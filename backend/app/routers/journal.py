from fastapi import APIRouter, HTTPException, Depends
from app.models.schemas import JournalEntryCreate, JournalSearchRequest
from app.services.rag import ingest_journal, search_memories
from typing import Dict, List

router = APIRouter()

# Demo user UUID for hackathon (bypassing auth)
DEMO_USER_ID = "00000000-0000-0000-0000-000000000001"

@router.post("/ingest")
async def ingest_entry(entry: JournalEntryCreate, user_id: str = DEMO_USER_ID) -> Dict:
    """
    Ingest a journal entry and generate embedding

    For hackathon: Using demo UUID as default
    In production: Extract user_id from auth token
    """
    try:
        print(f"[JOURNAL] Ingesting entry for user: {user_id}")
        print(f"[JOURNAL] Content length: {len(entry.content)} chars")
        result = await ingest_journal(user_id, entry.content)
        print(f"[JOURNAL] Ingest successful: {result}")
        return result
    except Exception as e:
        print(f"[JOURNAL ERROR] {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/search")
async def search_entries(request: JournalSearchRequest, user_id: str = DEMO_USER_ID) -> Dict:
    """
    Search journal entries using semantic similarity

    For hackathon: Using demo UUID as default
    In production: Extract user_id from auth token
    """
    try:
        memories = await search_memories(user_id, request.query, request.top_k)
        return {
            "query": request.query,
            "results": memories,
            "count": len(memories)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
