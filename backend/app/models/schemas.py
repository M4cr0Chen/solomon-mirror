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

class MentorInfo(BaseModel):
    id: Optional[str] = None
    name: str
    title: str
    era: str
    expertise: Optional[List[str]] = None
    philosophy: Optional[str] = None
    life_story: Optional[str] = None
    notable_works: Optional[List[str]] = None
    signature_quote: Optional[str] = None

# Chat Models
class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str
    agent: Optional[str] = None  # Which agent responded
    mentor: Optional[MentorInfo] = None

class ChatRequest(BaseModel):
    message: str
    user_id: Optional[str] = None

class MentorSelectionRequest(BaseModel):
    mentor_id: str
    user_id: Optional[str] = None

class MentorExitRequest(BaseModel):
    user_id: Optional[str] = None

class ChatResponse(BaseModel):
    message: ChatMessage
    agent: str  # Current agent handling the conversation
    mentor: Optional[MentorInfo] = None

# Agent State
class AgentState(BaseModel):
    messages: List[ChatMessage]
    user_id: str
    context: str = ""
    current_agent: str = "orchestrator"
