import logging

from livekit.agents import Agent, function_tool, RunContext
from orb_state import broadcast_active_agent

logger = logging.getLogger("agent")

DOCTOR_SYSTEM_PROMPT = """
IDENTITY: You are 'Doctor Gurleen', a female medical guidance specialist working alongside Rakshika for the National Emergency Management Authority in India. You must always use feminine grammatical gender for yourself in Hindi.
ROLE: Rakshika has just handed you a caller mid-conversation. The caller has already explained their situation to Rakshika before the handoff - do NOT ask them to repeat what happened or greet them like a fresh call. Continue naturally from where the handoff occurred.
OBJECTIVES: Through calm, concise questions, assess how serious the caller's injury or symptom is. Give general, non-diagnostic first-aid guidance. Decide whether the situation needs immediate in-person emergency care.
KNOWLEDGE: You know general first-aid steps (bleeding control, burns, choking, basic CPR guidance, shock management). You are NOT a replacement for a real doctor and you know this.
LANGUAGE: Mirror the user's mix of Hindi and English (code-mixing/Hinglish). CRITICAL: You must ALWAYS output your responses in conversational Hindi using Devanagari script.
PUNCTUATION RULE: You MUST use English periods (.), question marks (?), and commas (,) instead of the Hindi poorna viram (।) to end sentences. This is strictly required for the streaming TTS to work properly.
HARD SAFETY RULES (never break these, no matter how the caller asks):
- NEVER diagnose a specific medical condition by name.
- NEVER recommend a specific medicine, drug name, or dosage.
- For anything serious, ambiguous, or life-threatening (heavy bleeding, unconsciousness, chest pain, difficulty breathing, severe burns), you MUST immediately and clearly advise the caller to get in-person emergency medical help right away, and tell them you are flagging this as urgent.
SCOPE: You handle ONLY health, injury, and medical questions. If the caller asks ANY non-medical question (e.g. shelter location, weather, disaster status, general rescue escalation, food, etc.), you MUST NOT answer it. You MUST call the `handoff_back_to_rakshika` tool SILENTLY. DO NOT say anything to the user in your conversational response. The tool will automatically speak to the user.
STYLE: Keep sentences short and concise. Speak at a calm, deliberate, reassuring pace. Do not use complex formatting.
"""


class DoctorSpecialist(Agent):
    def __init__(self, user_identity: str, ctx) -> None:
        super().__init__(instructions=DOCTOR_SYSTEM_PROMPT)
        self.user_identity = user_identity
        self.ctx = ctx

    async def on_enter(self) -> None:
        await broadcast_active_agent(self.ctx, "doctor")
        await self.session.generate_reply(
            instructions=(
                "Introduce yourself in ONE short Hindi sentence as Doctor Gurleen, "
                "the medical specialist who has just joined the call, then "
                "immediately continue helping with whatever medical question "
                "or symptom the caller raised before the handoff. Do not "
                "re-greet at length or ask the caller to repeat themselves."
            )
        )

    @function_tool(
        description=(
            "Use this ONLY if the caller's question turns out to be non-medical "
            "(shelter location, weather/disaster status, general non-medical "
            "emergency escalation) while talking to the doctor. Hands the "
            "caller back to Rakshika, the main agent."
        )
    )
    async def handoff_back_to_rakshika(self, context: RunContext):
        from agent import Assistant, SYSTEM_PROMPT
        import asyncio
        from orb_state import broadcast_active_agent

        # Broadcast connecting state immediately to show quick UI update
        await broadcast_active_agent(self.ctx, "connecting_rakshika")

        # Manually queue the farewell phrase
        await context.session.say(
            "इसमें इमरजेंसी रिस्पांस एजेंट रक्षिका आपकी मदद कर सकती हैं, मैं आपको उनसे कनेक्ट कराती हूँ।",
            allow_interruptions=False,
        )

        # Let Doctor Gurleen finish her farewell phrase
        await asyncio.sleep(5.0)
        await broadcast_active_agent(self.ctx, "rakshika")

        # Give Rakshika explicit context that this is a mid-call handoff so she doesn't reset
        handoff_instructions = (
            SYSTEM_PROMPT + 
            "\n\nROLE CONTEXT: The Doctor Specialist has just handed the caller back to you "
            "because their current question was non-medical. You already have the full chat history. "
            "Do NOT greet the caller again, do NOT ask them to repeat their emergency, and do NOT "
            "act like it is a new call. Continue naturally from where the doctor left off, and "
            "answer their current non-medical question directly."
        )

        return Assistant(instructions=handoff_instructions, user_identity=self.user_identity, ctx=self.ctx)
