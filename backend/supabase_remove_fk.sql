-- Remove foreign key constraint for hackathon (bypassing auth)
-- Run this in Supabase SQL Editor

-- Drop existing table and function
DROP FUNCTION IF EXISTS match_journal_entries;
DROP TABLE IF EXISTS journal_entries CASCADE;

-- Recreate table WITHOUT foreign key constraint (for hackathon demo)
CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,  -- No FK constraint - just storing UUID
    content TEXT NOT NULL,
    embedding VECTOR(768),  -- Gemini text-embedding-004 dimensions
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for vector similarity search
CREATE INDEX journal_entries_embedding_idx
ON journal_entries
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create index for user_id lookups
CREATE INDEX journal_entries_user_id_idx
ON journal_entries(user_id);

-- Recreate function for similarity search
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

-- Note: No RLS policies needed since we're not using auth.users
