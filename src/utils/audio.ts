// Custom high-fidelity audio synthesizer using browser Web Audio API
// This avoids loading slow or unstable external MP3 files and operates completely client-side.

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    // Lazy initialisation to comply with browser autoplay restrictions
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  return audioCtx;
}

export function playClickSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Tiny high-pitched click
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(1200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.05);

  gain.gain.setValueAtTime(0.05, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.06);
}

export function playSuccessSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  // A glorious rising major chime
  const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
  notes.forEach((freq, index) => {
    const timeOffset = index * 0.08;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, ctx.currentTime + timeOffset);

    gain.gain.setValueAtTime(0.0, ctx.currentTime + timeOffset);
    gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + timeOffset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + timeOffset + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime + timeOffset);
    osc.stop(ctx.currentTime + timeOffset + 0.35);
  });
}

export function playErrorSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Low, solid buzz for errors
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = 'sawtooth';
  osc1.frequency.setValueAtTime(150, ctx.currentTime);
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(153, ctx.currentTime); // detuned

  gain.gain.setValueAtTime(0.12, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);

  osc1.start();
  osc2.start();
  osc1.stop(ctx.currentTime + 0.26);
  osc2.stop(ctx.currentTime + 0.26);
}

export function playTransitionSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Soft atmospheric transition swoosh
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(450, ctx.currentTime + 0.25);

  gain.gain.setValueAtTime(0.001, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.1);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.3);
}
