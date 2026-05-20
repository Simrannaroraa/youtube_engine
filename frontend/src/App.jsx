import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Zap, CheckCircle, FileText, Clock, Sparkles,
  MessageSquare, Send, X, Trash2, Edit2, LogOut
} from 'lucide-react';
import * as api from './api';
import { useAuth } from './AuthContext';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const AUTHOR_NAME = "Simran";
const GITHUB_URL = "#";
const PROJECT_VERSION = "1.0.0";

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function getYouTubeId(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('?')[0];
    return u.searchParams.get('v');
  } catch { return null; }
}

function parseTopics(raw) {
  if (!raw) return [];
  const regex = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*([^-\[]+?)\s*-\s*([^[\n]+)/g;
  const results = [];
  let m;
  while ((m = regex.exec(raw)) !== null) {
    results.push({ time: m[1].trim(), title: m[2].trim(), desc: m[3].trim().replace(/\.$/, '') });
  }
  return results;
}

// ─── GLOBAL STYLES ────────────────────────────────────────────────
const GLOBAL_CSS = `
  :root {
    --neon-cyan: #0077b6;
    --neon-purple: #7209b7;
    --neon-pink: #d90429;
    --neon-green: #2b9348;
    --neon-yellow: #e65f00;
    --dark-0: #fbf5f2;
    --dark-1: #f4e8e3;
    --dark-2: rgba(255, 250, 248, 0.85);
    --dark-3: #e8d7d0;
    --grid-color: rgba(0, 119, 182, 0.05);
    --border-cyan: rgba(0, 119, 182, 0.16);
    --border-cyan-hot: rgba(0, 119, 182, 0.55);
    --text-dim: rgba(15, 30, 54, 0.58);
    --text-mid: rgba(15, 30, 54, 0.76);
    --text-bright: #0c1e36;
    --text-white: #0c1e36;
    --nav-bg: rgba(251, 245, 242, 0.75);
    --nav-bg-scrolled: rgba(251, 245, 242, 0.95);
    --btn-hover-text: #ffffff;
    --input-area-bg: rgba(255, 255, 255, 0.6);
    --font-display: 'Orbitron', monospace;
    --font-mono: 'Share Tech Mono', monospace;
    --font-body: 'Rajdhani', sans-serif;
  }

  html { scroll-behavior: smooth; }
  body { background: var(--dark-0); color: var(--text-white); font-family: var(--font-body); overflow-x: hidden; }
  
  /* Scrollbar */
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: var(--dark-1); }
  ::-webkit-scrollbar-thumb { background: var(--neon-cyan); opacity: 0.5; border-radius: 2px; }

  /* Global grid background */
  .cyber-grid-bg {
    background-image:
      linear-gradient(var(--grid-color) 1px, transparent 1px),
      linear-gradient(90deg, var(--grid-color) 1px, transparent 1px);
    background-size: 40px 40px;
  }

  /* Scan lines overlay */
  .scanlines::after {
    content: '';
    position: fixed;
    inset: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(0,0,0,0.02) 2px,
      rgba(0,0,0,0.02) 4px
    );
    pointer-events: none;
    z-index: 9999;
  }

  /* Glitch text animation */
  @keyframes glitch {
    0%   { clip-path: inset(40% 0 61% 0); transform: translate(-2px, 0); }
    20%  { clip-path: inset(92% 0 1% 0);  transform: translate(1px, 0); }
    40%  { clip-path: inset(43% 0 1% 0);  transform: translate(-1px, 0); }
    60%  { clip-path: inset(25% 0 58% 0); transform: translate(2px, 0); }
    80%  { clip-path: inset(54% 0 7% 0);  transform: translate(-2px, 0); }
    100% { clip-path: inset(58% 0 43% 0); transform: translate(1px, 0); }
  }

  @keyframes glitch2 {
    0%   { clip-path: inset(65% 0 12% 0); transform: translate(2px, 0); filter: hue-rotate(90deg); }
    25%  { clip-path: inset(10% 0 75% 0); transform: translate(-2px, 0); filter: hue-rotate(180deg); }
    50%  { clip-path: inset(80% 0 5% 0);  transform: translate(1px, 0); filter: hue-rotate(270deg); }
    75%  { clip-path: inset(30% 0 50% 0); transform: translate(-1px, 0); filter: hue-rotate(360deg); }
    100% { clip-path: inset(15% 0 70% 0); transform: translate(2px, 0); filter: hue-rotate(90deg); }
  }

  .glitch-text {
    position: relative;
  }
  .glitch-text::before,
  .glitch-text::after {
    content: attr(data-text);
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .glitch-text::before {
    color: var(--neon-pink);
    animation: glitch 3s infinite linear;
    animation-delay: 0.5s;
  }
  .glitch-text::after {
    color: var(--neon-cyan);
    animation: glitch2 3s infinite linear;
  }

  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulse-border {
    0%, 100% { box-shadow: 0 0 0 0 rgba(0,119,182,0.2), inset 0 0 20px rgba(0,119,182,0.02); }
    50%       { box-shadow: 0 0 20px 4px rgba(0,119,182,0.08), inset 0 0 30px rgba(0,119,182,0.04); }
  }
  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeSlideIn {
    from { opacity: 0; transform: translateX(-12px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50%       { transform: translateY(-5px); }
  }
  @keyframes neon-flicker {
    0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% { opacity: 1; }
    20%, 24%, 55% { opacity: 0.6; }
  }
  @keyframes scan-line {
    0%   { transform: translateY(-100%); }
    100% { transform: translateY(100vh); }
  }
  @keyframes data-stream {
    0%   { background-position: 0% 0%; }
    100% { background-position: 0% 100%; }
  }
  @keyframes corner-pulse {
    0%, 100% { opacity: 0.5; }
    50%       { opacity: 1; }
  }

  .cyber-card {
    background: var(--dark-2);
    border: 1px solid var(--border-cyan);
    border-radius: 0;
    position: relative;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    transition: border-color 0.3s, box-shadow 0.3s;
    clip-path: polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px));
  }
  .cyber-card::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(0,119,182,0.02) 0%, transparent 50%);
    pointer-events: none;
  }
  .cyber-card:hover {
    border-color: var(--border-cyan-hot);
    box-shadow: 0 0 30px rgba(0,119,182,0.06), inset 0 0 30px rgba(0,119,182,0.02);
  }

  /* Corner decorators */
  .cyber-card::after {
    content: '';
    position: absolute;
    top: -1px; right: -1px;
    width: 16px; height: 16px;
    border-top: 1px solid var(--neon-cyan);
    border-right: 1px solid var(--neon-cyan);
    pointer-events: none;
    animation: corner-pulse 2s ease-in-out infinite;
  }

  .cyber-btn {
    font-family: var(--font-display);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    border: 1px solid var(--neon-cyan);
    background: transparent;
    color: var(--neon-cyan);
    padding: 10px 24px;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition: all 0.25s;
    clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
  }
  .cyber-btn::before {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--neon-cyan);
    transform: translateX(-101%);
    transition: transform 0.25s ease;
  }
  .cyber-btn:hover::before { transform: translateX(0); }
  .cyber-btn:hover { color: var(--btn-hover-text); box-shadow: 0 0 24px rgba(0,119,182,0.3); }
  .cyber-btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .cyber-btn:disabled::before { display: none; }
  .cyber-btn span { position: relative; z-index: 1; }

  .cyber-btn-solid {
    font-family: var(--font-display);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    border: 1px solid var(--neon-purple);
    background: rgba(114,9,183,0.1);
    color: var(--neon-purple);
    padding: 10px 28px;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition: all 0.25s;
    clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
  }
  .cyber-btn-solid:hover {
    background: var(--neon-purple);
    box-shadow: 0 0 24px rgba(114,9,183,0.3);
    color: white;
  }

  .cyber-input {
    background: rgba(0,119,182,0.03);
    border: 1px solid var(--border-cyan);
    color: var(--text-white);
    font-family: var(--font-mono);
    font-size: 13px;
    padding: 12px 16px;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
    width: 100%;
    clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%);
  }
  .cyber-input::placeholder { color: var(--text-dim); }
  .cyber-input:focus {
    border-color: var(--neon-cyan);
    box-shadow: 0 0 16px rgba(0,119,182,0.1), inset 0 0 16px rgba(0,119,182,0.02);
  }

  .section-label {
    font-family: var(--font-display);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.3em;
    color: var(--neon-cyan);
    text-transform: uppercase;
    animation: neon-flicker 5s infinite;
  }

  /* Marquee */
  @keyframes marquee {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }
  .marquee-track {
    display: flex;
    white-space: nowrap;
    animation: marquee 30s linear infinite;
  }

  /* Tag badge */
  .cyber-tag {
    font-family: var(--font-mono);
    font-size: 11px;
    padding: 3px 10px;
    border: 1px solid rgba(0,119,182,0.2);
    color: var(--text-mid);
    background: rgba(0,119,182,0.04);
    letter-spacing: 0.05em;
  }

  a { color: var(--neon-cyan); text-decoration: none; }
  a:hover { text-decoration: underline; }

  /* prose reset for ReactMarkdown */
  .md-prose p { margin: 0 0 8px; line-height: 1.65; }
  .md-prose ul { padding-left: 20px; }
  .md-prose li { margin-bottom: 6px; line-height: 1.6; }
  .md-prose li::marker { color: var(--neon-cyan); }
  .md-prose strong { color: var(--neon-cyan); }
`;

// ─── CHAPTER TIMELINE ─────────────────────────────────────────────────────────
function ChapterTimeline({ raw }) {
  const chapters = parseTopics(raw);

  if (!chapters.length) return (
    <div style={{ color: 'var(--text-mid)', fontSize: 14, lineHeight: 1.7, fontFamily: 'var(--font-body)' }}>
      <ReactMarkdown>{raw}</ReactMarkdown>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {chapters.map((ch, i) => (
        <div key={i} style={{ display: 'flex', gap: 0, position: 'relative', animation: `fadeSlideIn 0.4s ease ${i * 0.06}s both` }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 48, flexShrink: 0 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0, zIndex: 1,
              background: 'var(--neon-cyan)',
              boxShadow: '0 0 12px var(--neon-cyan), 0 0 24px rgba(0,245,255,0.4)',
            }} />
            {i < chapters.length - 1 && (
              <div style={{ flex: 1, width: 1, minHeight: 24, marginTop: 4,
                background: 'linear-gradient(to bottom, rgba(0,245,255,0.5) 0%, rgba(0,245,255,0.05) 100%)'
              }} />
            )}
          </div>
          <div style={{ flex: 1, paddingBottom: i < chapters.length - 1 ? 24 : 0, paddingLeft: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                color: 'var(--neon-cyan)', background: 'rgba(0,245,255,0.08)',
                border: '1px solid rgba(0,245,255,0.3)', padding: '2px 8px',
                textShadow: '0 0 8px var(--neon-cyan)',
              }}>
                {ch.time}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(0,245,255,0.3)', letterSpacing: '0.1em' }}>
                [{String(i + 1).padStart(2, '0')}]
              </span>
            </div>
            <p style={{ color: 'var(--text-white)', fontWeight: 600, fontSize: 13, margin: '0 0 3px', fontFamily: 'var(--font-body)', letterSpacing: '0.02em' }}>
              {ch.title}
            </p>
            <p style={{ color: 'var(--text-dim)', fontSize: 12, lineHeight: 1.6, margin: 0, fontFamily: 'var(--font-body)' }}>
              {ch.desc}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── TYPING INDICATOR ─────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '10px 14px',
      background: 'rgba(0,245,255,0.05)', border: '1px solid var(--border-cyan)',
      alignSelf: 'flex-start', maxWidth: '85%'
    }}>
      {[0, 180, 360].map((delay, i) => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: '50%', background: 'var(--neon-cyan)',
          display: 'inline-block', animation: `bounce 1s ${delay}ms infinite ease-in-out`,
          boxShadow: '0 0 8px var(--neon-cyan)',
        }} />
      ))}
    </div>
  );
}

// ─── NAVBAR ───────────────────────────────────────────────────────────────────
function Navbar({ onHistoryClick, onGetStarted, user, onSignIn, onSignOut }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 32px',
      background: scrolled ? 'var(--nav-bg-scrolled)' : 'var(--nav-bg)',
      backdropFilter: 'blur(12px)',
      borderBottom: `1px solid ${scrolled ? 'rgba(0,245,255,0.3)' : 'rgba(0,245,255,0.1)'}`,
      transition: 'all 0.3s',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ position: 'relative', width: 28, height: 28 }}>
          <div style={{ position: 'absolute', inset: 0, border: '2px solid var(--neon-cyan)', transform: 'rotate(45deg)',
            boxShadow: '0 0 12px var(--neon-cyan)', animation: 'corner-pulse 2s ease-in-out infinite' }} />
          <Zap size={14} color="var(--neon-cyan)" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
        </div>
        <div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--neon-cyan)',
            letterSpacing: '0.15em', textShadow: '0 0 16px var(--neon-cyan)' }}>
            YT ENGINE
          </span>
        </div>
      </div>

      {/* Nav items */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {user && (
          <button onClick={onHistoryClick} style={{
            background: 'none', border: 'none', fontFamily: 'var(--font-display)', fontSize: 10,
            letterSpacing: '0.2em', color: 'var(--text-mid)', cursor: 'pointer', textTransform: 'uppercase', transition: 'color 0.2s'
          }}
            onMouseEnter={e => e.target.style.color = 'var(--neon-cyan)'}
            onMouseLeave={e => e.target.style.color = 'var(--text-mid)'}
          >
            [ HISTORY ]
          </button>
        )}

        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {user.photoURL && (
              <img src={user.photoURL} alt="avatar"
                style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border-cyan)' }} />
            )}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-mid)',
              maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.displayName?.split(' ')[0] || user.email}
            </span>
            <button onClick={onSignOut} title="Sign out"
              style={{ background: 'none', border: '1px solid rgba(0,245,255,0.2)', color: 'var(--text-dim)',
                cursor: 'pointer', padding: '5px 8px', display: 'flex', alignItems: 'center',
                borderRadius: 2, transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--neon-cyan)'; e.currentTarget.style.color = 'var(--neon-cyan)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,245,255,0.2)'; e.currentTarget.style.color = 'var(--text-dim)'; }}
            >
              <LogOut size={13} />
            </button>
          </div>
        ) : (
          <button onClick={onSignIn} className="cyber-btn">
            <span>Sign In →</span>
          </button>
        )}
      </div>
    </nav>
  );
}

// ─── HERO ─────────────────────────────────────────────────────────────────────
function Hero() {
  const [typed, setTyped] = useState('');
  const full = '> ANALYZING_VIDEO_INTELLIGENCE...';
  useEffect(() => {
    let i = 0;
    const t = setInterval(() => {
      if (i <= full.length) { setTyped(full.slice(0, i)); i++; }
      else clearInterval(t);
    }, 55);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="cyber-grid-bg" style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      paddingTop: 60, padding: '60px 24px 0', position: 'relative', overflow: 'hidden',
    }}>
      {/* Background glow orbs */}
      <div style={{ position: 'absolute', top: '20%', left: '10%', width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,245,255,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '20%', right: '5%', width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(191,0,255,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />


      <div style={{ maxWidth: 800, width: '100%', textAlign: 'center', position: 'relative' }}>
        {/* Terminal line */}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--neon-green)',
          marginBottom: 32, letterSpacing: '0.05em', animation: 'fadeSlideUp 0.4s ease both' }}>
          {typed}<span style={{ animation: 'neon-flicker 0.8s infinite', color: 'var(--neon-green)' }}>█</span>
        </div>

        {/* Main headline */}
        <h1 style={{ position: 'relative', marginBottom: 8 }}>
          <span className="glitch-text" data-text="TURN ANY VIDEO"
            style={{ display: 'block', fontFamily: 'var(--font-display)', fontWeight: 900,
              fontSize: 'clamp(36px,7vw,80px)', lineHeight: 1.1, color: 'var(--text-bright)',
              textShadow: '0 0 40px rgba(0,245,255,0.3)', animation: 'fadeSlideUp 0.5s 0.2s both',
              letterSpacing: '0.04em' }}>
            TURN ANY VIDEO
          </span>
          <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontWeight: 900,
            fontSize: 'clamp(36px,7vw,80px)', lineHeight: 1.1,
            background: 'linear-gradient(90deg, var(--neon-cyan) 0%, #a855f7 50%, var(--neon-pink) 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            animation: 'fadeSlideUp 0.5s 0.3s both', letterSpacing: '0.04em' }}>
            INTO INTELLIGENCE
          </span>
        </h1>

        <p style={{ fontFamily: 'var(--font-body)', fontSize: 17, color: 'var(--text-mid)', maxWidth: 560,
          margin: '24px auto 40px', lineHeight: 1.7, fontWeight: 300, animation: 'fadeSlideUp 0.5s 0.4s both' }}>
          Paste a URL → extract an executive summary, timestamped chapters, key takeaways,
          and a RAG-powered AI that knows the entire video — in seconds.
        </p>

        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', animation: 'fadeSlideUp 0.5s 0.5s both' }}>
          <a href="#analyzer" className="cyber-btn" style={{ textDecoration: 'none', display: 'inline-block' }}>
            <span>⚡ Start Analyzing</span>
          </a>
          <a href="#features" className="cyber-btn-solid" style={{ textDecoration: 'none', display: 'inline-block' }}>
            <span>See How It Works</span>
          </a>
        </div>

        <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginTop: 32,
          animation: 'fadeSlideUp 0.5s 0.6s both' }}>
          {['NO LOGIN REQUIRED', 'FREE TO USE', 'INSTANT RESULTS'].map(t => (
            <span key={t} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.15em' }}>
              ◆ {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── MARQUEE STRIP ────────────────────────────────────────────────────────────
function MarqueeStrip() {
  const items = ['GEMINI 2.5 FLASH', 'LANGCHAIN', 'FAISS', 'RAG', 'YOUTUBE TRANSCRIPT API', 'TEXT-EMBEDDING-004', 'FASTAPI', 'PYTHON', 'REACT'];
  const repeated = [...items, ...items];
  return (
    <div style={{ overflow: 'hidden', borderTop: '1px solid rgba(0,245,255,0.15)', borderBottom: '1px solid rgba(0,245,255,0.15)',
      padding: '10px 0', background: 'rgba(0,245,255,0.02)' }}>
      <div className="marquee-track">
        {repeated.map((item, i) => (
          <span key={i} style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: '0.25em', color: 'var(--text-dim)',
            marginRight: 48, whiteSpace: 'nowrap' }}>
            ◆ {item}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── FEATURES ─────────────────────────────────────────────────────────────────
function Features() {
  const cards = [
    { Icon: FileText,      num: '01', title: 'EXECUTIVE SUMMARY',  color: 'var(--neon-cyan)',
      desc: 'A precise single-paragraph overview of the entire video, engineered for copy-paste intelligence.' },
    { Icon: Clock,         num: '02', title: 'TIMESTAMP CHAPTERS', color: 'var(--neon-purple)',
      desc: 'Major topic shifts mapped to MM:SS markers. Jump to exactly what you need with zero scrubbing.' },
    { Icon: Sparkles,      num: '03', title: 'KEY TAKEAWAYS',      color: 'var(--neon-pink)',
      desc: 'Top 5–7 insights extracted and formatted as a clean, scannable bullet list for rapid absorption.' },
    { Icon: MessageSquare, num: '04', title: 'RAG CHATBOT',        color: 'var(--neon-green)',
      desc: 'Ask anything. Every answer is grounded in the actual transcript — zero hallucinations, full context.' },
  ];

  return (
    <section id="features" className="cyber-grid-bg" style={{ padding: '80px 24px', background: 'var(--dark-1)' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <p className="section-label" style={{ marginBottom: 12 }}>◆ CAPABILITIES ◆</p>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(24px,4vw,40px)',
            color: 'var(--text-bright)', letterSpacing: '0.05em' }}>
            FOUR TOOLS.&nbsp;
            <span style={{ color: 'var(--neon-cyan)', textShadow: '0 0 20px var(--neon-cyan)' }}>ONE ENGINE.</span>
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
          {cards.map(({ Icon, num, title, color, desc }, i) => (
            <div key={title} className="cyber-card" style={{
              padding: 28, animationDelay: `${i * 0.08}s`,
              borderColor: `${color}33`,
              transition: 'border-color 0.3s, box-shadow 0.3s, transform 0.2s',
            }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = color;
                e.currentTarget.style.boxShadow = `0 0 30px ${color}22`;
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = `${color}33`;
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 14 }}>
                <div style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `1px solid ${color}55`, background: `${color}0d`, flexShrink: 0 }}>
                  <Icon size={20} color={color} />
                </div>
                <div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: `${color}99` }}>{num}</span>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600, color: '#000000',
                    letterSpacing: '0.1em', margin: '2px 0 0' }}>
                    {title}
                  </h3>
                </div>
              </div>
              <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-mid)', fontSize: 14, lineHeight: 1.65, margin: 0 }}>
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CHATBOT ──────────────────────────────────────────────────────────────────
function Chatbot({ sessionId, videoUrl, initialMessages = null }) {
  const [messages, setMessages] = useState(() => {
    if (initialMessages && initialMessages.length > 0) {
      return initialMessages;
    }
    return [
      { role: 'assistant', content: "SYSTEM ONLINE. Transcript indexed. I have full context of this video — query anything: concepts, timestamps, specific quotes, or comparisons." }
    ];
  });
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTyping]);

  // Update messages when initialMessages change (from loaded chat)
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  const handleSend = async () => {
    if (!input.trim() || isAsking) return;
    const q = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: q }]);
    setIsTyping(true);
    setIsAsking(true);
    try {
      const data = await api.askQuestion(sessionId, videoUrl, q);
      setIsTyping(false);
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
    } catch {
      setIsTyping(false);
      setMessages(prev => [...prev, { role: 'assistant', content: 'CONNECTION ERROR. Please retry.' }]);
    } finally { setIsAsking(false); }
  };

  return (
    <div style={{ background: 'var(--dark-2)', border: '1px solid var(--border-cyan)', marginTop: 2, position: 'relative',
      boxShadow: '0 0 30px rgba(0,245,255,0.05)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', borderBottom: '1px solid var(--border-cyan)',
        background: 'rgba(0,245,255,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--neon-green)',
            boxShadow: '0 0 8px var(--neon-green)', animation: 'corner-pulse 1.5s ease-in-out infinite' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 600,
            color: 'var(--neon-cyan)', letterSpacing: '0.2em' }}>RAG INTERFACE</span>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)' }}>
          GROUNDED IN TRANSCRIPT
        </span>
      </div>

      {/* Messages */}
      <div style={{ padding: '16px 20px', minHeight: 200, maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            padding: '10px 14px', fontSize: 13, maxWidth: '85%',
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            background: msg.role === 'user'
              ? 'rgba(191,0,255,0.15)'
              : 'rgba(0,245,255,0.05)',
            border: `1px solid ${msg.role === 'user' ? 'rgba(191,0,255,0.4)' : 'var(--border-cyan)'}`,
            color: 'var(--text-white)',
            fontFamily: 'var(--font-body)',
            lineHeight: 1.6,
            animation: 'fadeSlideUp 0.3s ease both',
          }}>
            {msg.role === 'assistant' && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--neon-cyan)', display: 'block', marginBottom: 4 }}>
                {'> SYSTEM'}
              </span>
            )}
            <div className="md-prose"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
          </div>
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 0, padding: '12px 16px', borderTop: '1px solid var(--border-cyan)',
        background: 'var(--input-area-bg)' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--neon-cyan)' }}>{'> '}</span>
          <input
            className="cyber-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="query the video..."
            style={{ paddingLeft: 28, clipPath: 'none', borderRight: 'none' }}
          />
        </div>
        <button
          onClick={handleSend}
          disabled={isAsking || !input.trim()}
          style={{
            background: 'var(--neon-cyan)', border: 'none', padding: '0 16px', cursor: isAsking ? 'not-allowed' : 'pointer',
            opacity: isAsking ? 0.4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s', flexShrink: 0,
          }}
          onMouseEnter={e => { if (!isAsking) e.currentTarget.style.boxShadow = '0 0 20px var(--neon-cyan)'; }}
          onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
        >
          <Send size={15} color="white" />
        </button>
      </div>
    </div>
  );
}

// ─── VIDEO EMBED ──────────────────────────────────────────────────────────────
function VideoEmbed({ url }) {
  const videoId = getYouTubeId(url);
  if (!videoId) return null;
  return (
    <div style={{
      aspectRatio: '16/9', width: '100%', marginBottom: 2,
      border: '1px solid var(--border-cyan)',
      boxShadow: '0 0 40px rgba(0,245,255,0.1), inset 0 0 40px rgba(0,0,0,0.5)',
      position: 'relative',
    }}>
      {/* Corner decorators */}
      {[
        { top: -1, left: -1, borderTop: '2px solid var(--neon-cyan)', borderLeft: '2px solid var(--neon-cyan)' },
        { top: -1, right: -1, borderTop: '2px solid var(--neon-cyan)', borderRight: '2px solid var(--neon-cyan)' },
        { bottom: -1, left: -1, borderBottom: '2px solid var(--neon-cyan)', borderLeft: '2px solid var(--neon-cyan)' },
        { bottom: -1, right: -1, borderBottom: '2px solid var(--neon-cyan)', borderRight: '2px solid var(--neon-cyan)' },
      ].map((s, i) => (
        <div key={i} style={{ position: 'absolute', width: 16, height: 16, ...s, zIndex: 2 }} />
      ))}
      <iframe
        src={`https://www.youtube.com/embed/${videoId}`}
        title="YouTube video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
      />
    </div>
  );
}

// ─── RESULT CARD WRAPPER ──────────────────────────────────────────────────────
function ResultCard({ icon: Icon, label, color = 'var(--neon-cyan)', children, delay = 0 }) {
  return (
    <div className="cyber-card" style={{ padding: 24, animation: `fadeSlideUp 0.4s ${delay}s both`,
      borderColor: `${color}33` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
        paddingBottom: 12, borderBottom: `1px solid ${color}22` }}>
        <Icon size={15} color={color} />
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 600,
          color, letterSpacing: '0.2em', textShadow: `0 0 12px ${color}` }}>
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

// ─── ANALYZER ─────────────────────────────────────────────────────────────────
function Analyzer({ onChatsChange, loadedChat = null, onLoadedChatChange = null, user, onSignIn }) {
  const [videoUrl, setVideoUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasResults, setHasResults] = useState(false);
  const [elapsed, setElapsed] = useState(null);
  const [error, setError] = useState(null);
  const [currentChat, setCurrentChat] = useState(null);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [chatMessages, setChatMessages] = useState(null);

  // When a chat is loaded from history
  useEffect(() => {
    if (loadedChat) {
      setCurrentChat({
        session_id: loadedChat.session_id,
        video_url: loadedChat.video_url,
        summary: loadedChat.summary,
        takeaways: loadedChat.takeaways,
        topics: loadedChat.topics
      });
      setCurrentSessionId(loadedChat.session_id);
      setHasResults(true);
      setChatMessages(loadedChat.messages || []);
      
      // Scroll to results
      setTimeout(() => {
        document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [loadedChat]);

  const handleAnalyze = async () => {
    if (!videoUrl.trim()) return;
    setIsLoading(true); setHasResults(false); setError(null);
    const t = Date.now();
    try {
      const data = await api.analyzeVideo(videoUrl);
      const chatData = await api.getChat(data.session_id);
      setCurrentSessionId(data.session_id);
      setCurrentChat({ session_id: chatData.session_id, video_url: chatData.video_url, summary: chatData.summary, takeaways: chatData.takeaways, topics: chatData.topics });
      setElapsed(((Date.now() - t) / 1000).toFixed(1));
      setHasResults(true);
      if (onChatsChange) onChatsChange();
    } catch (err) {
      setError(err.message);
    } finally { setIsLoading(false); }
  };

  return (
    <section id="analyzer" className="cyber-grid-bg" style={{ padding: '80px 24px', background: 'var(--dark-0)' }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <p className="section-label" style={{ marginBottom: 12 }}>◆ ANALYZE ◆</p>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(22px,3.5vw,36px)',
            color: 'var(--text-bright)', letterSpacing: '0.06em', margin: '0 0 10px' }}>
            INPUT TARGET URL
          </h2>
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-dim)', fontSize: 14, letterSpacing: '0.05em' }}>
            ANY PUBLIC VIDEO WITH CAPTIONS ENABLED
          </p>
        </div>

        {/* Auth gate — shown when not signed in */}
        {!user && (
          <div style={{
            marginTop: 8, border: '1px solid var(--border-cyan)',
            background: 'rgba(0,245,255,0.03)', padding: '40px 32px',
            textAlign: 'center', animation: 'fadeSlideUp 0.4s ease both',
          }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ width: 48, height: 48, border: '2px solid var(--neon-cyan)', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
                boxShadow: '0 0 20px rgba(0,245,255,0.2)' }}>
                <Zap size={22} color="var(--neon-cyan)" />
              </div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--neon-cyan)',
                letterSpacing: '0.15em', margin: '0 0 8px' }}>ACCESS REQUIRED</p>
              <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-dim)', fontSize: 14,
                lineHeight: 1.7, margin: 0 }}>
                Sign in or create an account to analyze videos and save your session history.
              </p>
            </div>
            <button onClick={onSignIn} className="cyber-btn">
              <span>⚡ Sign In / Sign Up</span>
            </button>
          </div>
        )}

        {/* Input — shown only when signed in */}
        {user && (
        <div style={{ display: 'flex', gap: 2, position: 'relative' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
              fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--neon-cyan)', zIndex: 1 }}>URL://</span>
            <input
              className="cyber-input"
              type="text"
              value={videoUrl}
              onChange={e => setVideoUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
              placeholder="www.youtube.com/watch?v=..."
              disabled={isLoading}
              style={{ paddingLeft: 60, clipPath: 'none' }}
            />
          </div>
          <button
            className="cyber-btn"
            onClick={handleAnalyze}
            disabled={isLoading || !videoUrl.trim()}
            style={{ padding: '0 28px', whiteSpace: 'nowrap' }}
          >
            <span>{isLoading ? 'SCANNING...' : '⚡ ANALYZE'}</span>
          </button>
        </div>

        )}

        {/* Error — only shown when signed in */}
        {error && (
          <div style={{ marginTop: 12, background: 'rgba(255,0,110,0.12)', border: '1px solid rgba(255,0,110,0.5)',
            padding: '14px 16px', fontFamily: 'var(--font-mono)', color: '#ff6b9d', fontSize: 13, lineHeight: 1.6,
            borderRadius: '4px', animation: 'fadeSlideUp 0.3s ease both' }}>
            <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 12, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              ⚠ ERROR
            </div>
            <div>{error}</div>
            {error.includes('captions') && (
              <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,107,157,0.8)', fontStyle: 'italic' }}>
                💡 Tip: Try a video from major creators (TED, educational channels, etc.) - they usually have captions.
              </div>
            )}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div style={{ marginTop: 16, background: 'rgba(0,245,255,0.03)', border: '1px solid var(--border-cyan)',
            padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
            animation: 'pulse-border 2s ease-in-out infinite' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 22, height: 22, border: '2px solid rgba(0,245,255,0.2)',
                borderTopColor: 'var(--neon-cyan)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--neon-cyan)', letterSpacing: '0.2em' }}>
                PROCESSING VIDEO
              </span>
            </div>
            <div style={{ display: 'flex', gap: 24 }}>
              {['EXTRACTING TRANSCRIPT', 'GENERATING SUMMARY', 'BUILDING VECTORS'].map((s, i) => (
                <span key={s} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.1em' }}>
                  ◆ {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {hasResults && currentChat && (
          <div id="results-section" style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Success banner */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10,
              background: 'rgba(57,255,20,0.06)', border: '1px solid rgba(57,255,20,0.3)',
              padding: '10px 16px', animation: 'fadeSlideUp 0.3s ease both' }}>
              <CheckCircle size={14} color="var(--neon-green)" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--neon-green)', letterSpacing: '0.1em' }}>
                ANALYSIS COMPLETE — {elapsed}s — SESSION ID: {currentSessionId?.slice(0, 8)}...
              </span>
            </div>

            <VideoEmbed url={currentChat.video_url} />

            <ResultCard icon={FileText} label="EXECUTIVE SUMMARY" delay={0.05}>
              <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-mid)', fontSize: 14, lineHeight: 1.75, margin: 0 }}>
                {currentChat.summary}
              </p>
            </ResultCard>

            <ResultCard icon={Sparkles} label="KEY TAKEAWAYS" color="var(--neon-purple)" delay={0.1}>
              <div className="md-prose" style={{ fontFamily: 'var(--font-body)', color: 'var(--text-mid)', fontSize: 14 }}>
                <ReactMarkdown>{currentChat.takeaways}</ReactMarkdown>
              </div>
            </ResultCard>

            <ResultCard icon={Clock} label="TIMESTAMP CHAPTERS" color="var(--neon-pink)" delay={0.15}>
              <ChapterTimeline raw={currentChat.topics} />
            </ResultCard>

            <Chatbot sessionId={currentSessionId} videoUrl={currentChat.video_url} initialMessages={chatMessages} />
          </div>
        )}
      </div>
    </section>
  );
}

// ─── ABOUT ────────────────────────────────────────────────────────────────────
function About() {
  const stack = ['React', 'FastAPI', 'Python', 'LangChain', 'Gemini 2.5 Flash', 'text-embedding-004', 'FAISS', 'YouTubeTranscriptApi', 'Groq'];
  const rows = [
    ['PROJECT', 'YT Insight Engine by Simran'],
    ['SEMESTER', '4th'],
    ['REPO', <a key="gh" href="https://github.com/Simrannaroraa/youtube_engine" target="_blank" rel="noopener noreferrer">View on GitHub →</a>],
  ];

  return (
    <section className="cyber-grid-bg" style={{ padding: '80px 24px', background: 'var(--dark-1)' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <p className="section-label" style={{ marginBottom: 12 }}>◆ ABOUT ◆</p>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(22px,3.5vw,36px)',
            color: 'var(--text-bright)', letterSpacing: '0.06em' }}>BUILT WITH MODERN AI TOOLING</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          {/* Project details */}
          <div className="cyber-card" style={{ padding: 28 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 600, color: 'var(--neon-cyan)',
              letterSpacing: '0.2em', margin: '0 0 20px' }}>PROJECT DETAILS</h3>
            {rows.map(([label, value], i) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '11px 0', fontSize: 13, borderBottom: i < rows.length - 1 ? '1px solid rgba(0,245,255,0.08)' : 'none' }}>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', fontSize: 11, letterSpacing: '0.1em' }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-body)', color: 'var(--text-white)', fontWeight: 500 }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Tech stack */}
          <div className="cyber-card" style={{ padding: 28 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 600, color: 'var(--neon-purple)',
              letterSpacing: '0.2em', margin: '0 0 20px', textShadow: '0 0 12px var(--neon-purple)' }}>TECH STACK</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {stack.map((tech, i) => (
                <span key={tech} className="cyber-tag" style={{
                  animationDelay: `${i * 0.05}s`,
                  borderColor: i % 3 === 0 ? 'rgba(0,245,255,0.3)' : i % 3 === 1 ? 'rgba(191,0,255,0.3)' : 'rgba(255,0,110,0.3)',
                  color: i % 3 === 0 ? 'var(--text-mid)' : i % 3 === 1 ? '#c084fc' : '#fb7185',
                }}>
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── FOOTER ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ background: 'var(--dark-0)', borderTop: '1px solid rgba(0,245,255,0.1)',
      padding: '28px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: 200, height: 1, background: 'linear-gradient(90deg, transparent, var(--neon-cyan), transparent)' }} />
      <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', fontSize: 12, margin: '0 0 4px', letterSpacing: '0.1em' }}>
        YT.INSIGHT.ENGINE // BUILT BY {AUTHOR_NAME.toUpperCase()}
      </p>
      <p style={{ fontFamily: 'var(--font-mono)', color: 'rgba(0,245,255,0.2)', fontSize: 11, margin: 0, letterSpacing: '0.08em' }}>
        POWERED BY LANGCHAIN + GEMINI + FAISS
      </p>
    </footer>
  );
}

// ─── HISTORY SIDEBAR ──────────────────────────────────────────────────────────
function HistorySidebar({ open, onClose, chats, onChatsChange, onChatSelect }) {
  const [sessions, setSessions] = useState([]);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    if (chats && chats.length) {
      setSessions(chats.map(c => ({
        id: c.session_id,
        name: c.chat_name || 'Untitled',
        createdAt: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
      })));
    }
  }, [chats]);

  const saveRename = (id) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, name: renameValue } : s));
    setRenamingId(null);
    api.renameChat && api.renameChat(id, renameValue)
      .then(() => { if (onChatsChange) onChatsChange(); })
      .catch(() => {});
  };

  const deleteSession = (id) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    setOpenMenuId(null);
    api.deleteChat && api.deleteChat(id).catch(() => {});
    if (onChatsChange) onChatsChange();
  };

  const handleChatClick = async (sessionId) => {
    try {
      const chatData = await api.getChat(sessionId);
      if (onChatSelect) {
        onChatSelect(chatData);
      }
      onClose();
    } catch (err) {
      console.error('Failed to load chat:', err);
    }
  };

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 40,
        background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
        opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity 300ms',
      }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, height: '100%', zIndex: 50,
        width: 320, background: 'var(--dark-1)',
        borderLeft: `1px solid ${open ? 'var(--border-cyan-hot)' : 'var(--border-cyan)'}`,
        display: 'flex', flexDirection: 'column',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 320ms cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: open ? '-20px 0 60px rgba(0,245,255,0.08)' : 'none',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px', borderBottom: '1px solid var(--border-cyan)',
          background: 'rgba(0,245,255,0.03)' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 600,
            color: 'var(--neon-cyan)', letterSpacing: '0.2em', textShadow: '0 0 12px var(--neon-cyan)' }}>
            SESSION LOG
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 4,
            transition: 'color 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--neon-cyan)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}>
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {sessions.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              height: '100%', gap: 14, color: 'var(--text-dim)' }}>
              <Clock size={24} />
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, textAlign: 'center', padding: '0 32px', margin: 0,
                letterSpacing: '0.08em', lineHeight: 1.8 }}>
                NO SESSIONS LOGGED.<br />ANALYZE A VIDEO TO BEGIN.
              </p>
            </div>
          ) : sessions.map((session, idx) => (
            <div key={session.id} style={{
              padding: '14px 16px', borderBottom: '1px solid rgba(0,245,255,0.06)',
              cursor: 'pointer', position: 'relative', transition: 'background 150ms',
              animation: `fadeSlideIn 0.3s ${idx * 0.05}s both`,
            }}
              onClick={() => !renamingId && handleChatClick(session.id)}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,245,255,0.04)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--neon-cyan)',
                  boxShadow: '0 0 6px var(--neon-cyan)', flexShrink: 0 }} />
                {renamingId === session.id ? (
                  <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveRename(session.id); if (e.key === 'Escape') setRenamingId(null); }}
                    style={{ flex: 1, background: 'transparent', border: 'none', borderBottom: '1px solid var(--neon-cyan)',
                      color: 'var(--text-bright)', fontSize: 13, outline: 'none', fontFamily: 'var(--font-mono)', padding: '0 0 2px' }}
                  />
                ) : (
                  <span style={{ flex: 1, fontFamily: 'var(--font-body)', color: 'var(--text-white)', fontSize: 13,
                    fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {session.name}
                  </span>
                )}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button onClick={e => { e.stopPropagation(); setRenamingId(session.id); setRenameValue(session.name); }}
                    style={{ background: 'rgba(0,245,255,0.1)', border: '1px solid rgba(0,245,255,0.3)', color: 'var(--neon-cyan)', cursor: 'pointer', padding: '6px 10px',
                      borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,245,255,0.2)'; e.currentTarget.style.boxShadow = '0 0 8px rgba(0,245,255,0.4)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,245,255,0.1)'; e.currentTarget.style.boxShadow = 'none'; }}
                    title="Rename">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); deleteSession(session.id); }}
                    style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', cursor: 'pointer', padding: '6px 10px',
                      borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.2)'; e.currentTarget.style.boxShadow = '0 0 8px rgba(248,113,113,0.4)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.1)'; e.currentTarget.style.boxShadow = 'none'; }}
                    title="Delete">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', fontSize: 11, margin: '5px 0 0 14px',
                letterSpacing: '0.05em' }}>
                {session.createdAt}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── AUTH MODAL ───────────────────────────────────────────────────────────────
function AuthModal({ onClose }) {
  const { signInWithEmail, signUpWithEmail } = useAuth();
  const [tab, setTab] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (tab === 'login') {
        await signInWithEmail(email, password);
      } else {
        if (!name.trim()) { setError('Please enter your name.'); setLoading(false); return; }
        await signUpWithEmail(email, password, name.trim());
      }
      onClose();
    } catch (err) {
      const map = {
        'auth/user-not-found': 'No account found with this email.',
        'auth/wrong-password': 'Incorrect password.',
        'auth/email-already-in-use': 'An account with this email already exists.',
        'auth/weak-password': 'Password must be at least 6 characters.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/invalid-credential': 'Invalid email or password.',
      };
      setError(map[err.code] || err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', background: 'rgba(0,245,255,0.04)',
    border: '1px solid rgba(0,245,255,0.25)', color: 'var(--text-white)',
    fontFamily: 'var(--font-body)', fontSize: 14, padding: '11px 14px',
    outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
    borderRadius: 2,
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
      animation: 'fadeSlideUp 0.25s ease both',
      padding: '24px',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 420,
        background: 'var(--dark-1)',
        border: '1px solid var(--border-cyan-hot)',
        boxShadow: '0 0 60px rgba(0,245,255,0.12), 0 0 120px rgba(0,245,255,0.04)',
        animation: 'fadeSlideUp 0.3s ease both',
        position: 'relative',
      }}>
        {/* Corner accents */}
        {[
          { top: -2, left: -2, borderTop: '2px solid var(--neon-cyan)', borderLeft: '2px solid var(--neon-cyan)' },
          { top: -2, right: -2, borderTop: '2px solid var(--neon-cyan)', borderRight: '2px solid var(--neon-cyan)' },
          { bottom: -2, left: -2, borderBottom: '2px solid var(--neon-cyan)', borderLeft: '2px solid var(--neon-cyan)' },
          { bottom: -2, right: -2, borderBottom: '2px solid var(--neon-cyan)', borderRight: '2px solid var(--neon-cyan)' },
        ].map((s, i) => (
          <div key={i} style={{ position: 'absolute', width: 14, height: 14, ...s }} />
        ))}

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid rgba(0,245,255,0.12)',
          background: 'rgba(0,245,255,0.03)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--neon-cyan)',
              boxShadow: '0 0 8px var(--neon-cyan)', animation: 'corner-pulse 1.5s ease-in-out infinite' }} />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 600,
              color: 'var(--neon-cyan)', letterSpacing: '0.2em' }}>
              {tab === 'login' ? 'AUTHENTICATE' : 'CREATE ACCOUNT'}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-dim)', padding: 4, transition: 'color 0.2s', display: 'flex' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--neon-cyan)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}>
            <X size={16} />
          </button>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(0,245,255,0.12)' }}>
          {['login', 'signup'].map(t => (
            <button key={t} onClick={() => { setTab(t); setError(''); }} style={{
              flex: 1, padding: '12px 0',
              background: tab === t ? 'rgba(0,245,255,0.07)' : 'transparent',
              border: 'none', borderBottom: tab === t ? '2px solid var(--neon-cyan)' : '2px solid transparent',
              color: tab === t ? 'var(--neon-cyan)' : 'var(--text-dim)',
              fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: '0.2em',
              cursor: 'pointer', transition: 'all 0.2s', textTransform: 'uppercase',
            }}>
              {t === 'login' ? '[ LOG IN ]' : '[ SIGN UP ]'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {tab === 'signup' && (
            <div>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)',
                letterSpacing: '0.15em', display: 'block', marginBottom: 6 }}>NAME</label>
              <input
                id="auth-name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={e => setName(e.target.value)}
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = 'var(--neon-cyan)'; e.target.style.boxShadow = '0 0 12px rgba(0,245,255,0.15)'; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(0,245,255,0.25)'; e.target.style.boxShadow = 'none'; }}
                autoComplete="name"
              />
            </div>
          )}

          <div>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)',
              letterSpacing: '0.15em', display: 'block', marginBottom: 6 }}>EMAIL</label>
            <input
              id="auth-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={inputStyle}
              onFocus={e => { e.target.style.borderColor = 'var(--neon-cyan)'; e.target.style.boxShadow = '0 0 12px rgba(0,245,255,0.15)'; }}
              onBlur={e => { e.target.style.borderColor = 'rgba(0,245,255,0.25)'; e.target.style.boxShadow = 'none'; }}
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)',
              letterSpacing: '0.15em', display: 'block', marginBottom: 6 }}>PASSWORD</label>
            <input
              id="auth-password"
              type="password"
              placeholder={tab === 'signup' ? 'At least 6 characters' : '••••••••'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={inputStyle}
              onFocus={e => { e.target.style.borderColor = 'var(--neon-cyan)'; e.target.style.boxShadow = '0 0 12px rgba(0,245,255,0.15)'; }}
              onBlur={e => { e.target.style.borderColor = 'rgba(0,245,255,0.25)'; e.target.style.boxShadow = 'none'; }}
              required
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {error && (
            <div style={{
              background: 'rgba(255,0,110,0.10)', border: '1px solid rgba(255,0,110,0.4)',
              padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12,
              color: '#ff6b9d', letterSpacing: '0.04em', lineHeight: 1.5,
            }}>
              ⚠ {error}
            </div>
          )}

          <button
            id="auth-submit-btn"
            type="submit"
            disabled={loading}
            className="cyber-btn"
            style={{ width: '100%', opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            <span>
              {loading
                ? '⏳ PROCESSING...'
                : tab === 'login' ? '⚡ LOG IN' : '⚡ CREATE ACCOUNT'}
            </span>
          </button>

          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)',
            textAlign: 'center', letterSpacing: '0.06em', margin: 0 }}>
            {tab === 'login' ? (
              <>No account?{' '}
                <span onClick={() => { setTab('signup'); setError(''); }}
                  style={{ color: 'var(--neon-cyan)', cursor: 'pointer', textDecoration: 'underline' }}>
                  Create one →
                </span>
              </>
            ) : (
              <>Already have one?{' '}
                <span onClick={() => { setTab('login'); setError(''); }}
                  style={{ color: 'var(--neon-cyan)', cursor: 'pointer', textDecoration: 'underline' }}>
                  Log in →
                </span>
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────

export default function App() {
  const { user, loading, signOut } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [chats, setChats] = useState([]);
  const [loadedChat, setLoadedChat] = useState(null);

  const loadChats = async () => { try { setChats(await api.getChats()); } catch {} };
  useEffect(() => { if (user) loadChats(); else setChats([]); }, [user]);

  const scrollToAnalyzer = () => document.getElementById('analyzer')?.scrollIntoView({ behavior: 'smooth' });

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--dark-0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '2px solid rgba(0,245,255,0.2)',
        borderTopColor: 'var(--neon-cyan)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  );

  return (
    <div className="scanlines" style={{ background: 'var(--dark-0)', minHeight: '100vh', color: 'var(--text-bright)', overflowX: 'hidden' }}>
      <style>{GLOBAL_CSS}</style>
      <Navbar
        onHistoryClick={() => setShowHistory(true)}
        onGetStarted={scrollToAnalyzer}
        user={user}
        onSignIn={() => setShowAuthModal(true)}
        onSignOut={signOut}
      />
      <Hero />
      <MarqueeStrip />
      <Features />
      <Analyzer
        onChatsChange={loadChats}
        loadedChat={loadedChat}
        onLoadedChatChange={setLoadedChat}
        user={user}
        onSignIn={() => setShowAuthModal(true)}
      />
      <About />
      <Footer />
      <HistorySidebar
        open={showHistory}
        onClose={() => setShowHistory(false)}
        chats={chats}
        onChatsChange={loadChats}
        onChatSelect={setLoadedChat}
      />
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </div>
  );
}