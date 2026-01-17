# Quick Start Guide

## 🚀 Phase 1 Complete!

All Phase 1 features are implemented and ready to test. Here's how to get started:

## Setup (5 minutes)

### 1. Backend Environment

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your API keys
```

### 2. Frontend Environment

```bash
cd frontend
npm install
cp .env.local.example .env.local
# Edit .env.local with your API keys
```

### 3. Supabase Setup

1. Create a Supabase project at https://supabase.com
2. Go to SQL Editor
3. Copy and paste the entire contents of `backend/supabase_schema.sql`
4. Run the SQL script
5. Verify that the `journal_entries` table appears in Table Editor

## Running the App

### Terminal 1 - Backend
```bash
cd backend
source venv/bin/activate
python -m app.main
```

Should see: `INFO:     Uvicorn running on http://0.0.0.0:8000`

### Terminal 2 - Frontend
```bash
cd frontend
npm run dev
```

Should see: `▲ Next.js 14.x.x
- Local:        http://localhost:3000`

## Testing the Flow

### Test 1: Journal Entry
1. Go to http://localhost:3000
2. Click "JOURNAL ENTRY"
3. Write something like:
   ```
   I've been feeling anxious about my upcoming job interview.
   I know what to say but I keep doubting myself.
   ```
4. Click "SAVE ENTRY"
5. ✅ Should see success message

### Test 2: Chat with The Council
1. Go to http://localhost:3000
2. Click "ENTER THE COUNCIL"
3. Type: "I'm feeling stressed and overwhelmed"
4. ✅ Should see response from "THE EMPATH" with empathy

### Test 3: Verify Backend
1. Open http://localhost:8000/docs
2. ✅ Should see FastAPI interactive docs

## What Works Now (Phase 1)

✅ Backend
- FastAPI server with CORS
- Journal ingestion with embeddings
- RAG similarity search
- LangGraph orchestrator
- Mindfulness agent routing

✅ Frontend
- Terminal aesthetic UI
- Journal entry page
- Chat interface
- Agent avatars
- Real-time messaging

✅ Database
- Supabase with pgvector
- Journal entries table
- Similarity search function

## What's Next (Phase 2)

According to `HACKATHON_EXECUTION_PLAN.md`, Phase 2 (Hours 12-24) will add:

- 🔄 Wise Mentor agent with RAG context
- 🔄 Historical persona selection
- 🔄 WebSocket relay for meditation
- 🔄 Enhanced agent routing

## Common Issues

**Backend Error: "No module named 'app'"**
- Make sure you're in the backend directory
- Activate the virtual environment first

**Frontend Error: "Module not found"**
- Run `npm install` again
- Delete `.next` folder and restart

**Database Error: "relation 'journal_entries' does not exist"**
- Run the `supabase_schema.sql` script in Supabase SQL Editor
- Make sure pgvector extension is enabled

**CORS Error in browser**
- Verify backend is running on port 8000
- Check `NEXT_PUBLIC_API_URL` in `.env.local`

## Current Tech Stack

- **Backend**: FastAPI + LangGraph + OpenAI
- **Frontend**: Next.js 14 + Tailwind + Framer Motion
- **Database**: Supabase (PostgreSQL + pgvector)
- **AI**: OpenAI text-embedding-ada-002 + GPT-4

Happy hacking! 🎯
