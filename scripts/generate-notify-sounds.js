import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const SAMPLE_RATE = 44100
const DURATION = 2

function writeWav(filePath, samples) {
  const dataSize = samples.length * 2
  const buf = Buffer.alloc(44 + dataSize)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + dataSize, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(SAMPLE_RATE, 24)
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(dataSize, 40)
  for (let i = 0; i < samples.length; i += 1) {
    const clipped = Math.max(-1, Math.min(1, samples[i]))
    buf.writeInt16LE(Math.round(clipped * 32767), 44 + i * 2)
  }
  writeFileSync(filePath, buf)
}

function renderChime(notes) {
  const count = Math.floor(SAMPLE_RATE * DURATION)
  const samples = new Float64Array(count)
  for (const note of notes) {
    for (let i = 0; i < count; i += 1) {
      const time = i / SAMPLE_RATE
      if (time < note.start || time > note.start + note.dur) continue
      const local = time - note.start
      const attack = note.attack ?? 0.01
      const decayK = note.decay ?? 3.2
      const env = local < attack
        ? local / attack
        : Math.exp(-decayK * (local - attack) / Math.max(0.04, note.dur - attack))
      const wave = Math.sin(2 * Math.PI * note.freq * time)
        + 0.32 * Math.sin(2 * Math.PI * note.freq * 2 * time)
        + 0.1 * Math.sin(2 * Math.PI * note.freq * 3 * time)
      samples[i] += wave * env * note.gain
    }
  }
  let peak = 0
  for (const value of samples) peak = Math.max(peak, Math.abs(value))
  const scale = peak > 0 ? 0.94 / peak : 1
  for (let i = 0; i < count; i += 1) samples[i] *= scale
  return samples
}

const primary = renderChime([
  { freq: 1046, start: 0.00, dur: 0.16, gain: 1, decay: 10 },
  { freq: 1318, start: 0.09, dur: 0.16, gain: 1, decay: 10 },
  { freq: 1661, start: 0.18, dur: 0.18, gain: 1, decay: 9 },
  { freq: 2093, start: 0.28, dur: 1.70, gain: 0.92, decay: 2.1 },
])
const reminder = renderChime([
  { freq: 784, start: 0.00, dur: 0.16, gain: 1, decay: 10 },
  { freq: 987, start: 0.09, dur: 0.16, gain: 1, decay: 10 },
  { freq: 1244, start: 0.18, dur: 0.18, gain: 1, decay: 9 },
  { freq: 1568, start: 0.28, dur: 1.70, gain: 0.92, decay: 2.1 },
])

writeWav(join(ROOT, 'notify-primary.wav'), primary)
writeWav(join(ROOT, 'notify-reminder.wav'), reminder)
console.log('wrote 2s notify wavs')
