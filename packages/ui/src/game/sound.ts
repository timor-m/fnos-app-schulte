import completeUrl from "../assets/audio/complete-warm.wav";
import errorUrl from "../assets/audio/error-muted.wav";
import failUrl from "../assets/audio/fail-soft.wav";
import startUrl from "../assets/audio/start-chime.wav";

let audioContext: AudioContext | null = null;
let resumePromise: Promise<boolean> | null = null;
let tapOscillator: OscillatorNode | null = null;
let tapGain: GainNode | null = null;
let tapVoiceContext: AudioContext | null = null;
const bufferCache = new Map<string, AudioBuffer>();
const bufferPromises = new Map<string, Promise<AudioBuffer | null>>();

function getContext(): AudioContext | null {
  try {
    if (typeof window === "undefined") return null;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (audioContext?.state === "closed") audioContext = null;
    if (!audioContext) {
      try {
        audioContext = new Ctor({ latencyHint: "interactive" });
      } catch {
        audioContext = new Ctor();
      }
    }
    return audioContext;
  } catch {
    return null;
  }
}

function ensureRunning(ctx: AudioContext): Promise<boolean> {
  if (ctx.state === "running") return Promise.resolve(true);
  if (resumePromise) return resumePromise;

  resumePromise = ctx
    .resume()
    .then(() => ctx.state === "running")
    .catch(() => false)
    .finally(() => {
      resumePromise = null;
    });
  return resumePromise;
}

function scheduleTone(
  ctx: AudioContext,
  frequency: number,
  durationMs: number,
  type: OscillatorType,
  gainValue: number
): void {
  try {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.addEventListener(
      "ended",
      () => {
        oscillator.disconnect();
        gain.disconnect();
      },
      { once: true }
    );
    oscillator.start(now);
    oscillator.stop(now + durationMs / 1000);
  } catch {
    // 音频不可用时静默降级，绝不影响点按逻辑
  }
}

function tone(frequency: number, durationMs: number, type: OscillatorType, gainValue: number): void {
  const ctx = getContext();
  if (!ctx) return;

  if (ctx.state === "running") {
    scheduleTone(ctx, frequency, durationMs, type, gainValue);
    return;
  }

  void ensureRunning(ctx).then((ready) => {
    if (ready) scheduleTone(ctx, frequency, durationMs, type, gainValue);
  });
}

function scheduleTap(ctx: AudioContext, step: number): void {
  try {
    if (!tapOscillator || !tapGain || tapVoiceContext !== ctx) {
      tapOscillator?.disconnect();
      tapGain?.disconnect();
      tapOscillator = ctx.createOscillator();
      tapGain = ctx.createGain();
      tapVoiceContext = ctx;
      tapOscillator.type = "sine";
      tapGain.gain.value = 0.0001;
      tapOscillator.connect(tapGain).connect(ctx.destination);
      tapOscillator.start();
    }

    const now = ctx.currentTime;
    tapOscillator.frequency.setValueAtTime(420 + Math.min(step, 60) * 8, now);
    tapGain.gain.cancelScheduledValues(now);
    tapGain.gain.setValueAtTime(0.08, now);
    tapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
  } catch {
    tapOscillator = null;
    tapGain = null;
    tapVoiceContext = null;
  }
}

function loadBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer | null> {
  const cached = bufferCache.get(url);
  if (cached) return Promise.resolve(cached);
  const pending = bufferPromises.get(url);
  if (pending) return pending;

  const request = fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`Audio request failed: ${response.status}`);
      return response.arrayBuffer();
    })
    .then((data) => ctx.decodeAudioData(data))
    .then((buffer) => {
      bufferCache.set(url, buffer);
      return buffer;
    })
    .catch(() => null)
    .finally(() => {
      bufferPromises.delete(url);
    });
  bufferPromises.set(url, request);
  return request;
}

function sample(url: string, volume: number, fallback: () => void, playbackRate = 1): void {
  const ctx = getContext();
  if (!ctx) {
    fallback();
    return;
  }

  void ensureRunning(ctx).then(async (ready) => {
    if (!ready) {
      fallback();
      return;
    }
    const buffer = await loadBuffer(ctx, url);
    if (!buffer) {
      fallback();
      return;
    }
    try {
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = buffer;
      source.playbackRate.value = playbackRate;
      gain.gain.value = volume;
      source.connect(gain).connect(ctx.destination);
      source.addEventListener(
        "ended",
        () => {
          source.disconnect();
          gain.disconnect();
        },
        { once: true }
      );
      source.start();
    } catch {
      fallback();
    }
  });
}

function preloadSamples(): void {
  const ctx = getContext();
  if (!ctx) return;
  for (const url of [startUrl, errorUrl, completeUrl, failUrl]) {
    void loadBuffer(ctx, url);
  }
}

export function preloadAudio(): void {
  preloadSamples();
}

/** 必须直接从用户手势调用，提前解除 WebView 的自动播放限制。 */
export function unlockAudio(): void {
  const ctx = getContext();
  if (ctx) {
    void ensureRunning(ctx);
    preloadSamples();
  }
}

export function playTap(step: number): void {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === "running") {
    scheduleTap(ctx, step);
    return;
  }
  void ensureRunning(ctx).then((ready) => {
    if (ready) scheduleTap(ctx, step);
  });
}

export function playError(): void {
  sample(errorUrl, 0.42, () => tone(180, 160, "triangle", 0.1));
}

export function playComplete(): void {
  sample(completeUrl, 0.52, () => {
    tone(523, 140, "sine", 0.1);
    window.setTimeout(() => tone(659, 140, "sine", 0.1), 120);
    window.setTimeout(() => tone(784, 220, "sine", 0.12), 240);
  });
}

export function playFail(): void {
  sample(failUrl, 0.48, () => {
    tone(330, 180, "triangle", 0.1);
    window.setTimeout(() => tone(233, 260, "triangle", 0.1), 160);
  });
}

export function playStart(): void {
  sample(startUrl, 0.5, () => {
    tone(392, 140, "sine", 0.08);
    window.setTimeout(() => tone(523, 180, "sine", 0.08), 120);
  });
}
