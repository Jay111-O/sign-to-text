/**
 * Speech-to-Sign: Web Speech API, waveform, transcript, ASL display, chat
 */
import { initWaveform, stopWaveform } from './waveform.js';
import { setText as setAslText, clearLetters, getDisplayText } from './asl-display.js';

const transcriptEl = document.getElementById('transcript');
const micBtn = document.getElementById('mic-btn');
const pauseBtn = document.getElementById('pause-btn');
const stopBtn = document.getElementById('stop-btn');

if (!transcriptEl || !micBtn) throw new Error('Speech-to-Sign DOM elements not found');

let recognition = null;
let stream = null;
let isPaused = false;
let fullTranscript = '';
let onTranscriptCallback = null;

function getSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  const rec = new SpeechRecognition();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = 'en-US';
  return rec;
}

function updateTranscript(text) {
  fullTranscript = text;
  transcriptEl.textContent = text || '';
  setAslText(text || '');
}

function startListening() {
  recognition = getSpeechRecognition();
  if (!recognition) {
    transcriptEl.textContent = 'Speech recognition is not supported in this browser. Try Chrome or Edge.';
    return;
  }

  recognition.onresult = (event) => {
    let interim = '';
    let final = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const text = result[0].transcript;
      if (result.isFinal) {
        final += text;
      } else {
        interim += text;
      }
    }
    const current = fullTranscript + final;
    updateTranscript(current + interim);
  };

  recognition.onend = () => {
    if (!isPaused && stream) {
      try {
        recognition.start();
      } catch (_) {}
    }
  };

  recognition.onerror = (event) => {
    if (event.error === 'not-allowed') {
      stopListening();
      transcriptEl.textContent = 'Microphone access was denied.';
    }
  };

  recognition.start();
  micBtn.classList.add('listening');
  micBtn.querySelector('.btn-text').textContent = 'Listening…';
  pauseBtn.disabled = false;
  stopBtn.disabled = false;
}

function requestMicAndStart() {
  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((s) => {
      stream = s;
      initWaveform(stream);
      startListening();
    })
    .catch(() => {
      transcriptEl.textContent = 'Could not access microphone. Please allow microphone permission.';
    });
}

function stopListening() {
  if (recognition) {
    try {
      recognition.stop();
    } catch (_) {}
    recognition = null;
  }
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  stopWaveform();
  micBtn.classList.remove('listening');
  micBtn.querySelector('.btn-text').textContent = 'Start listening';
  pauseBtn.disabled = true;
  stopBtn.disabled = true;
  pauseBtn.textContent = 'Pause';
  isPaused = false;

  const text = getDisplayText() || fullTranscript;
  if (text.trim() && onTranscriptCallback) {
    onTranscriptCallback(text.trim());
  }
}

micBtn.addEventListener('click', () => {
  if (stream) {
    stopListening();
  } else {
    updateTranscript('');
    requestMicAndStart();
  }
});

pauseBtn.addEventListener('click', () => {
  if (!stream) return;
  if (isPaused) {
    isPaused = false;
    startListening();
    pauseBtn.textContent = 'Pause';
    micBtn.querySelector('.btn-text').textContent = 'Listening…';
  } else {
    isPaused = true;
    if (recognition) {
      try {
        recognition.stop();
      } catch (_) {}
    }
    pauseBtn.textContent = 'Resume';
    micBtn.querySelector('.btn-text').textContent = 'Paused';
  }
});

stopBtn.addEventListener('click', stopListening);

export function setOnTranscriptCallback(cb) {
  onTranscriptCallback = cb;
}

export function getCurrentTranscript() {
  return getDisplayText() || fullTranscript;
}

export function clearTranscript() {
  fullTranscript = '';
  updateTranscript('');
  clearLetters();
}
