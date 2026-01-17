import google.generativeai as genai
from app.config import get_settings
from app.database import get_supabase
from typing import List, Dict

settings = get_settings()
genai.configure(api_key=settings.google_api_key)
supabase = get_supabase()

def generate_embedding(text: str) -> List[float]:
    """Generate embedding vector for text using Gemini"""
    try:
        # Use Gemini embedding model
        result = genai.embed_content(
            model="models/text-embedding-004",  # Latest Gemini embedding model
            content=text,
            task_type="retrieval_document"
        )
        return result['embedding']
    except Exception as e:
        print(f"Embedding error: {str(e)}")
        raise Exception(f"Failed to generate embedding: {str(e)}")

async def ingest_journal(user_id: str, content: str) -> Dict:
    """Ingest a journal entry with vector embedding (or without if quota exceeded)"""
    try:
        # Try to generate embedding
        try:
            embedding = generate_embedding(content)
            print(f"Generated embedding with {len(embedding)} dimensions")
        except Exception as embed_error:
            print(f"Embedding failed (quota?), storing without embedding: {str(embed_error)}")
            embedding = None

        # Store in Supabase
        result = supabase.table("journal_entries").insert({
            "user_id": user_id,
            "content": content,
            "embedding": embedding
        }).execute()

        return {
            "id": result.data[0]["id"],
            "message": "Journal entry ingested successfully" + (" (without embeddings)" if not embedding else "")
        }
    except Exception as e:
        print(f"Ingest error: {str(e)}")
        raise Exception(f"Failed to ingest journal entry: {str(e)}")

async def search_memories(user_id: str, query: str, top_k: int = 3) -> List[str]:
    """Search user's journal entries using semantic similarity (or fallback to recent entries)"""
    try:
        # Try semantic search first
        try:
            # Use Gemini embeddings for query
            result = genai.embed_content(
                model="models/text-embedding-004",
                content=query,
                task_type="retrieval_query"
            )
            query_embedding = result['embedding']

            # Perform similarity search using the RPC function
            search_result = supabase.rpc('match_journal_entries', {
                'query_embedding': query_embedding,
                'match_threshold': 0.7,
                'match_count': top_k,
                'user_id': user_id
            }).execute()

            if search_result.data:
                return [entry['content'] for entry in search_result.data]
        except Exception as embed_error:
            print(f"Semantic search failed, falling back to recent entries: {str(embed_error)}")

        # Fallback: Just get recent journal entries
        fallback_result = supabase.table("journal_entries").select("content").eq("user_id", user_id).order("created_at", desc=True).limit(top_k).execute()

        if fallback_result.data:
            print(f"Returning {len(fallback_result.data)} recent entries as fallback")
            return [entry['content'] for entry in fallback_result.data]

        return []

    except Exception as e:
        # If everything fails, return empty list (graceful degradation)
        print(f"Search error: {str(e)}")
        return []

async def get_user_context(user_id: str, query: str) -> str:
    """Get relevant user context for a query"""
    memories = await search_memories(user_id, query, top_k=3)

    if not memories:
        return "No previous journal entries found."

    context = "Relevant memories from your past:\n\n"
    for i, memory in enumerate(memories, 1):
        context += f"{i}. {memory}\n\n"

    return context.strip()
