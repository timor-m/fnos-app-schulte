let audioContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  try {
    if (typeof window === "undefined") return null;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!audioContext) audioContext = new Ctor();
    if (audioContext.state === "suspended") {
      void audioContext.resume();
    }
    return audioContext;
  } catch {
    return null;
  }
}

function tone(frequency: number, durationMs: number, type: OscillatorType, gainValue: number): void {
  try {
    const ctx = getContext();
    if (!ctx) return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(gainValue, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + durationMs / 1000);
  } catch {
    // 音频不可用时静默降级，绝不影响点按逻辑
  }
}

export function playTap(step: number): void {
  // 音高随进度缓慢上升，形成正反馈
  tone(420 + Math.min(step, 60) * 8, 90, "sine", 0.08);
}

export function playError(): void {
  tone(180, 160, "triangle", 0.1);
}

export function playComplete(): void {
  tone(523, 140, "sine", 0.1);
  window.setTimeout(() => tone(659, 140, "sine", 0.1), 120);
  window.setTimeout(() => tone(784, 220, "sine", 0.12), 240);
}

export function playFail(): void {
  tone(330, 180, "triangle", 0.1);
  window.setTimeout(() => tone(233, 260, "triangle", 0.1), 160);
}
