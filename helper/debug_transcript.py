from youtube_transcript_api import YouTubeTranscriptApi
import re
import time

video_url = "https://www.youtube.com/watch?v=6H5gQXzN6vQ"

def get_video_id(url):
    regex = r"(?:v=|\/)([0-9A-Za-z_-]{11}).*"
    match = re.search(regex, url)
    if match:
        return match.group(1)
    return None

try:
    video_id = get_video_id(video_url)
    print(f"Video ID: {video_id}")
    
    # Add delay to avoid IP blocking
    print("Waiting 5 seconds to avoid IP block...")
    time.sleep(5)
    
    # Use instance method instead of static method
    api = YouTubeTranscriptApi()
    
    print("Attempting list (instance method)...")
    transcript_list = api.list(video_id)
    
    print("Available transcripts:")
    for t in transcript_list:
        print(f" - {t.language} ({t.language_code}) | Generated: {t.is_generated}")
        
    print("Fetching English transcript...")
    transcript = transcript_list.find_generated_transcript(['en'])
    data = transcript.fetch()
    print(f"First 100 chars: {str(data)[:100]}")
    print("Success!")

except Exception as e:
    if "IpBlocked" in str(type(e).__name__):
        print(f"\n⚠️  IP Blocked Error: YouTube is blocking requests from your IP")
        print(f"Cause: {e}")
        print(f"\nSolutions:")
        print(f"1. Wait 30-60 minutes and try again (IP block is temporary)")
        print(f"2. Use a VPN or proxy to change your IP")
        print(f"3. Use headers to mimic a browser request")
    else:
        print(f"Error: {e}")
    import traceback
    traceback.print_exc()