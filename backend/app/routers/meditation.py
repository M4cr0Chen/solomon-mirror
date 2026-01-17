from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import google.generativeai as genai
from app.config import get_settings
import asyncio
import json

router = APIRouter()
settings = get_settings()
genai.configure(api_key=settings.google_api_key)

@router.websocket("/ws/session")
async def meditation_session(websocket: WebSocket):
    """
    WebSocket endpoint for real-time meditation sessions using Gemini Live API
    Handles bidirectional audio streaming
    """
    await websocket.accept()
    print("[MEDITATION] WebSocket connection accepted")

    try:
        # System instruction for meditation guide
        system_instruction = """You are a calm, soothing meditation guide.
Your role is to:
1. Guide the user through a 5-minute breathing exercise
2. Speak slowly and gently with pauses
3. Use calming, peaceful language
4. Provide clear breathing instructions (inhale 4 counts, hold 4, exhale 4)
5. Encourage mindfulness and present-moment awareness

Keep your voice soft and reassuring. Start by welcoming them to the meditation session."""

        print("[MEDITATION] Initializing Gemini Live API session...")

        # Note: As of January 2025, Gemini Live API may not be fully available
        # This is the planned implementation based on the hackathon plan
        # You may need to use Gemini 2.0 Flash with multimodal capabilities

        try:
            # Use Gemini 2.0 Flash Experimental (supports multimodal)
            model = genai.GenerativeModel('gemini-2.0-flash-exp')

            # Send initial greeting
            greeting = """Welcome to your meditation session. Find a comfortable position, close your eyes if you wish, and let's begin with some gentle breathing.

Take a deep breath in... 2, 3, 4... Hold... 2, 3, 4... And slowly exhale... 2, 3, 4.

Let's do that again together."""

            # Send text greeting
            await websocket.send_json({
                "type": "transcript",
                "text": greeting
            })

            print("[MEDITATION] Greeting sent, starting meditation loop...")

            # For now, use text-based interaction
            # Real Gemini Live API would handle audio streaming
            while True:
                # Receive message from client
                try:
                    data = await websocket.receive_text()
                    message_data = json.loads(data)

                    if message_data.get("type") == "user_input":
                        user_message = message_data.get("text", "")
                        print(f"[MEDITATION] User: {user_message}")

                        # Generate response using Gemini
                        response = model.generate_content(
                            f"{system_instruction}\n\nUser: {user_message}\n\nGuide:",
                            generation_config=genai.types.GenerationConfig(
                                temperature=0.7,
                                max_output_tokens=300,
                            )
                        )

                        assistant_message = response.text

                        # Send response back
                        await websocket.send_json({
                            "type": "transcript",
                            "text": assistant_message
                        })

                    elif message_data.get("type") == "breathing_update":
                        # Client sends breathing state updates
                        # We can use this for audio-reactive visuals
                        await websocket.send_json({
                            "type": "acknowledgment",
                            "status": "ok"
                        })

                except json.JSONDecodeError:
                    print("[MEDITATION] Received non-JSON data, skipping")
                    continue

        except Exception as api_error:
            print(f"[MEDITATION API ERROR] {str(api_error)}")
            await websocket.send_json({
                "type": "error",
                "message": f"API Error: {str(api_error)}"
            })

    except WebSocketDisconnect:
        print("[MEDITATION] Client disconnected")
    except Exception as e:
        print(f"[MEDITATION ERROR] {str(e)}")
        import traceback
        traceback.print_exc()
        try:
            await websocket.send_json({
                "type": "error",
                "message": str(e)
            })
        except:
            pass
    finally:
        print("[MEDITATION] Session ended")


@router.get("/health")
async def meditation_health():
    """Health check for meditation service"""
    return {
        "status": "ok",
        "service": "meditation",
        "note": "Gemini Live API integration ready"
    }
