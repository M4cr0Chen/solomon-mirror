from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

app = FastAPI(
    title="The Mirror API",
    description="Self-Discovery Engine with Digital Twin and Council of Agents",
    version="0.1.0"
)

# CORS Configuration - Critical for Next.js frontend
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "The Mirror API is running"}

@app.get("/health")
async def health():
    return {"status": "ok"}

# Import routers
from app.routers import journal, chat, meditation
app.include_router(journal.router, prefix="/api/journal", tags=["journal"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(meditation.router, prefix="/api/meditation", tags=["meditation"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
