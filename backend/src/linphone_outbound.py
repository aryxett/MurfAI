import asyncio
import os
from dotenv import load_dotenv
from livekit import api

load_dotenv(".env.local")

async def main():
    sip_uri = os.getenv("LINPHONE_SIP_URI")
    trunk_id = os.getenv("LIVEKIT_SIP_OUTBOUND_TRUNK_ID")
    
    # We use this exact room name because our agent.py checks for it
    # to trigger the mandatory Day 6 Outbound greeting!
    room_name = "outbound-call-test"

    if not sip_uri or not trunk_id or "ST_" not in trunk_id:
        print("Error: Missing or invalid LINPHONE_SIP_URI or LIVEKIT_SIP_OUTBOUND_TRUNK_ID in .env.local")
        return

    # Initialize the LiveKit API client (automatically uses LIVEKIT_URL, API_KEY, API_SECRET from .env)
    lk_api = api.LiveKitAPI()
    
    print(f"Dialing Linphone SIP URI: {sip_uri}...")
    print(f"Connecting to LiveKit Room: {room_name}...")

    # Extract just the username from the SIP URI (e.g., sip:user@domain -> user)
    sip_user = sip_uri.replace("sip:", "").split("@")[0]

    try:
        # First, explicitly create the room to avoid 404 "object cannot be found" error
        print(f"Creating Room: {room_name}...")
        await lk_api.room.create_room(api.CreateRoomRequest(name=room_name))

        # IMPORTANT: Dispatch the agent to the room so it joins and speaks!
        print("Dispatching 'my-agent' to the room...")
        await lk_api.agent_dispatch.create_dispatch(
            api.CreateAgentDispatchRequest(agent_name="my-agent", room=room_name)
        )

        print(f"Dispatching SIP call to Linphone user: {sip_user}...")
        request = api.CreateSIPParticipantRequest(
            room_name=room_name,
            sip_call_to=sip_user,
            sip_number="+18005550199",
            trunk=api.SIPOutboundConfig(hostname="sip.linphone.org"),
            participant_identity="rakshika_user_1763",
            wait_until_answered=True,
            media_encryption=api.SIPMediaEncryption.SIP_MEDIA_ENCRYPT_DISABLE,
        )
        
        participant = await lk_api.sip.create_sip_participant(request)
        print(f"\nCall initiated successfully! SIP Participant ID: {participant.participant_id}")
        print("\nYour Linphone app on your smartphone should start ringing NOW!")
        print("Answer the call on your phone to hear Rakshika speak.")
    except Exception as e:
        print(f"\nFailed to initiate SIP call: {e}")
        print("Check if your LiveKit Server is running, credentials are correct, and the SIP Trunk exists.")
    finally:
        await lk_api.aclose()

if __name__ == "__main__":
    asyncio.run(main())
