-- =====================================================
-- Common Queries for The Mirror
-- Quick reference for database operations
-- =====================================================

-- =====================================================
-- USER MANAGEMENT
-- =====================================================

-- Get or create user profile
SELECT * FROM user_profiles WHERE id = 'user-uuid-here';

-- Create user profile if not exists
INSERT INTO user_profiles (id, display_name)
VALUES ('user-uuid-here', 'John Doe')
ON CONFLICT (id) DO NOTHING;

-- Update user preferences
UPDATE user_profiles
SET preferred_meditation_duration = 600,
    preferred_mentor_category = 'philosopher',
    theme_preference = 'light'
WHERE id = 'user-uuid-here';

-- =====================================================
-- JOURNAL OPERATIONS
-- =====================================================

-- Get user's recent journal entries
SELECT id, content, created_at
FROM journal_entries
WHERE user_id = 'user-uuid-here'
  AND is_archived = false
ORDER BY created_at DESC
LIMIT 10;

-- Search journal entries with RAG (vector similarity)
SELECT * FROM match_journal_entries(
    '[0.1, 0.2, ...]'::vector(768),  -- query embedding
    0.5,  -- similarity threshold
    5,    -- max results
    'user-uuid-here'::uuid
);

-- Get recent entries (fallback when embeddings fail)
SELECT * FROM get_recent_journal_entries(
    'user-uuid-here'::uuid,
    3  -- number of entries
);

-- Get journal entry with follow-ups
SELECT
    je.id,
    je.content,
    je.created_at,
    json_agg(
        json_build_object(
            'question', jf.follow_up_question,
            'answer', jf.follow_up_answer,
            'created_at', jf.created_at
        )
    ) FILTER (WHERE jf.id IS NOT NULL) as followups
FROM journal_entries je
LEFT JOIN journal_followups jf ON je.id = jf.original_entry_id
WHERE je.user_id = 'user-uuid-here'
GROUP BY je.id, je.content, je.created_at
ORDER BY je.created_at DESC;

-- Archive old entries
UPDATE journal_entries
SET is_archived = true
WHERE user_id = 'user-uuid-here'
  AND created_at < NOW() - INTERVAL '1 year'
  AND is_archived = false;

-- Get entries by mood
SELECT id, content, created_at, mood_tags
FROM journal_entries
WHERE user_id = 'user-uuid-here'
  AND mood_tags ? 'anxious'  -- JSON contains operator
ORDER BY created_at DESC;

-- Get entries by topic
SELECT id, content, created_at, topics
FROM journal_entries
WHERE user_id = 'user-uuid-here'
  AND topics ? 'work'
ORDER BY created_at DESC;

-- =====================================================
-- CHAT & CONVERSATION
-- =====================================================

-- Get active chat session
SELECT *
FROM chat_sessions
WHERE user_id = 'user-uuid-here'
  AND ended_at IS NULL
ORDER BY started_at DESC
LIMIT 1;

-- Create new chat session
INSERT INTO chat_sessions (user_id, session_name, mentor_id)
VALUES ('user-uuid-here', 'Career Guidance', 'marcus_aurelius')
RETURNING *;

-- End chat session
UPDATE chat_sessions
SET ended_at = NOW()
WHERE id = 'session-uuid-here';

-- Get chat history for a session
SELECT
    cs.id as session_id,
    cs.session_name,
    cs.mentor_id,
    cs.started_at,
    json_agg(
        json_build_object(
            'role', cm.role,
            'content', cm.content,
            'agent_persona', cm.agent_persona,
            'created_at', cm.created_at
        )
        ORDER BY cm.created_at
    ) as messages
FROM chat_sessions cs
LEFT JOIN chat_messages cm ON cs.id = cm.session_id
WHERE cs.user_id = 'user-uuid-here'
  AND cs.id = 'session-uuid-here'
GROUP BY cs.id;

-- Get all chat sessions for user
SELECT
    cs.*,
    COUNT(cm.id) as message_count,
    MAX(cm.created_at) as last_message_at
FROM chat_sessions cs
LEFT JOIN chat_messages cm ON cs.id = cm.session_id
WHERE cs.user_id = 'user-uuid-here'
GROUP BY cs.id
ORDER BY cs.started_at DESC;

-- Load conversation state
SELECT agent_state, last_agent, updated_at
FROM conversation_history
WHERE user_id = 'user-uuid-here'
  AND session_key = 'default'
ORDER BY updated_at DESC
LIMIT 1;

-- Save/update conversation state
INSERT INTO conversation_history (user_id, session_key, agent_state, last_agent)
VALUES (
    'user-uuid-here',
    'default',
    '{"messages": [], "current_agent": "router"}'::jsonb,
    'router'
)
ON CONFLICT (user_id, session_key)
DO UPDATE SET
    agent_state = EXCLUDED.agent_state,
    last_agent = EXCLUDED.last_agent,
    updated_at = NOW();

-- =====================================================
-- MEDITATION
-- =====================================================

-- Get meditation history
SELECT
    ms.id,
    ms.duration,
    ms.completed,
    ms.stage_reached,
    ms.created_at,
    ms.completed_at,
    mr.reflection_text,
    mr.ai_insight,
    mr.emotional_state
FROM meditation_sessions ms
LEFT JOIN meditation_reflections mr ON ms.id = mr.session_id
WHERE ms.user_id = 'user-uuid-here'
ORDER BY ms.created_at DESC;

-- Create meditation session
INSERT INTO meditation_sessions (user_id, duration, completed, stage_reached)
VALUES ('user-uuid-here', 600, true, 'closing')
RETURNING *;

-- Save meditation reflection
INSERT INTO meditation_reflections (session_id, reflection_text, ai_insight, emotional_state)
VALUES (
    'session-uuid-here',
    'I felt calm and centered during this session...',
    'Your reflection shows growing mindfulness...',
    'peaceful'
);

-- Get meditation statistics
SELECT
    COUNT(*) as total_sessions,
    COUNT(*) FILTER (WHERE completed = true) as completed_sessions,
    SUM(duration) FILTER (WHERE completed = true) as total_minutes,
    AVG(duration) FILTER (WHERE completed = true) as avg_duration,
    MAX(created_at) as last_session
FROM meditation_sessions
WHERE user_id = 'user-uuid-here';

-- Get meditation streak (consecutive days)
WITH daily_meditation AS (
    SELECT DISTINCT DATE(created_at) as meditation_date
    FROM meditation_sessions
    WHERE user_id = 'user-uuid-here'
      AND completed = true
    ORDER BY meditation_date DESC
),
streak AS (
    SELECT
        meditation_date,
        meditation_date - ROW_NUMBER() OVER (ORDER BY meditation_date DESC)::int as streak_group
    FROM daily_meditation
)
SELECT COUNT(*) as current_streak
FROM streak
WHERE streak_group = (SELECT streak_group FROM streak LIMIT 1);

-- =====================================================
-- ANALYTICS
-- =====================================================

-- Most selected mentors
SELECT
    mentor_id,
    COUNT(*) as selection_count,
    array_agg(DISTINCT context_keywords) as common_contexts
FROM mentor_selections
WHERE user_id = 'user-uuid-here'
GROUP BY mentor_id
ORDER BY selection_count DESC;

-- User activity summary
SELECT * FROM user_activity_summary
WHERE user_id = 'user-uuid-here';

-- Weekly activity trend
SELECT
    DATE_TRUNC('week', created_at) as week,
    'journal' as activity_type,
    COUNT(*) as count
FROM journal_entries
WHERE user_id = 'user-uuid-here'
GROUP BY week
UNION ALL
SELECT
    DATE_TRUNC('week', created_at),
    'meditation',
    COUNT(*)
FROM meditation_sessions
WHERE user_id = 'user-uuid-here'
  AND completed = true
GROUP BY week
UNION ALL
SELECT
    DATE_TRUNC('week', started_at),
    'chat',
    COUNT(*)
FROM chat_sessions
WHERE user_id = 'user-uuid-here'
GROUP BY week
ORDER BY week DESC;

-- Mood trends over time
SELECT
    DATE_TRUNC('day', created_at) as day,
    jsonb_array_elements_text(mood_tags) as mood,
    COUNT(*) as frequency
FROM journal_entries
WHERE user_id = 'user-uuid-here'
  AND mood_tags IS NOT NULL
GROUP BY day, mood
ORDER BY day DESC, frequency DESC;

-- Topic distribution
SELECT
    jsonb_array_elements_text(topics) as topic,
    COUNT(*) as entry_count
FROM journal_entries
WHERE user_id = 'user-uuid-here'
  AND topics IS NOT NULL
GROUP BY topic
ORDER BY entry_count DESC;

-- =====================================================
-- ADMIN & MAINTENANCE
-- =====================================================

-- Count all entries per user
SELECT
    user_id,
    COUNT(*) as total_entries,
    COUNT(*) FILTER (WHERE embedding IS NOT NULL) as entries_with_embeddings,
    MIN(created_at) as first_entry,
    MAX(created_at) as last_entry
FROM journal_entries
GROUP BY user_id;

-- Find entries missing embeddings
SELECT id, content, created_at
FROM journal_entries
WHERE embedding IS NULL
  AND is_archived = false
ORDER BY created_at DESC;

-- Database size statistics
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Active users (activity in last 7 days)
SELECT DISTINCT user_id
FROM (
    SELECT user_id, created_at FROM journal_entries
    UNION ALL
    SELECT user_id, created_at FROM meditation_sessions
    UNION ALL
    SELECT user_id, started_at as created_at FROM chat_sessions
) as activity
WHERE created_at > NOW() - INTERVAL '7 days';

-- =====================================================
-- VECTOR SEARCH OPTIMIZATION
-- =====================================================

-- Check vector index health
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read
FROM pg_stat_user_indexes
WHERE indexname LIKE '%embedding%';

-- Analyze embedding distribution
SELECT
    COUNT(*) as total_entries,
    COUNT(embedding) as with_embeddings,
    ROUND(100.0 * COUNT(embedding) / COUNT(*), 2) as embedding_coverage_percent
FROM journal_entries;

-- Find similar entries to a specific entry (without embedding generation)
SELECT
    je2.id,
    je2.content,
    1 - (je1.embedding <=> je2.embedding) as similarity
FROM journal_entries je1
CROSS JOIN journal_entries je2
WHERE je1.id = 'entry-uuid-here'
  AND je2.id != je1.id
  AND je1.embedding IS NOT NULL
  AND je2.embedding IS NOT NULL
ORDER BY je1.embedding <=> je2.embedding
LIMIT 5;

-- =====================================================
-- EXPORT & BACKUP
-- =====================================================

-- Export all user data as JSON
SELECT jsonb_build_object(
    'profile', (SELECT row_to_json(up.*) FROM user_profiles up WHERE id = 'user-uuid-here'),
    'journal_entries', (SELECT jsonb_agg(je.*) FROM journal_entries je WHERE user_id = 'user-uuid-here'),
    'chat_sessions', (SELECT jsonb_agg(cs.*) FROM chat_sessions cs WHERE user_id = 'user-uuid-here'),
    'meditation_sessions', (SELECT jsonb_agg(ms.*) FROM meditation_sessions ms WHERE user_id = 'user-uuid-here')
) as user_data;

-- Count total records by table
SELECT
    'journal_entries' as table_name, COUNT(*) as count FROM journal_entries
UNION ALL
SELECT 'chat_sessions', COUNT(*) FROM chat_sessions
UNION ALL
SELECT 'chat_messages', COUNT(*) FROM chat_messages
UNION ALL
SELECT 'meditation_sessions', COUNT(*) FROM meditation_sessions
UNION ALL
SELECT 'meditation_reflections', COUNT(*) FROM meditation_reflections
UNION ALL
SELECT 'mentor_selections', COUNT(*) FROM mentor_selections
UNION ALL
SELECT 'user_profiles', COUNT(*) FROM user_profiles;
