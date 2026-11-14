// Tiny synthesized sound engine – no assets needed, everything is WebAudio.

type Wave = OscillatorType;

export class Sfx {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicGain!: GainNode;
  private noiseBuf!: AudioBuffer;
  private musicTimer: number | null = null;
  private step = 0;
  volume = 0.7;
  musicOn = true;

  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicOn ? 0.22 : 0;
      this.musicGain.connect(this.master);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    void this.ctx.resume();
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    if (this.musicGain) this.musicGain.gain.value = on ? 0.22 : 0;
  }

  private tone(freq: number, dur: number, type: Wave = 'sine', vol = 0.3, slideTo?: number, delay = 0, dest?: AudioNode) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest ?? this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol = 0.3, freq = 2000, delay = 0, q = 0.7, type: BiquadFilterType = 'lowpass') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(this.master);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
  }

  shootBlaster() {
    this.tone(880, 0.09, 'square', 0.12, 220);
    this.noise(0.05, 0.15, 3500);
  }
  shootScatter() {
    this.noise(0.22, 0.5, 1800);
    this.tone(160, 0.18, 'sawtooth', 0.25, 50);
    this.tone(1200, 0.12, 'triangle', 0.1, 400, 0.02);
  }
  shootPie() {
    this.tone(220, 0.25, 'sine', 0.35, 70);
    this.noise(0.18, 0.3, 700);
    this.tone(600, 0.2, 'triangle', 0.1, 900, 0.05);
  }
  explode() {
    this.noise(0.6, 0.7, 900);
    this.tone(120, 0.5, 'sine', 0.5, 35);
    this.tone(900, 0.25, 'triangle', 0.15, 200, 0.02);
  }
  reload() {
    this.tone(300, 0.05, 'square', 0.1, 400);
    this.tone(500, 0.06, 'square', 0.1, 650, 0.35);
    this.tone(700, 0.08, 'square', 0.12, 900, 0.6);
  }
  empty() {
    this.tone(200, 0.05, 'square', 0.1);
  }
  hit() {
    this.tone(1400, 0.04, 'square', 0.08, 900);
  }
  head() {
    this.tone(1800, 0.08, 'triangle', 0.2, 2600);
    this.tone(2400, 0.1, 'triangle', 0.12, 3200, 0.05);
  }
  pop() {
    this.tone(300, 0.16, 'sine', 0.35, 900);
    this.tone(1200, 0.12, 'triangle', 0.15, 1800, 0.06);
    this.noise(0.1, 0.12, 6000, 0, 1, 'highpass');
  }
  hurt() {
    this.tone(180, 0.25, 'sawtooth', 0.3, 70);
    this.noise(0.12, 0.25, 500);
  }
  pickup() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.18, undefined, i * 0.06));
  }
  heal() {
    [392, 523, 659, 784, 988].forEach((f, i) => this.tone(f, 0.18, 'sine', 0.2, undefined, i * 0.07));
  }
  chomp() {
    this.tone(260, 0.08, 'square', 0.25, 120);
    this.tone(240, 0.08, 'square', 0.25, 100, 0.1);
    this.noise(0.08, 0.2, 1500, 0.02);
  }
  swipe() {
    this.noise(0.18, 0.25, 1200, 0, 1.5, 'bandpass');
  }
  groan() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lg = this.ctx.createGain();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 700;
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(130, t);
    o.frequency.linearRampToValueAtTime(95, t + 1.1);
    lfo.frequency.value = 7;
    lg.gain.value = 9;
    lfo.connect(lg);
    lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    o.connect(f);
    f.connect(g);
    g.connect(this.master);
    o.start(t);
    lfo.start(t);
    o.stop(t + 1.3);
    lfo.stop(t + 1.3);
  }
  zombieMoan(far = 0.5) {
    this.tone(110 + Math.random() * 40, 0.5, 'sawtooth', 0.05 * far, 80);
  }
  wave() {
    [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.22, 'square', 0.12, undefined, i * 0.1));
    this.tone(1046, 0.5, 'triangle', 0.18, undefined, 0.4);
  }
  win() {
    [523, 659, 784, 1047, 784, 1047, 1318].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.22, undefined, i * 0.12));
  }
  lose() {
    [440, 392, 330, 262].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.25, f * 0.9, i * 0.2));
  }
  jump() {
    this.tone(300, 0.15, 'sine', 0.12, 600);
  }
  land() {
    this.noise(0.08, 0.15, 400);
  }
  dart() {
    this.tone(1100, 0.07, 'triangle', 0.08, 500);
  }

  // ----- bouncy background music -----
  startMusic() {
    if (!this.ctx || this.musicTimer !== null) return;
    const chords = [
      [261.6, 329.6, 392.0],
      [220.0, 261.6, 329.6],
      [174.6, 220.0, 261.6],
      [196.0, 246.9, 293.7],
    ];
    const melody = [0, 2, 4, 2, 5, 4, 2, 1, 0, 2, 4, 7, 5, 4, 2, 4];
    const scale = [523.3, 587.3, 659.3, 784.0, 880.0, 1046.5, 1174.7, 1318.5];
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || !this.musicOn) return;
      const s = this.step++;
      const chord = chords[Math.floor(s / 8) % 4];
      if (s % 2 === 0) this.tone(chord[0] / 2, 0.22, 'triangle', 0.5, undefined, 0, this.musicGain);
      if (s % 4 === 2) this.tone(chord[(s >> 2) % 3], 0.12, 'square', 0.12, undefined, 0, this.musicGain);
      if (s % 2 === 1 || s % 8 === 0) {
        const n = scale[melody[s % melody.length]];
        this.tone(n, 0.16, 'sine', 0.35, undefined, 0, this.musicGain);
      }
    }, 240);
  }
  stopMusic() {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
