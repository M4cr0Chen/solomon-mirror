-- Make embedding column nullable to support storing entries without embeddings
-- Run this in Supabase SQL Editor if you get errors about NULL embeddings

ALTER TABLE journal_entries
ALTER COLUMN embedding DROP NOT NULL;
