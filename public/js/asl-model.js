/**
 * Trainable ASL model: store landmark samples per letter, classify with KNN.
 * Landmarks are normalized (wrist at origin, scale by palm size) for invariance.
 */
const STORAGE_KEY = 'signbridge_asl_trained';
const K_NEIGHBORS = 5;
const MIN_SAMPLES_PER_LETTER = 5;
const MIN_TOTAL_SAMPLES = 10;

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
}

function palmSize(lm) {
  return dist(lm[0], lm[9]) || 0.08;
}

/** Normalize 21 landmarks to wrist-origin, palm-scale, then flatten to 63 floats */
export function normalizeLandmarks(landmarks) {
  if (!landmarks || landmarks.length < 21) return null;
  const wrist = landmarks[0];
  const scale = palmSize(landmarks);
  if (scale < 1e-6) return null;
  const out = [];
  for (let i = 0; i < 21; i++) {
    const p = landmarks[i];
    out.push((p.x - wrist.x) / scale, (p.y - wrist.y) / scale, ((p.z || 0) - (wrist.z || 0)) / scale);
  }
  return out;
}

function vectorDist(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

function loadSamples() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveSamples(samples) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(samples));
  } catch (e) {
    console.warn('Could not save ASL samples', e);
  }
}

/** Add a training sample: { letter, vector } */
export function addSample(letter, landmarks) {
  const vector = normalizeLandmarks(landmarks);
  if (!vector || !letter) return false;
  const samples = loadSamples();
  samples.push({ letter: letter.toUpperCase(), vector });
  saveSamples(samples);
  return true;
}

/** Get all samples: { letter, vector }[] */
export function getSamples() {
  return loadSamples();
}

/** Get count per letter: { A: 15, B: 12, ... } */
export function getSampleCounts() {
  const samples = loadSamples();
  const counts = {};
  for (const { letter } of samples) {
    counts[letter] = (counts[letter] || 0) + 1;
  }
  return counts;
}

/** Clear all training data */
export function clearSamples() {
  saveSamples([]);
}

/** Whether we have enough data to use the trained model */
export function hasTrainedModel() {
  const samples = loadSamples();
  if (samples.length < MIN_TOTAL_SAMPLES) return false;
  const counts = getSampleCounts();
  const lettersWithEnough = Object.values(counts).filter((c) => c >= MIN_SAMPLES_PER_LETTER).length;
  return lettersWithEnough >= 2;
}

/**
 * Classify hand using KNN on trained samples.
 * Returns { letter, confidence } or { letter: null, confidence: 0 } if no/invalid model.
 */
export function classifyWithModel(landmarks) {
  const samples = loadSamples();
  if (samples.length < MIN_TOTAL_SAMPLES) return { letter: null, confidence: 0 };

  const vector = normalizeLandmarks(landmarks);
  if (!vector) return { letter: null, confidence: 0 };

  const k = Math.min(K_NEIGHBORS, samples.length);
  const withDist = samples.map((s) => ({
    letter: s.letter,
    dist: vectorDist(vector, s.vector),
  }));
  withDist.sort((a, b) => a.dist - b.dist);
  const nearest = withDist.slice(0, k);

  const votes = {};
  let totalWeight = 0;
  for (const { letter, dist: d } of nearest) {
    const w = 1 / (1 + d);
    votes[letter] = (votes[letter] || 0) + w;
    totalWeight += w;
  }
  let bestLetter = null;
  let bestScore = 0;
  for (const [letter, score] of Object.entries(votes)) {
    if (score > bestScore) {
      bestScore = score;
      bestLetter = letter;
    }
  }
  if (!bestLetter) return { letter: null, confidence: 0 };
  const avgDist = nearest.reduce((s, n) => s + n.dist, 0) / nearest.length;
  const confidence = Math.max(0.5, Math.min(0.95, 1 - avgDist * 0.4));
  return { letter: bestLetter, confidence };
}
