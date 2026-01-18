-- Add new tables for chat, profiles, and analytics
-- Matches existing simple schema style (no FK constraints, no RLS)

-- Chat sessions
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    mentor_id VARCHAR(255),
    started_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User profiles
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY,
    display_name VARCHAR(255),
    preferred_meditation_duration INT DEFAULT 300,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversation state persistence
CREATE TABLE IF NOT EXISTS conversation_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    session_key VARCHAR(100) NOT NULL,
    agent_state JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meditation reflections
CREATE TABLE IF NOT EXISTS meditation_reflections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL,
    reflection_text TEXT,
    ai_insight TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mentor selection tracking
CREATE TABLE IF NOT EXISTS mentor_selections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    mentor_id VARCHAR(255) NOT NULL,
    selected_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indices
CREATE INDEX IF NOT EXISTS chat_sessions_user_idx ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS chat_messages_session_idx ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS conversation_history_user_idx ON conversation_history(user_id, session_key);
CREATE INDEX IF NOT EXISTS meditation_reflections_session_idx ON meditation_reflections(session_id);
CREATE INDEX IF NOT EXISTS mentor_selections_user_idx ON mentor_selections(user_id);
