from fastapi import APIRouter, HTTPException
from app.models.schemas import JournalEntryCreate, JournalSearchRequest
from app.services.rag import ingest_journal, search_memories
from app.config import get_settings
from typing import Dict, List, Optional
from pydantic import BaseModel
import google.generativeai as genai

router = APIRouter()
settings = get_settings()
genai.configure(api_key=settings.google_api_key)

# Demo user UUID for hackathon (bypassing auth)
DEMO_USER_ID = "00000000-0000-0000-0000-000000000001"

# Store journal conversation state per user
journal_sessions = {}


class JournalResponse(BaseModel):
    status: str
    entry_id: Optional[str] = None
    follow_up_questions: Optional[List[str]] = None
    insights: Optional[str] = None
    message: Optional[str] = None


class JournalFollowUpRequest(BaseModel):
    original_entry: str
    follow_up_answers: Dict[str, str]  # question -> answer mapping


async def generate_follow_up_questions(content: str, previous_entries: List[str] = None) -> Dict:
    """
    Analyze journal entry and generate thoughtful follow-up questions
    like a deep interview to understand the user better
    """
    context = ""
    if previous_entries:
        context = f"""
PREVIOUS JOURNAL ENTRIES (for context):
{chr(10).join(f'- {entry[:200]}...' for entry in previous_entries[:3])}
"""

    system_prompt = f"""You are a thoughtful journal companion conducting a deep, empathetic interview.
Your goal is to help the user explore their thoughts and feelings more deeply.

{context}

CURRENT ENTRY:
{content}

ANALYZE THE ENTRY AND:
1. Identify the key emotional themes or significant points
2. Generate 2-3 thoughtful follow-up questions that:
   - Help them explore their feelings more deeply
   - Uncover underlying patterns or beliefs
   - Encourage self-reflection
   - Are open-ended and non-judgmental

3. Provide a brief insight about what you noticed in their entry

FORMAT YOUR RESPONSE EXACTLY LIKE THIS:
INSIGHT: [1-2 sentence observation about their entry]

QUESTIONS:
1. [First follow-up question]
2. [Second follow-up question]
3. [Third follow-up question - optional]

Remember:
- Be warm and curious, not clinical
- Ask questions that go deeper, not just surface level
- Notice emotions they might not have explicitly named
- Look for patterns if you have context from previous entries
"""

    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(
            system_prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.7,
                max_output_tokens=500,
            )
        )

        response_text = response.text

        # Parse the response
        insight = ""
        questions = []

        lines = response_text.strip().split('\n')
        in_questions = False

        for line in lines:
            line = line.strip()
            if line.startswith('INSIGHT:'):
                insight = line.replace('INSIGHT:', '').strip()
            elif line.startswith('QUESTIONS:'):
                in_questions = True
            elif in_questions and line and (line[0].isdigit() or line.startswith('-')):
                # Extract question text
                question = line.lstrip('0123456789.-) ').strip()
                if question:
                    questions.append(question)

        return {
            "insight": insight,
            "questions": questions[:3]  # Max 3 questions
        }

    except Exception as e:
        print(f"[JOURNAL] Error generating questions: {str(e)}")
        return {
            "insight": "Thank you for sharing.",
            "questions": [
                "How did that make you feel in the moment?",
                "What do you think triggered these thoughts?",
                "Is there anything else you'd like to explore about this?"
            ]
        }


async def synthesize_journal_session(original_entry: str, follow_ups: Dict[str, str]) -> str:
    """
    Combine the original entry with follow-up answers into a rich, synthesized entry
    """
    follow_up_text = "\n".join([
        f"Q: {q}\nA: {a}"
        for q, a in follow_ups.items()
    ])

    system_prompt = f"""You are helping to create a rich, synthesized journal entry.

ORIGINAL ENTRY:
{original_entry}

FOLLOW-UP CONVERSATION:
{follow_up_text}

Create a cohesive, first-person journal entry that weaves together all of this information.
Keep the user's voice and tone. Don't add interpretations they didn't express.
The result should read like a single, thoughtful journal entry.

Write 2-4 paragraphs maximum."""

    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(
            system_prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.6,
                max_output_tokens=600,
            )
        )
        return response.text
    except Exception as e:
        # Fallback: just concatenate
        return f"{original_entry}\n\n{follow_up_text}"


@router.post("/ingest", response_model=JournalResponse)
async def ingest_entry(entry: JournalEntryCreate, user_id: str = DEMO_USER_ID) -> JournalResponse:
    """
    Ingest a journal entry, generate embedding, and return follow-up questions
    for deeper exploration.
    """
    try:
        print(f"[JOURNAL] Ingesting entry for user: {user_id}")
        print(f"[JOURNAL] Content length: {len(entry.content)} chars")

        # Get previous entries for context
        previous_entries = await search_memories(user_id, entry.content, top_k=3)

        # Generate follow-up questions
        analysis = await generate_follow_up_questions(entry.content, previous_entries)

        # Store the session for potential follow-up
        journal_sessions[user_id] = {
            "original_entry": entry.content,
            "insight": analysis["insight"],
            "questions": analysis["questions"]
        }

        # Ingest the initial entry
        result = await ingest_journal(user_id, entry.content)

        return JournalResponse(
            status="success",
            entry_id=result.get("entry_id"),
            follow_up_questions=analysis["questions"],
            insights=analysis["insight"],
            message="Entry saved. Would you like to explore deeper?"
        )

    except Exception as e:
        print(f"[JOURNAL ERROR] {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/follow-up", response_model=JournalResponse)
async def process_follow_up(request: JournalFollowUpRequest, user_id: str = DEMO_USER_ID) -> JournalResponse:
    """
    Process follow-up answers and create a synthesized, deeper journal entry
    """
    try:
        print(f"[JOURNAL] Processing follow-up for user: {user_id}")

        # Synthesize the full entry
        synthesized_entry = await synthesize_journal_session(
            request.original_entry,
            request.follow_up_answers
        )

        # Ingest the synthesized entry (this is the richer version)
        result = await ingest_journal(user_id, synthesized_entry)

        # Generate new insight based on the deeper exploration
        model = genai.GenerativeModel('gemini-2.5-flash')
        insight_response = model.generate_content(
            f"""Based on this journal entry and self-exploration, provide a brief, warm
            observation (1-2 sentences) that might help the person see a pattern or
            feel understood:

            {synthesized_entry}""",
            generation_config=genai.types.GenerationConfig(
                temperature=0.7,
                max_output_tokens=150,
            )
        )

        # Clear the session
        if user_id in journal_sessions:
            del journal_sessions[user_id]

        return JournalResponse(
            status="success",
            entry_id=result.get("entry_id"),
            insights=insight_response.text,
            message="Your deeper reflection has been saved. This will help your Digital Twin understand you better."
        )

    except Exception as e:
        print(f"[JOURNAL ERROR] {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/search")
async def search_entries(request: JournalSearchRequest, user_id: str = DEMO_USER_ID) -> Dict:
    """
    Search journal entries using semantic similarity
    """
    try:
        memories = await search_memories(user_id, request.query, request.top_k)
        return {
            "query": request.query,
            "results": memories,
            "count": len(memories)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session")
async def get_session(user_id: str = DEMO_USER_ID) -> Dict:
    """
    Get the current journal session state (for resuming)
    """
    if user_id in journal_sessions:
        return journal_sessions[user_id]
    return {"status": "no_active_session"}
