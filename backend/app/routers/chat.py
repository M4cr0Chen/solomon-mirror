from fastapi import APIRouter, HTTPException
import uuid
from app.models.schemas import (
    ChatRequest,
    ChatResponse,
    ChatMessage,
    MentorSelectionRequest,
    MentorExitRequest,
)
from typing import Optional
from app.agents.orchestrator import council_graph, AgentState, MENTORS, DEFAULT_MENTOR

router = APIRouter()

# Demo user UUID for hackathon (bypassing auth)
DEMO_USER_ID = "00000000-0000-0000-0000-000000000001"

# Store conversation state per user (in production, use Redis or database)
conversation_states = {}

def resolve_user_id(user_id: Optional[str]) -> str:
    """Return a valid UUID, falling back to the demo user ID."""
    resolved = user_id if user_id else DEMO_USER_ID
    try:
        uuid.UUID(str(resolved))
    except (ValueError, TypeError):
        print(f"[CHAT] Invalid user ID '{resolved}', using demo user ID")
        resolved = DEMO_USER_ID
    return resolved


def mentor_payload(mentor: Optional[dict]) -> Optional[dict]:
    if not mentor:
        return None
    era = mentor.get("era", "")
    is_present = "present" in era.lower()
    verb = "is" if is_present else "was"
    life_story = mentor.get("life_story") or f"{mentor.get('name')} {verb} {mentor.get('title')} who lived in {era}."
    return {
        "id": mentor.get("id"),
        "name": mentor.get("name"),
        "title": mentor.get("title"),
        "era": mentor.get("era"),
        "expertise": mentor.get("expertise"),
        "philosophy": mentor.get("philosophy"),
        "life_story": life_story,
        "notable_works": mentor.get("notable_works"),
        "signature_quote": mentor.get("signature_quote"),
    }


@router.post("/message", response_model=ChatResponse)
async def send_message(request: ChatRequest) -> ChatResponse:
    """
    Send a message to the Council and get a response

    The orchestrator will route to the appropriate agent
    """
    try:
        print(f"[CHAT] Received message: {request.message[:50]}...")

        # Use demo user ID if not provided or invalid
        user_id = resolve_user_id(request.user_id)
        print(f"[CHAT] User ID: {user_id}")

        # Get or create conversation state for this user
        if user_id in conversation_states:
            # Continue existing conversation
            existing_state = conversation_states[user_id]
            initial_state: AgentState = {
                "messages": existing_state.get("messages", []) + [{"role": "user", "content": request.message}],
                "user_id": user_id,
                "context": existing_state.get("context", ""),
                "current_agent": "orchestrator",
                "discovery_complete": existing_state.get("discovery_complete", False),
                "selected_mentor": existing_state.get("selected_mentor", None),
                "user_situation": existing_state.get("user_situation", "")
            }
        else:
            # New conversation
            initial_state: AgentState = {
                "messages": [{"role": "user", "content": request.message}],
                "user_id": user_id,
                "context": "",
                "current_agent": "orchestrator",
                "discovery_complete": False,
                "selected_mentor": None,
                "user_situation": ""
            }

        print("[CHAT] Running through LangGraph...")
        # Run through the graph (using ainvoke for async nodes)
        result = await council_graph.ainvoke(initial_state)

        print(f"[CHAT] LangGraph completed. Messages: {len(result['messages'])}")

        # Save conversation state
        conversation_states[user_id] = {
            "messages": result["messages"],
            "context": result.get("context", ""),
            "discovery_complete": result.get("discovery_complete", False),
            "selected_mentor": result.get("selected_mentor"),
            "user_situation": result.get("user_situation", "")
        }

        # Extract the assistant's response
        if len(result["messages"]) > 0:
            # Find the last assistant message
            assistant_message = None
            for msg in reversed(result["messages"]):
                if msg["role"] == "assistant":
                    assistant_message = msg
                    break

            if assistant_message:
                print(f"[CHAT] Response from {result['current_agent']}: {assistant_message['content'][:50]}...")

                # Include persona info if available
                agent_info = result["current_agent"]
                if "persona" in assistant_message:
                    agent_info = f"{result['current_agent']}:{assistant_message['persona']}"

                mentor_info = None
                selected_mentor = result.get("selected_mentor") or {}
                if selected_mentor:
                    mentor_info = mentor_payload(selected_mentor)

                return ChatResponse(
                    message=ChatMessage(
                        role=assistant_message["role"],
                        content=assistant_message["content"],
                        agent=agent_info,
                        mentor=mentor_info
                    ),
                    agent=agent_info,
                    mentor=mentor_info
                )
            else:
                raise Exception("No assistant response found")
        else:
            raise Exception("No response from agent")

    except Exception as e:
        print(f"[CHAT ERROR] {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")


@router.post("/reset")
async def reset_conversation(user_id: str = DEMO_USER_ID):
    """Reset the conversation state for a user"""
    if user_id in conversation_states:
        del conversation_states[user_id]
    return {"status": "ok", "message": "Conversation reset"}


@router.get("/mentors")
async def list_mentors():
    mentors = [
        mentor_payload({**mentor, "id": mentor_id})
        for mentor_id, mentor in MENTORS.items()
    ]
    return {"mentors": mentors, "default": mentor_payload({**DEFAULT_MENTOR, "id": "default"})}


@router.post("/mentor/select")
async def select_mentor(request: MentorSelectionRequest):
    user_id = resolve_user_id(request.user_id)
    state = conversation_states.get(user_id)
    if not state or not state.get("messages"):
        raise HTTPException(status_code=400, detail="No active conversation to update")

    mentor = MENTORS.get(request.mentor_id)
    if not mentor:
        raise HTTPException(status_code=404, detail="Mentor not found")

    selected = {**mentor, "id": request.mentor_id}
    state["selected_mentor"] = selected
    state["discovery_complete"] = True
    conversation_states[user_id] = state
    return {"status": "ok", "mentor": mentor_payload(selected)}


@router.post("/mentor/exit")
async def exit_mentor(request: MentorExitRequest):
    user_id = resolve_user_id(request.user_id)
    state = conversation_states.get(user_id)
    if state:
        state["selected_mentor"] = None
        state["discovery_complete"] = False
        conversation_states[user_id] = state
    return {"status": "ok"}
