import os
from dotenv import load_dotenv
load_dotenv(".env.local")
from google import genai
client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
print("Available models:")
for m in client.models.list():
    if "gemini" in m.name.lower():
        print(m.name)
