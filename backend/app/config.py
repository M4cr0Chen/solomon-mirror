from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # Supabase
    supabase_url: str
    supabase_key: str
    supabase_service_key: str

    # AI APIs
    openai_api_key: str = ""  # Optional (not used, keeping for compatibility)
    google_api_key: str  # For everything (Gemini)

    # App Config
    environment: str = "development"
    cors_origins: str = "http://localhost:3000"

    class Config:
        env_file = ".env"
        case_sensitive = False

@lru_cache()
def get_settings():
    return Settings()
