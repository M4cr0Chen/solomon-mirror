# The Mirror: 36-Hour Hackathon Execution Plan

## Project Overview
Building a "Self-Discovery" application that helps users overcome "Solomon's Paradox" (the ability to give good advice to others but not oneself). The app creates a "Digital Twin" of the user using RAG and employs a Multi-Agent System to guide them through mindfulness, meditation, and mentorship.

## Tech Stack (Strict Constraints)
- **Frontend:** Next.js (App Router), Tailwind CSS, shadcn/ui, Framer Motion (for reactive visuals), Lucide React
- **Backend:** FastAPI (Python)
- **Orchestration:** LangGraph (for managing agent state and loops)
- **Database/Vector Store:** Supabase (Postgres + pgvector)
- **AI:** Google Gemini API (Chat: gemini-3-flash-preview, Embeddings: text-embedding-004)
- **Audio:** Gemini Live API (multimodal voice) via WebSocket relay
- **Authentication:** Supabase Auth (bypassed for hackathon with demo UUID)

## Core Features to Build
1. **The Council (Chat Interface):** A text interface where an Orchestrator Agent routes the user to a "Mindfulness Agent" or "Wise Mentor"
2. **The Wise Mentor:** An agent that retrieves user context (RAG) and adopts a specific historical persona to give advice
3. **Real-Time Meditation:** A voice-interactive session using Gemini Live API with audio-first reactive UI (geometric shapes that expand/contract with breath)

---

## Phase 1: Foundation & Infrastructure (Hours 0-12)
**Goal:** Working auth, basic chat UI, database schema, and a "hello world" LangGraph orchestrator.

### Backend Tasks (Hour 0-6)
1. **Project Setup:**
   - Initialize FastAPI project with Poetry/pip
   - Install dependencies: `fastapi`, `uvicorn`, `langchain`, `langgraph`, `supabase`, `google-generativeai`, `websockets`
   - Create `.env` for API keys (Supabase URL/Key, Google API Key)

2. **Database Schema (Supabase):**
   ```sql
   -- Enable pgvector
   CREATE EXTENSION IF NOT EXISTS vector;

   -- journal_entries table
   CREATE TABLE journal_entries (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     user_id UUID NOT NULL,  -- No FK constraint for hackathon demo
     content TEXT NOT NULL,
     embedding VECTOR(768),  -- Gemini text-embedding-004 dimensions
     created_at TIMESTAMPTZ DEFAULT NOW()
   );

   -- Create index for vector similarity search
   CREATE INDEX ON journal_entries USING ivfflat (embedding vector_cosine_ops);
   ```

3. **Core Endpoints:**
   ```python
   # app/main.py
   POST /api/journal/ingest  # Store journal entry + generate embedding
   GET  /api/journal/search  # RAG similarity search
   POST /api/chat/message    # Send message to orchestrator
   ```

4. **LangGraph Orchestrator (Simple Version):**
   ```python
   # app/agents/orchestrator.py
   from langgraph.graph import StateGraph, END

   class AgentState(TypedDict):
       messages: list
       user_id: str
       context: str
       current_agent: str

   # Nodes: route_agent, mindfulness_agent, wise_mentor
   # Edge: Always return to route_agent after each response
   ```

### Frontend Tasks (Hour 6-12)
1. **Next.js Setup:**
   - `npx create-next-app@latest --app --tailwind`
   - Install: `shadcn/ui`, `@supabase/ssr`, `framer-motion`, `lucide-react`
   - Configure Supabase client with env vars

2. **Core Pages & Components:**
   ```
   app/
     (auth)/
       login/page.tsx      # Supabase Auth UI
     (app)/
       layout.tsx          # Protected route wrapper
       council/page.tsx    # Main chat interface
   components/
     chat/
       MessageList.tsx     # Display messages
       MessageInput.tsx    # Text input + send button
       AgentAvatar.tsx     # Show which agent is speaking
   ```

3. **Design System (Minimalist/Terminal):**
   ```typescript
   // Use monospace fonts (JetBrains Mono, Fira Code)
   // Color palette: #0A0E27 (bg), #00FF41 (accent), #888 (muted)
   // shadcn/ui components with custom terminal theme
   ```

### Critical Risks
- **Risk:** Supabase pgvector not enabled → Test vector similarity query immediately after schema creation
- **Risk:** CORS issues between Next.js (port 3000) and FastAPI (port 8000) → Set up CORS middleware in FastAPI from day 1
- **Risk:** LangGraph complexity → Start with a simple `if/else` router before implementing full state graph

---

## Phase 2: Core AI Features (Hours 12-24)
**Goal:** Working RAG pipeline with Gemini embeddings, Wise Mentor agent with persona, and WebSocket relay for Gemini Live API.

### Backend Tasks (Hour 12-18)

1. **RAG Pipeline Implementation:**
   ```python
   # app/services/rag.py
   import google.generativeai as genai
   from supabase import Client

   genai.configure(api_key=settings.google_api_key)

   def generate_embedding(text: str):
       # Generate Gemini embedding
       result = genai.embed_content(
           model="models/text-embedding-004",
           content=text,
           task_type="retrieval_document"
       )
       return result['embedding']

   async def ingest_journal(user_id: str, content: str):
       # Generate embedding (768 dimensions)
       embedding = generate_embedding(content)

       # Store in Supabase
       supabase.table("journal_entries").insert({
           "user_id": user_id,
           "content": content,
           "embedding": embedding
       }).execute()

   async def search_memories(user_id: str, query: str, top_k=3):
       # Generate query embedding
       result = genai.embed_content(
           model="models/text-embedding-004",
           content=query,
           task_type="retrieval_query"
       )
       query_embedding = result['embedding']

       # pgvector similarity search
       results = supabase.rpc('match_journal_entries', {
           'query_embedding': query_embedding,
           'match_threshold': 0.7,
           'match_count': top_k,
           'user_id': user_id
       }).execute()

       return [r['content'] for r in results.data]
   ```

2. **Wise Mentor Agent (LangGraph Node):**
   ```python
   # app/agents/wise_mentor.py
   import google.generativeai as genai

   async def wise_mentor_node(state: AgentState):
       user_message = state["messages"][-1]["content"]

       # RAG: Retrieve user context
       context = await search_memories(state["user_id"], user_message)

       # Determine persona (simple keyword matching for hackathon)
       persona = detect_persona(user_message)  # "Stoic", "Buddhist", etc.

       system_prompt = f"""You are {persona['name']}, a {persona['title']}.
       The user has shared this about themselves:
       {chr(10).join(context)}

       Respond in the voice of {persona['name']}, using their philosophy."""

       # Use Gemini for chat
       model = genai.GenerativeModel('gemini-3-flash-preview')
       full_prompt = f"{system_prompt}\n\nUser: {user_message}\n\nAssistant:"

       response = model.generate_content(
           full_prompt,
           generation_config=genai.types.GenerationConfig(
               temperature=0.7,
               max_output_tokens=500,
           )
       )

       assistant_message = response.text

       return {
           **state,
           "messages": state["messages"] + [{"role": "assistant", "content": assistant_message}]
       }
   ```

3. **WebSocket Relay for Gemini Live API:**
   ```python
   # app/routers/meditation.py
   from fastapi import WebSocket, WebSocketDisconnect
   import google.generativeai as genai
   import asyncio
   import json

   @router.websocket("/ws/meditation")
   async def meditation_session(websocket: WebSocket):
       await websocket.accept()

       try:
           # Configure Gemini Live API client
           genai.configure(api_key=settings.google_api_key)

           # Initialize Gemini Live session
           model = genai.GenerativeModel("gemini-2.0-flash-exp")

           # System instructions for meditation guide
           system_instruction = """You are a calm, soothing meditation guide.
           Your role is to:
           1. Guide the user through a 5-minute breathing exercise
           2. Speak slowly and gently
           3. Use calming, peaceful language
           4. Provide clear breathing instructions (inhale 4 counts, hold 4, exhale 4)
           5. Encourage mindfulness and present-moment awareness

           Keep your voice soft and reassuring."""

           # Start live session with voice input/output
           async with model.start_chat(
               config={
                   "system_instruction": system_instruction,
                   "response_modalities": ["audio"],  # Audio output
                   "speech_config": {
                       "voice_config": {"prebuilt_voice_config": {"voice_name": "Puck"}}
                   }
               }
           ) as chat:

               # Bidirectional communication
               async def client_to_gemini():
                   try:
                       async for message in websocket.iter_bytes():
                           # Send audio chunks to Gemini Live
                           await chat.send_message(message)
                   except WebSocketDisconnect:
                       pass

               async def gemini_to_client():
                   async for response in chat.send_message_stream(""):
                       # Stream audio responses back to client
                       if response.audio:
                           await websocket.send_bytes(response.audio)

                       # Also send text transcripts for debugging/UI
                       if response.text:
                           await websocket.send_json({
                               "type": "transcript",
                               "text": response.text
                           })

               # Run both directions concurrently
               await asyncio.gather(client_to_gemini(), gemini_to_client())

       except Exception as e:
           print(f"[MEDITATION ERROR] {str(e)}")
           await websocket.close()
   ```

   **Note:** Gemini Live API features:
   - Native multimodal (audio in/out)
   - Real-time streaming
   - Lower latency than OpenAI Realtime
   - Built-in voice activity detection
   - Multiple voice options (Puck, Charon, Kore, Fenrir, Aoede)

### Frontend Tasks (Hour 18-24)
1. **Council Chat Refinement:**
   ```typescript
   // app/council/page.tsx
   const [messages, setMessages] = useState<Message[]>([]);
   const [currentAgent, setCurrentAgent] = useState<string>("orchestrator");

   async function sendMessage(content: string) {
     const response = await fetch('/api/chat/message', {
       method: 'POST',
       body: JSON.stringify({ content })
     });

     const { message, agent } = await response.json();
     setCurrentAgent(agent);
     setMessages(prev => [...prev, message]);
   }
   ```

2. **Journal Ingestion UI:**
   ```typescript
   // app/journal/page.tsx
   // Simple textarea + "Save Entry" button
   // On save: POST to /api/journal/ingest
   ```

3. **Meditation Page Scaffold:**
   ```typescript
   // app/meditation/page.tsx
   // Empty page with "Start Session" button
   // Will implement audio-reactive UI in Phase 3
   ```

### Critical Risks
- **Risk:** Gemini API quota limits (free tier) → Enable billing on Google Cloud Console for reliable access (~$1-2 for entire hackathon)
- **Risk:** Gemini Live API WebSocket connection issues → Test with simple audio stream first before full implementation
- **Risk:** RAG returns irrelevant results → Use a higher `match_threshold` (0.75+) and limit to top 3 results
- **Risk:** LangGraph state not persisting → Add checkpointer: `MemorySaver()` for demo (no need for Redis in hackathon)

---

## Phase 3: Integration & Audio-Reactive UI (Hours 24-30)
**Goal:** Real-time meditation session with reactive visuals, full agent routing, end-to-end testing.

### Backend Tasks (Hour 24-26)
1. **Complete LangGraph Orchestrator:**
   ```python
   # app/agents/graph.py
   def create_council_graph():
       workflow = StateGraph(AgentState)

       workflow.add_node("router", route_agent)
       workflow.add_node("mindfulness", mindfulness_agent)
       workflow.add_node("wise_mentor", wise_mentor_node)

       workflow.add_conditional_edges(
           "router",
           lambda state: state["current_agent"],
           {
               "mindfulness": "mindfulness",
               "wise_mentor": "wise_mentor",
               "end": END
           }
       )

       workflow.add_edge("mindfulness", "router")
       workflow.add_edge("wise_mentor", "router")
       workflow.set_entry_point("router")

       return workflow.compile(checkpointer=MemorySaver())
   ```

2. **Add Session Management:**
   ```python
   # Track meditation sessions in Supabase
   CREATE TABLE meditation_sessions (
     id UUID PRIMARY KEY,
     user_id UUID REFERENCES auth.users,
     duration INT,  -- seconds
     completed BOOLEAN DEFAULT FALSE,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

### Frontend Tasks (Hour 26-30)
1. **Audio-Reactive Meditation UI:**
   ```typescript
   // components/meditation/BreathingOrb.tsx
   import { motion } from 'framer-motion';

   export function BreathingOrb({ audioLevel }: { audioLevel: number }) {
     // Map audio level (0-1) to scale
     const scale = 1 + (audioLevel * 0.5);

     return (
       <motion.div
         className="w-64 h-64 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-600"
         animate={{
           scale: [1, scale, 1],
           opacity: [0.6, 0.9, 0.6],
         }}
         transition={{
           duration: 4,  // 4-second breath cycle
           repeat: Infinity,
           ease: "easeInOut"
         }}
       />
     );
   }
   ```

2. **WebSocket Audio Handler:**
   ```typescript
   // app/meditation/page.tsx
   const [audioLevel, setAudioLevel] = useState(0);

   useEffect(() => {
     const ws = new WebSocket('ws://localhost:8000/ws/meditation');

     // Request microphone access
     navigator.mediaDevices.getUserMedia({ audio: true })
       .then(stream => {
         const mediaRecorder = new MediaRecorder(stream, {
           mimeType: 'audio/webm'
         });

         mediaRecorder.ondataavailable = (event) => {
           // Convert to PCM16 and send to WebSocket
           const reader = new FileReader();
           reader.onload = () => {
             const base64 = btoa(reader.result);
             ws.send(base64);
           };
           reader.readAsBinaryString(event.data);
         };

         mediaRecorder.start(100);  // Send chunks every 100ms
       });

     ws.onmessage = (event) => {
       // Receive audio from OpenAI
       const audioBlob = new Blob([event.data], { type: 'audio/pcm' });
       const audioUrl = URL.createObjectURL(audioBlob);
       const audio = new Audio(audioUrl);
       audio.play();

       // Analyze audio level for visualization
       analyzeAudioLevel(event.data).then(setAudioLevel);
     };

     return () => ws.close();
   }, []);
   ```

3. **Agent Indicator UI:**
   ```typescript
   // components/chat/AgentIndicator.tsx
   const agentColors = {
     mindfulness: "text-blue-400",
     wise_mentor: "text-purple-400",
     orchestrator: "text-green-400"
   };

   <div className="flex items-center gap-2 font-mono">
     <Terminal className={agentColors[currentAgent]} />
     <span>{currentAgent.toUpperCase()}</span>
   </div>
   ```

### Critical Risks
- **Risk:** Audio playback latency → Use Web Audio API instead of `<audio>` element for lower latency
- **Risk:** Microphone permissions blocked → Show clear instructions and fallback to text-only mode
- **Risk:** Framer Motion animations jank → Use `transform` and `opacity` only (GPU-accelerated properties)

---

## Phase 4: Polish & Demo Preparation (Hours 30-36)
**Goal:** Bug-free demo, presentation deck, deployed (optional), rehearsed pitch.

### Backend Tasks (Hour 30-32)
1. **Error Handling & Logging:**
   ```python
   # Add middleware for all endpoints
   @app.exception_handler(Exception)
   async def global_exception_handler(request, exc):
       logger.error(f"Unhandled error: {exc}")
       return JSONResponse(
           status_code=500,
           content={"detail": "Internal server error"}
       )
   ```

2. **Rate Limiting (Optional):**
   - If using free-tier OpenAI, add simple in-memory rate limiter

3. **Health Check:**
   ```python
   @app.get("/health")
   async def health():
       return {"status": "ok", "supabase": check_supabase()}
   ```

### Frontend Tasks (Hour 32-35)
1. **Loading States:**
   ```typescript
   // Add skeletons for all async operations
   {isLoading ? <Skeleton className="h-20" /> : <MessageList />}
   ```

2. **Error Boundaries:**
   ```typescript
   // app/error.tsx
   'use client';
   export default function Error({ error, reset }) {
     return (
       <div className="flex flex-col items-center justify-center h-screen">
         <Terminal className="text-red-400 mb-4" />
         <h2 className="font-mono">Connection Lost</h2>
         <button onClick={reset}>Reconnect</button>
       </div>
     );
   }
   ```

3. **Terminal Aesthetic Polish:**
   - Add scanline effect (CSS overlay with repeating-linear-gradient)
   - Typewriter effect for agent responses
   - Glitch animation on page transitions

4. **Onboarding Flow:**
   ```typescript
   // app/onboarding/page.tsx
   // 3-step wizard:
   // 1. "Write your first journal entry"
   // 2. "Meet your Council"
   // 3. "Try a meditation session"
   ```

### Demo Preparation (Hour 35-36)
1. **Seed Data:**
   - Pre-populate demo account with 5 journal entries
   - Test RAG retrieval works with seeded data

2. **Demo Script:**
   ```markdown
   1. Show journal ingestion (30 sec)
   2. Chat with Wise Mentor, show RAG context (1 min)
   3. Start meditation session, show audio-reactive UI (1 min)
   4. End with value prop: "Your past self, guiding your future"
   ```

3. **Presentation Deck (5 slides max):**
   - Slide 1: Problem (Solomon's Paradox)
   - Slide 2: Solution (Digital Twin + Council)
   - Slide 3: Architecture diagram
   - Slide 4: Live demo
   - Slide 5: Impact & next steps

4. **Deployment (If Time Permits):**
   - Frontend: Vercel (auto-deploy from GitHub)
   - Backend: Railway/Render (free tier)
   - **Skip if under 2 hours remaining**

### Critical Risks
- **Risk:** Demo breaks during presentation → Have screen recording backup
- **Risk:** Audio doesn't work on projector → Bring headphones for judges
- **Risk:** Running out of OpenAI credits → Pre-generate responses for critical demo paths

---

## Critical Path Summary
**Must-Have by Each Milestone:**
- **Hour 12:** Auth works, can send a chat message, LangGraph returns "hello world"
- **Hour 24:** RAG retrieval works, Wise Mentor gives contextual advice, WebSocket relay connects
- **Hour 30:** Full meditation session with audio + visuals, all agents integrated
- **Hour 36:** Polished demo, rehearsed pitch

## What to Cut If Behind Schedule
1. **Cut First (Hour 20+):** Mindfulness agent (focus on Wise Mentor only)
2. **Cut Second (Hour 28+):** Advanced audio visualization (static orb is fine)
3. **Cut Third (Hour 32+):** Onboarding flow (jump straight to main app)
4. **Never Cut:** RAG pipeline, Wise Mentor, basic meditation session

## Technology Landmines to Avoid
- **Don't** build a custom vector database (use pgvector)
- **Don't** try to deploy in the last 4 hours (localhost demo is fine)
- **Don't** add user profiles/settings (focus on core features)
- **Don't** implement conversation memory beyond LangGraph state (no external DB persistence needed)

---

## Key Success Metrics
- **Technical:** RAG retrieval working with 3+ relevant memories
- **UX:** Audio meditation session runs smoothly for 2+ minutes
- **Demo:** Can show end-to-end flow in under 3 minutes
- **Pitch:** Clear articulation of Solomon's Paradox problem

Good luck! Focus on the RAG → Wise Mentor → Meditation pipeline. Everything else is window dressing.
