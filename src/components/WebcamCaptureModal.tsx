'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

interface WebcamCaptureModalProps {
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
  facingMode?: 'user' | 'environment';
}

export default function WebcamCaptureModal({
  onCapture,
  onClose,
  facingMode = 'user',
}: WebcamCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch {
        if (!cancelled) {
          setError(
            'Could not access camera. Please check permissions or use the upload button instead.'
          );
        }
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [facingMode, stopStream]);

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCaptured(dataUrl);
    stopStream();
  };

  const handleRetake = () => {
    setCaptured(null);
    setError(null);

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(() => {
        setError('Could not restart camera.');
      });
  };

  const handleConfirm = () => {
    if (captured) {
      onCapture(captured);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
      <div
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
        style={{ border: '1px solid rgba(14,14,12,0.1)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-cormorant text-lg font-light text-ink">Take Photo</h3>
          <button
            type="button"
            onClick={() => {
              stopStream();
              onClose();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-ink/5 transition"
          >
            <svg
              className="h-5 w-5 text-ink-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {error ? (
          <div
            className="rounded-lg bg-amber-50 px-4 py-3 mb-4"
            style={{ border: '1px solid rgba(217,119,6,0.15)' }}
          >
            <p className="font-jost text-sm text-amber-800">{error}</p>
          </div>
        ) : captured ? (
          <div className="mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={captured} alt="Captured photo" className="w-full rounded-lg" />
          </div>
        ) : (
          <div className="mb-4 overflow-hidden rounded-lg bg-ink/5">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full"
              style={facingMode === 'user' ? { transform: 'scaleX(-1)' } : undefined}
            />
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />

        <div className="flex gap-3">
          {error ? (
            <button
              type="button"
              onClick={() => {
                stopStream();
                onClose();
              }}
              className="flex-1 rounded-lg bg-ink py-2.5 font-jost text-sm font-light text-cream transition hover:bg-ink/90"
            >
              Close
            </button>
          ) : captured ? (
            <>
              <button
                type="button"
                onClick={handleRetake}
                className="flex-1 rounded-lg py-2.5 font-jost text-sm font-light text-ink transition hover:bg-ink/5"
                style={{ border: '1px solid rgba(14,14,12,0.15)' }}
              >
                Retake
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 rounded-lg bg-ink py-2.5 font-jost text-sm font-light text-cream transition hover:bg-ink/90"
              >
                Use Photo
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleCapture}
              className="flex-1 rounded-lg bg-ink py-2.5 font-jost text-sm font-light text-cream transition hover:bg-ink/90"
            >
              Capture
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
