/**
 * Live waveform visualization from microphone stream using Web Audio API
 */
let audioContext = null;
let analyser = null;
let dataArray = null;
let animationId = null;

const canvas = document.getElementById('waveform');
if (!canvas) throw new Error('Waveform canvas not found');
const ctx = canvas.getContext('2d');

const BAR_COUNT = 64;

function setCanvasSize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(canvas.clientWidth || 300, 1);
  const h = Math.max(canvas.clientHeight || 60, 1);
  const bufferW = Math.floor(w * dpr);
  const bufferH = Math.floor(h * dpr);
  if (canvas.width !== bufferW || canvas.height !== bufferH) {
    canvas.width = bufferW;
    canvas.height = bufferH;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  }
  return { width: w, height: h };
}

export function initWaveform(stream) {
  if (audioContext) {
    audioContext.close();
  }
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioContext.createMediaStreamSource(stream);
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.8;
  source.connect(analyser);

  const bufferLength = analyser.frequencyBinCount;
  dataArray = new Uint8Array(bufferLength);

  if (animationId) cancelAnimationFrame(animationId);
  draw();
}

function draw() {
  animationId = requestAnimationFrame(draw);
  if (!analyser || !dataArray) return;

  const { width: WIDTH, height: HEIGHT } = setCanvasSize();
  const BAR_WIDTH = Math.max(2, (WIDTH / BAR_COUNT) - 2);

  analyser.getByteFrequencyData(dataArray);
  ctx.fillStyle = 'rgb(15, 15, 18)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const step = Math.floor(dataArray.length / BAR_COUNT);
  for (let i = 0; i < BAR_COUNT; i++) {
    const value = dataArray[i * step] || 0;
    const barHeight = Math.max(2, (value / 255) * HEIGHT * 0.9);
    const x = i * (BAR_WIDTH + 2);
    const y = HEIGHT - barHeight;
    const gradient = ctx.createLinearGradient(0, HEIGHT, 0, 0);
    gradient.addColorStop(0, '#6366f1');
    gradient.addColorStop(1, '#818cf8');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.fillRect(x, y, BAR_WIDTH, barHeight);
  }
}

export function stopWaveform() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  if (ctx && canvas) {
    const { width, height } = setCanvasSize();
    ctx.fillStyle = 'rgb(15, 15, 18)';
    ctx.fillRect(0, 0, width, height);
  }
  if (audioContext) {
    audioContext.close().catch(() => {});
    audioContext = null;
  }
  analyser = null;
  dataArray = null;
}
