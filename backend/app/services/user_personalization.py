"""
User Personalization Service
Provides mock personalized user data for meditation experiences
For hackathon demo purposes
"""

from typing import Dict, List, Optional
from datetime import datetime

# Demo user UUID
DEMO_USER_ID = "00000000-0000-0000-0000-000000000001"

# Mock user profile database
MOCK_USER_PROFILES = {
    DEMO_USER_ID: {
        "id": DEMO_USER_ID,
        "first_name": "Marco",
        "display_name": "Marco Chen",
        "occupation": "Computer Science Student",
        "current_challenges": "Feeling stressed about upcoming recruiting season and technical interviews. Worried about finding the right career path and proving myself in interviews.",
        "personal_goals": "Land a great internship, build confidence in technical skills, find work-life balance, practice more mindfulness",
        "interests": ["coding", "meditation", "hiking", "music", "AI research"],
        "stress_sources": ["interview prep", "career uncertainty", "imposter syndrome", "time management"],
        "preferred_meditation_duration": 600,
    }
}


def get_user_profile(user_id: str = DEMO_USER_ID) -> Dict:
    """
    Get user profile with personalization data
    Returns mock data for demo purposes
    """
    return MOCK_USER_PROFILES.get(user_id, {
        "id": user_id,
        "first_name": "friend",
        "display_name": "User",
        "occupation": "",
        "current_challenges": "",
        "personal_goals": "",
        "interests": [],
        "stress_sources": [],
        "preferred_meditation_duration": 600,
    })


def get_personalization_context(user_id: str = DEMO_USER_ID) -> str:
    """
    Generate personalization context string for LLM prompts
    Combines user profile data into natural language
    """
    profile = get_user_profile(user_id)

    if not profile.get("first_name") or profile["first_name"] == "friend":
        return ""

    context_parts = []

    # Name
    name = profile.get("first_name", "friend")
    context_parts.append(f"The user's name is {name}.")

    # Occupation
    if profile.get("occupation"):
        context_parts.append(f"They are a {profile['occupation']}.")

    # Current challenges
    if profile.get("current_challenges"):
        context_parts.append(f"Current challenges: {profile['current_challenges']}")

    # Personal goals
    if profile.get("personal_goals"):
        context_parts.append(f"Their goals: {profile['personal_goals']}")

    # Stress sources
    if profile.get("stress_sources") and len(profile["stress_sources"]) > 0:
        stress_list = ", ".join(profile["stress_sources"])
        context_parts.append(f"Main sources of stress: {stress_list}.")

    # Interests (for relatable metaphors)
    if profile.get("interests") and len(profile["interests"]) > 0:
        interests_list = ", ".join(profile["interests"])
        context_parts.append(f"Interests: {interests_list}.")

    return "\n".join(context_parts)


def get_greeting_name(user_id: str = DEMO_USER_ID) -> str:
    """Get user's first name for greetings, or 'friend' as fallback"""
    profile = get_user_profile(user_id)
    return profile.get("first_name", "friend")


def should_acknowledge_stress(user_id: str = DEMO_USER_ID) -> bool:
    """Check if user has stress sources that should be acknowledged"""
    profile = get_user_profile(user_id)
    return len(profile.get("stress_sources", [])) > 0


def get_stress_acknowledgment(user_id: str = DEMO_USER_ID) -> str:
    """Get a natural acknowledgment of user's stressors"""
    profile = get_user_profile(user_id)
    stress_sources = profile.get("stress_sources", [])

    if not stress_sources:
        return ""

    # Pick 1-2 main stressors
    main_stressors = stress_sources[:2]

    if len(main_stressors) == 1:
        return f"I know you've been dealing with {main_stressors[0]}"
    elif len(main_stressors) == 2:
        return f"I know you've been navigating {main_stressors[0]} and {main_stressors[1]}"
    else:
        return "I know there's a lot on your mind right now"


# Example usage for testing
if __name__ == "__main__":
    print("User Profile:")
    print("-" * 60)
    profile = get_user_profile()
    for key, value in profile.items():
        print(f"{key}: {value}")

    print("\n\nPersonalization Context:")
    print("-" * 60)
    print(get_personalization_context())

    print("\n\nGreeting Example:")
    print("-" * 60)
    name = get_greeting_name()
    stress = get_stress_acknowledgment()
    print(f"Dear {name}... {stress}... let's set everything aside for now...")
