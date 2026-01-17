# Fixing Gemini API Quota Issues

## The Problem
You're hitting the free tier quota limit for Gemini embeddings API. Even with a Gemini Pro subscription, the **API** has separate billing from the web interface.

## Solution: Enable Billing on Google Cloud

### Step 1: Go to Google AI Studio
1. Visit: https://aistudio.google.com/app/apikey
2. You'll see your API keys listed

### Step 2: Create a New Project with Billing
1. Click "Get API key" → "Create API key in new project"
2. Or go to: https://console.cloud.google.com/
3. Create a new project (or select existing one)

### Step 3: Enable Billing
1. Go to: https://console.cloud.google.com/billing
2. Click "Link a billing account"
3. Follow the steps to add a payment method
   - **New users get $300 free credits!**
   - Gemini API is very cheap: ~$0.00001 per 1K characters for embeddings

### Step 4: Enable the Generative Language API
1. Go to: https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com
2. Click "Enable"
3. Make sure billing is enabled for this project

### Step 5: Create New API Key
1. Go to: https://console.cloud.google.com/apis/credentials
2. Create credentials → API key
3. Copy this new API key

### Step 6: Update Your .env
Replace your `GOOGLE_API_KEY` in `/Users/marcochen/code/uofthacks/backend/.env` with the new API key:

```
GOOGLE_API_KEY=your_new_api_key_with_billing_enabled
```

### Step 7: Restart Backend
```bash
python3 -m app.main
```

## Cost Estimation for Hackathon

For a 36-hour hackathon with moderate usage:
- **Embeddings**: ~$0.50 (500 journal entries × 200 chars each)
- **Chat**: ~$1.00 (1000 messages)
- **Total**: ~$1.50 max

With $300 free credits, you're more than covered!

## Alternative: Wait for Quota Reset

If you don't want to enable billing:
- Free tier quota resets every 24 hours
- The app has a fallback system that stores entries without embeddings
- You can still use chat (different quota)
- Journal entries will work but without semantic search

## Temporary Workaround (Already Implemented)

The code already has graceful fallbacks:
1. If embedding fails → stores journal without embedding
2. If semantic search fails → returns most recent entries
3. Chat still works (different API quota)

This means your app will function even with quota limits, just without the RAG semantic search feature.

## Quick Test

After updating your API key, test it:

```bash
# In Python
import google.generativeai as genai
genai.configure(api_key="your_new_key")
result = genai.embed_content(
    model="models/text-embedding-004",
    content="test",
    task_type="retrieval_document"
)
print(f"Success! Embedding dimensions: {len(result['embedding'])}")
```

Should print: `Success! Embedding dimensions: 768`
