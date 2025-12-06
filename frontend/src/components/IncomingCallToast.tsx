"use client";
import { PhoneCallIcon, PhoneOffIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface IncomingCallToastProps {
  callerName: string;
  roomId: string;
  onAccept: () => void;
  onReject: () => void;
  onTimeout: () => void;
}

export function IncomingCallToast({
  callerName,
  roomId,
  onAccept,
  onReject,
  onTimeout,
}: IncomingCallToastProps) {
  const [timeLeft, setTimeLeft] = useState(60); // 60 seconds = 1 minute
  const router = useRouter();

  useEffect(() => {
    // Countdown timer
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [onTimeout]);

  const handleAccept = () => {
    onAccept();
    router.push(`/call?roomId=${roomId}&caller=false`);
  };

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-5">
      <div className="bg-base-100 border-2 border-primary shadow-2xl rounded-2xl p-6 min-w-[320px] max-w-md">
        {/* Caller Info */}
        <div className="flex items-center gap-4 mb-4">
          <div className="relative">
            <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-primary-content font-bold text-xl">
              {callerName.charAt(0).toUpperCase()}
            </div>
            {/* Pulsing ring animation */}
            <div className="absolute inset-0 rounded-full bg-primary animate-ping opacity-20"></div>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg text-base-content">
              {callerName}
            </h3>
            <p className="text-sm text-base-content/60">Incoming video call...</p>
          </div>
        </div>

        {/* Timer */}
        <div className="mb-4 text-center">
          <div className="text-2xl font-mono font-bold text-base-content">
            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
          </div>
          <div className="text-xs text-base-content/60 mt-1">
            Call will auto-cancel
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-base-300 rounded-full h-1.5 mb-4 overflow-hidden">
          <div
            className="bg-primary h-full transition-all duration-1000 ease-linear"
            style={{ width: `${(timeLeft / 60) * 100}%` }}
          ></div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onReject}
            className="flex-1 btn btn-error text-error-content gap-2"
          >
            <PhoneOffIcon className="size-5" />
            Decline
          </button>
          <button
            onClick={handleAccept}
            className="flex-1 btn btn-success text-success-content gap-2 animate-pulse"
          >
            <PhoneCallIcon className="size-5" />
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
