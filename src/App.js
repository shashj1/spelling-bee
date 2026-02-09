import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import Confetti from './components/Confetti';
import SoundWave from './components/SoundWave';
import {
  getStoredFirebaseConfig, saveFirebaseConfig, initFirebase, isFirebaseReady,
  getApiKeys, saveApiKeys, getGroups, saveGroups, getWeekData, saveWeekData,
  uploadAudio, logPractice, getPracticeData, getChildren,
  saveChildren, getCurrentWeekId
} from './firebase';
import { generateSpellingContent, extractWordsFromPhoto, generateSpeech } from './services/ai';
import { playAudioUrl, stopAudio, speakText, playMusic, stopMusic } from './services/audio';

// ==================== SETUP WIZARD ====================
function SetupWizard({ onComplete }) {
  const [step, setStep] = useState(1);
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [groups, setGroups] = useState(['PENS', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Firebase config is hardcoded — init it immediately
  useEffect(() => {
    const config = getStoredFirebaseConfig();
    initFirebase(config);
  }, []);

  const handleApiKeysSubmit = async () => {
    setError('');
    if (!anthropicKey.trim()) { setError('Anthropic API key is required'); return; }
    if (!openaiKey.trim()) { setError('OpenAI API key is required (for text-to-speech)'); return; }
    setLoading(true);
    try {
      await saveApiKeys({ anthropic: anthropicKey.trim(), openai: openaiKey.trim() });
      setStep(2);
    } catch (e) { setError('Failed to save API keys. Have you enabled Firestore in your Firebase console? Error: ' + e.message); }
    setLoading(false);
  };

  const handleGroupsSubmit = async () => {
    const validGroups = groups.filter(g => g.trim());
    if (validGroups.length === 0) { setError('Add at least one spelling group'); return; }
    setLoading(true);
    try {
      await saveGroups(validGroups.map(g => g.trim().toUpperCase()));
      onComplete();
    } catch (e) { setError('Failed to save groups: ' + e.message); }
    setLoading(false);
  };

  return (
    <div className="app-bg">
      <div className="container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div className="setup-step fade-in">
          <div style={{ fontSize: '60px', marginBottom: '20px' }}>🐝</div>
          {step === 1 && (<>
            <h2>Welcome to Spelling Bee!</h2>
            <p>To get started, we need two API keys. These are stored securely in the cloud so other parents won't need to enter them — they're only used about once a week when new spelling words are uploaded.</p>
            <div style={{ textAlign: 'left' }}>
              <label className="input-label">Anthropic API Key (for generating sentences & stories)</label>
              <input type="password" className="input-field mb-12" value={anthropicKey} onChange={e => setAnthropicKey(e.target.value)} placeholder="sk-ant-..." />
              <label className="input-label">OpenAI API Key (for text-to-speech audio)</label>
              <input type="password" className="input-field mb-20" value={openaiKey} onChange={e => setOpenaiKey(e.target.value)} placeholder="sk-..." />
            </div>
            {error && <p style={{ color: '#E74C3C', marginBottom: '12px', fontWeight: 600 }}>{error}</p>}
            <button className="btn btn-primary btn-large" onClick={handleApiKeysSubmit} disabled={loading}>{loading ? 'Saving...' : 'Save & Continue →'}</button>
            <p style={{ marginTop: '16px', fontSize: '0.85rem', color: 'var(--text-light)' }}>See the README for how to get these keys (takes 2 minutes).</p>
          </>)}
          {step === 2 && (<>
            <h2>Spelling Groups 📚</h2>
            <p>Enter the spelling group names from school. You can always add more later in Settings.</p>
            <div style={{ textAlign: 'left' }}>
              {groups.map((g, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                  <input className="input-field" value={g} onChange={e => { const n = [...groups]; n[i] = e.target.value; setGroups(n); }} placeholder={`Group ${i + 1} name`} />
                  {groups.length > 1 && <button className="btn btn-outline btn-small" onClick={() => setGroups(groups.filter((_, j) => j !== i))}>✕</button>}
                </div>
              ))}
              <button className="btn btn-outline btn-small mt-12" onClick={() => setGroups([...groups, ''])}>+ Add Group</button>
            </div>
            {error && <p style={{ color: '#E74C3C', marginTop: '12px', fontWeight: 600 }}>{error}</p>}
            <button className="btn btn-primary btn-large mt-20" onClick={handleGroupsSubmit} disabled={loading}>{loading ? 'Saving...' : "Let's Go! 🐝"}</button>
          </>)}
        </div>
      </div>
    </div>
  );
}

// ==================== SPLASH / HOME ====================
function SplashScreen({ groups, weekData, onSelectGroup, onUpload, onNavigate }) {
  const [musicOn, setMusicOn] = useState(false);
  const toggleMusic = () => { if (musicOn) stopMusic(); else playMusic(); setMusicOn(!musicOn); };

  return (
    <div className="splash page-content">
      <button className="music-toggle" onClick={toggleMusic} title={musicOn ? 'Mute' : 'Play music'}>{musicOn ? '🔊' : '🔇'}</button>
      <div className="splash-bee">🐝</div>
      <h1 className="splash-title">Spelling Bee!</h1>
      <p className="splash-subtitle">Pick your spelling group to start practising</p>
      <div className="group-grid">
        {groups.map((group) => {
          const hasData = weekData[group];
          return (
            <button key={group} className={`group-btn ${hasData ? 'ready' : 'not-ready'}`}
              onClick={() => hasData ? onSelectGroup(group) : onUpload(group)}>
              <span>
                {group}
                {!hasData && <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 400, opacity: 0.7 }}>No words yet this week</span>}
                {hasData && <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 400, opacity: 0.8 }}>{hasData.words.length} words ready ✓</span>}
              </span>
              <span className="status-dot"></span>
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button className="btn btn-outline" onClick={() => onNavigate('tracker')}>📋 Who's practised?</button>
        <button className="btn btn-outline" onClick={() => onNavigate('upload')}>📤 Upload new words</button>
        <button className="btn btn-outline" onClick={() => onNavigate('settings')}>⚙️ Settings</button>
      </div>
      <p style={{ marginTop: '24px', fontSize: '0.8rem', color: 'var(--text-light)' }}>Week of {getCurrentWeekId()}</p>
    </div>
  );
}

// ==================== UPLOAD ====================
function UploadScreen({ group, apiKeys, onComplete, onBack }) {
  const [mode, setMode] = useState(null);
  const [textInput, setTextInput] = useState('');
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    setLoadingMsg('Reading the spelling list from your photo...');
    setError('');
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const extracted = await extractWordsFromPhoto(base64, apiKeys.anthropic);
      setWords(extracted);
      setMode('review');
    } catch (e) { setError('Failed to read photo: ' + e.message); }
    setLoading(false);
  };

  const handleTextSubmit = () => {
    const parsed = textInput.split(/[,\n]+/).map(w => w.trim().toLowerCase()).filter(w => w.length > 0);
    if (parsed.length === 0) { setError('Please enter some spelling words'); return; }
    setWords(parsed);
    setMode('review');
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    try {
      setLoadingMsg('🐝 Creating funny sentences and a silly story...');
      setProgress(10);
      const content = await generateSpellingContent(words, apiKeys.anthropic);
      setProgress(30);

      setLoadingMsg('🎙️ Recording all the audio (this takes a minute)...');
      const totalAudioSteps = words.length * 4 + 1;
      let audioCount = 0;
      const audioUrls = {};

      for (const word of words) {
        setLoadingMsg(`🎙️ Recording: "${word}"...`);
        try {
          const wordBlob = await generateSpeech(`The word is: ${word}.`, apiKeys.openai);
          audioUrls[`word_${word}`] = await uploadAudio(group, `word_${word}.mp3`, wordBlob);
          audioCount++; setProgress(30 + (audioCount / totalAudioSteps) * 60);

          const sentenceBlob = await generateSpeech(content.sentences[word] || `${word} is this week's spelling word.`, apiKeys.openai);
          audioUrls[`sentence_${word}`] = await uploadAudio(group, `sentence_${word}.mp3`, sentenceBlob);
          audioCount++; setProgress(30 + (audioCount / totalAudioSteps) * 60);

          const repeatBlob = await generateSpeech(`${word}.`, apiKeys.openai);
          audioUrls[`repeat_${word}`] = await uploadAudio(group, `repeat_${word}.mp3`, repeatBlob);
          audioCount++; setProgress(30 + (audioCount / totalAudioSteps) * 60);

          const letters = word.split('').join(', ');
          const spellingBlob = await generateSpeech(`${word} is spelt: ${letters}. ${word}.`, apiKeys.openai);
          audioUrls[`spelling_${word}`] = await uploadAudio(group, `spelling_${word}.mp3`, spellingBlob);
          audioCount++; setProgress(30 + (audioCount / totalAudioSteps) * 60);
        } catch (audioErr) { console.error(`Audio failed for ${word}:`, audioErr); }
      }

      setLoadingMsg('🎙️ Recording the silly story...');
      try {
        const storyBlob = await generateSpeech(content.story, apiKeys.openai);
        audioUrls['story'] = await uploadAudio(group, 'story.mp3', storyBlob);
      } catch (e) { console.error('Story audio failed:', e); }

      setProgress(95);
      setLoadingMsg('💾 Saving everything...');
      await saveWeekData(group, { words, sentences: content.sentences, story: content.story, audioUrls, createdAt: new Date().toISOString() });
      setProgress(100);
      onComplete();
    } catch (e) {
      setError('Generation failed: ' + e.message);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="app-bg"><div className="container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">{loadingMsg}</p>
          <div className="progress-bar-container" style={{ maxWidth: '300px' }}>
            <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>This only happens once per week — sit tight! ☕</p>
        </div>
      </div></div>
    );
  }

  return (
    <div className="app-bg"><div className="container page-content">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <h2 style={{ fontFamily: 'Fredoka', color: 'var(--primary)', marginBottom: '8px' }}>Upload Words for {group}</h2>
      <p style={{ color: 'var(--text-light)', marginBottom: '24px' }}>Add this week's spelling words by typing them or taking a photo of the sheet.</p>
      {error && <div style={{ background: '#FEE2E2', padding: '12px 16px', borderRadius: '12px', marginBottom: '16px', color: '#DC2626', fontWeight: 600 }}>{error}</div>}

      {!mode && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <button className="btn btn-primary btn-large" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setMode('text')}>✏️ Type the words</button>
          <button className="btn btn-secondary btn-large" style={{ width: '100%', justifyContent: 'center' }} onClick={() => fileInputRef.current?.click()}>📸 Take a photo</button>
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden-input" onChange={handlePhotoUpload} />
        </div>
      )}

      {mode === 'text' && (
        <div>
          <label className="input-label">Type or paste spelling words (one per line, or commas)</label>
          <textarea className="input-field" value={textInput} onChange={e => setTextInput(e.target.value)} placeholder={"beautiful\nnecessary\nfavourite\nbelieve"} rows={8} autoFocus />
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button className="btn btn-outline" onClick={() => setMode(null)}>← Back</button>
            <button className="btn btn-primary" onClick={handleTextSubmit}>Review Words →</button>
          </div>
        </div>
      )}

      {mode === 'review' && (
        <div>
          <div className="card">
            <h3 className="card-title">Words found ({words.length}):</h3>
            <div>{words.map((w, i) => <span key={i} className="word-chip">{w}</span>)}</div>
            <div style={{ marginTop: '16px' }}>
              <label className="input-label">Edit if needed (one per line):</label>
              <textarea className="input-field" value={words.join('\n')} onChange={e => setWords(e.target.value.split('\n').map(w => w.trim().toLowerCase()).filter(Boolean))} rows={Math.max(5, words.length)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-outline" onClick={() => { setMode(null); setWords([]); }}>← Start Over</button>
            <button className="btn btn-primary btn-large" onClick={handleGenerate}>✨ Generate Everything!</button>
          </div>
        </div>
      )}
    </div></div>
  );
}

// ==================== SPELLING TEST ====================
function SpellingTest({ group, data, onFinish, onBack }) {
  const [phase, setPhase] = useState('ready');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [pauseTime, setPauseTime] = useState(10);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [message, setMessage] = useState('');
  const [revealedWords, setRevealedWords] = useState({});
  const [childName, setChildName] = useState('');
  const [childrenList, setChildrenList] = useState([]);
  const [newChildName, setNewChildName] = useState('');
  const [isPlayingStory, setIsPlayingStory] = useState(false);
  const timerRef = useRef(null);
  const abortRef = useRef(false);

  const words = data.words;
  const totalWords = words.length;

  useEffect(() => {
    getChildren().then(setChildrenList);
    return () => { abortRef.current = true; stopAudio(); if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const playWordAudio = async (word, type) => {
    const url = data.audioUrls?.[`${type}_${word}`];
    if (url) {
      try { await playAudioUrl(url); return; } catch (e) { console.log('Stored audio failed, using browser TTS'); }
    }
    if (type === 'word') await speakText(`The word is: ${word}`);
    else if (type === 'sentence') await speakText(data.sentences[word] || word);
    else if (type === 'repeat') await speakText(word);
    else if (type === 'spelling') { const l = word.split('').join(', '); await speakText(`${word} is spelt: ${l}. ${word}.`); }
  };

  const startTest = () => { setPhase('playing'); abortRef.current = false; playWord(0); };

  const playWord = async (index) => {
    if (abortRef.current || index >= totalWords) { if (index >= totalWords) setPhase('checking'); return; }
    setCurrentIndex(index);
    const word = words[index];
    setIsPlaying(true);
    await playWordAudio(word, 'word');
    if (abortRef.current) return;
    await new Promise(r => setTimeout(r, 500));
    if (abortRef.current) return;
    await playWordAudio(word, 'sentence');
    if (abortRef.current) return;
    await new Promise(r => setTimeout(r, 500));
    if (abortRef.current) return;
    await playWordAudio(word, 'repeat');
    if (abortRef.current) return;
    setIsPlaying(false);
    setPhase('writing');
    setTimeLeft(pauseTime);
    await new Promise((resolve) => {
      let remaining = pauseTime;
      timerRef.current = setInterval(() => {
        remaining -= 1; setTimeLeft(remaining);
        if (remaining <= 0 || abortRef.current) { clearInterval(timerRef.current); resolve(); }
      }, 1000);
    });
    if (abortRef.current) return;
    setPhase('playing');
    playWord(index + 1);
  };

  const handleRevealWord = async (index) => {
    setRevealedWords(prev => ({ ...prev, [index]: true }));
    await playWordAudio(words[index], 'spelling');
  };

  const handleRevealAll = async () => {
    const all = {}; for (let i = 0; i < words.length; i++) all[i] = true;
    setRevealedWords(all);
    for (let i = 0; i < words.length; i++) {
      if (abortRef.current) return;
      await playWordAudio(words[i], 'spelling');
      await new Promise(r => setTimeout(r, 300));
    }
  };

  const getEncouragingMessage = (s, t) => {
    const p = s / t;
    if (p === 1) return "PERFECT SCORE! 🌟 You absolute legend! Every single word spot-on!";
    if (p >= 0.9) return "Brilliant work! 🌟 You're smashing it — nearly perfect!";
    if (p >= 0.7) return "Really well done! 💪 That's a cracking effort!";
    if (p >= 0.5) return "Good going! 🙌 You're getting there — keep practising!";
    if (p >= 0.3) return "Nice try! 🌈 Every bit of practice makes you better!";
    return "Great effort having a go! 🐝 Keep buzzing away — practice makes perfect!";
  };

  const handleScoreSubmit = async () => {
    setMessage(getEncouragingMessage(score, totalWords));
    if (score / totalWords >= 0.7) { setShowConfetti(true); setTimeout(() => setShowConfetti(false), 4000); }
    setPhase('message');
  };

  const handlePlayStory = async () => {
    setPhase('story'); setIsPlayingStory(true);
    const url = data.audioUrls?.story;
    if (url) { try { await playAudioUrl(url); setIsPlayingStory(false); return; } catch {} }
    await speakText(data.story, 0.9);
    setIsPlayingStory(false);
  };

  const handleNameAndLog = async () => {
    const name = childName || newChildName.trim();
    if (!name) return;
    if (newChildName.trim() && !childrenList.includes(newChildName.trim())) {
      const updated = [...childrenList, newChildName.trim()].sort();
      await saveChildren(updated); setChildrenList(updated);
    }
    await logPractice(group, name, score, totalWords);
    onFinish();
  };

  if (phase === 'ready') return (
    <div className="app-bg"><div className="container page-content">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <div className="test-screen">
        <h2 style={{ fontFamily: 'Fredoka', color: 'var(--primary)', marginBottom: '8px' }}>{group} Spelling Test</h2>
        <p style={{ color: 'var(--text-light)', marginBottom: '30px' }}>{totalWords} words • Listen, then write each word</p>
        <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
          <h3 className="card-title">⏱️ Writing Time</h3>
          <p style={{ color: 'var(--text-light)', marginBottom: '12px' }}>How long do you need to write each word?</p>
          <div className="slider-container">
            <input type="range" className="slider" min={5} max={30} value={pauseTime} onChange={e => setPauseTime(parseInt(e.target.value))} />
            <div className="slider-value">{pauseTime} seconds</div>
          </div>
        </div>
        <button className="btn btn-primary btn-large mt-20" onClick={startTest}>🐝 Start Test!</button>
      </div>
    </div></div>
  );

  if (phase === 'playing' || phase === 'writing') return (
    <div className="app-bg"><div className="container">
      <div className="test-screen">
        <div className="progress-bar-container">
          <div className="progress-bar-fill" style={{ width: `${((currentIndex + 1) / totalWords) * 100}%` }}></div>
        </div>
        <div className="word-number">{currentIndex + 1}</div>
        <div className="word-display">of {totalWords} words</div>
        {phase === 'playing' && (<>
          <div className="status-playing"><SoundWave /> Listening...</div>
          <div className="timer-ring" style={{ borderColor: 'var(--green)', marginTop: '20px' }}><span style={{ fontSize: '3rem' }}>👂</span></div>
        </>)}
        {phase === 'writing' && (<>
          <div className="status-writing">✏️ Write it down!</div>
          <div className="timer-ring active"><span className="timer-text">{timeLeft}</span></div>
        </>)}
        <button className="btn btn-outline mt-30" onClick={() => {
          abortRef.current = true; stopAudio(); if (timerRef.current) clearInterval(timerRef.current); setPhase('checking');
        }}>Skip to checking →</button>
      </div>
    </div></div>
  );

  if (phase === 'checking') return (
    <div className="app-bg"><div className="container page-content">
      <div className="text-center">
        <h2 style={{ fontFamily: 'Fredoka', color: 'var(--primary)', marginBottom: '8px' }}>✅ Check Your Answers!</h2>
        <p style={{ color: 'var(--text-light)', marginBottom: '20px' }}>Tap a word to hear its spelling, or reveal all at once</p>
        <button className="btn btn-secondary mb-20" onClick={handleRevealAll}>🔊 Spell Out All Words</button>
      </div>
      {words.map((word, i) => (
        <div key={i} className={`check-word ${revealedWords[i] ? 'revealed' : ''}`} onClick={() => handleRevealWord(i)}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>Word {i + 1}</div>
          {revealedWords[i] ? <div className="letter-display">{word.toUpperCase()}</div> : <div style={{ color: 'var(--secondary)', fontWeight: 600 }}>Tap to reveal</div>}
        </div>
      ))}
      <div className="text-center mt-30">
        <button className="btn btn-primary btn-large" onClick={() => setPhase('score')}>Enter My Score →</button>
      </div>
    </div></div>
  );

  if (phase === 'score') return (
    <div className="app-bg"><div className="container page-content">
      <div className="test-screen">
        <h2 style={{ fontFamily: 'Fredoka', color: 'var(--primary)', marginBottom: '20px' }}>How did you do?</h2>
        <p style={{ color: 'var(--text-light)', marginBottom: '20px' }}>Count up your correct answers</p>
        <div className="score-input">
          <button className="score-btn" onClick={() => setScore(Math.max(0, score - 1))}>−</button>
          <div className="score-display">{score}/{totalWords}</div>
          <button className="score-btn" onClick={() => setScore(Math.min(totalWords, score + 1))}>+</button>
        </div>
        <button className="btn btn-primary btn-large mt-30" onClick={handleScoreSubmit}>Done! ✨</button>
      </div>
    </div></div>
  );

  if (phase === 'message') return (
    <div className="app-bg"><div className="container page-content">
      <Confetti active={showConfetti} />
      <div className="test-screen">
        <div style={{ fontSize: '60px', marginBottom: '10px' }}>{score / totalWords >= 0.7 ? '🌟' : '💪'}</div>
        <div className="message-bubble">{message}</div>
        <div style={{ fontSize: '2rem', fontFamily: 'Fredoka', color: 'var(--primary)', margin: '10px 0' }}>{score} / {totalWords}</div>
        <button className="btn btn-secondary btn-large mt-20" onClick={handlePlayStory}>📖 Hear the Silly Story!</button>
        <button className="btn btn-outline mt-12" onClick={() => setPhase('name')}>Skip to finish →</button>
      </div>
    </div></div>
  );

  if (phase === 'story') return (
    <div className="app-bg"><div className="container page-content">
      <div className="text-center">
        <h2 style={{ fontFamily: 'Fredoka', color: 'var(--primary)', marginBottom: '20px' }}>📖 This Week's Silly Story</h2>
        {isPlayingStory && <div className="status-playing" style={{ justifyContent: 'center', marginBottom: '16px' }}><SoundWave /> Playing...</div>}
        <div className="story-container">{data.story}</div>
        <button className="btn btn-primary btn-large mt-20" onClick={() => setPhase('name')}>Finish Up →</button>
      </div>
    </div></div>
  );

  if (phase === 'name') return (
    <div className="app-bg"><div className="container page-content">
      <div className="test-screen">
        <div style={{ fontSize: '50px', marginBottom: '10px' }}>🏷️</div>
        <h2 style={{ fontFamily: 'Fredoka', color: 'var(--primary)', marginBottom: '8px' }}>Who are you?</h2>
        <p style={{ color: 'var(--text-light)', marginBottom: '20px' }}>Pick your name so we know you've done your spelling!</p>
        {childrenList.length > 0 && (
          <div className="name-grid" style={{ maxWidth: '400px', margin: '0 auto 20px' }}>
            {childrenList.map(name => (
              <button key={name} className={`name-btn ${childName === name ? 'selected' : ''}`}
                onClick={() => { setChildName(name); setNewChildName(''); }}>{name}</button>
            ))}
          </div>
        )}
        <p style={{ color: 'var(--text-light)', marginBottom: '8px', fontWeight: 600 }}>Or type your name:</p>
        <input className="input-field" value={newChildName} onChange={e => { setNewChildName(e.target.value); setChildName(''); }}
          placeholder="Type your name..." style={{ maxWidth: '300px' }} />
        <button className="btn btn-primary btn-large mt-20" onClick={handleNameAndLog}
          disabled={!childName && !newChildName.trim()}>All Done! 🎉</button>
      </div>
    </div></div>
  );

  return null;
}

// ==================== PRACTICE TRACKER ====================
function PracticeTracker({ groups, onBack }) {
  const [practiceData, setPracticeData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const all = {};
      for (const g of groups) { const d = await getPracticeData(g); if (d) all[g] = d; }
      setPracticeData(all); setLoading(false);
    };
    load();
  }, [groups]);

  if (loading) return <div className="app-bg"><div className="container"><div className="loading-container"><div className="loading-spinner"></div></div></div></div>;

  return (
    <div className="app-bg"><div className="container page-content">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <h2 style={{ fontFamily: 'Fredoka', color: 'var(--primary)', marginBottom: '8px' }}>📋 Who's Practised This Week?</h2>
      <p style={{ color: 'var(--text-light)', marginBottom: '24px' }}>Week of {getCurrentWeekId()}</p>
      {groups.map(g => {
        const gData = practiceData[g];
        const children = gData?.children ? Object.entries(gData.children) : [];
        return (
          <div key={g} className="card">
            <h3 className="card-title">{g}</h3>
            {children.length === 0 ? <p style={{ color: 'var(--text-light)' }}>No one has practised yet this week</p> : (
              <ul className="tracker-list">
                {children.map(([name, info]) => (
                  <li key={name} className="tracker-item">
                    <span className="tracker-name">{name}</span>
                    <span className="tracker-count">{info.attempts} time{info.attempts !== 1 ? 's' : ''} ✓</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div></div>
  );
}

// ==================== SETTINGS ====================
function SettingsScreen({ groups, onBack, onGroupsUpdate }) {
  const [newAnthropicKey, setNewAnthropicKey] = useState('');
  const [newOpenaiKey, setNewOpenaiKey] = useState('');
  const [localGroups, setLocalGroups] = useState([...groups]);
  const [childrenList, setChildrenList] = useState([]);
  const [newChildName, setNewChildName] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { getChildren().then(setChildrenList); }, []);

  const handleSaveKeys = async () => {
    setSaving(true);
    try {
      const updates = {};
      if (newAnthropicKey) updates.anthropic = newAnthropicKey;
      if (newOpenaiKey) updates.openai = newOpenaiKey;
      if (Object.keys(updates).length > 0) { await saveApiKeys(updates); setMsg('API keys updated! ✓'); setNewAnthropicKey(''); setNewOpenaiKey(''); }
    } catch (e) { setMsg('Error: ' + e.message); }
    setSaving(false);
  };

  const handleSaveGroups = async () => {
    const valid = localGroups.filter(g => g.trim());
    setSaving(true);
    try { await saveGroups(valid.map(g => g.trim().toUpperCase())); onGroupsUpdate(valid.map(g => g.trim().toUpperCase())); setMsg('Groups updated! ✓'); }
    catch (e) { setMsg('Error: ' + e.message); }
    setSaving(false);
  };

  const handleAddChild = async () => {
    if (!newChildName.trim()) return;
    const updated = [...childrenList, newChildName.trim()].sort();
    await saveChildren(updated); setChildrenList(updated); setNewChildName('');
  };

  const handleRemoveChild = async (name) => {
    const updated = childrenList.filter(n => n !== name);
    await saveChildren(updated); setChildrenList(updated);
  };

  return (
    <div className="app-bg"><div className="container page-content">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <h2 style={{ fontFamily: 'Fredoka', color: 'var(--primary)', marginBottom: '24px' }}>⚙️ Settings</h2>
      {msg && <div style={{ background: '#D1FAE5', padding: '12px 16px', borderRadius: '12px', marginBottom: '16px', color: '#059669', fontWeight: 600 }}>{msg}</div>}

      <div className="card">
        <h3 className="card-title">🔑 API Keys</h3>
        <p style={{ color: 'var(--text-light)', marginBottom: '12px', fontSize: '0.9rem' }}>Update API keys (leave blank to keep current)</p>
        <label className="input-label">Anthropic API Key</label>
        <input type="password" className="input-field mb-12" value={newAnthropicKey} onChange={e => setNewAnthropicKey(e.target.value)} placeholder="sk-ant-... (leave blank to keep)" />
        <label className="input-label">OpenAI API Key</label>
        <input type="password" className="input-field mb-12" value={newOpenaiKey} onChange={e => setNewOpenaiKey(e.target.value)} placeholder="sk-... (leave blank to keep)" />
        <button className="btn btn-primary btn-small" onClick={handleSaveKeys} disabled={saving}>Save Keys</button>
      </div>

      <div className="card">
        <h3 className="card-title">📚 Spelling Groups</h3>
        {localGroups.map((g, i) => (
          <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <input className="input-field" value={g} onChange={e => { const n = [...localGroups]; n[i] = e.target.value; setLocalGroups(n); }} />
            {localGroups.length > 1 && <button className="btn btn-outline btn-small" onClick={() => setLocalGroups(localGroups.filter((_, j) => j !== i))}>✕</button>}
          </div>
        ))}
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <button className="btn btn-outline btn-small" onClick={() => setLocalGroups([...localGroups, ''])}>+ Add</button>
          <button className="btn btn-primary btn-small" onClick={handleSaveGroups} disabled={saving}>Save Groups</button>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">👧 Children's Names</h3>
        <p style={{ color: 'var(--text-light)', marginBottom: '12px', fontSize: '0.9rem' }}>Pre-add children's names so they can pick from a list</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
          {childrenList.map(name => (
            <span key={name} style={{ background: 'rgba(78,205,196,0.15)', padding: '6px 12px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {name}
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold', color: '#999' }} onClick={() => handleRemoveChild(name)}>✕</button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input className="input-field" value={newChildName} onChange={e => setNewChildName(e.target.value)} placeholder="Child's name" onKeyDown={e => e.key === 'Enter' && handleAddChild()} />
          <button className="btn btn-secondary btn-small" onClick={handleAddChild}>Add</button>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">ℹ️ About</h3>
        <p style={{ color: 'var(--text-light)', lineHeight: 1.6 }}>
          Spelling Bee helps children practise their weekly spelling words with audio, funny sentences, and silly stories.
          Content is generated once per week using AI, then cached so it costs almost nothing to run.
        </p>
        <p style={{ color: 'var(--text-light)', marginTop: '8px', fontSize: '0.85rem' }}>
          Auto-resets every Thursday at noon (UK time) for the new spelling week.
        </p>
      </div>
    </div></div>
  );
}

// ==================== MAIN APP ====================
function App() {
  const [page, setPage] = useState('loading');
  const [groups, setGroups] = useState([]);
  const [weekData, setWeekData] = useState({});
  const [apiKeys, setApiKeysState] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [uploadGroup, setUploadGroup] = useState(null);

  useEffect(() => {
    const init = async () => {
      // Firebase config is hardcoded — just init directly
      const config = getStoredFirebaseConfig();
      const success = initFirebase(config);
      if (!success) { setPage('setup'); return; }

      const [grps, keys] = await Promise.all([getGroups(), getApiKeys()]);
      if (!grps || grps.length === 0 || !keys) { setPage('setup'); return; }

      setGroups(grps);
      setApiKeysState(keys);

      const wd = {};
      for (const g of grps) {
        const d = await getWeekData(g);
        if (d) wd[g] = d;
      }
      setWeekData(wd);
      setPage('home');
    };
    init();
  }, []);

  const refreshData = async () => {
    const wd = {};
    for (const g of groups) {
      const d = await getWeekData(g);
      if (d) wd[g] = d;
    }
    setWeekData(wd);
  };

  if (page === 'loading') return (
    <div className="app-bg"><div className="container"><div className="loading-container">
      <div className="splash-bee" style={{ fontSize: '60px' }}>🐝</div>
      <div className="loading-spinner"></div>
      <p className="loading-text">Loading Spelling Bee...</p>
    </div></div></div>
  );

  if (page === 'setup') return <SetupWizard onComplete={async () => {
    const [grps, keys] = await Promise.all([getGroups(), getApiKeys()]);
    setGroups(grps); setApiKeysState(keys);
    const wd = {};
    for (const g of grps) { const d = await getWeekData(g); if (d) wd[g] = d; }
    setWeekData(wd); setPage('home');
  }} />;

  if (page === 'home') return (
    <div className="app-bg">
      <SplashScreen groups={groups} weekData={weekData}
        onSelectGroup={(g) => { setSelectedGroup(g); setPage('test'); }}
        onUpload={(g) => { setUploadGroup(g); setPage('upload'); }}
        onNavigate={(p) => {
          if (p === 'upload') { setPage('pickUploadGroup'); }
          else setPage(p);
        }} />
    </div>
  );

  if (page === 'pickUploadGroup') return (
    <div className="app-bg"><div className="container page-content">
      <button className="back-btn" onClick={() => setPage('home')}>← Back</button>
      <h2 style={{ fontFamily: 'Fredoka', color: 'var(--primary)', marginBottom: '8px' }}>Upload New Words</h2>
      <p style={{ color: 'var(--text-light)', marginBottom: '24px' }}>Which group do you want to upload words for?</p>
      <div className="group-grid">
        {groups.map((group) => (
          <button key={group} className="group-btn ready" onClick={() => { setUploadGroup(group); setPage('upload'); }}>
            <span>{group}{weekData[group] && <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 400, opacity: 0.8 }}>Will replace current words</span>}</span>
          </button>
        ))}
      </div>
    </div></div>
  );

  if (page === 'upload') return (
    <UploadScreen group={uploadGroup} apiKeys={apiKeys}
      onComplete={async () => { await refreshData(); setPage('home'); }}
      onBack={() => setPage('home')} />
  );

  if (page === 'test') return (
    <SpellingTest group={selectedGroup} data={weekData[selectedGroup]}
      onFinish={() => setPage('home')}
      onBack={() => setPage('home')} />
  );

  if (page === 'tracker') return <PracticeTracker groups={groups} onBack={() => setPage('home')} />;

  if (page === 'settings') return (
    <SettingsScreen groups={groups} onBack={() => setPage('home')}
      onGroupsUpdate={(newGroups) => setGroups(newGroups)} />
  );

  return null;
}

export default App;
