from supabase import create_client, Client
from app.config import get_settings

settings = get_settings()

# Initialize Supabase client
supabase: Client = create_client(settings.supabase_url, settings.supabase_key)

def get_supabase() -> Client:
    """Dependency for getting Supabase client"""
    return supabase
