-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Journal entries table with vector embeddings (nullable for quota fallback)
CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(768),  -- Google Gemini embedding-001 dimensions (nullable)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS journal_entries_embedding_idx
ON journal_entries
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create index for user_id lookups
CREATE INDEX IF NOT EXISTS journal_entries_user_id_idx
ON journal_entries(user_id);

-- Function for similarity search
CREATE OR REPLACE FUNCTION match_journal_entries(
    query_embedding VECTOR(768),
    match_threshold FLOAT,
    match_count INT,
    user_id UUID
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        journal_entries.id,
        journal_entries.content,
        1 - (journal_entries.embedding <=> query_embedding) AS similarity
    FROM journal_entries
    WHERE journal_entries.user_id = match_journal_entries.user_id
        AND 1 - (journal_entries.embedding <=> query_embedding) > match_threshold
    ORDER BY journal_entries.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Meditation sessions table (for Phase 3)
CREATE TABLE IF NOT EXISTS meditation_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    duration INT,  -- Duration in seconds
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for meditation sessions
CREATE INDEX IF NOT EXISTS meditation_sessions_user_id_idx
ON meditation_sessions(user_id);

-- Row Level Security (RLS) policies
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE meditation_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own journal entries
CREATE POLICY "Users can view own journal entries"
ON journal_entries FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert their own journal entries
CREATE POLICY "Users can insert own journal entries"
ON journal_entries FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only see their own meditation sessions
CREATE POLICY "Users can view own meditation sessions"
ON meditation_sessions FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert their own meditation sessions
CREATE POLICY "Users can insert own meditation sessions"
ON meditation_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);
