import streamlit as st
from utils import *
import utils
import time

# --- Page Config ---
st.set_page_config(
    page_title="YT Insight Engine",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded"
)

# --- Custom CSS for Dark Pink Theme ---
st.markdown("""
<style>
    /* Main Background */
    .stApp {
        background-color: #1a0f1a;
        color: #E0D5E0;
    }
    
    /* Sidebar */
    [data-testid="stSidebar"] {
        background-color: #220d22;
        border-right: 2px solid #8b3a8b;
    }
    
    /* Inputs */
    .stTextInput > div > div > input {
        background-color: #2d1a2d;
        color: #ff69b4; /* Hot Pink */
        border: 2px solid #8b3a8b;
        border-radius: 8px;
    }
    
    /* Buttons */
    .stButton > button {
        background: linear-gradient(90deg, #ff1493 0%, #ff69b4 100%);
        color: #fff;
        font-weight: bold;
        border: none;
        border-radius: 8px;
        padding: 0.5rem 1rem;
        transition: all 0.3s ease;
    }
    .stButton > button:hover {
        transform: scale(1.02);
        box-shadow: 0 0 15px rgba(255, 20, 147, 0.6);
    }
    
    /* Headers */
    h1, h2, h3 {
        color: #ff1493; /* Deep Pink */
        font-family: 'Segoe UI', sans-serif;
        text-shadow: 0 0 10px rgba(255, 20, 147, 0.3);
    }
    
    /* Cards/Expanders */
    .streamlit-expanderHeader {
        background-color: #3d2a3d;
        color: #FFB6D9;
        border-radius: 8px;
        border-left: 3px solid #ff1493;
    }
    .stAlert {
        background-color: #2d1a2d;
        color: #FFB6D9;
        border: 2px solid #8b3a8b;
        border-radius: 8px;
    }
    
    /* Chat Message */
    .stChatMessage {
        background-color: #2d1a2d;
        border-radius: 10px;
        padding: 10px;
        margin-bottom: 5px;
        border-left: 3px solid #ff69b4;
    }
    
    /* Status and Spinner */
    .stStatus {
        background-color: #2d1a2d;
        border: 1px solid #8b3a8b;
    }
    
    /* Progress Bar */
    .stProgress > div > div > div {
        background: linear-gradient(90deg, #ff1493 0%, #ff69b4 100%);
    }
    
    /* Text Input Placeholder */
    .stTextInput > div > div > input::placeholder {
        color: #b8658b;
    }
</style>
""", unsafe_allow_html=True)

# --- Session State Initialization ---
if "summary" not in st.session_state:
    st.session_state["summary"] = None
if "takeaways" not in st.session_state:
    st.session_state["takeaways"] = None
if "topics" not in st.session_state:
    st.session_state["topics"] = None
if "vector_store" not in st.session_state:
    st.session_state["vector_store"] = None
if "transcript_text" not in st.session_state:
    st.session_state["transcript_text"] = None
if "messages" not in st.session_state:
    st.session_state["messages"] = []

# --- Sidebar ---
with st.sidebar:
    st.title("⚡ Insight History")
    st.markdown("---")
    # Mock history for now
    st.caption("No recent history.")
    st.markdown("---")
    st.info("💡 Tip: Use a video with clear spoken audio for best results.")

# --- Main Layout ---
st.title("📺 YT Insight Engine")
st.markdown("Attributes **Executive Summary**, **Gold Nuggets**, and **Interactive Q&A** from any YouTube video.")

video_url = st.text_input("Enter YouTube Video URL:", placeholder="https://www.youtube.com/watch?v=...")

if st.button("Analyze Video ⚡"):
    if not video_url:
        st.warning("Please enter a valid URL.")
    else:
        try:
            # Clear previous chat history when analyzing a new video
            st.session_state["messages"] = []
            
            # Start timing
            start_time = time.time()
            
            # Check if video is in cache (without extracting transcript first)
            video_id = utils.get_video_id(video_url)
            if video_id in utils._analysis_cache:
                st.info("⚡ This video is cached! Loading instantly...")
            
            with st.spinner("Initialising Quantum Link... (Extracting Transcript)"):
                transcript_start = time.time()
                transcript_text, transcript_list = utils.get_transcript(video_url)
                st.session_state["transcript_text"] = transcript_text
                transcript_time = time.time() - transcript_start
            
            # Show video thumbnail/embed
            st.video(video_url)
            
            progress_bar = st.progress(0, text="Analyzing Content...")
            
            with st.status("Processing intelligence...", expanded=True):
                st.write("⏱️ Running 4 analysis tasks sequentially (respecting rate limits)...")
                
                # Run all 4 analysis steps sequentially (with caching)
                analysis_start = time.time()
                summary, takeaways, topics, vector_store, is_cached = utils.analyze_in_parallel(video_url, transcript_text, transcript_list)
                analysis_time = time.time() - analysis_start
                
                # Store results
                st.session_state["summary"] = summary
                st.session_state["takeaways"] = takeaways
                st.session_state["topics"] = topics
                st.session_state["vector_store"] = vector_store
                
                st.write(f"✓ Summary generated")
                st.write(f"✓ Takeaways extracted")
                st.write(f"✓ Topics segmented")
                st.write(f"✓ Knowledge base built")
                
                progress_bar.progress(100, text="Analysis Complete!")
                time.sleep(0.5)
                progress_bar.empty()
            
            # Calculate and display processing time with breakdown
            elapsed_time = time.time() - start_time
            
            if is_cached:
                st.success(f"⚡ Analysis completed in {elapsed_time:.2f} seconds (loaded from cache - no API calls made!)")
                st.balloons()  # Celebration animation for instant cache hit
            else:
                st.success(f"✅ Analysis completed in {elapsed_time:.2f} seconds")
            st.info(f"📊 Breakdown: Transcript extraction: {transcript_time:.2f}s | Analysis: {analysis_time:.2f}s")
                
        except ValueError as e:
            if "API Key" in str(e):
                 st.error(f"⚠️ {e}")
                 st.markdown("""
                 **Action Required:**
                 1. Get a free Groq API Key at [console.groq.com](https://console.groq.com)
                 2. Create a file named `.env` in the project folder
                 3. Add: `GROQ_API_KEY=your_key_here`
                 4. Restart the app
                 
                 **Why Groq?**
                 ✓ Completely FREE (unlimited requests!)
                 ✓ No quota limits
                 ✓ Fastest inference speed
                 ✓ No exhaustion worries
                 """)
            else:
                 st.error(f"Error accessing video data: {e}. Please ensure the video has captions enabled.")
        except Exception as e:
            if "404" in str(e) and "models/" in str(e):
                st.error(f"⚠️ Model Error: {e}")
                st.warning("The specified model is not available for your API Key/Region.")
                
                with st.spinner("Fetching available models..."):
                    available = utils.list_available_models()
                    st.code("\n".join(available), language="text")
                    st.info("Please update the model name in utlis.py to one of the above.")
            else:
                st.error(f"An unexpected error occurred: {e}")

# --- Display Results ---
if st.session_state["summary"]:
    col1, col2 = st.columns([2, 1])
    
    with col1:
        st.subheader("📝 Executive Summary")
        st.info(st.session_state["summary"])
        
        st.subheader("💎 Key Takeaways")
        st.markdown(st.session_state["takeaways"])
        
    with col2:
        st.subheader("📍 Topic Timeline")
        st.markdown(st.session_state["topics"])

    st.markdown("---")
    
    # --- RAG Q&A Interface ---
    st.subheader("🤖 Ask the Video")
    
    # Display chat messages
    for message in st.session_state["messages"]:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])

    if prompt := st.chat_input("Ask a question about the video content..."):
        st.session_state["messages"].append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        if st.session_state["vector_store"]:
            with st.spinner("Thinking..."):
                qa_chain = utils.get_qa_chain(st.session_state["vector_store"])
                response = qa_chain.run(prompt)
                
            st.session_state["messages"].append({"role": "assistant", "content": response})
            with st.chat_message("assistant"):
                st.markdown(response)
        else:
            st.error("Vector Store not initialized. Please analyze a video first.")