# Migration Guide: From In-Memory to Database Persistence

This guide shows how to update the FastAPI backend to use the new database schema instead of in-memory storage.

## Overview

Current implementation uses Python dicts for state management:
- `conversation_states = {}` in `app/routers/chat.py:11`
- `journal_sessions = {}` in `app/routers/journal.py:205`

This guide shows how to persist this data to Supabase.

---

## 1. Conversation State Persistence

### Current Implementation (`app/routers/chat.py`)

```python
# In-memory storage (lost on restart)
conversation_states = {}

@router.post("/message")
async def chat_message(request: ChatRequest):
    user_id = request.user_id or "default_user"

    if user_id not in conversation_states:
        conversation_states[user_id] = agent.get_initial_state(user_id)

    state = conversation_states[user_id]
    # ... process message
    conversation_states[user_id] = updated_state
```

### Updated Implementation (with Database)

Create a new service file `app/services/conversation_store.py`:

```python
from app.database import supabase
from app.agents.orchestrator import AgentState
from typing import Optional
import json

class ConversationStore:
    """Manages conversation state persistence in Supabase"""

    @staticmethod
    async def load_state(user_id: str, session_key: str = "default") -> Optional[dict]:
        """Load conversation state from database"""
        try:
            result = supabase.table('conversation_history')\
                .select('*')\
                .eq('user_id', user_id)\
                .eq('session_key', session_key)\
                .order('updated_at', desc=True)\
                .limit(1)\
                .execute()

            if result.data:
                return result.data[0]['agent_state']
            return None
        except Exception as e:
            print(f"Error loading conversation state: {e}")
            return None

    @staticmethod
    async def save_state(user_id: str, state: dict, session_key: str = "default"):
        """Save conversation state to database"""
        try:
            supabase.table('conversation_history').upsert({
                'user_id': user_id,
                'session_key': session_key,
                'agent_state': state,
                'last_agent': state.get('current_agent'),
                'updated_at': 'now()'
            }, on_conflict='user_id,session_key').execute()
        except Exception as e:
            print(f"Error saving conversation state: {e}")

    @staticmethod
    async def clear_state(user_id: str, session_key: str = "default"):
        """Clear conversation state from database"""
        try:
            supabase.table('conversation_history')\
                .delete()\
                .eq('user_id', user_id)\
                .eq('session_key', session_key)\
                .execute()
        except Exception as e:
            print(f"Error clearing conversation state: {e}")
```

Update `app/routers/chat.py`:

```python
from app.services.conversation_store import ConversationStore

# Remove in-memory dict
# conversation_states = {}  # DELETE THIS

@router.post("/message")
async def chat_message(request: ChatRequest):
    user_id = request.user_id or "default_user"

    # Load from database instead of memory
    state = await ConversationStore.load_state(user_id)

    if state is None:
        state = agent.get_initial_state(user_id)

    # Process message
    updated_state = await agent.process_message(state, request.message)

    # Save to database instead of memory
    await ConversationStore.save_state(user_id, updated_state)

    return ChatResponse(
        message=updated_state["messages"][-1],
        agent=updated_state["current_agent"]
    )

@router.post("/reset")
async def reset_conversation(user_id: str = "default_user"):
    # Clear from database instead of memory
    await ConversationStore.clear_state(user_id)
    return {"status": "conversation reset"}
```

---

## 2. Journal Follow-up Persistence

### Current Implementation (`app/routers/journal.py`)

```python
# In-memory storage
journal_sessions = {}

@router.post("/follow-up")
async def process_follow_up(request: JournalFollowUpRequest):
    user_id = request.user_id or "default_user"

    if user_id not in journal_sessions:
        raise HTTPException(status_code=404, detail="No active journal session")

    session = journal_sessions[user_id]
    # ... process follow-up
```

### Updated Implementation (with Database)

Update `app/routers/journal.py`:

```python
@router.post("/follow-up")
async def process_follow_up(request: JournalFollowUpRequest):
    user_id = request.user_id or "default_user"

    # Get the original entry from the database
    try:
        original_entry = supabase.table('journal_entries')\
            .select('*')\
            .eq('id', request.entry_id)\
            .eq('user_id', user_id)\
            .single()\
            .execute()

        if not original_entry.data:
            raise HTTPException(status_code=404, detail="Original entry not found")

        # Store follow-up answer
        followup_data = {
            'original_entry_id': request.entry_id,
            'follow_up_question': request.question,
            'follow_up_answer': request.answer
        }

        followup_result = supabase.table('journal_followups')\
            .insert(followup_data)\
            .execute()

        # Synthesize deeper entry
        synthesized_content = await synthesize_entry(
            original_entry.data['content'],
            request.answer
        )

        # Create new journal entry with synthesis
        new_entry = {
            'user_id': user_id,
            'content': synthesized_content,
            'embedding': await get_embedding(synthesized_content)
        }

        new_entry_result = supabase.table('journal_entries')\
            .insert(new_entry)\
            .execute()

        # Link the synthesized entry back to the follow-up
        supabase.table('journal_followups')\
            .update({'synthesized_entry_id': new_entry_result.data[0]['id']})\
            .eq('id', followup_result.data[0]['id'])\
            .execute()

        return {
            "status": "success",
            "synthesized_entry": new_entry_result.data[0],
            "followup_id": followup_result.data[0]['id']
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

---

## 3. Chat Session Tracking

Add session tracking to chat endpoints:

```python
# app/routers/chat.py

@router.post("/message")
async def chat_message(request: ChatRequest):
    user_id = request.user_id or "default_user"

    # Load or create chat session
    session = await get_or_create_chat_session(user_id)

    # Load conversation state
    state = await ConversationStore.load_state(user_id)
    if state is None:
        state = agent.get_initial_state(user_id)

    # Process message
    updated_state = await agent.process_message(state, request.message)

    # Save conversation state
    await ConversationStore.save_state(user_id, updated_state)

    # Save message to chat_messages table
    await save_chat_message(
        session_id=session['id'],
        role='user',
        content=request.message
    )

    response_message = updated_state["messages"][-1]

    await save_chat_message(
        session_id=session['id'],
        role='assistant',
        content=response_message.content,
        agent_persona=updated_state["current_agent"]
    )

    # Track mentor selection if applicable
    if updated_state.get("selected_mentor"):
        await track_mentor_selection(
            user_id=user_id,
            session_id=session['id'],
            mentor_id=updated_state["selected_mentor"]["name"],
            context_keywords=updated_state.get("user_situation", "")
        )

    return ChatResponse(
        message=response_message,
        agent=updated_state["current_agent"]
    )

# Helper functions
async def get_or_create_chat_session(user_id: str):
    """Get active chat session or create new one"""
    result = supabase.table('chat_sessions')\
        .select('*')\
        .eq('user_id', user_id)\
        .is_('ended_at', 'null')\
        .order('started_at', desc=True)\
        .limit(1)\
        .execute()

    if result.data:
        return result.data[0]

    # Create new session
    new_session = supabase.table('chat_sessions')\
        .insert({'user_id': user_id})\
        .execute()

    return new_session.data[0]

async def save_chat_message(session_id: str, role: str, content: str, agent_persona: str = None):
    """Save individual chat message"""
    supabase.table('chat_messages').insert({
        'session_id': session_id,
        'role': role,
        'content': content,
        'agent_persona': agent_persona
    }).execute()

async def track_mentor_selection(user_id: str, session_id: str, mentor_id: str, context_keywords: str):
    """Track when a mentor is selected"""
    supabase.table('mentor_selections').insert({
        'user_id': user_id,
        'session_id': session_id,
        'mentor_id': mentor_id,
        'context_keywords': context_keywords
    }).execute()
```

---

## 4. Meditation Reflection Persistence

### Current Implementation (`app/routers/meditation.py`)

```python
@router.post("/reflection")
async def save_reflection(request: MeditationReflectionRequest):
    # Currently just returns AI insight without saving
    insight = await generate_insight(request.reflection)
    return {"insight": insight}
```

### Updated Implementation (with Database)

```python
@router.post("/reflection")
async def save_reflection(request: MeditationReflectionRequest):
    user_id = request.user_id or "default_user"

    # Generate AI insight
    insight = await generate_insight(request.reflection)

    # Find or create meditation session
    session = supabase.table('meditation_sessions')\
        .select('*')\
        .eq('user_id', user_id)\
        .eq('completed', False)\
        .order('created_at', desc=True)\
        .limit(1)\
        .execute()

    if not session.data:
        # Create session if none exists
        session = supabase.table('meditation_sessions')\
            .insert({
                'user_id': user_id,
                'duration': request.duration,
                'completed': True,
                'completed_at': 'now()'
            })\
            .execute()
        session_id = session.data[0]['id']
    else:
        session_id = session.data[0]['id']
        # Mark session as completed
        supabase.table('meditation_sessions')\
            .update({'completed': True, 'completed_at': 'now()'})\
            .eq('id', session_id)\
            .execute()

    # Save reflection
    supabase.table('meditation_reflections').insert({
        'session_id': session_id,
        'reflection_text': request.reflection,
        'ai_insight': insight,
        'emotional_state': request.emotional_state
    }).execute()

    # Optionally save to journal_entries for RAG
    if request.save_to_journal:
        journal_content = f"Meditation Reflection:\n{request.reflection}\n\nInsight: {insight}"
        embedding = await get_embedding(journal_content)

        supabase.table('journal_entries').insert({
            'user_id': user_id,
            'content': journal_content,
            'embedding': embedding,
            'mood_tags': ["meditative", request.emotional_state]
        }).execute()

    return {
        "insight": insight,
        "session_id": session_id,
        "saved": True
    }
```

---

## 5. User Profile Management

Add a new router `app/routers/profile.py`:

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.database import supabase

router = APIRouter(prefix="/api/profile", tags=["profile"])

class UserProfileUpdate(BaseModel):
    display_name: str | None = None
    bio: str | None = None
    preferred_meditation_duration: int | None = None
    preferred_mentor_category: str | None = None
    theme_preference: str | None = None

@router.get("")
async def get_profile(user_id: str):
    """Get user profile"""
    result = supabase.table('user_profiles')\
        .select('*')\
        .eq('id', user_id)\
        .single()\
        .execute()

    if not result.data:
        # Create default profile
        default_profile = supabase.table('user_profiles')\
            .insert({'id': user_id})\
            .execute()
        return default_profile.data[0]

    return result.data

@router.put("")
async def update_profile(user_id: str, profile: UserProfileUpdate):
    """Update user profile"""
    update_data = {k: v for k, v in profile.dict().items() if v is not None}

    result = supabase.table('user_profiles')\
        .upsert({'id': user_id, **update_data})\
        .execute()

    return result.data[0]

@router.get("/activity")
async def get_activity_summary(user_id: str):
    """Get user activity summary"""
    result = supabase.table('user_activity_summary')\
        .select('*')\
        .eq('user_id', user_id)\
        .single()\
        .execute()

    return result.data
```

Register in `app/main.py`:

```python
from app.routers import profile

app.include_router(profile.router)
```

---

## 6. Database Configuration

Ensure `app/database.py` is properly configured:

```python
from supabase import create_client, Client
from app.config import settings

supabase: Client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_KEY
)

# Test connection on startup
def test_connection():
    try:
        result = supabase.table('user_profiles').select('id').limit(1).execute()
        print("✓ Supabase connection successful")
        return True
    except Exception as e:
        print(f"✗ Supabase connection failed: {e}")
        return False
```

Update `app/main.py`:

```python
from app.database import test_connection

@app.on_event("startup")
async def startup_event():
    if not test_connection():
        print("Warning: Database connection failed. Some features may not work.")
```

---

## 7. Testing the Migration

### Test Conversation Persistence

```bash
# Terminal 1: Start server
uvicorn app.main:app --reload

# Terminal 2: Send messages
curl -X POST http://localhost:8000/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{"message": "I feel stressed about work", "user_id": "test-user"}'

# Restart server, then send another message
curl -X POST http://localhost:8000/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{"message": "What did we discuss?", "user_id": "test-user"}'

# Conversation should persist across restarts!
```

### Verify in Supabase Dashboard

1. Go to Table Editor
2. Check `conversation_history` table
3. Verify `agent_state` JSONB contains conversation data

---

## Rollback Plan

If issues occur, you can temporarily switch back to in-memory storage:

```python
# Add a config flag
USE_DATABASE_PERSISTENCE = os.getenv("USE_DB_PERSISTENCE", "true").lower() == "true"

# In conversation loading
if USE_DATABASE_PERSISTENCE:
    state = await ConversationStore.load_state(user_id)
else:
    state = conversation_states.get(user_id)
```

Set `USE_DB_PERSISTENCE=false` in `.env` to disable.

---

## Performance Considerations

1. **Connection Pooling**: Supabase Python client handles this automatically
2. **Caching**: Consider adding Redis for frequently accessed conversation states
3. **Batch Operations**: Use `.upsert()` with multiple records when possible
4. **Index Tuning**: Monitor query performance in Supabase Dashboard

---

## Next Steps

1. ✅ Run `schema.sql` in Supabase Dashboard
2. ✅ Update `.env` with Supabase credentials
3. ✅ Implement `ConversationStore` service
4. ✅ Update chat router to use database
5. ✅ Update journal router for follow-ups
6. ✅ Update meditation router for reflections
7. ✅ Add profile router
8. ✅ Test all endpoints
9. ✅ Monitor performance
10. ✅ Deploy to production

Happy coding! 🚀
