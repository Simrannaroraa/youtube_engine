import { auth } from './firebase';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api';

// Attaches the Firebase JWT to every request
const authHeaders = async () => {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const analyzeVideo = async (videoUrl) => {
  const res = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ video_url: videoUrl }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.detail || 'Failed to analyze video');
  }
  return res.json();
};

export const getChats = async () => {
  const res = await fetch(`${API_BASE}/chats`, { headers: await authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch chats');
  return res.json();
};

export const getChat = async (sessionId) => {
  const res = await fetch(`${API_BASE}/chats/${sessionId}`, { headers: await authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch chat details');
  return res.json();
};

export const deleteChat = async (sessionId) => {
  const res = await fetch(`${API_BASE}/chats/${sessionId}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete chat');
  return res.json();
};

export const renameChat = async (sessionId, newName) => {
  const res = await fetch(`${API_BASE}/chats/${sessionId}/rename`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify({ new_name: newName }),
  });
  if (!res.ok) throw new Error('Failed to rename chat');
  return res.json();
};

export const askQuestion = async (sessionId, videoUrl, question) => {
  const res = await fetch(`${API_BASE}/qa`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ session_id: sessionId, video_url: videoUrl, question }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.detail || 'Failed to get answer');
  }
  return res.json();
};
