import os
from google import genai
from dotenv import load_dotenv

load_dotenv(".env.local")

client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

models_to_test = [
    "gemini-2.5-flash",
    "gemini-3.5-flash-lite"
]

for model in models_to_test:
    try:
        response = client.models.generate_content(
            model=model,
            contents="Say hi"
        )
        print(f"SUCCESS: {model}")
    except Exception as e:
        print(f"FAILED: {model} - {e}")
