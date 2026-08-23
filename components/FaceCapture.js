'use client';
import { useEffect, useRef, useState } from 'react';

// Reusable camera capture widget. Calls onCapture(dataUrl | null) whenever
// the captured photo changes — used both for registering a student's
// reference photo and for the live shot at login-time face verification.
export default function FaceCapture({ onCapture, label }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [captured, setCaptured] = useState(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');

  async function start() {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStreaming(true);
    } catch {
      setError('Could not access the camera. Please allow camera permission and try again.');
    }
  }

  function stop() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStreaming(false);
  }

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCaptured(dataUrl);
    stop();
    onCapture(dataUrl);
  }

  function retake() {
    setCaptured(null);
    onCapture(null);
    start();
  }

  useEffect(() => () => stop(), []);

  return (
    <div style={{ marginBottom: 15 }}>
      {label && <label style={{ display: 'block', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>{label}</label>}
      <div style={{ width: 220, height: 165, background: '#000', borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {captured ? (
          <img src={captured} alt="Captured face" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : streaming ? (
          <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ color: '#999', fontSize: 12 }}>Camera off</span>
        )}
      </div>
      {error && <div className="error-msg" style={{ marginTop: 8 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {!streaming && !captured && <button type="button" className="btn btn-ghost btn-sm" onClick={start}>Enable camera</button>}
        {streaming && !captured && <button type="button" className="btn btn-gold btn-sm" onClick={capture}>Capture</button>}
        {captured && <button type="button" className="btn btn-ghost btn-sm" onClick={retake}>Retake</button>}
      </div>
    </div>
  );
}
