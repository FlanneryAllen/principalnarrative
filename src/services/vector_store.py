"""
Vector Store Service - ChromaDB integration for semantic search.

Provides:
- Embedding storage for narrative documents
- Semantic similarity search
- Context retrieval for agents
"""
import os
import hashlib
from pathlib import Path
from ..logging_config import get_logger

from typing import Optional, List, Dict, Any
from dataclasses import dataclass

try:
    import chromadb
    from chromadb.config import Settings
    CHROMADB_AVAILABLE = True
except ImportError:
    CHROMADB_AVAILABLE = False

from ..config import settings

logger = get_logger("services.vector_store")


@dataclass
class SearchResult:
    """Result from semantic search."""
    path: str
    content: str
    score: float
    metadata: Dict[str, Any]


class VectorStore:
    """
    ChromaDB-powered vector store for narrative documents.

    Features:
    - Automatic embedding of narrative documents
    - Semantic similarity search
    - Metadata filtering
    - Collection management by layer
    """

    COLLECTION_NAME = "principal_narrative"

    def __init__(self, persist_dir: Optional[Path] = None):
        """Initialize vector store with optional persistence directory."""
        self.persist_dir = persist_dir or (settings.narrative_base_path.parent / ".chroma")
        self.client = None
        self.collection = None

        if CHROMADB_AVAILABLE:
            self._initialize()

    def _initialize(self):
        """Initialize ChromaDB client and collection."""
        try:
            # Create persistent client
            self.client = chromadb.PersistentClient(
                path=str(self.persist_dir),
                settings=Settings(
                    anonymized_telemetry=False,
                    allow_reset=True
                )
            )

            # Get or create collection
            self.collection = self.client.get_or_create_collection(
                name=self.COLLECTION_NAME,
                metadata={"description": "Principal Narrative document embeddings"}
            )

        except Exception as e:
            logger.error(f"ChromaDB initialization error: {e}", exc_info=True)
            self.client = None
            self.collection = None

    @property
    def is_available(self) -> bool:
        """Check if vector store is available."""
        return self.collection is not None

    def _doc_id(self, path: str) -> str:
        """Generate a stable document ID from path."""
        return hashlib.md5(path.encode()).hexdigest()

    def add_document(
        self,
        path: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Add or update a document in the vector store.

        Args:
            path: Document path (used as ID)
            content: Document content to embed
            metadata: Optional metadata for filtering

        Returns:
            True if successful
        """
        if not self.is_available:
            return False

        try:
            doc_id = self._doc_id(path)
            doc_metadata = {
                "path": path,
                "layer": self._extract_layer(path),
                **(metadata or {})
            }

            # Upsert document
            self.collection.upsert(
                ids=[doc_id],
                documents=[content],
                metadatas=[doc_metadata]
            )
            return True

        except Exception as e:
            print(f"Error adding document: {e}")
            return False

    def add_documents(self, documents: List[Dict[str, Any]]) -> int:
        """
        Batch add documents.

        Args:
            documents: List of dicts with 'path', 'content', 'metadata'

        Returns:
            Number of documents added
        """
        if not self.is_available:
            return 0

        try:
            ids = [self._doc_id(d["path"]) for d in documents]
            contents = [d["content"] for d in documents]
            metadatas = [
                {
                    "path": d["path"],
                    "layer": self._extract_layer(d["path"]),
                    **(d.get("metadata", {}))
                }
                for d in documents
            ]

            self.collection.upsert(
                ids=ids,
                documents=contents,
                metadatas=metadatas
            )
            return len(documents)

        except Exception as e:
            print(f"Error batch adding documents: {e}")
            return 0

    def search(
        self,
        query: str,
        n_results: int = 5,
        layer: Optional[str] = None,
        min_score: float = 0.0
    ) -> List[SearchResult]:
        """
        Semantic search for documents.

        Args:
            query: Search query
            n_results: Maximum number of results
            layer: Optional layer filter (strategy, messaging, etc.)
            min_score: Minimum similarity score (0-1)

        Returns:
            List of search results sorted by relevance
        """
        if not self.is_available:
            return []

        try:
            # Build where filter
            where_filter = None
            if layer:
                where_filter = {"layer": layer}

            # Query collection
            results = self.collection.query(
                query_texts=[query],
                n_results=n_results,
                where=where_filter,
                include=["documents", "metadatas", "distances"]
            )

            # Convert to SearchResult objects
            search_results = []
            if results["ids"] and results["ids"][0]:
                for i, doc_id in enumerate(results["ids"][0]):
                    # ChromaDB returns L2 distance, convert to similarity score
                    distance = results["distances"][0][i] if results["distances"] else 0
                    score = 1 / (1 + distance)  # Convert distance to similarity

                    if score >= min_score:
                        search_results.append(SearchResult(
                            path=results["metadatas"][0][i].get("path", ""),
                            content=results["documents"][0][i],
                            score=score,
                            metadata=results["metadatas"][0][i]
                        ))

            return search_results

        except Exception as e:
            logger.error(f"Search error: {e}", exc_info=True)
            return []

    def search_similar(
        self,
        document_path: str,
        n_results: int = 5
    ) -> List[SearchResult]:
        """
        Find documents similar to a given document.

        Args:
            document_path: Path to the reference document
            n_results: Number of results to return

        Returns:
            Similar documents (excluding the reference)
        """
        if not self.is_available:
            return []

        try:
            doc_id = self._doc_id(document_path)

            # Get the document's embedding
            result = self.collection.get(
                ids=[doc_id],
                include=["embeddings"]
            )

            if not result["embeddings"]:
                return []

            # Query by embedding
            results = self.collection.query(
                query_embeddings=result["embeddings"],
                n_results=n_results + 1,  # +1 to exclude self
                include=["documents", "metadatas", "distances"]
            )

            # Convert and filter out the reference document
            search_results = []
            if results["ids"] and results["ids"][0]:
                for i, rid in enumerate(results["ids"][0]):
                    if rid != doc_id:
                        distance = results["distances"][0][i] if results["distances"] else 0
                        score = 1 / (1 + distance)

                        search_results.append(SearchResult(
                            path=results["metadatas"][0][i].get("path", ""),
                            content=results["documents"][0][i],
                            score=score,
                            metadata=results["metadatas"][0][i]
                        ))

            return search_results[:n_results]

        except Exception as e:
            logger.error(f"Similar search error: {e}", exc_info=True)
            return []

    def delete_document(self, path: str) -> bool:
        """Delete a document from the vector store."""
        if not self.is_available:
            return False

        try:
            doc_id = self._doc_id(path)
            self.collection.delete(ids=[doc_id])
            return True
        except Exception as e:
            logger.error(f"Delete error: {e}", exc_info=True)
            return False

    def get_stats(self) -> Dict[str, Any]:
        """Get statistics about the vector store."""
        if not self.is_available:
            return {"available": False}

        try:
            count = self.collection.count()

            # Get layer distribution
            all_docs = self.collection.get(include=["metadatas"])
            layers = {}
            for meta in all_docs.get("metadatas", []):
                layer = meta.get("layer", "unknown")
                layers[layer] = layers.get(layer, 0) + 1

            return {
                "available": True,
                "total_documents": count,
                "by_layer": layers,
                "persist_dir": str(self.persist_dir)
            }
        except Exception as e:
            return {"available": True, "error": str(e)}

    def index_narrative_layer(self, base_path: Optional[Path] = None) -> int:
        """
        Index all documents in the narrative layer.

        Returns number of documents indexed.
        """
        if not self.is_available:
            return 0

        base = base_path or settings.narrative_base_path
        if not base.exists():
            return 0

        documents = []

        # Find all markdown and json files
        for ext in ["*.md", "*.json"]:
            for file_path in base.rglob(ext):
                try:
                    content = file_path.read_text()
                    rel_path = str(file_path.relative_to(base.parent))

                    documents.append({
                        "path": rel_path,
                        "content": content,
                        "metadata": {
                            "filename": file_path.name,
                            "extension": file_path.suffix
                        }
                    })
                except Exception as e:
                    print(f"Error reading {file_path}: {e}")

        return self.add_documents(documents)

    def _extract_layer(self, path: str) -> str:
        """Extract the narrative layer from a path."""
        parts = path.replace("\\", "/").split("/")

        layers = ["strategy", "messaging", "naming", "marketing",
                  "proof", "story", "constraints", "definitions", "coherence"]

        for part in parts:
            if part in layers:
                return part

        return "unknown"

    def reset(self) -> bool:
        """Reset the vector store (delete all documents)."""
        if not self.is_available:
            return False

        try:
            self.client.delete_collection(self.COLLECTION_NAME)
            self.collection = self.client.create_collection(
                name=self.COLLECTION_NAME,
                metadata={"description": "Principal Narrative document embeddings"}
            )
            return True
        except Exception as e:
            logger.error(f"Reset error: {e}", exc_info=True)
            return False


# Singleton instance
_vector_store: Optional[VectorStore] = None


def get_vector_store() -> VectorStore:
    """Get or create the vector store singleton."""
    global _vector_store
    if _vector_store is None:
        _vector_store = VectorStore()
    return _vector_store
