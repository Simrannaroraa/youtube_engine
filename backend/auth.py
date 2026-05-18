import os
import firebase_admin
from firebase_admin import auth
from fastapi import Header, HTTPException

# Initialize Firebase Admin SDK once at module load
# Only needs the project ID to verify tokens — fetches Google's public certs over HTTPS
# No service account JSON needed for token verification
_firebase_initialized = False

def _ensure_initialized():
    global _firebase_initialized
    if not _firebase_initialized:
        try:
            firebase_admin.get_app()
        except ValueError:
            project_id = os.getenv("FIREBASE_PROJECT_ID", "yt-insight-engine")
            firebase_admin.initialize_app(options={"projectId": project_id})
        _firebase_initialized = True


async def get_current_uid(authorization: str = Header(None)) -> str:
    """FastAPI dependency — verifies Firebase JWT and returns the user's uid."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Authentication required. Please sign in."
        )

    _ensure_initialized()
    token = authorization[len("Bearer "):]

    try:
        decoded = auth.verify_id_token(token)
        return decoded["uid"]
    except auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
    except auth.InvalidIdTokenError:
        raise HTTPException(status_code=401, detail="Invalid authentication token.")
    except Exception as e:
        print(f"Auth error: {str(e)}")
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")
