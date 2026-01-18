-- =====================================================
-- The Mirror - Supabase Database Schema
-- Self-Discovery Engine with RAG and Multi-Agent System
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- USER PROFILES
-- =====================================================

CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name VARCHAR(255),
    bio TEXT,
    preferred_meditation_duration INT DEFAULT 300,  -- Duration in seconds
    preferred_mentor_category VARCHAR(50),  -- "philosopher", "psychologist", "leader", "artist"
    theme_preference VARCHAR(20) DEFAULT 'dark',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- JOURNAL SYSTEM
-- =====================================================

-- Main journal entries table with vector embeddings for RAG
CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(768),  -- Gemini text-embedding-004 dimensions
    mood_tags JSONB,  -- e.g., ["anxious", "hopeful", "confused"]
    topics JSONB,  -- e.g., ["work", "relationships", "health"]
    embedding_model VARCHAR(50) DEFAULT 'gemini-text-embedding-004',
    is_archived BOOLEAN DEFAULT FALSE,
    public_visibility BOOLEAN DEFAULT FALSE,  -- For future social features
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track journal follow-up questions and synthesized entries
CREATE TABLE journal_followups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    original_entry_id UUID REFERENCES journal_entries(id) ON DELETE CASCADE NOT NULL,
    follow_up_question TEXT,
    follow_up_answer TEXT,
    synthesized_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for journal_entries
CREATE INDEX journal_entries_user_created_idx
    ON journal_entries(user_id, created_at DESC);

CREATE INDEX journal_entries_embedding_idx
    ON journal_entries USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX journal_entries_archived_idx
    ON journal_entries(user_id, is_archived);

-- =====================================================
-- CHAT & CONVERSATION SYSTEM
-- =====================================================

-- Chat sessions with mentor context
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    session_name VARCHAR(255),
    mentor_id VARCHAR(255),  -- e.g., "marcus_aurelius", "rumi", "maya_angelou"
    user_situation TEXT,  -- Context provided by user
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual chat messages within sessions
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE NOT NULL,
    role VARCHAR(20) NOT NULL,  -- "user" or "assistant"
    content TEXT NOT NULL,
    agent_persona VARCHAR(255),  -- Which mentor/agent responded
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Persistent conversation state for LangGraph agent system
CREATE TABLE conversation_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    session_key VARCHAR(100) NOT NULL,  -- Maps to conversation_states dict key
    agent_state JSONB,  -- Serialized AgentState (messages, context, current_agent, etc.)
    last_agent VARCHAR(50),  -- "router", "mindfulness", "discovery", "wise_mentor"
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for chat tables
CREATE INDEX chat_sessions_user_idx
    ON chat_sessions(user_id, created_at DESC);

CREATE INDEX chat_messages_session_idx
    ON chat_messages(session_id, created_at);

CREATE INDEX conversation_history_idx
    ON conversation_history(user_id, session_key);

-- =====================================================
-- MEDITATION SYSTEM
-- =====================================================

-- Meditation session tracking
CREATE TABLE meditation_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    duration INT,  -- Duration in seconds
    completed BOOLEAN DEFAULT FALSE,
    stage_reached VARCHAR(50),  -- "welcome", "breathing", "body_scan", "guided", "closing"
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Post-meditation reflections and AI insights
CREATE TABLE meditation_reflections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES meditation_sessions(id) ON DELETE CASCADE NOT NULL,
    reflection_text TEXT,
    ai_insight TEXT,  -- Generated by Gemini based on reflection
    emotional_state VARCHAR(50),  -- "calm", "energized", "peaceful", "focused"
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for meditation tables
CREATE INDEX meditation_sessions_user_idx
    ON meditation_sessions(user_id, completed, created_at DESC);

CREATE INDEX meditation_reflections_session_idx
    ON meditation_reflections(session_id);

-- =====================================================
-- ANALYTICS & TRACKING
-- =====================================================

-- Track which mentors users connect with for personalization
CREATE TABLE mentor_selections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    mentor_id VARCHAR(255) NOT NULL,  -- "marcus_aurelius", "carl_jung", etc.
    context_keywords TEXT,  -- What prompted this mentor selection
    session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
    selected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX mentor_selections_user_idx
    ON mentor_selections(user_id, selected_at DESC);

-- =====================================================
-- RAG FUNCTIONS
-- =====================================================

-- Vector similarity search for journal entries (RAG)
CREATE OR REPLACE FUNCTION match_journal_entries(
    query_embedding VECTOR(768),
    match_threshold FLOAT,
    match_count INT,
    target_user_id UUID
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    similarity FLOAT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        journal_entries.id,
        journal_entries.content,
        1 - (journal_entries.embedding <=> query_embedding) AS similarity,
        journal_entries.created_at
    FROM journal_entries
    WHERE journal_entries.user_id = target_user_id
        AND journal_entries.is_archived = FALSE
        AND journal_entries.embedding IS NOT NULL
        AND 1 - (journal_entries.embedding <=> query_embedding) > match_threshold
    ORDER BY journal_entries.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Get recent journal entries when embeddings fail or as fallback
CREATE OR REPLACE FUNCTION get_recent_journal_entries(
    target_user_id UUID,
    entry_count INT DEFAULT 3
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        journal_entries.id,
        journal_entries.content,
        journal_entries.created_at
    FROM journal_entries
    WHERE journal_entries.user_id = target_user_id
        AND journal_entries.is_archived = FALSE
    ORDER BY journal_entries.created_at DESC
    LIMIT entry_count;
END;
$$;

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all user tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE meditation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meditation_reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_selections ENABLE ROW LEVEL SECURITY;

-- User Profiles policies
CREATE POLICY "Users can view own profile"
    ON user_profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON user_profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON user_profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Journal Entries policies
CREATE POLICY "Users can view own journal entries"
    ON journal_entries FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own journal entries"
    ON journal_entries FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own journal entries"
    ON journal_entries FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own journal entries"
    ON journal_entries FOR DELETE
    USING (auth.uid() = user_id);

-- Journal Followups policies
CREATE POLICY "Users can view own journal followups"
    ON journal_followups FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM journal_entries
            WHERE journal_entries.id = journal_followups.original_entry_id
            AND journal_entries.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own journal followups"
    ON journal_followups FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM journal_entries
            WHERE journal_entries.id = journal_followups.original_entry_id
            AND journal_entries.user_id = auth.uid()
        )
    );

-- Chat Sessions policies
CREATE POLICY "Users can view own chat sessions"
    ON chat_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat sessions"
    ON chat_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat sessions"
    ON chat_sessions FOR UPDATE
    USING (auth.uid() = user_id);

-- Chat Messages policies
CREATE POLICY "Users can view own chat messages"
    ON chat_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM chat_sessions
            WHERE chat_sessions.id = chat_messages.session_id
            AND chat_sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own chat messages"
    ON chat_messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM chat_sessions
            WHERE chat_sessions.id = chat_messages.session_id
            AND chat_sessions.user_id = auth.uid()
        )
    );

-- Conversation History policies
CREATE POLICY "Users can view own conversation history"
    ON conversation_history FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversation history"
    ON conversation_history FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversation history"
    ON conversation_history FOR UPDATE
    USING (auth.uid() = user_id);

-- Meditation Sessions policies
CREATE POLICY "Users can view own meditation sessions"
    ON meditation_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own meditation sessions"
    ON meditation_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own meditation sessions"
    ON meditation_sessions FOR UPDATE
    USING (auth.uid() = user_id);

-- Meditation Reflections policies
CREATE POLICY "Users can view own meditation reflections"
    ON meditation_reflections FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM meditation_sessions
            WHERE meditation_sessions.id = meditation_reflections.session_id
            AND meditation_sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own meditation reflections"
    ON meditation_reflections FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM meditation_sessions
            WHERE meditation_sessions.id = meditation_reflections.session_id
            AND meditation_sessions.user_id = auth.uid()
        )
    );

-- Mentor Selections policies
CREATE POLICY "Users can view own mentor selections"
    ON mentor_selections FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mentor selections"
    ON mentor_selections FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user_profiles
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for conversation_history
CREATE TRIGGER update_conversation_history_updated_at
    BEFORE UPDATE ON conversation_history
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VIEWS (Optional - for analytics and debugging)
-- =====================================================

-- User activity summary
CREATE OR REPLACE VIEW user_activity_summary AS
SELECT
    u.id as user_id,
    up.display_name,
    COUNT(DISTINCT je.id) as journal_entries_count,
    COUNT(DISTINCT ms.id) as meditation_sessions_count,
    COUNT(DISTINCT cs.id) as chat_sessions_count,
    MAX(je.created_at) as last_journal_entry,
    MAX(ms.created_at) as last_meditation,
    MAX(cs.created_at) as last_chat
FROM auth.users u
LEFT JOIN user_profiles up ON u.id = up.id
LEFT JOIN journal_entries je ON u.id = je.user_id
LEFT JOIN meditation_sessions ms ON u.id = ms.user_id
LEFT JOIN chat_sessions cs ON u.id = cs.user_id
GROUP BY u.id, up.display_name;

-- =====================================================
-- INITIAL DATA / SEED (Optional)
-- =====================================================

-- Note: In production, seed data would be inserted via migrations or app logic
-- This is just an example structure

COMMENT ON TABLE journal_entries IS 'Stores user journal entries with vector embeddings for RAG semantic search';
COMMENT ON TABLE chat_sessions IS 'Tracks conversation sessions with AI mentors (Marcus Aurelius, Rumi, etc.)';
COMMENT ON TABLE meditation_sessions IS 'Records meditation session history and completion status';
COMMENT ON TABLE mentor_selections IS 'Analytics table tracking which mentors resonate with users';
COMMENT ON FUNCTION match_journal_entries IS 'RAG function: performs vector similarity search on journal entries using pgvector';
