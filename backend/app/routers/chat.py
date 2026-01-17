from fastapi import APIRouter, HTTPException
from app.models.schemas import ChatRequest, ChatResponse, ChatMessage
from app.agents.orchestrator import council_graph, AgentState

router = APIRouter()

# Demo user UUID for hackathon (bypassing auth)
DEMO_USER_ID = "00000000-0000-0000-0000-000000000001"

@router.post("/message", response_model=ChatResponse)
async def send_message(request: ChatRequest) -> ChatResponse:
    """
    Send a message to the Council and get a response

    The orchestrator will route to the appropriate agent
    """
    try:
        print(f"[CHAT] Received message: {request.message[:50]}...")

        # Use demo user ID if not provided
        user_id = request.user_id if request.user_id else DEMO_USER_ID
        print(f"[CHAT] User ID: {user_id}")

        # Create initial state
        initial_state: AgentState = {
            "messages": [{"role": "user", "content": request.message}],
            "user_id": user_id,
            "context": "",
            "current_agent": "orchestrator"
        }

        print("[CHAT] Running through LangGraph...")
        # Run through the graph (using ainvoke for async nodes)
        result = await council_graph.ainvoke(initial_state)

        print(f"[CHAT] LangGraph completed. Messages: {len(result['messages'])}")

        # Extract the assistant's response
        if len(result["messages"]) > 1:
            assistant_message = result["messages"][-1]
            print(f"[CHAT] Response from {result['current_agent']}: {assistant_message['content'][:50]}...")
            return ChatResponse(
                message=ChatMessage(
                    role=assistant_message["role"],
                    content=assistant_message["content"],
                    agent=result["current_agent"]
                ),
                agent=result["current_agent"]
            )
        else:
            raise Exception("No response from agent")

    except Exception as e:
        print(f"[CHAT ERROR] {str(e)}")
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")
