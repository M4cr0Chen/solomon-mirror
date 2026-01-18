# Supabase Database Schema

This directory contains the database schema for **The Mirror** self-discovery engine.

## Overview

The schema supports:
- **Journal System**: Vector embeddings (768-dim Gemini) with RAG semantic search
- **Chat System**: Multi-agent conversations with 50+ mentor personas
- **Meditation System**: Session tracking with reflections and AI insights
- **Analytics**: Mentor selection tracking and user activity monitoring

## Quick Start

### 1. Create a New Supabase Project

```bash
# Visit https://supabase.com/dashboard
# Create a new project and note your credentials
```

### 2. Run the Schema

Option A - Via Supabase Dashboard:
1. Go to SQL Editor in your Supabase project
2. Copy the contents of `schema.sql`
3. Paste and run

Option B - Via Supabase CLI:
```bash
supabase db reset
supabase db push
```

### 3. Update Backend Configuration

Update your `.env` file with Supabase credentials:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
```

## Schema Structure

### Core Tables

| Table | Purpose | Key Features |
|-------|---------|--------------|
| `user_profiles` | User preferences and settings | Display name, meditation preferences, theme |
| `journal_entries` | Journal entries with embeddings | pgvector (768-dim), mood tags, topics |
| `journal_followups` | Deep journaling workflow | Links questions → answers → synthesized entries |
| `chat_sessions` | Conversation tracking | Mentor context, session metadata |
| `chat_messages` | Individual messages | Role, content, agent persona |
| `conversation_history` | LangGraph state persistence | Serialized AgentState in JSONB |
| `meditation_sessions` | Meditation tracking | Duration, completion status, stage |
| `meditation_reflections` | Post-meditation insights | User reflection + AI-generated insight |
| `mentor_selections` | Analytics | Which mentors resonate with users |

### RAG Functions

#### `match_journal_entries()`
Performs vector similarity search on journal entries.

**Parameters:**
- `query_embedding`: VECTOR(768) - Gemini embedding of user query
- `match_threshold`: FLOAT - Minimum similarity score (0.0-1.0)
- `match_count`: INT - Max results to return
- `target_user_id`: UUID - User ID for filtering

**Returns:**
```sql
TABLE (
    id UUID,
    content TEXT,
    similarity FLOAT,
    created_at TIMESTAMPTZ
)
```

**Example Usage:**
```python
from app.database import supabase
from app.services.embeddings import get_embedding

# Generate embedding
query_embedding = get_embedding("What did I learn about managing stress?")

# Search journal entries
result = supabase.rpc(
    'match_journal_entries',
    {
        'query_embedding': query_embedding,
        'match_threshold': 0.5,
        'match_count': 3,
        'target_user_id': user_id
    }
).execute()
```

#### `get_recent_journal_entries()`
Fallback function for when embeddings fail or quota exceeded.

**Parameters:**
- `target_user_id`: UUID
- `entry_count`: INT (default: 3)

## Security

All tables use **Row Level Security (RLS)** policies:
- Users can only access their own data
- Policies enforce user_id matching via `auth.uid()`
- Foreign key relationships maintain data integrity

## Indices

Optimized for common query patterns:
- **Vector search**: IVFFlat index on embeddings (lists=100)
- **Time-based queries**: Created_at indices with DESC ordering
- **User filtering**: Composite indices on (user_id, created_at)

## Key Changes from Original Implementation

This schema extends the basic implementation with:

1. **Conversation Persistence**: `conversation_history` table stores LangGraph state
2. **Enhanced Journal**: Added `journal_followups` for deep journaling workflow
3. **Meditation Reflections**: `meditation_reflections` persists post-session insights
4. **Analytics**: `mentor_selections` tracks user-mentor resonance
5. **User Profiles**: Stores preferences and settings
6. **Metadata**: Added mood_tags, topics, and embedding_model tracking

## Migration from In-Memory Storage

The backend currently uses in-memory storage for:
- Conversation states (`conversation_states` dict in `app/routers/chat.py`)
- Journal sessions (`journal_sessions` dict in `app/routers/journal.py`)

To persist this data:

```python
# Before: In-memory storage
conversation_states = {}

# After: Database storage
async def save_conversation_state(user_id: str, session_key: str, state: dict):
    supabase.table('conversation_history').upsert({
        'user_id': user_id,
        'session_key': session_key,
        'agent_state': state,
        'last_agent': state.get('current_agent'),
        'updated_at': 'now()'
    }).execute()

async def load_conversation_state(user_id: str, session_key: str):
    result = supabase.table('conversation_history')\
        .select('*')\
        .eq('user_id', user_id)\
        .eq('session_key', session_key)\
        .single()\
        .execute()
    return result.data['agent_state'] if result.data else None
```

## Maintenance

### Archiving Old Entries

```sql
-- Archive journal entries older than 1 year
UPDATE journal_entries
SET is_archived = true
WHERE created_at < NOW() - INTERVAL '1 year'
  AND is_archived = false;
```

### Analytics Queries

```sql
-- Most popular mentors
SELECT mentor_id, COUNT(*) as selection_count
FROM mentor_selections
GROUP BY mentor_id
ORDER BY selection_count DESC
LIMIT 10;

-- User engagement metrics
SELECT * FROM user_activity_summary
ORDER BY journal_entries_count DESC;
```

## Troubleshooting

### Vector Index Issues
If vector search is slow:
```sql
-- Rebuild IVFFlat index with more lists
DROP INDEX journal_entries_embedding_idx;
CREATE INDEX journal_entries_embedding_idx
    ON journal_entries USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 200);  -- Increase based on data size
```

### RLS Policy Testing
```sql
-- Test as a specific user
SET request.jwt.claim.sub = 'user-uuid-here';
SELECT * FROM journal_entries;  -- Should only see that user's data
```

## Resources

- [Supabase pgvector Documentation](https://supabase.com/docs/guides/ai/vector-embeddings)
- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [Gemini Embeddings API](https://ai.google.dev/tutorials/embeddings_quickstart)
