const API_BASE = 'http://localhost:8000/api';

export const analyzeVideo = async (videoUrl) => {
  const res = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_url: videoUrl }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.detail || 'Failed to analyze video');
  }
  return res.json();
};

export const getChats = async () => {
  const res = await fetch(`${API_BASE}/chats`);
  if (!res.ok) throw new Error('Failed to fetch chats');
  return res.json();
};

export const getChat = async (sessionId) => {
  const res = await fetch(`${API_BASE}/chats/${sessionId}`);
  if (!res.ok) throw new Error('Failed to fetch chat details');
  return res.json();
};

export const deleteChat = async (sessionId) => {
  const res = await fetch(`${API_BASE}/chats/${sessionId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete chat');
  return res.json();
};

export const renameChat = async (sessionId, newName) => {
  const res = await fetch(`${API_BASE}/chats/${sessionId}/rename`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_name: newName }),
  });
  if (!res.ok) throw new Error('Failed to rename chat');
  return res.json();
};

export const askQuestion = async (sessionId, videoUrl, question) => {
  const res = await fetch(`${API_BASE}/qa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, video_url: videoUrl, question }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.detail || 'Failed to get answer');
  }
  return res.json();
};
