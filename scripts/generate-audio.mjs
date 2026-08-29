import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const sampleRate = 22_050;
const root = resolve("packages/ui/src/assets/audio");

function envelope(t, duration, attack = 0.008, release = 0.08) {
  const attackGain = Math.min(1, t / attack);
  const releaseGain = Math.min(1, Math.max(0, (duration - t) / release));
  return attackGain * releaseGain;
}

function tone({ duration, frequencies, wave = "sine", volume = 0.25, decay = 0.08 }) {
  const count = Math.ceil(duration * sampleRate);
  const samples = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const t = i / sampleRate;
    let value = 0;
    for (const [frequency, level = 1] of frequencies) {
      const phase = 2 * Math.PI * frequency * t;
      value +=
        wave === "triangle"
          ? (2 / Math.PI) * Math.asin(Math.sin(phase)) * level
          : Math.sin(phase) * level;
    }
    samples[i] = value * volume * envelope(t, duration, 0.006, decay);
  }
  return samples;
}

function mix(parts, duration) {
  const count = Math.ceil(duration * sampleRate);
  const samples = new Float32Array(count);
  for (const { data, offset = 0, gain = 1 } of parts) {
    const start = Math.floor(offset * sampleRate);
    for (let i = 0; i < data.length && start + i < count; i += 1) {
      samples[start + i] += data[i] * gain;
    }
  }
  return samples;
}

function writeWav(relativePath, samples) {
  const target = resolve(root, relativePath);
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + samples.length * 2, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }
  return mkdir(dirname(target), { recursive: true }).then(() => writeFile(target, buffer));
}

const start = mix(
  [
    { data: tone({ duration: 0.18, frequencies: [[392, 0.7], [784, 0.14]], volume: 0.22, decay: 0.1 }) },
    { data: tone({ duration: 0.28, frequencies: [[523, 0.7], [1_046, 0.12]], volume: 0.2, decay: 0.16 }), offset: 0.12 }
  ],
  0.45
);

// 其余音效（点按成功/失败、过关、解锁）使用 Mixkit 素材，见 packages/ui/src/game/sound.ts
await Promise.all([writeWav("start-chime.wav", start)]);

console.log("Generated local audio assets in", root);
