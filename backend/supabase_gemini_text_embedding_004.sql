-- Update to use Gemini text-embedding-004 (768 dimensions)
-- Run this in Supabase SQL Editor

-- Drop existing function and table
DROP FUNCTION IF EXISTS match_journal_entries;
DROP TABLE IF EXISTS journal_entries CASCADE;

-- Recreate table with Gemini text-embedding-004 dimensions
CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
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

-- Re-enable RLS
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

-- Recreate policies
CREATE POLICY "Users can view own journal entries"
ON journal_entries FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own journal entries"
ON journal_entries FOR INSERT
WITH CHECK (auth.uid() = user_id);
