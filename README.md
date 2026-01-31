# SignBridge

Real-time **Speech-to-Sign** and **Sign-to-Text** for deaf and hearing-impaired communication. Built with the Web Speech API, MediaPipe Hands, and a rule-based ASL letter classifier.

## Features

- **Speech → Sign (top)**  
  - Real-time speech recognition (Web Speech API)  
  - Live waveform from microphone  
  - Transcribed text + ASL finger-spelling display (letter-by-letter)  
  - Pause / Stop / Play controls  

- **Sign → Text (middle)**  
  - Webcam hand tracking with MediaPipe Hands  
  - Bounding boxes and landmarks overlay  
  - Rule-based ASL letter recognition (A, B, C, D, E, I, K, L, V, W, Y, H, etc.)  
  - Live text and confidence score  
  - “Add to chat” to send current spelled word  

- **Dual-mode chat (bottom)**  
  - Left: Speech → Sign messages  
  - Right: Sign → Text messages  
  - Copy conversation / Share  
  - Messages stored via backend API when server is running  

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Start the server**

   ```bash
   npm start
   ```

3. Open **http://localhost:3000** in a modern browser (Chrome or Edge recommended for Web Speech API and MediaPipe).

## Requirements

- **Browser:** Chrome or Edge (for speech recognition and best MediaPipe support).  
- **HTTPS or localhost** for microphone and camera.  
- **Microphone** for Speech → Sign.  
- **Webcam** for Sign → Text.  

## Tech stack

- **Frontend:** Vanilla JS (ES modules), CSS, HTML  
- **Backend:** Node.js, Express  
- **APIs:** Web Speech API, MediaPipe Tasks Vision (Hand Landmarker), rule-based ASL classifier  

## Project structure

```
sign to text/
├── server.js           # Express server + chat API
├── package.json
├── public/
│   ├── index.html
│   ├── css/styles.css
│   └── js/
│       ├── app.js           # Entry, wires modules
│       ├── speech-to-sign.js # Web Speech API, transcript, ASL display
│       ├── waveform.js      # Mic waveform
│       ├── asl-display.js   # Finger-spelling letters
│       ├── sign-to-text.js  # MediaPipe + webcam
│       ├── asl-classifier.js# Rule-based ASL letter classification
│       └── chat.js          # Dual-mode chat, copy/share, API
└── README.md
```

## API (backend)

- `POST /api/chat/session` – create session, returns `{ sessionId }`  
- `POST /api/chat/:sessionId/message` – add message `{ type, content, source }`  
- `GET /api/chat/:sessionId` – get message history  

If the server is not running, chat still works locally (messages shown in UI only).

## License

MIT
