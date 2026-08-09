import sqlite3
import os
from datetime import datetime
import logging

logger = logging.getLogger("agent.db")

DB_PATH = os.path.join(os.path.dirname(__file__), "callers.db")

def init_db():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS callers (
                user_id TEXT PRIMARY KEY,
                name TEXT,
                location TEXT,
                household_size INTEGER,
                mobility_needs TEXT,
                last_interaction TIMESTAMP
            )
        ''')
        conn.commit()
        conn.close()
        logger.info(f"Initialized database at {DB_PATH}")
    except Exception as e:
        logger.error(f"Error initializing database: {e}")

def get_caller(user_id: str):
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM callers WHERE user_id = ?", (user_id,))
        row = cursor.fetchone()
        conn.close()
        if row:
            return dict(row)
        return None
    except Exception as e:
        logger.error(f"Error fetching caller {user_id}: {e}")
        return None

def save_caller(user_id: str, name: str = None, location: str = None, household_size: int = None, mobility_needs: str = None):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        now = datetime.now().isoformat()
        
        # Check if caller exists
        cursor.execute("SELECT * FROM callers WHERE user_id = ?", (user_id,))
        exists = cursor.fetchone()
        
        if exists:
            # Update existing
            updates = []
            params = []
            if name is not None:
                updates.append("name = ?")
                params.append(name)
            if location is not None:
                updates.append("location = ?")
                params.append(location)
            if household_size is not None:
                updates.append("household_size = ?")
                params.append(household_size)
            if mobility_needs is not None:
                updates.append("mobility_needs = ?")
                params.append(mobility_needs)
            
            updates.append("last_interaction = ?")
            params.append(now)
            
            params.append(user_id)
            
            query = f"UPDATE callers SET {', '.join(updates)} WHERE user_id = ?"
            cursor.execute(query, params)
        else:
            # Insert new
            cursor.execute('''
                INSERT INTO callers (user_id, name, location, household_size, mobility_needs, last_interaction)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (user_id, name, location, household_size, mobility_needs, now))
            
        conn.commit()
        conn.close()
        logger.info(f"Saved data for user {user_id}")
        return True
    except Exception as e:
        logger.error(f"Error saving caller {user_id}: {e}")
        return False

def delete_caller(user_id: str):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM callers WHERE user_id = ?", (user_id,))
        conn.commit()
        conn.close()
        logger.info(f"Deleted data for user {user_id}")
        return True
    except Exception as e:
        logger.error(f"Error deleting caller {user_id}: {e}")
        return False

# Initialize the DB when the module is imported
init_db()
