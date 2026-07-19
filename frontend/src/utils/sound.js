let audioContext;
let masterGain;

async function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!audioContext) {
    audioContext = new AudioContextClass();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.45;
    masterGain.connect(audioContext.destination);
  }

  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  return audioContext;
}

const PATTERNS = {
  click: [
    { frequency: 420, start: 0, duration: 0.055, gain: 0.12 },
    { frequency: 720, start: 0.045, duration: 0.07, gain: 0.09 },
  ],
  open: [
    { frequency: 180, start: 0, duration: 0.08, gain: 0.13 },
    { frequency: 360, start: 0.07, duration: 0.09, gain: 0.12 },
    { frequency: 680, start: 0.15, duration: 0.12, gain: 0.09 },
  ],
  select: [
    { frequency: 520, start: 0, duration: 0.06, gain: 0.11 },
    { frequency: 260, start: 0.055, duration: 0.055, gain: 0.08 },
  ],
  launch: [
    { frequency: 160, start: 0, duration: 0.09, gain: 0.14 },
    { frequency: 320, start: 0.075, duration: 0.1, gain: 0.13 },
    { frequency: 640, start: 0.15, duration: 0.16, gain: 0.1 },
    { frequency: 960, start: 0.28, duration: 0.1, gain: 0.08 },
  ],
};

export async function playUiSound(kind = 'click', enabled = true) {
  if (!enabled) return;

  const context = await getAudioContext();
  if (!context) return;

  const notes = PATTERNS[kind] || PATTERNS.click;

  notes.forEach((note) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + note.start;
    const end = start + note.duration;

    oscillator.type = kind === 'launch' ? 'triangle' : 'square';
    oscillator.frequency.setValueAtTime(note.frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(note.gain, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(gain);
    gain.connect(masterGain);
    oscillator.start(start);
    oscillator.stop(end + 0.02);
  });
}
