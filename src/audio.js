export const audio = {
  ctx: null,
  muted: false,
  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) this.ctx = new AudioContext();
    }
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  },
  tone(frequency, start, duration, type = 'sine', volume = 0.2) {
    if (!this.ctx || this.muted) return;
    const oscillator = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, this.ctx.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(volume, this.ctx.currentTime + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + start + duration);
    oscillator.connect(gain).connect(this.ctx.destination);
    oscillator.start(this.ctx.currentTime + start);
    oscillator.stop(this.ctx.currentTime + start + duration + 0.05);
  },
  chord(frequencies, start, duration, type = 'triangle', volume = 0.16) {
    frequencies.forEach((frequency, index) => this.tone(frequency, start + index * 0.02, duration, type, volume));
  },
  click() { this.tone(600, 0, 0.08, 'square', 0.1); this.tone(900, 0.03, 0.06, 'square', 0.07); },
  correct() { [523, 659, 784].forEach((frequency, index) => this.tone(frequency, index * 0.1, 0.2, 'triangle', 0.25)); },
  wrong() { this.tone(220, 0, 0.18, 'sawtooth', 0.16); this.tone(180, 0.15, 0.3, 'sawtooth', 0.14); },
  prompt() { [523, 659, 784, 1047].forEach((frequency, index) => this.tone(frequency, index * 0.08, 0.14, 'triangle', 0.12)); },
  fanfare() { [523, 659, 784, 1047].forEach((frequency, index) => this.tone(frequency, index * 0.14, 0.35, 'triangle', 0.24)); this.chord([523, 659, 784], 0.72, 0.7); },
  sad() { this.tone(392, 0, 0.25, 'triangle', 0.16); this.tone(311, 0.25, 0.35, 'triangle', 0.16); },
  speak(text) {
    if (this.muted || !('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN'; utterance.rate = 0.9; utterance.pitch = 1.35;
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance);
  },
};
