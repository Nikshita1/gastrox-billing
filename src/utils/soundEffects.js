/**
 * Sound Effects Utility
 * Uses Web Audio API to generate simple sound effects without needing audio files
 */

let audioContext = null;
let contextResumed = false;

const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
};

const resumeAudioContext = () => {
  if (contextResumed) return;
  
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume().then(() => {
      contextResumed = true;
      console.log('Audio context resumed');
    });
  } else {
    contextResumed = true;
  }
};

// Resume audio on any user interaction
if (typeof window !== 'undefined') {
  const events = ['click', 'touchstart', 'keydown'];
  events.forEach(event => {
    window.addEventListener(event, resumeAudioContext, { once: true });
  });
}

// Helper function to create a beep sound
const playTone = (frequency, duration, type = 'sine', volume = 0.3) => {
  try {
    resumeAudioContext();
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = type;

    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
    
    console.log(`Played tone: ${frequency}Hz for ${duration}s`);
  } catch (error) {
    console.error('Error playing tone:', error);
  }
};

// Success sound (positive upward beep)
export const playSuccess = () => {
  playTone(523, 0.1, 'sine', 0.3); // C5
  setTimeout(() => playTone(659, 0.1, 'sine', 0.3), 100); // E5
  setTimeout(() => playTone(784, 0.15, 'sine', 0.3), 200); // G5
};

// Error sound (descending beep)
export const playError = () => {
  playTone(600, 0.1, 'sine', 0.3);
  setTimeout(() => playTone(400, 0.2, 'sine', 0.3), 100);
};

// Click sound (soft pop)
export const playClick = () => {
  playTone(800, 0.05, 'sine', 0.15);
};

// Warning sound (urgent beep for auto-logout)
export const playWarning = () => {
  playTone(400, 0.1, 'sine', 0.4);
  setTimeout(() => playTone(400, 0.1, 'sine', 0.4), 120);
  setTimeout(() => playTone(600, 0.15, 'sine', 0.4), 240);
};

// Save/Confirmation sound (bell-like)
export const playSave = () => {
  playTone(523, 0.08, 'sine', 0.2);
  setTimeout(() => playTone(523, 0.08, 'sine', 0.2), 85);
};

// Export sound (whoosh-like)
export const playExport = () => {
  playTone(1000, 0.05, 'sine', 0.15);
  setTimeout(() => playTone(800, 0.05, 'sine', 0.15), 50);
};
