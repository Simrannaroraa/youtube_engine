import sys
sys.path.insert(0, '/Users/simran/Desktop/pbl')

import main
import traceback

video_url = "https://www.youtube.com/watch?v=6H5gQXzN6vQ"

print(f"Testing get_transcript for {video_url}...")
try:
    text, data = main.get_transcript(video_url)
    print("SUCCESS!")
    print(f"Transcript Length: {len(text)}")
    print(f"Sample: {text[:100]}")
    if "fallback" in str(main.get_transcript.__doc__):
         print("(Note: Check logs to see if fallback was used)")
except Exception as e:
    print("FAILED.")
    traceback.print_exc()