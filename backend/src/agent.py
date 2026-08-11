import sys
import io
import logging
import json
import os
import asyncio
# Fix Windows console encoding for Devanagari (Hindi) output
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    JobProcess,
    cli,
    inference,
    tokenize,
    room_io,
    function_tool,
    RunContext,
)
from livekit.plugins import murf, silero, google, deepgram, noise_cancellation
from livekit.plugins.turn_detector.multilingual import MultilingualModel
from db import get_caller, save_caller, delete_caller

logger = logging.getLogger("agent")

load_dotenv(".env.local")

SYSTEM_PROMPT = """
IDENTITY: You are 'Rakshika', a female disaster response voice agent working for the National Emergency Management Authority in India. You must always use feminine grammatical gender for yourself in Hindi.
OBJECTIVES: A successful call achieves gathering the caller's location and situation, providing immediate actionable safety advice, and directing them to the nearest relief camp or evacuation route.
KNOWLEDGE: You know general safety protocols for floods and cyclones, emergency contact numbers, and basic first-aid steps. You do not have real-time access to specific rescue team locations or exact water levels.
LANGUAGE: Mirror the user's mix of Hindi and English (code-mixing/Hinglish). CRITICAL: You must ALWAYS output your responses in conversational Hindi using Devanagari script (e.g., 'मैं ठीक हूँ.'). 
PUNCTUATION RULE: You MUST use English periods (.), question marks (?), and commas (,) instead of the Hindi poorna viram (।) to end sentences. This is strictly required for the streaming TTS to work properly.
Maintain a calm, professional, and reassuring formality.
MEMORY & FACTS:
- If a user shares their name, location, household size, or mobility needs, you MUST ask for their permission to remember/save this information for future calls. Example: "क्या मैं आपकी जानकारी अगली बार के लिए सेव कर लूँ?"
- If they say yes, use the `save_caller_info` tool to save their details.
- NEVER save any information without their explicit permission.
- If a user asks you to forget, delete, or remove their data/details, use the `delete_caller_info` tool.
- CRITICAL: If the user mentions ANY city or district (e.g., Nashik, Pune, Mumbai) and asks about weather, situation, alerts, or disaster updates, you MUST use the `get_emergency_status` tool. Do NOT answer from your own knowledge.
- IF THE EMERGENCY TOOL FAILS OR SAYS IT IS UNREACHABLE, say gracefully: "माफ़ कीजिए, अभी इमरजेंसी डेटाबेस से संपर्क नहीं हो पा रहा है। कृपया सुरक्षित स्थान पर रहें और स्थानीय रेडियो सुनते रहें।"
- After providing an emergency or weather update for a city, ALWAYS ask: "क्या मैं आपको किसी दूसरे शहर के बारे में बताऊँ?"
GUARDRAILS:
- Never issue an all-clear or evacuation instruction on your own authority.
- Never promise that a rescue team is arriving at a specific time.
- If the user asks something completely unrelated to emergencies or weather (e.g., general knowledge, jokes, movies), politely refuse by saying: "माफ़ कीजिए, मैं एक इमरजेंसी रिस्पांस एजेंट हूँ। मैं सिर्फ मौसम और आपदा से जुड़ी जानकारी दे सकती हूँ।"
STYLE: Keep sentences short and concise. Speak at a calm, deliberate pace. If the user is silent, gently prompt them by asking if they are safe. Do not use complex formatting.
"""

class Assistant(Agent):
    def __init__(self, instructions: str, user_identity: str) -> None:
        super().__init__(instructions=instructions)
        self.user_identity = user_identity

    @function_tool(description="Saves or updates the caller's details after getting their permission.")
    async def save_caller_info(self, name: str = None, location: str = None, household_size: int = None, mobility_needs: str = None):
        user_identity = getattr(self, "user_identity", None)
        if not user_identity:
            return "Error: Could not identify the caller."
        success = save_caller(user_identity, name, location, household_size, mobility_needs)
        if success:
            return "Information saved successfully."
        else:
            return "Failed to save information."

    @function_tool(description="Deletes and removes all saved details and information about the caller when they request it.")
    async def delete_caller_info(self):
        user_identity = getattr(self, "user_identity", None)
        if not user_identity:
            return "Error: Could not identify the caller."
        success = delete_caller(user_identity)
        if success:
            return "Information deleted successfully."
        else:
            return "Failed to delete information."

    @function_tool(description="Checks the current weather, active disaster alerts, and recent earthquakes for a specific district/city globally. Use this when the user asks about the situation, safety, weather, earthquakes, or alerts.")
    async def get_emergency_status(self, district: str):
        api_key = os.getenv("WEATHER_API_KEY")
        if not api_key:
            return "Error: WeatherAPI key is missing in configuration. The emergency database is unreachable."
            
        try:
            search_query = f"{district}, India"
            weather_url = f"http://api.weatherapi.com/v1/forecast.json?key={api_key}&q={search_query}&alerts=yes"
            quake_url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson"
            import aiohttp
            async with aiohttp.ClientSession() as session:
                # 1. Weather and Weather Alerts
                async with session.get(weather_url, timeout=5) as resp:
                    if resp.status == 400:
                        return f"No emergency data available for '{district}'. Please verify the city name."
                    if resp.status != 200:
                        return f"Error: The emergency database is currently unreachable (HTTP {resp.status})."
                    
                    data = await resp.json()
                    condition = data.get("current", {}).get("condition", {}).get("text", "Unknown")
                    temp = data.get("current", {}).get("temp_c", "Unknown")
                    alerts = data.get("alerts", {}).get("alert", [])
                    
                    status_message = f"Current weather in {district}: {temp}°C, {condition}. "
                    
                    if alerts:
                        alert_headlines = [alert.get("headline", "") for alert in alerts[:2]]
                        status_message += f"ACTIVE ALERTS: {' | '.join(alert_headlines)}. "
                    else:
                        status_message += "No active weather/disaster alerts. "

                # 2. Earthquake Data (USGS Free API)
                try:
                    async with session.get(quake_url, timeout=5) as q_resp:
                        if q_resp.status == 200:
                            q_data = await q_resp.json()
                            earthquakes = q_data.get("features", [])
                            local_quakes = []
                            for eq in earthquakes:
                                place = eq.get("properties", {}).get("place", "")
                                if place and district.lower() in place.lower():
                                    mag = eq.get("properties", {}).get("mag", 0)
                                    if mag >= 3.5: # Only report noticeable quakes (Magnitude 3.5+)
                                        local_quakes.append(f"Magnitude {mag} near {place}")
                            
                            if local_quakes:
                                status_message += f"EARTHQUAKE ALERT: {' | '.join(local_quakes[:2])}. "
                            else:
                                status_message += f"No recent earthquakes in or near {district}. "
                except Exception as e:
                    # Ignore earthquake API failure silently to not break weather
                    pass
                        
                return status_message
        except Exception as e:
            return f"Error: Could not connect to emergency database due to timeout or network issue."

server = AgentServer()

def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load(min_silence_duration=1.0)

server.setup_fnc = prewarm

@server.rtc_session(agent_name="my-agent")
async def my_agent(ctx: JobContext):
    ctx.log_context_fields = {
        "room": ctx.room.name,
    }

    # Join the room and connect to the user
    await ctx.connect()
    
    logger.info("Waiting for participant...")
    participant = await ctx.wait_for_participant()
    user_identity = participant.identity
    
    caller = get_caller(user_identity)
    instructions = SYSTEM_PROMPT
    if caller:
        instructions += f"\nMEMORY (Caller info from previous call): {caller}\nUse this info to respond if they ask about their details."

    agent_instance = Assistant(instructions=instructions, user_identity=user_identity)

    session = AgentSession(
        stt=deepgram.STT(model="nova-3", language="hi"),
        llm=google.LLM(
                model="gemini-3.5-flash-lite",
            ),
        tts=murf.TTS(
                voice="Namrita", 
                locale="hi-IN",
                tokenizer=tokenize.basic.SentenceTokenizer(min_sentence_len=2),
                text_pacing=False
            ),
        vad=ctx.proc.userdata["vad"],
        preemptive_generation=True,
    )

    # Start the session, which initializes the voice pipeline and warms up the models
    await session.start(
        agent=agent_instance,
        room=ctx.room,
    )

    logger.info(f"Participant joined with identity: {user_identity}")

    # Check if this is an outbound call based on the room name
    is_outbound = ctx.room.name.startswith("outbound-call")

    if is_outbound:
        # Mandatory Day 6 Outbound Greeting
        session.say("नमस्ते! मैं नेशनल इमरजेंसी रिस्पांस से रक्षिका बात कर रही हूँ। यह एक वेलफेयर चेक कॉल है। अगर आप यह कॉल नहीं चाहते हैं, तो कृपया 'स्टॉप' बोलें।", allow_interruptions=False)
    else:
        # Initiate the first turn by asking if they have spoken before, as requested by the user
        session.say("नमस्ते! मैं रक्षिका हूँ, नेशनल इमरजेंसी रिस्पांस एजेंट। क्या हम पहले बात कर चुके हैं? कृपया अपना नाम बताइये।", allow_interruptions=False)

    @session.on("metrics_collected")
    def on_metrics_collected(metrics):
        logger.info(f"Metrics collected (use this to check TTS latency): {metrics}")


if __name__ == "__main__":
    cli.run_app(server)
