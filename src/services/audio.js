// Audio playback manager
// Handles both stored Firebase URLs and blob URLs

let currentAudio = null;

export function stopAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
}

export function playAudioUrl(url) {
  return new Promise((resolve, reject) => {
    stopAudio();
    currentAudio = new Audio(url);
    currentAudio.onended = () => {
      currentAudio = null;
      resolve();
    };
    currentAudio.onerror = (e) => {
      currentAudio = null;
      reject(e);
    };
    currentAudio.play().catch(reject);
  });
}

export function playAudioBlob(blob) {
  const url = URL.createObjectURL(blob);
  return playAudioUrl(url).finally(() => URL.revokeObjectURL(url));
}

// Browser TTS fallback
export function speakText(text, rate = 1) {
  return new Promise((resolve) => {
    stopAudio();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-GB';
    utterance.rate = rate;
    
    // Try to find a British voice
    const voices = speechSynthesis.getVoices();
    const britishVoice = voices.find(v => v.lang === 'en-GB');
    if (britishVoice) utterance.voice = britishVoice;
    
    utterance.onend = resolve;
    utterance.onerror = resolve;
    speechSynthesis.speak(utterance);
  });
}

// Simple splash screen music using Web Audio API
let musicContext = null;
let musicGain = null;
let musicOscillators = [];

export function playMusic() {
  try {
    if (musicContext) return;
    musicContext = new (window.AudioContext || window.webkitAudioContext)();
    musicGain = musicContext.createGain();
    musicGain.gain.value = 0.08;
    musicGain.connect(musicContext.destination);

    // Simple cheerful melody
    const notes = [523, 587, 659, 698, 784, 698, 659, 587, 523, 587, 659, 784, 880, 784, 659, 523];
    const durations = [0.3, 0.3, 0.3, 0.3, 0.6, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.6, 0.3, 0.3, 0.6];

    let time = musicContext.currentTime + 0.1;
    
    const playSequence = () => {
      notes.forEach((freq, i) => {
        const osc = musicContext.createOscillator();
        const noteGain = musicContext.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        noteGain.gain.setValueAtTime(0.3, time);
        noteGain.gain.exponentialRampToValueAtTime(0.01, time + durations[i] * 0.9);
        osc.connect(noteGain);
        noteGain.connect(musicGain);
        osc.start(time);
        osc.stop(time + durations[i]);
        musicOscillators.push(osc);
        time += durations[i];
      });
    };

    // Play melody twice
    playSequence();
    playSequence();

  } catch (e) {
    console.log('Music not available:', e);
  }
}

export function stopMusic() {
  if (musicContext) {
    musicOscillators.forEach(o => {
      try { o.stop(); } catch {}
    });
    musicOscillators = [];
    musicContext.close();
    musicContext = null;
    musicGain = null;
  }
}
