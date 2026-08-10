import asyncio
import os
from livekit.agents import llm
from agent import Assistant

async def test():
    agent = Assistant(instructions="You are a helpful assistant.", user_identity="test_user")
    try:
        tools = llm.find_function_tools(agent)
        print(f"Found {len(tools)} tools on agent:")
        for t in tools:
            print(f"- {t.tool_info.name}")
    except Exception as e:
        print(f"Error exploring tools: {e}")

asyncio.run(test())
