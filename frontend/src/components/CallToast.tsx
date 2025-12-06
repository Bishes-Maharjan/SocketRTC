"use client";
import { PhoneCallIcon, PhoneOffIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface CallToastProps {
  type: "calling" | "incoming";
  roomId: string;
  userName?: string;
  onCancel?: () => void;
  onAccept?: () => void;
  onReject?: () => void;
}

export function CallToast({
  type,
  roomId,
  userName,
  onCancel,
  onAccept,
  onReject,
}: CallToastProps) {
  const [timeLeft, setTimeLeft] = useState(60);
  const router = useRouter();

  useEffect(() => {
    if (type === "incoming") {
      const interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            onReject?.();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [type, onReject]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (type === "calling") {
    return (
      <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-5">
        <div className="bg-base-100 border-2 border-primary shadow-2xl rounded-2xl p-6 min-w-[320px] max-w-md">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-primary-content font-bold text-xl">
                {userName?.charAt(0).toUpperCase() || "?"}
              </div>
              <div className="absolute inset-0 rounded-full bg-primary animate-ping opacity-20"></div>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg text-base-content">
                Calling {userName || "..."}
              </h3>
              <p className="text-sm text-base-content/60">Waiting for answer...</p>
            </div>
          </div>

          <div className="flex gap-1 justify-center mb-4">
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>

          <button
            onClick={onCancel}
            className="w-full btn btn-error text-error-content gap-2"
          >
            <PhoneOffIcon className="size-5" />
            Cancel Call
          </button>
        </div>
      </div>
    );
  }

  // Incoming call
  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-5">
      <div className="bg-base-100 border-2 border-primary shadow-2xl rounded-2xl p-6 min-w-[320px] max-w-md">
        <div className="flex items-center gap-4 mb-4">
          <div className="relative">
            <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-primary-content font-bold text-xl">
              {userName?.charAt(0).toUpperCase() || "?"}
            </div>
            <div className="absolute inset-0 rounded-full bg-primary animate-ping opacity-20"></div>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg text-base-content">
              {userName || "Unknown User"}
            </h3>
            <p className="text-sm text-base-content/60">Incoming video call...</p>
          </div>
        </div>

        <div className="mb-4 text-center">
          <div className="text-2xl font-mono font-bold text-base-content">
            {formatTime(timeLeft)}
          </div>
          <div className="text-xs text-base-content/60 mt-1">
            Call will auto-cancel
          </div>
        </div>

        <div className="w-full bg-base-300 rounded-full h-1.5 mb-4 overflow-hidden">
          <div
            className="bg-primary h-full transition-all duration-1000 ease-linear"
            style={{ width: `${(timeLeft / 60) * 100}%` }}
          ></div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onReject}
            className="flex-1 btn btn-error text-error-content gap-2"
          >
            <PhoneOffIcon className="size-5" />
            Decline
          </button>
          <button
            onClick={onAccept}
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
