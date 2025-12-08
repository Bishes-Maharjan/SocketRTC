'use client';

import { useEffect, useState } from 'react';

interface CallingModalProps {
  isOpen: boolean;
  recipientName?: string;
  countdown: number;
  onCancel: () => void;
}

export default function CallingModal({
  isOpen,
  recipientName = 'User',
  countdown,
  onCancel,
}: CallingModalProps) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulse((prev) => !prev);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-sm text-center">
        {/* Animated Calling Icon */}
        <div className="flex justify-center mb-6">
          <div className={`transition-transform duration-500 ${pulse ? 'scale-110' : 'scale-100'}`}>
            <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-12 w-12 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Recipient Name */}
        <h3 className="text-2xl font-bold text-base-content mb-2">
          Calling {recipientName}...
        </h3>

        {/* Countdown Timer */}
        <div className="mb-6">
          <div className="text-5xl font-bold text-primary mb-2">
            {countdown}
          </div>
          <div className="text-sm text-base-content/60">
            seconds remaining
          </div>
        </div>

        {/* Loading Spinner */}
        <div className="flex justify-center mb-6">
          <span className="loading loading-dots loading-lg text-primary"></span>
        </div>

        {/* Cancel Button */}
        <button
          onClick={onCancel}
          className="btn btn-error btn-block gap-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          Cancel Call
        </button>
      </div>
      <div className="modal-backdrop bg-black/50"></div>
    </div>
  );
}
