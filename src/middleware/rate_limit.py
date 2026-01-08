"""
Rate Limiting Middleware for API Protection

Implements token bucket algorithm for rate limiting requests per IP address.
Prevents API abuse and ensures fair usage across clients.
"""
import time
from typing import Dict, Tuple
from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from ..logging_config import get_logger
from ..config import settings

logger = get_logger("middleware.rate_limit")


class TokenBucket:
    """Token bucket algorithm for rate limiting."""
    
    def __init__(self, capacity: int, refill_rate: float):
        """
        Initialize token bucket.
        
        Args:
            capacity: Maximum number of tokens
            refill_rate: Tokens added per second
        """
        self.capacity = capacity
        self.refill_rate = refill_rate
        self.tokens = capacity
        self.last_refill = time.time()
    
    def consume(self, tokens: int = 1) -> bool:
        """
        Try to consume tokens from the bucket.
        
        Args:
            tokens: Number of tokens to consume
            
        Returns:
            True if tokens were consumed, False if rate limit exceeded
        """
        # Refill tokens based on time passed
        now = time.time()
        time_passed = now - self.last_refill
        self.tokens = min(
            self.capacity,
            self.tokens + time_passed * self.refill_rate
        )
        self.last_refill = now
        
        # Check if we have enough tokens
        if self.tokens >= tokens:
            self.tokens -= tokens
            return True
        return False


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting middleware using token bucket algorithm.
    
    Features:
    - Per-IP rate limiting
    - Configurable limits via environment variables
    - Automatic cleanup of old buckets
    - Detailed logging of rate limit violations
    """
    
    def __init__(
        self,
        app,
        requests_per_minute: int = 60,
        burst_size: int = 10,
        cleanup_interval: int = 300
    ):
        """
        Initialize rate limiting middleware.
        
        Args:
            app: FastAPI application
            requests_per_minute: Sustained requests allowed per minute
            burst_size: Maximum burst of requests allowed
            cleanup_interval: Seconds between bucket cleanup
        """
        super().__init__(app)
        self.buckets: Dict[str, TokenBucket] = {}
        self.requests_per_minute = requests_per_minute
        self.burst_size = burst_size
        self.cleanup_interval = cleanup_interval
        self.last_cleanup = time.time()
        
        # Calculate refill rate (tokens per second)
        self.refill_rate = requests_per_minute / 60.0
        
        logger.info(
            f"Rate limiting enabled: {requests_per_minute} req/min, "
            f"burst: {burst_size}"
        )
    
    def _get_client_ip(self, request: Request) -> str:
        """
        Extract client IP from request.
        
        Handles X-Forwarded-For header for proxied requests.
        """
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"
    
    def _cleanup_old_buckets(self):
        """Remove inactive buckets to prevent memory leaks."""
        now = time.time()
        if now - self.last_cleanup < self.cleanup_interval:
            return
        
        # Remove buckets that haven't been used in 10 minutes
        cutoff = now - 600
        to_remove = [
            ip for ip, bucket in self.buckets.items()
            if bucket.last_refill < cutoff
        ]
        
        for ip in to_remove:
            del self.buckets[ip]
        
        if to_remove:
            logger.debug(f"Cleaned up {len(to_remove)} inactive rate limit buckets")
        
        self.last_cleanup = now
    
    async def dispatch(self, request: Request, call_next) -> Response:
        """
        Process request with rate limiting.
        
        Raises:
            HTTPException: If rate limit is exceeded
        """
        # Skip rate limiting for health checks
        if request.url.path in ["/health", "/metrics"]:
            return await call_next(request)
        
        # Cleanup old buckets periodically
        self._cleanup_old_buckets()
        
        # Get client IP
        client_ip = self._get_client_ip(request)
        
        # Get or create token bucket for this IP
        if client_ip not in self.buckets:
            self.buckets[client_ip] = TokenBucket(
                capacity=self.burst_size,
                refill_rate=self.refill_rate
            )
        
        bucket = self.buckets[client_ip]
        
        # Try to consume a token
        if not bucket.consume():
            logger.warning(
                f"Rate limit exceeded for {client_ip} on {request.method} "
                f"{request.url.path}"
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "error": "Rate limit exceeded",
                    "message": f"Too many requests. Limit: {self.requests_per_minute} requests per minute.",
                    "retry_after": int(1.0 / self.refill_rate)
                }
            )
        
        # Process request
        response = await call_next(request)
        
        # Add rate limit headers
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(int(bucket.tokens))
        response.headers["X-RateLimit-Reset"] = str(
            int(time.time() + (self.burst_size - bucket.tokens) / self.refill_rate)
        )
        
        return response


def get_rate_limit_middleware(
    requests_per_minute: int = None,
    burst_size: int = None
) -> RateLimitMiddleware:
    """
    Factory function to create rate limit middleware with settings.
    
    Args:
        requests_per_minute: Override default rate limit
        burst_size: Override default burst size
        
    Returns:
        Configured RateLimitMiddleware instance
    """
    # Get from environment or use defaults
    rpm = requests_per_minute or getattr(settings, 'RATE_LIMIT', 60)
    burst = burst_size or getattr(settings, 'RATE_LIMIT_BURST', 10)
    
    return lambda app: RateLimitMiddleware(
        app,
        requests_per_minute=rpm,
        burst_size=burst
    )
