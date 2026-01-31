/**
 * ASL letter classifier: uses trained KNN model if available, else rule-based.
 */
import { hasTrainedModel, classifyWithModel } from './asl-model.js';

const TIPS = [4, 8, 12, 16, 20];
const PIPS = [3, 6, 10, 14, 18];
const MCP = [2, 5, 9, 13, 17];

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
}

function palmSize(lm) {
  return dist(lm[0], lm[9]) || 0.08;
}

function fingerExtended(lm, fingerIdx, strict = false) {
  const tip = lm[TIPS[fingerIdx]];
  const pip = lm[PIPS[fingerIdx]];
  const mcp = lm[MCP[fingerIdx]];
  const tipPip = dist(tip, pip);
  const pipMcp = dist(pip, mcp) || 0.01;
  const ratio = tipPip / pipMcp;
  return strict ? ratio > 0.95 : ratio > 0.78;
}

function extendedFingers(lm, strict = false) {
  return [0, 1, 2, 3, 4].map((i) => (fingerExtended(lm, i, strict) ? 1 : 0));
}

function thumbOut(lm) {
  const tip = lm[4];
  const ip = lm[3];
  const mcp = lm[2];
  const tipIp = dist(tip, ip);
  const ipMcp = dist(ip, mcp) || 0.01;
  return tipIp / ipMcp > 0.75;
}

function thumbStretchedSideways(lm) {
  const tip = lm[4];
  const wrist = lm[0];
  const mcp = lm[2];
  return dist(tip, wrist) > dist(mcp, wrist) * 1.1;
}

function thumbFolded(lm, palm) {
  const tip = lm[4];
  const palmCenter = { x: (lm[5].x + lm[9].x) / 2, y: (lm[5].y + lm[9].y) / 2, z: (lm[5].z + lm[9].z) / 2 };
  return dist(tip, palmCenter) < palm * 0.7;
}

function indexMiddleSpread(lm) {
  const dTip = dist(lm[8], lm[12]);
  const dMcp = dist(lm[5], lm[9]) || 0.01;
  return dTip > dMcp * 1.2;
}

function indexMiddleTogether(lm, palm) {
  return dist(lm[8], lm[12]) < palm * 0.4;
}

function classifyHandRules(landmarks) {
  if (!landmarks || landmarks.length < 21) return { letter: null, confidence: 0 };

  const palm = palmSize(landmarks);
  const extStrict = extendedFingers(landmarks, true);
  const ext = extendedFingers(landmarks, false);
  const [t, i, m, r, p] = ext;
  const [tS, iS, mS, rS, pS] = extStrict;
  const thumbOut_ = thumbOut(landmarks);
  const thumbSide = thumbStretchedSideways(landmarks);
  const thumbFold = thumbFolded(landmarks, palm);

  const hi = 0.88;
  const mid = 0.72;
  const low = 0.58;

  // A: fist, thumb to side
  if (!i && !m && !r && !p && thumbSide) return { letter: 'A', confidence: hi };
  // B: flat hand – all four fingers clearly straight, thumb folded in
  if (iS && mS && rS && pS && thumbFold) return { letter: 'B', confidence: hi };
  // C: thumb and index curved (both somewhat extended but not straight)
  if (thumbOut_ && i && !m && !r && !p && !iS) return { letter: 'C', confidence: mid };
  // D: only index up
  if (i && !m && !r && !p && !thumbOut_) return { letter: 'D', confidence: mid };
  // E: all closed, thumb not to side
  if (!i && !m && !r && !p && !thumbSide) return { letter: 'E', confidence: mid };
  // O: thumb and index touching (circle) – strict
  if (thumbOut_ && i && !m && !r && !p && dist(landmarks[4], landmarks[8]) < palm * 0.42) return { letter: 'O', confidence: mid };
  // F: OK sign – thumb and index tips close
  if (thumbOut_ && i && !m && !r && !p && dist(landmarks[4], landmarks[8]) < palm * 0.55) return { letter: 'F', confidence: mid };
  // I: only pinky up
  if (!i && !m && !r && p) return { letter: 'I', confidence: hi };
  // L: index and thumb out
  if (i && !m && !r && !p && thumbOut_) return { letter: 'L', confidence: hi };
  // Index + middle up: K (thumb out), H (together), V (spread), U (default)
  if (i && m && !r && !p) {
    if (thumbOut_) return { letter: 'K', confidence: mid };
    if (indexMiddleTogether(landmarks, palm)) return { letter: 'H', confidence: mid };
    if (indexMiddleSpread(landmarks)) return { letter: 'V', confidence: hi };
    return { letter: 'U', confidence: mid };
  }
  // W: three fingers up
  if (i && m && r && !p) return { letter: 'W', confidence: hi };
  // Y: thumb and pinky out
  if (!i && !m && !r && p && thumbOut_) return { letter: 'Y', confidence: hi };

  return { letter: null, confidence: 0 };
}

/** Classify: use trained model if available and confident, else rules */
export function classifyHand(landmarks) {
  if (!landmarks || landmarks.length < 21) return { letter: null, confidence: 0 };
  if (hasTrainedModel()) {
    const result = classifyWithModel(landmarks);
    if (result.letter && result.confidence >= 0.55) return result;
  }
  return classifyHandRules(landmarks);
}
