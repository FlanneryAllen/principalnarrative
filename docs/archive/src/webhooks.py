"""
Webhook handlers for Slack and GitHub events.

These endpoints receive real-time events and process them through the ingestion pipeline.
"""
import hmac
import hashlib
from fastapi import APIRouter, Request, HTTPException, Header
from typing import Optional

from .services import get_ingestion_service

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


# ============================================================================
# Slack Webhooks
# ============================================================================

@router.post("/slack/events")
async def slack_events(
    request: Request,
    x_slack_signature: Optional[str] = Header(None),
    x_slack_request_timestamp: Optional[str] = Header(None)
):
    """
    Handle Slack Events API webhook.

    Configure in Slack App settings:
    - Event Subscriptions URL: https://your-domain/webhooks/slack/events
    - Subscribe to: message.channels, message.groups

    Set SLACK_SIGNING_SECRET environment variable for verification.
    """
    body = await request.body()
    json_body = await request.json()

    # Handle URL verification challenge
    if json_body.get("type") == "url_verification":
        return {"challenge": json_body.get("challenge")}

    # Process event
    event = json_body.get("event", {})
    service = get_ingestion_service()

    item = service.handle_slack_event(event)

    if item:
        # Process through synthesizer
        result = service.process_items([item], auto_save=False)
        return {
            "status": "processed",
            "documents_generated": result.documents_generated
        }

    return {"status": "ignored", "reason": "not context-relevant"}


@router.post("/slack/interactive")
async def slack_interactive(request: Request):
    """
    Handle Slack interactive components (buttons, modals).

    Use this for approval workflows on synthesized documents.
    """
    form_data = await request.form()
    payload = form_data.get("payload")

    if not payload:
        raise HTTPException(status_code=400, detail="Missing payload")

    import json
    data = json.loads(payload)

    action_type = data.get("type")

    if action_type == "block_actions":
        # Handle button clicks
        actions = data.get("actions", [])
        for action in actions:
            action_id = action.get("action_id")
            if action_id == "approve_document":
                # Approve and save document
                return {"response_action": "clear"}
            elif action_id == "reject_document":
                # Reject document
                return {"response_action": "clear"}

    return {"status": "ok"}


# ============================================================================
# GitHub Webhooks
# ============================================================================

@router.post("/github")
async def github_webhook(
    request: Request,
    x_hub_signature_256: Optional[str] = Header(None),
    x_github_event: Optional[str] = Header(None)
):
    """
    Handle GitHub webhook events.

    Configure in GitHub repo settings:
    - Payload URL: https://your-domain/webhooks/github
    - Content type: application/json
    - Events: Issues, Pull requests, Discussions

    Set GITHUB_WEBHOOK_SECRET environment variable for verification.
    """
    body = await request.body()
    json_body = await request.json()

    event_type = x_github_event or "unknown"
    service = get_ingestion_service()

    item = service.handle_github_webhook(json_body, event_type)

    if item:
        result = service.process_items([item], auto_save=False)
        return {
            "status": "processed",
            "event": event_type,
            "documents_generated": result.documents_generated
        }

    return {"status": "ignored", "event": event_type}


@router.post("/github/comment")
async def github_comment_trigger(
    request: Request,
    x_github_event: Optional[str] = Header(None)
):
    """
    Handle GitHub issue/PR comments that trigger context extraction.

    Trigger by commenting: `/extract-context` on an issue or PR.
    """
    json_body = await request.json()

    if x_github_event not in ["issue_comment", "pull_request_review_comment"]:
        return {"status": "ignored", "reason": "not a comment event"}

    comment = json_body.get("comment", {})
    body = comment.get("body", "")

    # Check for trigger command
    if "/extract-context" not in body:
        return {"status": "ignored", "reason": "no trigger command"}

    # Extract context from the issue/PR
    service = get_ingestion_service()

    if "issue" in json_body:
        issue = json_body["issue"]
        repo = json_body.get("repository", {}).get("full_name")

        if repo and issue.get("number"):
            item = service.fetch_github_issue(repo, issue["number"])
            if item:
                result = service.process_items([item], auto_save=True)
                return {
                    "status": "extracted",
                    "issue": f"{repo}#{issue['number']}",
                    "documents_generated": result.documents_generated
                }

    return {"status": "failed", "reason": "could not extract context"}


# ============================================================================
# Generic Webhook
# ============================================================================

@router.post("/ingest")
async def generic_ingest_webhook(request: Request):
    """
    Generic webhook for ingesting context from any source.

    Send JSON with:
    {
        "text": "Content to process",
        "source": "source-name",
        "metadata": {...}
    }
    """
    json_body = await request.json()

    text = json_body.get("text")
    source = json_body.get("source", "webhook")

    if not text:
        raise HTTPException(status_code=400, detail="Missing 'text' field")

    service = get_ingestion_service()
    item = service.ingest_text(text, source)

    result = service.process_items([item], auto_save=False)

    return {
        "status": "processed",
        "source": source,
        "documents_generated": result.documents_generated,
        "errors": result.errors
    }
