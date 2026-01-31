/**
 * ASL finger-spelling display: shows letters one-by-one with optional highlight
 */
const aslLettersEl = document.getElementById('asl-letters');
const aslHintEl = document.getElementById('asl-spelling-hint');

if (!aslLettersEl) throw new Error('ASL letters container not found');

let highlightIndex = 0;
let highlightInterval = null;

export function setText(text) {
  clearLetters();
  if (!text || !text.trim()) return;

  const letters = text.toUpperCase().replace(/[^A-Z\s]/g, '').split('');
  letters.forEach((char) => {
    const span = document.createElement('span');
    span.className = 'asl-letter';
    span.textContent = char === ' ' ? '␣' : char;
    span.setAttribute('aria-label', char === ' ' ? 'space' : `ASL letter ${char}`);
    aslLettersEl.appendChild(span);
  });
  startHighlightCycle(letters.length);
}

export function clearLetters() {
  aslLettersEl.innerHTML = '';
  stopHighlightCycle();
}

function startHighlightCycle(count) {
  stopHighlightCycle();
  if (count === 0) return;
  const letters = aslLettersEl.querySelectorAll('.asl-letter');
  letters.forEach((el) => el.classList.remove('highlight'));
  highlightIndex = 0;

  highlightInterval = setInterval(() => {
    letters.forEach((el, i) => el.classList.toggle('highlight', i === highlightIndex));
    highlightIndex = (highlightIndex + 1) % letters.length;
  }, 800);
}

function stopHighlightCycle() {
  if (highlightInterval) {
    clearInterval(highlightInterval);
    highlightInterval = null;
  }
  aslLettersEl.querySelectorAll('.asl-letter').forEach((el) => el.classList.remove('highlight'));
}

export function getDisplayText() {
  return Array.from(aslLettersEl.querySelectorAll('.asl-letter'))
    .map((el) => (el.textContent === '␣' ? ' ' : el.textContent))
    .join('');
}
