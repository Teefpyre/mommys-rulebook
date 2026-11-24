class SoftSoundEngine {
  private ctx: AudioContext | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    volume: number,
    type: OscillatorType = 'sine',
    delay = 0
  ) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(freqEnd, now + duration);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.014);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playPageFlip() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const duration = 0.16;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i += 1) {
      const env = Math.sin((i / bufferSize) * Math.PI);
      data[i] = (Math.random() * 2 - 1) * env * 0.45;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(650, ctx.currentTime + duration);
    filter.Q.value = 1.1;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.11, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();
  }

  playCheckPop() {
    this.playTone(523.25, 659.25, 0.12, 0.08, 'triangle', 0);
    this.playTone(783.99, 880, 0.16, 0.06, 'sine', 0.045);
  }

  playUncheck() {
    this.playTone(440, 330, 0.1, 0.05, 'sine', 0);
  }

  playEnvelopeOpen() {
    this.playPageFlip();
    this.playTone(880, 1046.5, 0.22, 0.045, 'sine', 0.06);
  }

  playStarChime() {
    const notes = [1046.5, 1174.66, 1318.51, 1567.98];
    const picked = notes[Math.floor(Math.random() * notes.length)];
    this.playTone(picked, picked * 1.01, 0.28, 0.055, 'sine', 0);
    this.playTone(picked * 1.5, picked * 1.5, 0.2, 0.025, 'triangle', 0.03);
  }

  playHeartTap() {
    this.playTone(587.33, 880, 0.11, 0.06, 'sine', 0);
    this.playTone(880, 1046.5, 0.12, 0.045, 'triangle', 0.06);
  }

  playGentleError() {
    this.playTone(311.13, 277.18, 0.16, 0.05, 'triangle', 0);
  }

  playCelebration() {
    const arpeggio = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
    arpeggio.forEach((freq, idx) => {
      this.playTone(freq, freq, 0.45, 0.055, 'sine', idx * 0.075);
      this.playTone(freq * 0.5, freq * 0.5, 0.35, 0.025, 'triangle', idx * 0.075);
    });
  }
}

export const soundEngine = new SoftSoundEngine();
