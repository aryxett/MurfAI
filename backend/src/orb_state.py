"""
orb_state.py
------------
Shared helper used by both agent.py (Rakshika) and doctor_specialist.py
(Doctor) to broadcast which agent is currently active, so the frontend
orb can switch color in real time. Reuses the same data-channel
convention already used by create_escalation in agent.py.
"""

import json
import logging

logger = logging.getLogger("agent")


async def broadcast_active_agent(ctx, agent_id: str) -> None:
    """
    agent_id: "rakshika" | "doctor"
    Publishes {"type": "agent_switch", "data": {"agent": agent_id}}
    on the room's data channel.
    """
    if not ctx or not ctx.room:
        logger.warning("broadcast_active_agent: no room context available, skipping")
        return

    payload = json.dumps({"type": "agent_switch", "data": {"agent": agent_id}}).encode("utf-8")
    try:
        await ctx.room.local_participant.publish_data(payload, reliable=True)
        logger.info(f"Broadcast agent_switch -> {agent_id}")
    except Exception as e:
        logger.error(f"Failed to broadcast agent_switch event: {e}")
