// Sound for Island Hopper: every sound is made, not loaded.
// One job: a small WebAudio synth — engine hum that follows the throttle,
// a chime for a ring, a thud for a touchdown, a sting for a crash. It starts
// only after the player first touches a key or the mouse, so browsers allow it.

export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    engineOsc: null,
    engineOsc2: null,
    engineGain: null,
    windGain: null,
    muted: false,
    started: false,
  };
  return audio;
}

export function ensureAudio(audio) {
  if (audio.started) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    audio.ctx = ctx;
    audio.master = ctx.createGain();
    audio.master.gain.value = 0.5;
    audio.master.connect(ctx.destination);

    // Engine: two detuned saws through a low-pass, gain follows throttle.
    audio.engineOsc = ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 55;
    audio.engineOsc2 = ctx.createOscillator();
    audio.engineOsc2.type = 'sawtooth';
    audio.engineOsc2.frequency.value = 82.5;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    audio.engineGain = ctx.createGain();
    audio.engineGain.gain.value = 0;
    audio.engineOsc.connect(filter);
    audio.engineOsc2.connect(filter);
    filter.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engineOsc.start();
    audio.engineOsc2.start();

    // Wind: looped noise, louder with speed.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 700;
    audio.windGain = ctx.createGain();
    audio.windGain.gain.value = 0;
    noise.connect(windFilter);
    windFilter.connect(audio.windGain);
    audio.windGain.connect(audio.master);
    noise.start();

    audio.started = true;
  } catch (err) {
    audio.started = false;
  }
}

export function updateEngineSound(audio, throttle, speedKts, onGround) {
  if (!audio.started || audio.muted) return;
  const t = audio.ctx.currentTime;
  const rpm = 42 + throttle * 68;
  audio.engineOsc.frequency.setTargetAtTime(rpm, t, 0.1);
  audio.engineOsc2.frequency.setTargetAtTime(rpm * 1.5 + 3, t, 0.1);
  const target = onGround ? 0.02 + throttle * 0.05 : 0.03 + throttle * 0.09;
  audio.engineGain.gain.setTargetAtTime(target, t, 0.15);
  audio.windGain.gain.setTargetAtTime(Math.min(0.12, (speedKts / 210) * 0.12), t, 0.2);
}

function tone(audio, freq, dur, type, vol, when) {
  if (!audio.started || audio.muted) return;
  try {
    const t = audio.ctx.currentTime + (when || 0);
    const osc = audio.ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const g = audio.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol || 0.2, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(audio.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  } catch (err) {
    // Sound is garnish; a failure here must never break the game.
  }
}

export function playRingChime(audio) {
  tone(audio, 880, 0.35, 'sine', 0.25, 0);
  tone(audio, 1318, 0.4, 'sine', 0.18, 0.07);
}

export function playLandingThud(audio) {
  tone(audio, 90, 0.3, 'triangle', 0.35, 0);
  tone(audio, 660, 0.5, 'sine', 0.2, 0.08);
  tone(audio, 990, 0.6, 'sine', 0.15, 0.16);
}

export function playCrashSting(audio) {
  tone(audio, 160, 0.7, 'sawtooth', 0.25, 0);
  tone(audio, 70, 0.9, 'sawtooth', 0.25, 0.1);
}

export function toggleMute(audio) {
  audio.muted = !audio.muted;
  if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.5;
  return audio.muted;
}
