/**
 * Sign-to-Text: MediaPipe Hands + ASL classifier with vote buffer and trainable model
 */
import { classifyHand } from './asl-classifier.js';
import { addSample, getSampleCounts, clearSamples, hasTrainedModel } from './asl-model.js';

const video = document.getElementById('webcam-video');
const canvas = document.getElementById('webcam-canvas');
const placeholder = document.getElementById('webcam-placeholder');
const webcamBtn = document.getElementById('webcam-btn');
const signTextEl = document.getElementById('sign-text');
const confidenceEl = document.getElementById('sign-confidence');
const currentLetterEl = document.getElementById('current-letter');
const confidenceBarEl = document.getElementById('confidence-bar');
const addToChatBtn = document.getElementById('add-sign-to-chat-btn');
const trainLetterEl = document.getElementById('train-letter');
const trainRecordBtn = document.getElementById('train-record-btn');
const trainClearBtn = document.getElementById('train-clear-btn');
const trainStatusEl = document.getElementById('train-status');

if (!video || !canvas || !webcamBtn || !signTextEl) throw new Error('Sign-to-Text DOM elements not found');

let handLandmarker = null;
let stream = null;
let lastEmittedLetter = null;
let lastEmittedTime = 0;
let letterBuffer = '';
const LETTER_HOLD_MS = 500;
const MIN_CONFIDENCE = 0.5;
const VOTE_SIZE = 8;
const VOTE_MAJORITY = 5;
const voteBuffer = [];
let onSignCallback = null;
let animationId = null;

let recordingLetter = null;
let recordingCount = 0;
const RECORDING_TARGET = 15;
const RECORDING_INTERVAL_MS = 180;
let lastRecordTime = 0;

async function loadMediaPipe() {
  if (handLandmarker) return handLandmarker;
  const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs');
  const { HandLandmarker, FilesetResolver } = vision;
  const resolver = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
  );
  handLandmarker = await HandLandmarker.createFromOptions(resolver, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numHands: 1,
  });
  return handLandmarker;
}

function drawHands(ctx, results) {
  if (!results?.landmarks) return;
  ctx.strokeStyle = 'rgba(34, 197, 94, 0.9)';
  ctx.lineWidth = 2;
  ctx.fillStyle = 'rgba(34, 197, 94, 0.25)';
  for (const hand of results.landmarks) {
    const xs = hand.map((p) => p.x * canvas.width);
    const ys = hand.map((p) => p.y * canvas.height);
    const minX = Math.max(0, Math.min(...xs) - 12);
    const minY = Math.max(0, Math.min(...ys) - 12);
    const maxX = Math.min(canvas.width, Math.max(...xs) + 12);
    const maxY = Math.min(canvas.height, Math.max(...ys) + 12);
    ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
    for (let i = 0; i < hand.length; i++) {
      const x = hand[i].x * canvas.width;
      const y = hand[i].y * canvas.height;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
}

function getStableLetter() {
  if (voteBuffer.length < VOTE_MAJORITY) return null;
  const counts = {};
  for (const { letter } of voteBuffer) {
    counts[letter] = (counts[letter] || 0) + 1;
  }
  const entries = Object.entries(counts).filter(([letter]) => letter !== null);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1]);
  const [letter, count] = entries[0];
  if (count >= VOTE_MAJORITY) return letter;
  return null;
}

function getAverageConfidence() {
  if (voteBuffer.length === 0) return 0;
  const sum = voteBuffer.reduce((s, { confidence }) => s + confidence, 0);
  return sum / voteBuffer.length;
}

function detectAndDraw() {
  if (!stream || !video.srcObject || !handLandmarker) return;

  const results = handLandmarker.detectForVideo(video, performance.now());
  const ctx = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawHands(ctx, results);

  if (results?.landmarks?.[0]) {
    const landmarks = results.landmarks[0];
    if (recordingLetter) {
      const now = Date.now();
      if (now - lastRecordTime >= RECORDING_INTERVAL_MS) {
        addSample(recordingLetter, landmarks);
        recordingCount++;
        lastRecordTime = now;
        updateTrainStatus();
        if (recordingCount >= RECORDING_TARGET) {
          recordingLetter = null;
          recordingCount = 0;
          if (trainRecordBtn) trainRecordBtn.disabled = false;
          if (trainRecordBtn?.querySelector('.btn-text')) trainRecordBtn.querySelector('.btn-text').textContent = 'Record 15 samples';
        }
      }
    }
    if (!recordingLetter) {
    const { letter, confidence } = classifyHand(landmarks);
    if (letter && confidence >= MIN_CONFIDENCE) {
      voteBuffer.push({ letter, confidence });
      if (voteBuffer.length > VOTE_SIZE) voteBuffer.shift();
      const stable = getStableLetter();
      const avgConf = getAverageConfidence();
      if (currentLetterEl) {
        currentLetterEl.textContent = stable || letter;
        currentLetterEl.className = 'current-letter' + (stable ? ' stable' : '');
      }
      if (confidenceBarEl) {
        const pct = Math.round(avgConf * 100);
        confidenceBarEl.style.width = `${pct}%`;
        confidenceBarEl.setAttribute('aria-valuenow', pct);
      }
      if (confidenceEl) confidenceEl.textContent = `Confidence: ${Math.round(avgConf * 100)}%`;
      if (stable) {
        const now = Date.now();
        const heldLongEnough = now - lastEmittedTime >= LETTER_HOLD_MS;
        const isNewLetter = stable !== lastEmittedLetter;
        if (isNewLetter || heldLongEnough) {
          lastEmittedLetter = stable;
          lastEmittedTime = now;
          letterBuffer += stable;
          signTextEl.textContent = letterBuffer;
        }
      }
    } else {
      voteBuffer.push({ letter: null, confidence: 0 });
      if (voteBuffer.length > VOTE_SIZE) voteBuffer.shift();
      if (currentLetterEl) currentLetterEl.textContent = '—';
      if (confidenceBarEl) confidenceBarEl.style.width = '0%';
    }
    }
  } else {
    voteBuffer.length = 0;
    if (currentLetterEl) currentLetterEl.textContent = '—';
    if (confidenceBarEl) confidenceBarEl.style.width = '0%';
  }

  animationId = requestAnimationFrame(detectAndDraw);
}

function updateTrainStatus() {
  if (!trainStatusEl) return;
  if (recordingLetter) {
    trainStatusEl.textContent = `Recording ${recordingLetter}… ${recordingCount}/${RECORDING_TARGET}. Hold your hand steady.`;
    return;
  }
  const counts = getSampleCounts();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) {
    trainStatusEl.textContent = 'No model trained. Record at least 5 samples per letter for 2+ letters.';
    return;
  }
  const parts = Object.entries(counts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([letter, n]) => `${letter}: ${n}`);
  const active = hasTrainedModel() ? ' (active)' : '';
  trainStatusEl.textContent = `Trained: ${parts.join(', ')}${active}`;
}

function setupTrainUI() {
  if (trainLetterEl && trainLetterEl.options.length <= 1) {
    for (let i = 65; i <= 90; i++) {
      const opt = document.createElement('option');
      opt.value = String.fromCharCode(i);
      opt.textContent = String.fromCharCode(i);
      trainLetterEl.appendChild(opt);
    }
  }
  trainLetterEl?.addEventListener('change', () => {
    if (trainRecordBtn) trainRecordBtn.disabled = !stream || !trainLetterEl?.value;
  });
  trainRecordBtn?.addEventListener('click', () => {
    const letter = trainLetterEl?.value;
    if (!letter || !stream) return;
    recordingLetter = letter;
    recordingCount = 0;
    lastRecordTime = 0;
    trainRecordBtn.disabled = true;
    if (trainRecordBtn.querySelector('.btn-text')) trainRecordBtn.querySelector('.btn-text').textContent = 'Recording…';
    updateTrainStatus();
  });
  trainClearBtn?.addEventListener('click', () => {
    clearSamples();
    recordingLetter = null;
    recordingCount = 0;
    if (trainRecordBtn) trainRecordBtn.disabled = !stream || !trainLetterEl?.value;
    if (trainRecordBtn?.querySelector('.btn-text')) trainRecordBtn.querySelector('.btn-text').textContent = 'Record 15 samples';
    updateTrainStatus();
  });
  updateTrainStatus();
}

async function startWebcam() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' },
    });
    video.srcObject = stream;
    placeholder.classList.add('hidden');
    webcamBtn.querySelector('.btn-text').textContent = 'Stop camera';
    await video.play();
    await loadMediaPipe();
    letterBuffer = '';
    lastEmittedLetter = null;
    lastEmittedTime = 0;
    voteBuffer.length = 0;
    signTextEl.textContent = '—';
    if (confidenceEl) confidenceEl.textContent = 'Confidence: —';
    if (currentLetterEl) currentLetterEl.textContent = '—';
    if (confidenceBarEl) confidenceBarEl.style.width = '0%';
    if (trainRecordBtn) trainRecordBtn.disabled = !trainLetterEl?.value;
    updateTrainStatus();
    detectAndDraw();
  } catch (err) {
    placeholder.classList.remove('hidden');
    signTextEl.textContent = 'Camera access denied';
    console.error(err);
  }
}

function stopWebcam() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  video.srcObject = null;
  placeholder.classList.remove('hidden');
  webcamBtn.querySelector('.btn-text').textContent = 'Start camera';
  if (trainRecordBtn) trainRecordBtn.disabled = true;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

webcamBtn.addEventListener('click', () => {
  if (stream) {
    stopWebcam();
    if (letterBuffer.trim() && onSignCallback) {
      onSignCallback(letterBuffer.trim(), null);
    }
  } else {
    startWebcam();
  }
});

addToChatBtn?.addEventListener('click', () => {
  if (letterBuffer.trim() && onSignCallback) {
    onSignCallback(letterBuffer.trim(), null);
    letterBuffer = '';
    lastEmittedLetter = null;
    signTextEl.textContent = '—';
    if (confidenceEl) confidenceEl.textContent = 'Confidence: —';
  }
});

export function setOnSignCallback(cb) {
  onSignCallback = cb;
}

export function getSignBuffer() {
  return letterBuffer;
}

export function clearSignBuffer() {
  letterBuffer = '';
  lastEmittedLetter = null;
  voteBuffer.length = 0;
  if (signTextEl) signTextEl.textContent = '—';
  if (confidenceEl) confidenceEl.textContent = 'Confidence: —';
  if (currentLetterEl) currentLetterEl.textContent = '—';
  if (confidenceBarEl) confidenceBarEl.style.width = '0%';
}

setupTrainUI();
