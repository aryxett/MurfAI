import asyncio
from livekit import api

async def test():
    try:
        print(api.CreateAgentDispatchRequest.DESCRIPTOR.fields_by_name.keys())
    except Exception as e:
        print(e)

if __name__ == "__main__":
    asyncio.run(test())
