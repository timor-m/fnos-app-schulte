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

const tap = tone({
  duration: 0.075,
  frequencies: [[620, 0.75], [1_240, 0.18]],
  wave: "triangle",
  volume: 0.28,
  decay: 0.045
});

const start = mix(
  [
    { data: tone({ duration: 0.18, frequencies: [[392, 0.7], [784, 0.14]], volume: 0.22, decay: 0.1 }) },
    { data: tone({ duration: 0.28, frequencies: [[523, 0.7], [1_046, 0.12]], volume: 0.2, decay: 0.16 }), offset: 0.12 }
  ],
  0.45
);

const error = mix(
  [
    { data: tone({ duration: 0.12, frequencies: [[148, 0.7], [296, 0.1]], wave: "triangle", volume: 0.2 }) },
    { data: tone({ duration: 0.06, frequencies: [[90, 0.6]], wave: "triangle", volume: 0.12 }), offset: 0.035 }
  ],
  0.17
);

const complete = mix(
  [
    { data: tone({ duration: 0.18, frequencies: [[523, 0.75], [1_046, 0.12]], volume: 0.18, decay: 0.1 }) },
    { data: tone({ duration: 0.18, frequencies: [[659, 0.75], [1_318, 0.12]], volume: 0.18, decay: 0.1 }), offset: 0.13 },
    { data: tone({ duration: 0.48, frequencies: [[784, 0.72], [1_568, 0.12]], volume: 0.2, decay: 0.32 }), offset: 0.26 }
  ],
  0.86
);

const fail = mix(
  [
    { data: tone({ duration: 0.2, frequencies: [[330, 0.7], [165, 0.12]], wave: "triangle", volume: 0.17, decay: 0.12 }) },
    { data: tone({ duration: 0.32, frequencies: [[220, 0.7], [110, 0.12]], wave: "triangle", volume: 0.16, decay: 0.22 }), offset: 0.16 }
  ],
  0.62
);

await Promise.all([
  writeWav("start-chime.wav", start),
  writeWav("tap-soft.wav", tap),
  writeWav("error-muted.wav", error),
  writeWav("complete-warm.wav", complete),
  writeWav("fail-soft.wav", fail)
]);

console.log("Generated local audio assets in", root);
