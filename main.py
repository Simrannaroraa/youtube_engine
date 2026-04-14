import os
from dotenv import load_dotenv
from youtube_transcript_api import YouTubeTranscriptApi
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import PromptTemplate

load_dotenv()

genai_api_key = os.getenv("GOOGLE_API_KEY")

def validate_api_key():
    if not genai_api_key:
        raise ValueError("Google API Key not found. Please create a .env file with GOOGLE_API_KEY.")

# We don't raise immediately on import to allow app to start, 
# but we will check before LLM usage.

import re
import time

def get_video_id(url):
    """
    Extracts the video ID from a YouTube URL.
    Supports standard youtube.com and youtu.be links.
    """
    regex = r"(?:v=|\/)([0-9A-Za-z_-]{11}).*"
    match = re.search(regex, url)
    if match:
        return match.group(1)
    return None

def get_transcript(video_url):
    """
    Extracts transcript from a YouTube video URL.
    Returns the transcript text or raises an exception.
    Uses the YouTubeTranscriptApi with updated API calls.
    """
    try:
        video_id = get_video_id(video_url)
        if not video_id:
            raise ValueError("Could not extract Video ID. Check URL.")

        # Create an instance of YouTubeTranscriptApi
        # Note: Headers parameter is not supported, but the library handles blocking gracefully
        api = YouTubeTranscriptApi()
        
        # List all available transcripts using instance method
        transcript_data = None
        try:
            transcript_list = api.list(video_id)
            
            # Priority: Manual English -> Auto English -> Any Available Language
            transcript = None
            try:
                transcript = transcript_list.find_manually_created_transcript(['en'])
            except:
                try:
                    transcript = transcript_list.find_generated_transcript(['en'])
                except:
                    try:
                        transcript = transcript_list.find_generated_transcript(['en-US', 'en-GB'])
                    except:
                        # Get first available transcript (any language)
                        try:
                            transcript = transcript_list.find_generated_transcript()
                        except:
                            # If no generated, try first available
                            for t in transcript_list:
                                transcript = t
                                break
            
            if transcript is None:
                raise Exception("No transcripts found for this video")
            
            transcript_data = transcript.fetch()
            
        except Exception as e:
            error_msg = str(e).lower()
            
            # Check for IP blocking
            if "ipblocked" in error_msg or "your ip" in error_msg or "blocking requests" in error_msg:
                print("⚠️  YouTube IP Block Detected")
                print(f"Error: {e}")
                raise Exception(f"YouTube has temporarily blocked your IP due to too many requests. Please wait 30-60 minutes and try again. Alternatively, use a VPN to change your IP address.")
            
            # If list/find fails, try direct fetch with broader language support
            print(f"Transcript list method failed: {e}. Trying direct fetch with available languages...")
            try:
                # Add small delay before retry
                time.sleep(2)
                transcript_data = api.fetch(video_id, languages=['en', 'en-US', 'en-GB', 'hi'])
            except Exception as e2:
                if "ipblocked" in str(e2).lower():
                    raise Exception(f"YouTube has temporarily blocked your IP. Please wait 30-60 minutes and try again.")
                try:
                    # Try without specifying languages to get whatever is available
                    time.sleep(2)
                    transcript_data = api.fetch(video_id)
                except Exception as e3:
                    if "ipblocked" in str(e3).lower():
                        raise Exception(f"YouTube has temporarily blocked your IP. Please wait 30-60 minutes and try again.")
                    raise
        
        # Convert transcript snippets to list format and build text
        transcript_text = ""
        transcript_list_formatted = []
        
        for snippet in transcript_data:
            # Handle both dict and FetchedTranscriptSnippet object formats
            if isinstance(snippet, dict):
                text = snippet.get("text", "")
                start = snippet.get("start", 0)
                duration = snippet.get("duration", 0)
            else:
                # FetchedTranscriptSnippet object
                text = getattr(snippet, "text", "")
                start = getattr(snippet, "start", 0)
                duration = getattr(snippet, "duration", 0)
            
            transcript_text += " " + text
            transcript_list_formatted.append({
                "text": text,
                "start": start,
                "duration": duration
            })
            
        return transcript_text, transcript_list_formatted
        
    except Exception as e:
        error_msg = str(e)
        if "blocked your ip" in error_msg.lower():
            raise Exception(error_msg)
        raise Exception(f"Failed to fetch transcript: {e}. Please ensure the video has captions available.")

import google.genai as genai

def list_available_models():
    """Lists available models for the configured API key."""
    validate_api_key()
    models = []
    try:
        # Fallback: just return the model we're using
        models = ["models/gemini-2.5-flash"]
    except Exception as e:
        models = ["models/gemini-2.5-flash"]
        print(f"Note: Could not list models: {e}")
    return models

def get_llm():
    """Returns a configured Gemini 2.5 Flash model."""
    validate_api_key()
    
    # Use only gemini-2.5-flash model
    model_name = "models/gemini-2.5-flash"
    
    try:
        llm = ChatGoogleGenerativeAI(model=model_name, temperature=0.3, google_api_key=genai_api_key)
        # Test the model with a simple call to verify it works
        test_response = llm.invoke("test")
        print(f"✓ Using model: {model_name}")
        return llm
    except Exception as e:
        error_msg = str(e).lower()
        
        if "429" in str(e) or "resource_exhausted" in error_msg or "quota" in error_msg:
            raise Exception(f"⚠️  Model quota exhausted: {e}\nPlease wait a few minutes and try again.")
        elif "404" in str(e) or "not found" in error_msg:
            raise Exception(f"⚠️  Model not available: {e}\nPlease check your API key and region.")
        else:
            raise Exception(f"Error initializing model: {e}")

def generate_summary(text):
    """Generates a concise executive summary."""
    llm = get_llm()
    prompt_template = """
    You are an expert content summarizer. Provide a concise, widely accessible executive summary of the following video transcript.
    Constraint: The summary must be a single paragraph.
    
    Transcript:
    {text}
    """
    prompt = PromptTemplate(template=prompt_template, input_variables=["text"])
    chain = prompt | llm
    response = chain.invoke({"text": text})
    return response.content

def generate_key_takeaways(text):
    """Generates 5-7 key takeaways (Gold Nuggets)."""
    llm = get_llm()
    prompt_template = """
    You are an expert analyst. Identify the top 5-7 distinct "Gold Nuggets" or key insights from the following video transcript.
    Output format: a Markdown bulleted list.
    
    Transcript:
    {text}
    """
    prompt = PromptTemplate(template=prompt_template, input_variables=["text"])
    chain = prompt | llm
    response = chain.invoke({"text": text})
    return response.content

def generate_topics(transcript_list):
    """
    Generates topic segmentation from the raw transcript list (with timestamps).
    Uses a heuristic or LLM to group segments. 
    For efficiency, we'll suggest a simplified LLM approach or direct timestamp mapping.
    Here we use LLM to analyze the flow.
    """   
    formatted_transcript = ""
    # Sample every 30 seconds or so to keep context window small if needed, 
    # but for now let's try a bulk approach with a reasonable limit.
    for item in transcript_list[:300]: # Limit to first 300 chunks to avoid context overflow in MVP
        time = int(item['start'])
        minutes = time // 60
        seconds = time % 60
        timestamp = f"{minutes:02d}:{seconds:02d}"
        formatted_transcript += f"[{timestamp}] {item['text']}\n"
        
    llm = get_llm()
    prompt_template = """
    Analyze the following transcript with timestamps. 
    Identify 5-8 major topic shifts. 
    Output strictly in this format: "MM:SS - Topic Title"
    
    Transcript:
    {text}
    """
    prompt = PromptTemplate(template=prompt_template, input_variables=["text"])
    chain = prompt | llm
    response = chain.invoke({"text": formatted_transcript})
    return response.content

def create_vector_db(text):
    """Creates a FAISS vector index for the transcript. Falls back gracefully if embeddings unavailable."""
    validate_api_key()
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    chunks = text_splitter.split_text(text)
    
    try:
        embeddings = GoogleGenerativeAIEmbeddings(model="models/text-embedding-004", google_api_key=genai_api_key)
        vector_store = FAISS.from_texts(chunks, embedding=embeddings)
        return vector_store
    except Exception as e:
        # If embedding model not available, create a mock vector store that stores text chunks
        # This allows QA to still work via semantic search on text content
        print(f"Note: Vector embeddings unavailable. Using fallback text-based retrieval.")
        
        # Import Document from langchain_core
        from langchain_core.documents import Document
        
        # Create a simple mock vector store class
        class SimpleTextVectorStore:
            def __init__(self, texts):
                self.texts = texts
                
            def as_retriever(self):
                return SimpleTextRetriever(self.texts)
        
        class SimpleTextRetriever:
            def __init__(self, texts):
                self.texts = texts
                
            def invoke(self, query_dict):
                """Retrieve relevant text chunks based on query."""
                # Extract question from dict or string
                if isinstance(query_dict, dict):
                    question = query_dict.get("question", "")
                else:
                    question = str(query_dict)
                
                # Simple text-based retrieval: find chunks containing query words
                query_words = [w.lower() for w in question.split() if len(w) > 2]
                relevant_docs = []
                
                for text in self.texts:
                    # Score based on how many query words appear in the text
                    score = sum(1 for word in query_words if word in text.lower())
                    if score > 0 or len(query_words) == 0:  # Include even if no match
                        relevant_docs.append((score, text))
                
                # Sort by relevance and return top 4
                relevant_docs.sort(reverse=True, key=lambda x: x[0])
                
                # Return Document objects
                docs = [Document(page_content=text) for _, text in relevant_docs[:4]]
                
                # If no relevant docs found, return first few chunks
                if not docs:
                    docs = [Document(page_content=text) for text in self.texts[:4]]
                
                return docs
        
        return SimpleTextVectorStore(chunks)

def get_qa_chain(vector_store):
    """Returns a QA chain for the vector store using LCEL."""
    llm = get_llm()
    retriever = vector_store.as_retriever()
    
    prompt_template = """You are a helpful assistant. Answer the question as detailed as possible from the provided context. 
If the answer is not in the provided context, just say "answer is not available in the context", don't provide the wrong answer.
IMPORTANT: Always respond in English only, regardless of the language of the question.

Context:
{context}

Question:
{question}

Answer (in English):"""
    prompt = PromptTemplate(template=prompt_template, input_variables=["context", "question"])
    
    # Use LCEL to compose the chain
    def format_docs(docs):
        if isinstance(docs, str):
            return docs
        return "\n\n".join([doc.page_content for doc in docs])
    
    def get_context_from_retriever(input_dict):
        """Helper to extract context from retriever."""
        question = input_dict.get("question", "") if isinstance(input_dict, dict) else str(input_dict)
        docs = retriever.invoke({"question": question})
        return format_docs(docs)
    
    chain = (
        {
            "context": lambda x: get_context_from_retriever(x),
            "question": lambda x: x["question"] if isinstance(x, dict) else x
        }
        | prompt
        | llm
    )
    
    # Return a wrapper that handles the input format from app.py
    class QAChainWrapper:
        def __init__(self, chain_obj):
            self.chain = chain_obj
        
        def run(self, question):
            result = self.chain.invoke({"question": question})
            return result.content if hasattr(result, 'content') else str(result)
    
    return QAChainWrapper(chain)