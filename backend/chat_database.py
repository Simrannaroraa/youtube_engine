import sqlite3
from datetime import datetime
import json
import os


class ChatDatabase:
    """SQLite database manager for chat sessions and Q&A history"""
    
    def __init__(self, db_path="chat_sessions.db"):
        # Use absolute path to avoid issues with relative paths
        if not os.path.isabs(db_path):
            db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), db_path)
        self.db_path = db_path
        self.init_db()
    
    def init_db(self):
        """Create tables if they don't exist"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Chats table - stores session metadata and analysis results
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS chats (
                session_id TEXT PRIMARY KEY,
                video_id TEXT,
                video_url TEXT,
                chat_name TEXT,
                created_at TIMESTAMP,
                summary TEXT,
                takeaways TEXT,
                topics TEXT,
                analysis_time REAL
            )
        ''')
        
        # Q&A history table - stores all questions and answers
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS qa_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT,
                question TEXT,
                answer TEXT,
                timestamp TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES chats(session_id)
            )
        ''')
        
        conn.commit()
        conn.close()
    
    def save_chat(self, session_id, video_id, video_url, chat_name, 
                  summary, takeaways, topics, analysis_time):
        """Save a new chat session"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Convert lists to JSON strings for storage
            takeaways_json = json.dumps(takeaways) if isinstance(takeaways, list) else takeaways
            topics_json = json.dumps(topics) if isinstance(topics, list) else topics
            
            cursor.execute('''
                INSERT OR REPLACE INTO chats 
                (session_id, video_id, video_url, chat_name, created_at, summary, takeaways, topics, analysis_time)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (session_id, video_id, video_url, chat_name, 
                  datetime.now().isoformat(), summary, takeaways_json, topics_json, analysis_time))
            
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"Error saving chat: {e}")
            return False
    
    def add_qa(self, session_id, question, answer):
        """Add Q&A pair to a chat session"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO qa_history (session_id, question, answer, timestamp)
                VALUES (?, ?, ?, ?)
            ''', (session_id, question, answer, datetime.now().isoformat()))
            
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"Error adding Q&A: {e}")
            return False
    
    def get_all_chats(self):
        """Retrieve all saved chats ordered by creation date (newest first)"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT session_id, video_id, video_url, chat_name, created_at, 
                       summary, takeaways, topics, analysis_time 
                FROM chats 
                ORDER BY created_at DESC
            ''')
            chats = cursor.fetchall()
            
            conn.close()
            return chats
        except Exception as e:
            print(f"Error retrieving chats: {e}")
            return []
    
    def get_chat_by_id(self, session_id):
        """Retrieve a specific chat by session ID"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT session_id, video_id, video_url, chat_name, created_at, 
                       summary, takeaways, topics, analysis_time 
                FROM chats 
                WHERE session_id = ?
            ''', (session_id,))
            
            chat = cursor.fetchone()
            conn.close()
            return chat
        except Exception as e:
            print(f"Error retrieving chat: {e}")
            return None
    
    def get_chat_qa(self, session_id):
        """Get all Q&A pairs for a specific chat"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT question, answer, timestamp 
                FROM qa_history 
                WHERE session_id = ? 
                ORDER BY timestamp ASC
            ''', (session_id,))
            
            qa_list = cursor.fetchall()
            conn.close()
            return qa_list
        except Exception as e:
            print(f"Error retrieving Q&A: {e}")
            return []
    
    def delete_chat(self, session_id):
        """Delete a chat and all its Q&A history"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('DELETE FROM qa_history WHERE session_id = ?', (session_id,))
            cursor.execute('DELETE FROM chats WHERE session_id = ?', (session_id,))
            
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"Error deleting chat: {e}")
            return False
    
    def rename_chat(self, session_id, new_name):
        """Rename a chat"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                UPDATE chats 
                SET chat_name = ? 
                WHERE session_id = ?
            ''', (new_name, session_id))
            
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"Error renaming chat: {e}")
            return False
    
    def chat_exists(self, session_id):
        """Check if a chat session exists"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('SELECT 1 FROM chats WHERE session_id = ?', (session_id,))
            exists = cursor.fetchone() is not None
            
            conn.close()
            return exists
        except Exception as e:
            print(f"Error checking chat existence: {e}")
            return False
    
    def export_chat_as_json(self, session_id):
        """Export a chat session as JSON"""
        try:
            chat = self.get_chat_by_id(session_id)
            qa_list = self.get_chat_qa(session_id)
            
            if not chat:
                return None
            
            # Parse JSON strings back to lists
            takeaways = json.loads(chat[6]) if chat[6] else []
            topics = json.loads(chat[7]) if chat[7] else []
            
            export_data = {
                "session_id": chat[0],
                "video_id": chat[1],
                "video_url": chat[2],
                "chat_name": chat[3],
                "created_at": chat[4],
                "summary": chat[5],
                "takeaways": takeaways,
                "topics": topics,
                "analysis_time": chat[8],
                "qa_history": [
                    {
                        "question": qa[0],
                        "answer": qa[1],
                        "timestamp": qa[2]
                    }
                    for qa in qa_list
                ]
            }
            
            return export_data
        except Exception as e:
            print(f"Error exporting chat: {e}")
            return None
