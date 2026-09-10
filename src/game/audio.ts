// ============================================================
// HORIZON CYBER ACADEMY — Procedural audio engine (Web Audio API)
// No external assets: every sound is synthesized.
// Layers: ambient (office hum) + adaptive music (mood chords)
// + UI SFX + event sounds. Volumes persist in the game state.
// ============================================================

import type { SoundSettings } from "./types";

type Mode = SoundSettings["mode"];

const CHORDS: Record<Mode, number[][]> = {
  calm: [
    [261.63, 329.63, 392.0], // C
    [220.0, 277.18, 329.63], // Am
    [174.61, 220.0, 261.63], // F
    [196.0, 246.94, 293.66], // G
  ],
  investigation: [
    [220.0, 261.63, 329.63],
    [196.0, 233.08, 293.66],
    [174.61, 207.65, 261.63],
  ],
  tense: [
    [233.08, 277.18, 349.23],
    [220.0, 261.63, 311.13],
    [207.65, 246.94, 311.13],
  ],
  crisis: [
    [233.08, 277.18, 349.23, 466.16],
    [220.0, 261.63, 329.63, 440.0],
    [246.94, 293.66, 369.99, 493.88],
  ],
  resolved: [
    [261.63, 329.63, 392.0],
    [293.66, 369.99, 440.0],
    [261.63, 349.23, 440.0],
  ],
};

class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private musicNodes: OscillatorNode[] = [];
  private musicFilter: BiquadFilterNode | null = null;
  private chordTimer: ReturnType<typeof setInterval> | null = null;
  private chordIndex = 0;
  private mode: Mode = "calm";
  private settings: SoundSettings = {
    muted: false,
    master: 0.8,
    music: 0.6,
    sfx: 0.8,
    ambient: 0.5,
    mode: "calm",
  };
  private started = false;

  /** Must be called from a user gesture. Safe to call repeatedly. */
  ensure(): void {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      try {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        this.ctx = new AC();
      } catch {
        return;
      }
      this.buildGraph();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    if (!this.started) {
      this.started = true;
      this.startAmbient();
      this.startMusic();
    }
  }

  private buildGraph(): void {
    if (!this.ctx) return;
    this.master = this.ctx.createGain();
    this.master.gain.value = this.settings.muted
      ? 0
      : this.settings.master;
    this.master.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.settings.music * 0.16;
    this.musicFilter = this.ctx.createBiquadFilter();
    this.musicFilter.type = "lowpass";
    this.musicFilter.frequency.value = 900;
    this.musicGain.connect(this.musicFilter);
    this.musicFilter.connect(this.master);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.settings.sfx * 0.5;
    this.sfxGain.connect(this.master);

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = this.settings.ambient * 0.12;
    this.ambientGain.connect(this.master);
  }

  applySettings(s: SoundSettings): void {
    this.settings = { ...s };
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : s.master, t, 0.1);
    this.musicGain?.gain.setTargetAtTime(s.music * 0.16, t, 0.1);
    this.sfxGain?.gain.setTargetAtTime(s.sfx * 0.5, t, 0.05);
    this.ambientGain?.gain.setTargetAtTime(s.ambient * 0.12, t, 0.1);
    if (s.mode !== this.mode) this.setMode(s.mode);
  }

  setMode(mode: Mode): void {
    this.mode = mode;
    if (!this.ctx || !this.musicFilter) return;
    const target =
      mode === "crisis" ? 2400 : mode === "tense" ? 1600 : mode === "resolved" ? 1100 : mode === "investigation" ? 700 : 900;
    this.musicFilter.frequency.setTargetAtTime(target, this.ctx.currentTime, 1.2);
  }

  // ------------- Ambient: office hum + keyboard clicks -------------
  private startAmbient(): void {
    if (!this.ctx || !this.ambientGain) return;
    const ctx = this.ctx;

    // 60Hz building hum
    const hum = ctx.createOscillator();
    hum.type = "sine";
    hum.frequency.value = 60;
    const humGain = ctx.createGain();
    humGain.gain.value = 0.5;
    hum.connect(humGain);
    humGain.connect(this.ambientGain);
    hum.start();

    // ventilation noise (filtered brown noise)
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 380;
    noiseFilter.Q.value = 0.4;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.35;
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.ambientGain);
    noise.start();

    // random keyboard / office clicks
    const click = () => {
      if (this.settings.muted) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = "square";
      const f = 1400 + Math.random() * 2200;
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.018, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03 + Math.random() * 0.04);
      o.connect(g);
      g.connect(this.ambientGain!);
      o.start(t);
      o.stop(t + 0.09);
      this.clickTimer = setTimeout(click, 2000 + Math.random() * 7000);
    };
    this.clickTimer = setTimeout(click, 3000);
  }

  private clickTimer: ReturnType<typeof setTimeout> | null = null;

  // ------------- Music: slow pad chords -------------
  private startMusic(): void {
    if (!this.ctx || !this.musicGain) return;
    const ctx = this.ctx;
    const playChord = () => {
      if (!this.ctx || !this.musicGain) return;
      const chord = CHORDS[this.mode][this.chordIndex % CHORDS[this.mode].length];
      this.chordIndex++;
      const t = ctx.currentTime;
      const dur = this.mode === "crisis" ? 2.4 : 7.5;
      // stop old voices
      for (const n of this.musicNodes) {
        try {
          n.stop(t + 1.5);
        } catch {
          /* already stopped */
        }
      }
      this.musicNodes = [];
      chord.forEach((freq, i) => {
        const o1 = ctx.createOscillator();
        o1.type = "sawtooth";
        o1.frequency.value = freq;
        const o2 = ctx.createOscillator();
        o2.type = "sawtooth";
        o2.frequency.value = freq * 1.005;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.09 / chord.length, t + 1.6);
        g.gain.setValueAtTime(0.09 / chord.length, t + Math.max(1.8, dur - 1.6));
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o1.connect(g);
        o2.connect(g);
        g.connect(this.musicGain!);
        // gentle detune LFO
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.05 + i * 0.03;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 3;
        lfo.connect(lfoGain);
        lfoGain.connect(o1.frequency);
        lfo.start(t);
        lfo.stop(t + dur + 0.5);
        o1.start(t);
        o2.start(t);
        o1.stop(t + dur + 0.5);
        o2.stop(t + dur + 0.5);
        this.musicNodes.push(o1, o2, lfo);
      });
    };
    playChord();
    this.chordTimer = setInterval(playChord, 8000);
  }

  // ------------- One-shot SFX -------------
  private tone(
    freq: number,
    dur: number,
    type: OscillatorType = "sine",
    vol = 0.3,
    when = 0,
    slideTo?: number
  ): void {
    if (!this.ctx || !this.sfxGain || this.settings.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  key(): void {
    this.tone(900 + Math.random() * 500, 0.03, "square", 0.05);
  }
  open(): void {
    this.tone(480, 0.09, "sine", 0.18);
    this.tone(720, 0.12, "sine", 0.14, 0.05);
  }
  close(): void {
    this.tone(620, 0.08, "sine", 0.14);
    this.tone(380, 0.1, "sine", 0.12, 0.05);
  }
  notify(): void {
    this.tone(880, 0.12, "sine", 0.25);
    this.tone(1174.66, 0.16, "sine", 0.2, 0.09);
  }
  alert(): void {
    this.tone(659.25, 0.16, "triangle", 0.3);
    this.tone(493.88, 0.24, "triangle", 0.3, 0.14);
  }
  success(): void {
    this.tone(523.25, 0.14, "sine", 0.25);
    this.tone(659.25, 0.14, "sine", 0.25, 0.1);
    this.tone(783.99, 0.24, "sine", 0.25, 0.2);
  }
  error(): void {
    this.tone(220, 0.18, "sawtooth", 0.16);
    this.tone(185, 0.26, "sawtooth", 0.16, 0.1);
  }
  phone(): void {
    for (let i = 0; i < 3; i++) {
      this.tone(440, 0.18, "sine", 0.28, i * 0.7);
      this.tone(480, 0.18, "sine", 0.28, i * 0.7 + 0.18);
    }
  }
  boot(): void {
    this.tone(196, 0.5, "sine", 0.2);
    this.tone(392, 0.7, "sine", 0.18, 0.35);
  }
  unlock(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      this.tone(f, 0.3, "sine", 0.22, i * 0.14)
    );
  }

  destroy(): void {
    if (this.chordTimer) clearInterval(this.chordTimer);
    if (this.clickTimer) clearTimeout(this.clickTimer);
  }
}

export const audio = new AudioManager();
