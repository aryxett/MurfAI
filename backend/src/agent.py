import sys
import io
import logging
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
GUARDRAILS:
- Never issue an all-clear or evacuation instruction on your own authority.
- Never promise that a rescue team is arriving at a specific time.
- Escalation script: If the situation is life-threatening or they ask for something out-of-scope, say: "मैं समझ रही हूँ। मैं अभी आपको ह्यूमन इमरजेंसी ऑपरेटर से कनेक्ट कर रही हूँ जो आपकी तुरंत मदद करेंगे। कृपया लाइन पर बने रहें।"
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

server = AgentServer()

def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load(min_silence_duration=0.5)

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
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=lambda params: (
                    noise_cancellation.BVCTelephony()
                    if params.participant.kind
                    == rtc.ParticipantKind.PARTICIPANT_KIND_SIP
                    else noise_cancellation.BVC()
                ),
            ),
        ),
    )

    logger.info(f"Participant joined with identity: {user_identity}")

    # Initiate the first turn with a greeting based on memory
    if caller and caller.get("name"):
        name = caller.get("name")
        location = caller.get("location")
        greeting = f"नमस्ते {name}, फिर से स्वागत है! "
        if location:
            greeting += f"क्या {location} में अब सब सुरक्षित है? "
        greeting += "मैं आपकी कैसे मदद कर सकती हूँ?"
        session.say(greeting, allow_interruptions=False)
    else:
        session.say("नमस्ते! मैं रक्षिका हूँ, इमरजेंसी रिस्पांस एजेंट। आप अभी कहाँ हैं और क्या स्थिति है?", allow_interruptions=False)

    @session.on("metrics_collected")
    def on_metrics_collected(metrics):
        logger.info(f"Metrics collected (use this to check TTS latency): {metrics}")


if __name__ == "__main__":
    cli.run_app(server)
