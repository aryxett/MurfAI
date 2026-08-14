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
from orb_state import broadcast_active_agent

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
ESCALATION RULES (HUMAN HELP):
- You must ESCALATE to a human if: 1) The caller is trapped, injured, or needs urgent physical rescue. OR 2) The caller is reporting a missing person.
- STEP 1: BEFORE calling the `create_escalation` tool, you MUST ask the caller for permission: "मुझे आपकी जानकारी रेस्क्यू टीम को भेजनी होगी। क्या मैं आपकी डिटेल्स उनके साथ शेयर कर सकती हूँ?"
- CRITICAL: DO NOT call the `create_escalation` tool in the same turn when you ask for permission. You MUST stop speaking and wait for the user to reply.
- STEP 2: Only call the `create_escalation` tool AFTER the user explicitly says yes in their next reply.
- STEP 3: After the tool succeeds, give them the Reference ID and a clear next step. Example: "आपकी रिक्वेस्ट रेस्क्यू टीम को भेज दी गई है। आपका रेफरेंस नंबर [ID] है। कृपया शांत रहें, टीम जल्द ही आपसे संपर्क करेगी।"
DOCTOR HANDOFF RULES:
- If the caller describes an injury, medical symptom, health emergency, or explicitly asks for medical/first-aid advice (e.g. bleeding, chest pain, breathing difficulty, someone unconscious, 'mujhe chot lag gayi hai'), you MUST hand them off to the doctor specialist using the `transfer_to_doctor_specialist` tool.
- CRITICAL: You MUST call the tool SILENTLY. DO NOT generate any conversational text in your response when calling this tool. The tool itself will automatically speak the empathetic transfer message to the user.
- CRITICAL RULE FOR TOOLS: When calling the `create_escalation` tool, you MUST fill all the function arguments in strictly English ONLY. Never use Hindi for the tool arguments. For the `who` argument, provide ONLY the short first name of the caller (no extra details).
STYLE: Keep sentences short and concise. Speak at a calm, deliberate pace. If the user is silent, gently prompt them by asking if they are safe. Do not use complex formatting.
"""

class Assistant(Agent):
    def __init__(self, instructions: str, user_identity: str, ctx: JobContext) -> None:
        super().__init__(instructions=instructions)
        self.user_identity = user_identity
        self.ctx = ctx
        self.call_successful = False

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

    @function_tool(description="Creates a human escalation request when the caller is trapped, injured, or reporting a missing person. You MUST ask for permission before calling this tool.")
    async def create_escalation(
        self, 
        who: str, # ONLY the caller's short name in English (e.g. "Aryan")
        what_happened: str, # A short, 1-sentence summary of the situation in English (e.g. "Trapped in mud puddle.")
        what_agent_checked: str, # A short summary in English of the steps the agent took before escalating (e.g., "Verified location and obtained permission to escalate.")
        urgency: str, # MUST be exactly "HIGH" or "CRITICAL"
        language: str, # MUST be exactly "Hindi/English" (Do not use "hi" or other variations)
        preferred_contact: str # MUST be exactly "Phone Call"
    ):
        import random
        req_id = f"REQ-{random.randint(1000, 9999)}"
        
        # Save to a JSON file in the frontend so it can be displayed on the dashboard
        frontend_data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "frontend", "public")
        os.makedirs(frontend_data_dir, exist_ok=True)
        file_path = os.path.join(frontend_data_dir, "escalations.json")
        
        request_data = {
            "id": req_id,
            "who": who,
            "what_happened": what_happened,
            "what_agent_checked": what_agent_checked,
            "urgency": urgency,
            "language": language,
            "preferred_contact": preferred_contact,
            "timestamp": __import__('datetime').datetime.now().isoformat()
        }
        
        try:
            escalations = []
            if os.path.exists(file_path):
                with open(file_path, "r", encoding="utf-8") as f:
                    escalations = json.load(f)
            
            escalations.append(request_data)
            
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(escalations, f, indent=4, ensure_ascii=False)
                
            self.call_successful = True
                
            # Publish data to the room so the frontend can show the popup
            payload = json.dumps({"type": "escalation", "data": request_data}).encode("utf-8")
            if self.ctx and self.ctx.room:
                import asyncio
                async def delayed_publish():
                    await asyncio.sleep(3.0)  # Wait for agent TTS to start speaking
                    await self.ctx.room.local_participant.publish_data(payload, reliable=True)
                asyncio.create_task(delayed_publish())
                
            return f"Escalation request created successfully. Reference ID: {req_id}"
        except Exception as e:
            logger.error(f"Failed to create escalation: {e}")
            return "Error: Could not create the escalation request due to a system error."

    @function_tool(
        description=(
            "Hand off the call to the Doctor Specialist. Use this ONLY when the "
            "caller describes an injury, medical symptom, health emergency, or "
            "explicitly asks for medical/first-aid advice (e.g. bleeding, chest "
            "pain, breathing difficulty, someone unconscious, 'mujhe chot lag "
            "gayi hai', 'mera pet dukh raha hai'). Do NOT use this for shelter "
            "questions, weather/disaster status, or general rescue escalation - "
            "those stay with you and use get_emergency_status / create_escalation."
        )
    )
    async def transfer_to_doctor_specialist(self, context: RunContext):
        from doctor_specialist import DoctorSpecialist
        import asyncio
        from orb_state import broadcast_active_agent
        
        # Broadcast connecting state immediately to show quick UI update
        await broadcast_active_agent(self.ctx, "connecting_doctor")

        # Manually queue the empathetic speech
        await context.session.say(
            "ओह, घबराइए मत। मैं आपको एक स्पेशलिस्ट डॉक्टर से कनेक्ट कराती हूँ, वो आपकी इसमें मदद कर सकती हैं।",
            allow_interruptions=False,
        )

        # Wait 5.0 seconds to allow Rakshika's TTS to finish speaking
        await asyncio.sleep(5.0)

        return DoctorSpecialist(user_identity=self.user_identity, ctx=self.ctx)

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
                
                self.call_successful = True
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

    agent_instance = Assistant(instructions=instructions, user_identity=user_identity, ctx=ctx)

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

    # Explicitly set the orb to "rakshika" at the start of every call, so the
    # frontend is always in a known state (defensive - handles reconnects too)
    await broadcast_active_agent(ctx, "rakshika")

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

    @ctx.room.on("participant_disconnected")
    def on_participant_disconnected(p):
        if p.identity != user_identity:
            return
            
        logger.info(f"Call ended for {user_identity}. Success: {agent_instance.call_successful}")
        
        frontend_data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "frontend", "public")
        os.makedirs(frontend_data_dir, exist_ok=True)
        file_path = os.path.join(frontend_data_dir, "analytics.json")
        
        call_log = {
            "id": f"CALL-{__import__('random').randint(1000, 9999)}",
            "timestamp": __import__('datetime').datetime.now().isoformat(),
            "status": "Success" if agent_instance.call_successful else "Failed"
        }
        
        try:
            logs = []
            if os.path.exists(file_path):
                with open(file_path, "r", encoding="utf-8") as f:
                    try:
                        logs = json.load(f)
                    except json.JSONDecodeError:
                        logs = []
            
            logs.append(call_log)
            
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(logs, f, indent=4, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Failed to save analytics: {e}")


if __name__ == "__main__":
    cli.run_app(server)
