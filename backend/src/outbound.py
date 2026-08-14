import asyncio
import os
import uuid
from dotenv import load_dotenv
from livekit.api import LiveKitAPI, CreateSIPParticipantRequest

load_dotenv(".env.local")

async def main():
    # Fetch environment variables
    url = os.getenv("LIVEKIT_URL")
    api_key = os.getenv("LIVEKIT_API_KEY")
    api_secret = os.getenv("LIVEKIT_API_SECRET")
    sip_trunk_id = os.getenv("LIVEKIT_SIP_TRUNK_ID")
    destination_number = os.getenv("DESTINATION_PHONE_NUMBER")

    if not all([url, api_key, api_secret, sip_trunk_id, destination_number]):
        print("Missing required environment variables. Please check .env.local.")
        print("Required: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_SIP_TRUNK_ID, DESTINATION_PHONE_NUMBER")
        return

    # Initialize LiveKit API
    api = LiveKitAPI(url, api_key, api_secret)

    # Generate a unique room name for this outbound call
    # The agent checks for 'outbound' in the room name to change its greeting
    room_name = f"outbound-call-{uuid.uuid4().hex[:8]}"

    print(f"Initiating outbound call to {destination_number}...")
    print(f"Room Name: {room_name}")
    print(f"SIP Trunk ID: {sip_trunk_id}")

    try:
        # Dispatch the SIP participant creation
        await api.sip.create_sip_participant(CreateSIPParticipantRequest(
            sip_trunk_id=sip_trunk_id,
            sip_call_to=destination_number,
            room_name=room_name,
            participant_identity=f"sip_caller_{destination_number.replace('+', '')}"
        ))
        print("Call dispatched successfully!")
        print("Ensure your backend agent is running so it can join the room.")
    except Exception as e:
        print(f"Failed to dispatch outbound call: {e}")
    finally:
        await api.aclose()

if __name__ == "__main__":
    asyncio.run(main())
