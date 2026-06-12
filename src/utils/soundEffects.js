/**
 * Sound Effects Utility
 * Uses Web Audio API to generate simple sound effects without needing audio files
 */

const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// Helper function to create a beep sound
const playTone = (frequency, duration, type = 'sine', volume = 0.3) => {
  try {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = type;

    gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
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
