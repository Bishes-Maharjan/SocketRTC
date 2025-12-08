'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface IncomingCallModalProps {
  isOpen: boolean;
  callerName: string;
  roomId: string;
  callerId: string;
  onPickUp: () => void;
  onReject: () => void;
}

export default function IncomingCallModal({
  isOpen,
  callerName,
  roomId,
  callerId,
  onPickUp,
  onReject,
}: IncomingCallModalProps) {
  const router = useRouter();
  const [countdown, setCountdown] = useState(30);

  // Countdown timer
  useEffect(() => {
    if (!isOpen) {
      setCountdown(30);
      return;
    }

    if (countdown <= 0) {
      onReject(); // Auto-reject when timer expires
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [isOpen, countdown, onReject]);

  // Reset countdown when modal opens
  useEffect(() => {
    if (isOpen) {
      setCountdown(30);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePickUp = () => {
    onPickUp();
    router.push(`/call/${roomId}`);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="card bg-base-100 shadow-2xl w-full max-w-sm mx-4 animate-bounce-slow">
        <div className="card-body items-center text-center">
          {/* Caller Avatar */}
          <div className="relative mb-2">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-4xl text-white shadow-lg">
              {callerName.charAt(0).toUpperCase()}
            </div>
            {/* Pulsing ring animation */}
            <div className="absolute inset-0 rounded-full border-4 border-primary animate-ping opacity-30"></div>
          </div>

          {/* Caller Name */}
          <h2 className="card-title text-xl text-base-content">{callerName}</h2>
          <p className="text-base-content/60">Incoming video call...</p>

          {/* Countdown Timer */}
          <div className="my-4">
            <div className="radial-progress text-primary" style={{ '--value': (countdown / 30) * 100, '--size': '4rem' } as any}>
              <span className="text-lg font-bold">{countdown}s</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 w-full">
            <button
              onClick={onReject}
              className="btn btn-circle btn-error btn-lg flex-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <button
              onClick={handlePickUp}
              className="btn btn-circle btn-success btn-lg flex-1 animate-pulse"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </button>
          </div>

          {/* Labels */}
          <div className="flex gap-4 w-full text-sm">
            <span className="flex-1 text-error">Decline</span>
            <span className="flex-1 text-success">Accept</span>
          </div>
        </div>
      </div>
    </div>
  );
}
