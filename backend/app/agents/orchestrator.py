from typing import TypedDict, List, Dict
from langgraph.graph import StateGraph, END
import google.generativeai as genai
from app.config import get_settings
from app.services.rag import search_memories

settings = get_settings()
genai.configure(api_key=settings.google_api_key)

# Define the state structure
class AgentState(TypedDict):
    messages: List[dict]
    user_id: str
    context: str
    current_agent: str

# Persona definitions for Wise Mentor
PERSONAS = {
    "stoic": {
        "name": "Marcus Aurelius",
        "title": "Stoic philosopher and Roman Emperor",
        "keywords": ["stress", "control", "anxiety", "worry", "acceptance", "fear"],
        "philosophy": "Focus on what you can control. Accept what you cannot. Practice virtue and wisdom."
    },
    "buddhist": {
        "name": "Thich Nhat Hanh",
        "title": "Zen Buddhist monk and mindfulness teacher",
        "keywords": ["peace", "mindfulness", "present", "compassion", "suffering", "meditation"],
        "philosophy": "Be present in the moment. Practice compassion. Understand the nature of suffering."
    },
    "sage": {
        "name": "Confucius",
        "title": "Chinese philosopher and teacher",
        "keywords": ["relationship", "family", "work", "duty", "respect", "harmony"],
        "philosophy": "Cultivate virtue through learning. Respect relationships. Practice benevolence."
    },
    "default": {
        "name": "The Wise Elder",
        "title": "compassionate guide",
        "keywords": [],
        "philosophy": "Draw upon your own wisdom and experiences. You know yourself better than anyone."
    }
}

def detect_persona(user_message: str) -> Dict:
    """Detect appropriate persona based on user message keywords"""
    user_message_lower = user_message.lower()

    # Check each persona's keywords
    for persona_key, persona in PERSONAS.items():
        if persona_key == "default":
            continue
        for keyword in persona["keywords"]:
            if keyword in user_message_lower:
                print(f"[PERSONA] Detected {persona['name']} based on keyword: {keyword}")
                return persona

    # Default persona
    print("[PERSONA] Using default persona")
    return PERSONAS["default"]

def mindfulness_agent(state: AgentState) -> AgentState:
    """
    Empathetic agent for identifying emotions and providing comfort
    """
    user_message = state["messages"][-1]["content"]

    system_prompt = """You are The Empath, a compassionate mindfulness guide.
Your role is to:
1. Help users identify and name their emotions
2. Provide a safe space for venting
3. Offer gentle validation without judgment
4. Suggest simple breathing exercises if appropriate

Keep responses warm, concise (2-3 sentences), and focused on emotional awareness.
"""

    try:
        print(f"[AGENT] Processing message: {user_message[:50]}...")

        # Use Gemini Pro (correct model name without models/ prefix)
        model = genai.GenerativeModel('gemini-3-flash-preview')

        # Combine system prompt with user message for Gemini
        full_prompt = f"{system_prompt}\n\nUser: {user_message}\n\nAssistant:"

        print("[AGENT] Calling Gemini API...")
        response = model.generate_content(
            full_prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.7,
                max_output_tokens=500,  # Increased from 200
                top_p=0.95,
            )
        )

        print(f"[AGENT] Gemini response received")
        print(f"[AGENT] Response object: {response}")
        print(f"[AGENT] Candidates: {len(response.candidates)}")

        # Better response extraction
        if response.candidates:
            # Get the first candidate's content
            candidate = response.candidates[0]
            print(f"[AGENT] Finish reason: {candidate.finish_reason}")

            # Extract text from parts
            if candidate.content and candidate.content.parts:
                assistant_message = "".join(part.text for part in candidate.content.parts)
                print(f"[AGENT] Extracted message ({len(assistant_message)} chars): {assistant_message[:100]}...")
            else:
                print("[AGENT WARNING] No content parts found")
                assistant_message = response.text  # Fallback
        else:
            print("[AGENT WARNING] No candidates in response")
            assistant_message = response.text  # Fallback

        print(f"[AGENT] Final message length: {len(assistant_message)} chars")

        return {
            **state,
            "messages": state["messages"] + [{"role": "assistant", "content": assistant_message}],
            "current_agent": "mindfulness"
        }
    except Exception as e:
        print(f"[AGENT ERROR] {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            **state,
            "messages": state["messages"] + [{"role": "assistant", "content": f"Error: {str(e)}"}],
            "current_agent": "mindfulness"
        }

async def wise_mentor_node(state: AgentState) -> AgentState:
    """
    Wise Mentor agent that uses RAG to retrieve user context
    and adopts a historical persona to give advice
    """
    user_message = state["messages"][-1]["content"]

    try:
        print(f"[WISE MENTOR] Processing message: {user_message[:50]}...")

        # Retrieve user context using RAG
        print(f"[WISE MENTOR] Searching memories for user: {state['user_id']}")
        context_memories = await search_memories(state["user_id"], user_message, top_k=3)

        if context_memories:
            context_text = "Based on what you've shared before:\n\n" + "\n\n".join(
                f"- {memory}" for memory in context_memories
            )
            print(f"[WISE MENTOR] Retrieved {len(context_memories)} memories")
        else:
            context_text = "This appears to be our first conversation."
            print("[WISE MENTOR] No memories found")

        # Detect appropriate persona
        persona = detect_persona(user_message)
        print(f"[WISE MENTOR] Using persona: {persona['name']}")

        # Build system prompt with persona and context
        system_prompt = f"""You are {persona['name']}, a {persona['title']}.

{context_text}

Your philosophy: {persona['philosophy']}

Respond to the user's message in the voice and style of {persona['name']}, drawing upon:
1. Their past experiences and patterns (from the context above)
2. Your philosophical wisdom
3. Specific, actionable guidance

Keep your response concise (3-4 sentences) but profound. Speak as {persona['name']} would speak."""

        # Call Gemini API
        model = genai.GenerativeModel('gemini-3-flash-preview')
        full_prompt = f"{system_prompt}\n\nUser: {user_message}\n\n{persona['name']}:"

        print("[WISE MENTOR] Calling Gemini API...")
        response = model.generate_content(
            full_prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.8,
                max_output_tokens=500,
                top_p=0.95,
            )
        )

        # Extract response
        if response.candidates:
            candidate = response.candidates[0]
            if candidate.content and candidate.content.parts:
                assistant_message = "".join(part.text for part in candidate.content.parts)
            else:
                assistant_message = response.text
        else:
            assistant_message = response.text

        print(f"[WISE MENTOR] Response generated ({len(assistant_message)} chars)")

        return {
            **state,
            "messages": state["messages"] + [{
                "role": "assistant",
                "content": assistant_message,
                "persona": persona["name"]
            }],
            "current_agent": "wise_mentor",
            "context": context_text
        }

    except Exception as e:
        print(f"[WISE MENTOR ERROR] {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            **state,
            "messages": state["messages"] + [{
                "role": "assistant",
                "content": f"Error in Wise Mentor: {str(e)}"
            }],
            "current_agent": "wise_mentor"
        }

def route_agent(state: AgentState) -> AgentState:
    """
    Router agent that determines which specialized agent to use
    Based on simple keyword detection for hackathon
    """
    user_message = state["messages"][-1]["content"] if state["messages"] else ""
    user_message_lower = user_message.lower()

    print(f"[ROUTER] Analyzing message: {user_message[:50]}...")

    # Route to mindfulness for emotional processing
    mindfulness_keywords = ["feel", "feeling", "emotion", "sad", "angry", "frustrated", "upset", "hurt"]
    if any(keyword in user_message_lower for keyword in mindfulness_keywords):
        print("[ROUTER] Routing to mindfulness agent")
        return {**state, "current_agent": "mindfulness"}

    # Route to wise mentor for advice/guidance
    mentor_keywords = ["advice", "what should", "help me", "stuck", "decision", "problem", "challenge"]
    if any(keyword in user_message_lower for keyword in mentor_keywords):
        print("[ROUTER] Routing to wise_mentor agent")
        return {**state, "current_agent": "wise_mentor"}

    # Default to wise mentor
    print("[ROUTER] Defaulting to wise_mentor agent")
    return {**state, "current_agent": "wise_mentor"}

def create_council_graph():
    """
    Create the LangGraph workflow for the Council of Agents
    Phase 2: Full orchestrator with router, mindfulness, and wise mentor
    """
    workflow = StateGraph(AgentState)

    # Add all agent nodes
    workflow.add_node("router", route_agent)
    workflow.add_node("mindfulness", mindfulness_agent)
    workflow.add_node("wise_mentor", wise_mentor_node)

    # Set router as entry point
    workflow.set_entry_point("router")

    # Add conditional edges from router to agents
    workflow.add_conditional_edges(
        "router",
        lambda state: state["current_agent"],
        {
            "mindfulness": "mindfulness",
            "wise_mentor": "wise_mentor",
        }
    )

    # Both agents return to END
    workflow.add_edge("mindfulness", END)
    workflow.add_edge("wise_mentor", END)

    return workflow.compile()

# Initialize the graph
council_graph = create_council_graph()
