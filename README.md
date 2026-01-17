# The Mirror - Self-Discovery Engine

A hackathon project that helps users overcome Solomon's Paradox by creating a Digital Twin using RAG and a Multi-Agent System for mindfulness and mentorship.

## Project Structure

```
uofthacks/
├── backend/              # FastAPI backend
│   ├── app/
│   │   ├── agents/      # LangGraph orchestrator and agents
│   │   ├── routers/     # API endpoints
│   │   ├── services/    # RAG and business logic
│   │   ├── models/      # Pydantic schemas
│   │   └── main.py      # FastAPI app entry point
│   ├── requirements.txt
│   └── supabase_schema.sql
├── frontend/            # Next.js frontend
│   ├── app/            # App router pages
│   ├── components/     # React components
│   └── lib/            # Utilities
└── HACKATHON_EXECUTION_PLAN.md
```

## Phase 1 Status ✅

### Completed Features
- [x] FastAPI backend with CORS configuration
- [x] Supabase database schema with pgvector
- [x] RAG pipeline for journal ingestion and similarity search
- [x] LangGraph orchestrator with basic agent routing
- [x] Core API endpoints (/api/journal, /api/chat)
- [x] Next.js frontend with terminal aesthetic
- [x] Chat interface with agent avatars
- [x] Journal entry page
- [x] Terminal-themed UI with scanline effects

## Setup Instructions

### Prerequisites
- Python 3.10+
- Node.js 18+
- Supabase account
- OpenAI API key

### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Create and activate virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your credentials:
   ```
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_KEY=your_supabase_service_role_key
   OPENAI_API_KEY=your_openai_api_key
   ```

5. **Set up Supabase database:**
   - Go to your Supabase project dashboard
   - Navigate to SQL Editor
   - Run the contents of `supabase_schema.sql`
   - This will create tables and enable pgvector

6. **Run the backend:**
   ```bash
   python -m app.main
   ```

   Backend will be available at `http://localhost:8000`

### Frontend Setup

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.local.example .env.local
   ```

   Edit `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

   Frontend will be available at `http://localhost:3000`

## Testing the Application

### 1. Test Backend API (Optional)

Visit `http://localhost:8000/docs` to see the interactive API documentation.

Test the health endpoint:
```bash
curl http://localhost:8000/health
```

### 2. Test Journal Ingestion

1. Go to `http://localhost:3000/journal`
2. Write a journal entry (e.g., "I've been feeling anxious about my upcoming presentation")
3. Click "SAVE ENTRY"
4. You should see a success message

### 3. Test The Council Chat

1. Go to `http://localhost:3000/council`
2. Type a message like "I'm feeling stressed about work"
3. The Mindfulness Agent (The Empath) should respond with empathy

## Architecture

### Backend
- **FastAPI**: REST API server
- **LangGraph**: Agent orchestration and state management
- **Supabase + pgvector**: Vector database for RAG
- **OpenAI**: Embeddings and chat completions

### Frontend
- **Next.js 14**: App Router for routing
- **Tailwind CSS**: Terminal-themed styling
- **Framer Motion**: Smooth animations
- **Lucide React**: Icons

### Current Agents
- **Orchestrator**: Routes user queries to appropriate agents
- **Mindfulness Agent (The Empath)**: Helps identify emotions and provides comfort

## Next Steps (Phase 2)

According to the execution plan, Phase 2 will add:
- [ ] Wise Mentor agent with RAG-powered context
- [ ] Historical persona selection
- [ ] WebSocket relay for OpenAI Realtime API
- [ ] Meditation session scaffold

## Troubleshooting

### Backend won't start
- Make sure you're in the virtual environment: `source venv/bin/activate`
- Check that all environment variables are set in `.env`
- Verify Python version: `python --version` (should be 3.10+)

### Frontend won't start
- Delete `node_modules` and `.next`: `rm -rf node_modules .next`
- Reinstall: `npm install`
- Check Node version: `node --version` (should be 18+)

### Database errors
- Ensure pgvector extension is enabled in Supabase
- Check that the SQL schema was executed successfully
- Verify Supabase credentials in `.env`

### CORS errors
- Make sure backend is running on port 8000
- Check that `NEXT_PUBLIC_API_URL` in frontend `.env.local` matches backend URL
- Verify CORS middleware is configured in backend `main.py`

## License

MIT - Built for UofT Hacks 2025
