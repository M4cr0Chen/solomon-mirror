from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

# Journal Models
class JournalEntryCreate(BaseModel):
    content: str

class JournalEntry(BaseModel):
    id: str
    user_id: str
    content: str
    created_at: datetime

class JournalSearchRequest(BaseModel):
    query: str
    top_k: int = 3

# Chat Models
class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str
    agent: Optional[str] = None  # Which agent responded

class ChatRequest(BaseModel):
    message: str
    user_id: Optional[str] = None

class ChatResponse(BaseModel):
    message: ChatMessage
    agent: str  # Current agent handling the conversation

# Agent State
class AgentState(BaseModel):
    messages: List[ChatMessage]
    user_id: str
    context: str = ""
    current_agent: str = "orchestrator"
