function b64ToBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function encodeWav(buffer: AudioBuffer) {
  const channels = buffer.numberOfChannels;
  const rate = buffer.sampleRate;
  const samples = buffer.length;
  const dataSize = samples * channels * 2;
  const bytes = new ArrayBuffer(44 + dataSize);
  const view = new DataView(bytes);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  const chans = Array.from({ length: channels }, (_, i) => buffer.getChannelData(i));
  let offset = 44;
  for (let i = 0; i < samples; i++) {
    for (let c = 0; c < channels; c++) {
      const s = Math.max(-1, Math.min(1, chans[c][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([bytes], { type: "audio/wav" });
}

export async function clipsToWav(clips: { b64: string }[]) {
  const ctx = new AudioContext();
  const buffers: AudioBuffer[] = [];
  for (const clip of clips) {
    const copy = b64ToBytes(clip.b64).buffer.slice(0);
    buffers.push(await ctx.decodeAudioData(copy));
  }
  if (!buffers.length) throw new Error("No audio to download");
  const channels = Math.max(...buffers.map((b) => b.numberOfChannels));
  const rate = buffers[0].sampleRate;
  const length = buffers.reduce((n, b) => n + b.length, 0);
  const out = ctx.createBuffer(channels, length, rate);
  let offset = 0;
  for (const buf of buffers) {
    for (let c = 0; c < channels; c++) {
      out.getChannelData(c).set(buf.getChannelData(Math.min(c, buf.numberOfChannels - 1)), offset);
    }
    offset += buf.length;
  }
  await ctx.close().catch(() => undefined);
  return encodeWav(out);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
