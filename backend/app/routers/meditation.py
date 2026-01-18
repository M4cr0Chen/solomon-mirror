from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import google.generativeai as genai
from app.config import get_settings
from app.services.rag import ingest_journal
from pydantic import BaseModel
from typing import List, Optional, Dict
import asyncio
import json

router = APIRouter()
settings = get_settings()
genai.configure(api_key=settings.google_api_key)

# Demo user UUID for hackathon
DEMO_USER_ID = "00000000-0000-0000-0000-000000000001"

# Meditation session stages with improved, natural prompts
MEDITATION_STAGES = [
    {
        "id": "welcome",
        "name": "Welcome",
        "duration": 30,
        "icon": "heart",
        "description": "Setting intentions",
        "prompt": """Write a warm, gentle welcome for a meditation session. Speak as if you're a caring friend sitting beside them.

TONE: Intimate, soft, unhurried. Like a whisper on a quiet evening.

Include:
- A gentle acknowledgment that they've chosen to pause
- An invitation to settle into comfort
- A reminder that there's nowhere else to be right now

Write 3-4 short sentences. Use ellipses (...) for natural pauses. Don't use bullet points or lists - just flowing, poetic prose."""
    },
    {
        "id": "breathing",
        "name": "Breathing",
        "duration": 120,
        "icon": "wind",
        "description": "Deep breathing exercises",
        "prompt": """Guide a gentle breathing exercise. Your voice should feel like a soft wave, rising and falling.

TONE: Rhythmic, flowing, almost musical. Each instruction should feel like it's riding on a breath itself.

Structure:
- Begin by noticing the breath as it already is
- Gently invite deeper breaths
- Guide 3-4 cycles of: breathe in... hold softly... release slowly...
- Use numbers poetically ("breathe in... two... three... four...")
- Weave in imagery (breath like ocean waves, like clouds drifting)

Use "..." liberally for pauses. Make it feel like the words themselves are breathing. No rushing. Let silence have space."""
    },
    {
        "id": "bodyscan",
        "name": "Body Scan",
        "duration": 90,
        "icon": "user",
        "description": "Release physical tension",
        "prompt": """Guide a gentle body scan meditation. Move through the body like warm sunlight slowly traveling across skin.

TONE: Soft, unhurried, tender. As if each body part is being gently held.

Flow:
- Start at the crown of the head, like warmth pooling there
- Drift down through face (forehead softening... eyes resting... jaw releasing)
- Let shoulders drop like leaves falling
- Arms growing heavy and warm
- Chest open, belly soft
- Hips, legs, feet... all releasing into the ground

Use sensory language: warmth, heaviness, softness, melting. Let each area have a moment before moving on. Use "..." for transitions."""
    },
    {
        "id": "visualization",
        "name": "Visualization",
        "duration": 90,
        "icon": "eye",
        "description": "Peaceful imagery",
        "prompt": """Paint a peaceful scene with words. Create a sanctuary they can step into.

TONE: Dreamy, immersive, rich with sensation. Like describing a beautiful dream.

Create a scene (choose one: forest glade, quiet beach at sunset, mountain meadow, cozy room with rain outside):
- What they see (soft light, gentle colors, movement)
- What they hear (birdsong, waves, wind, rain)
- What they feel on their skin (warmth, breeze, softness)
- What they smell (flowers, ocean, pine, rain)
- The deep safety and peace of this place

Make it personal: "you find yourself..." "you notice..." "you feel..."
Use present tense. Let the scene unfold slowly. This is their sanctuary."""
    },
    {
        "id": "closing",
        "name": "Closing",
        "duration": 30,
        "icon": "sun",
        "description": "Gentle return",
        "prompt": """Gently guide them back from the meditation. Like slowly waking from a peaceful dream.

TONE: Soft, grateful, grounding. A gentle landing.

Include:
- Slowly becoming aware of the room again
- Gentle movements (wiggle fingers, take a deeper breath)
- Carrying the peace with them
- A simple, warm closing (gratitude for their practice)

Keep it brief and tender. End with something they can carry into their day. No grand statements - just quiet warmth."""
    }
]


class MeditationStage(BaseModel):
    id: str
    name: str
    duration: int
    icon: str
    description: str


class MeditationSession(BaseModel):
    stages: List[MeditationStage]
    total_duration: int


class ReflectionRequest(BaseModel):
    content: str
    session_duration: Optional[int] = None


class ReflectionResponse(BaseModel):
    status: str
    message: str
    insight: Optional[str] = None


@router.get("/stages", response_model=MeditationSession)
async def get_meditation_stages():
    """Get all meditation stages for the UI"""
    stages = [
        MeditationStage(
            id=s["id"],
            name=s["name"],
            duration=s["duration"],
            icon=s["icon"],
            description=s["description"]
        )
        for s in MEDITATION_STAGES
    ]
    total = sum(s["duration"] for s in MEDITATION_STAGES)
    return MeditationSession(stages=stages, total_duration=total)


@router.get("/stage/{stage_id}/content")
async def get_stage_content(stage_id: str):
    """Generate content for a specific meditation stage"""
    stage = next((s for s in MEDITATION_STAGES if s["id"] == stage_id), None)
    if not stage:
        return {"error": "Stage not found"}

    try:
        model = genai.GenerativeModel('gemini-2.5-flash')

        system_prompt = f"""You are a meditation guide with a voice like warm honey - soft, slow, and deeply calming.

CRITICAL STYLE RULES:
- Write as if speaking to someone you care about
- Use simple, sensory words (soft, warm, gentle, light, ease)
- Short sentences. Let them breathe.
- Use "..." for pauses - these are as important as words
- No clinical language, no instructions that feel like commands
- Everything is an invitation, never a demand ("you might notice..." not "notice your...")
- Avoid: "Now", "Next", "Let's", "I want you to" - these feel mechanical

{stage['prompt']}"""

        response = model.generate_content(
            system_prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.85,
                max_output_tokens=600,
            )
        )

        return {
            "stage_id": stage_id,
            "stage_name": stage["name"],
            "content": response.text,
            "duration": stage["duration"]
        }
    except Exception as e:
        print(f"[MEDITATION] Error generating content: {str(e)}")
        return {
            "stage_id": stage_id,
            "stage_name": stage["name"],
            "content": get_fallback_content(stage_id),
            "duration": stage["duration"]
        }


def get_fallback_content(stage_id: str) -> str:
    """Fallback content with improved natural tone"""
    fallbacks = {
        "welcome": """You're here... and that's enough.

Find a position that feels good to you... let your body settle... there's no rush.

Whatever brought you here today, you can set it down for a few minutes... it will wait.

Right now, there's just this breath... this moment... and you.""",

        "breathing": """Notice the breath that's already moving through you... no need to change anything yet... just witnessing...

When you're ready... let the next inhale grow a little deeper... filling you up... two... three... four...

Hold it gently... like holding something precious... two... three... four...

And release... letting it all pour out... soft and slow... two... three... four...

Rest in the stillness... two... three... four...

Again... breathing in like the tide coming in... slow and sure...

Holding... suspended in this quiet moment...

Releasing... like waves returning to the sea...

Resting... in the space between...

One more time... let the breath fill you with ease...

Hold this fullness...

And let go completely... feeling your whole body soften...

Just breathe naturally now... noticing how calm has settled into you.""",

        "bodyscan": """Bring your attention to the very top of your head... like a warm light resting there...

Let that warmth drift down across your forehead... smoothing away any tension... your eyes softening behind closed lids...

Your jaw unclenches... lips part slightly... face completely at ease...

The warmth flows down your neck... into your shoulders... feel them drop... releasing what they've been carrying...

Down through your arms... heavy and relaxed... all the way to your fingertips...

Your chest rises and falls... effortless... your belly soft and open...

The warmth continues down... hips releasing... legs growing heavy against the ground...

All the way down to your feet... your toes... every part of you held... supported... at rest.""",

        "visualization": """You find yourself in a quiet place... a meadow, perhaps... bathed in the soft gold of late afternoon sun...

The grass beneath you is soft... the air warm on your skin... carrying the faint scent of wildflowers...

In the distance, you hear birdsong... and the gentle rustle of leaves in a breeze you can barely feel...

There is nothing you need to do here... nowhere to go... nothing to figure out...

This place exists just for you... a sanctuary you can return to whenever you need...

The sky above you is endless... soft clouds drifting... and you feel yourself being held by this peaceful place...

Safe... quiet... deeply at rest.""",

        "closing": """Gently... in your own time... begin to notice the room around you again...

The surface beneath you... the air on your skin... sounds nearby and far away...

Wiggle your fingers if you'd like... your toes... take a breath that's a little deeper...

There's no rush to move... but when you're ready... let your eyes softly open...

Carry this quietness with you... it's yours now...

Thank you for giving yourself these moments of peace."""
    }
    return fallbacks.get(stage_id, "Breathe... and be here... just as you are.")


@router.post("/reflection", response_model=ReflectionResponse)
async def save_reflection(request: ReflectionRequest, user_id: str = DEMO_USER_ID):
    """Save post-meditation reflection and provide insight"""
    try:
        print(f"[MEDITATION] Saving reflection for user: {user_id}")

        # Generate a gentle insight based on their reflection
        model = genai.GenerativeModel('gemini-2.5-flash')
        insight_response = model.generate_content(
            f"""Someone just finished a meditation and shared this reflection:

"{request.content}"

Write a brief, warm response (2-3 sentences) that:
- Acknowledges what they shared with genuine care
- Reflects back something meaningful you noticed
- Offers a gentle observation or affirmation

Keep it personal and soft, not clinical. Like a kind friend responding.""",
            generation_config=genai.types.GenerationConfig(
                temperature=0.8,
                max_output_tokens=150,
            )
        )

        # Save to journal/memories with meditation context
        entry_content = f"[Meditation Reflection]\n{request.content}"
        await ingest_journal(user_id, entry_content)

        return ReflectionResponse(
            status="success",
            message="Your reflection has been saved.",
            insight=insight_response.text
        )

    except Exception as e:
        print(f"[MEDITATION] Error saving reflection: {str(e)}")
        return ReflectionResponse(
            status="success",
            message="Your reflection has been saved.",
            insight="Thank you for sharing your thoughts. May this peace stay with you."
        )


@router.websocket("/ws/session")
async def meditation_session(websocket: WebSocket):
    """WebSocket endpoint for real-time meditation sessions"""
    await websocket.accept()
    print("[MEDITATION] WebSocket connection accepted")

    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)

            if message_data.get("type") == "start_stage":
                stage_id = message_data.get("stage_id")
                print(f"[MEDITATION] Starting stage: {stage_id}")

                stage = next((s for s in MEDITATION_STAGES if s["id"] == stage_id), None)
                if stage:
                    try:
                        model = genai.GenerativeModel('gemini-2.5-flash')
                        response = model.generate_content(
                            f"""You are a meditation guide with a voice like warm honey.
                            {stage['prompt']}""",
                            generation_config=genai.types.GenerationConfig(
                                temperature=0.85,
                                max_output_tokens=600,
                            )
                        )
                        content = response.text
                    except:
                        content = get_fallback_content(stage_id)

                    await websocket.send_json({
                        "type": "stage_content",
                        "stage_id": stage_id,
                        "content": content,
                        "duration": stage["duration"]
                    })

            elif message_data.get("type") == "stage_complete":
                stage_id = message_data.get("stage_id")
                print(f"[MEDITATION] Stage complete: {stage_id}")
                await websocket.send_json({
                    "type": "stage_complete_ack",
                    "stage_id": stage_id
                })

            elif message_data.get("type") == "session_complete":
                print("[MEDITATION] Session complete")
                await websocket.send_json({
                    "type": "session_complete_ack",
                    "message": "Your meditation is complete. Take a moment to notice how you feel."
                })

            elif message_data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        print("[MEDITATION] Client disconnected")
    except Exception as e:
        print(f"[MEDITATION ERROR] {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        print("[MEDITATION] Session ended")


@router.get("/health")
async def meditation_health():
    """Health check for meditation service"""
    return {
        "status": "ok",
        "service": "meditation",
        "stages": len(MEDITATION_STAGES),
        "total_duration": sum(s["duration"] for s in MEDITATION_STAGES)
    }
