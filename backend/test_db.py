import os
import sys

# Add src directory to path so db can be imported
sys.path.append(os.path.join(os.path.dirname(__file__), "src"))
from db import save_caller, get_caller

success = save_caller("test_user_123", "Rahul", "Delhi", 4, "None")
print(f"Save success: {success}")
caller = get_caller("test_user_123")
print(f"Caller fetched: {caller}")
