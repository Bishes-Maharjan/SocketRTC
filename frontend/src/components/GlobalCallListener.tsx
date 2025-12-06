"use client";
import { useAuth } from "@/auth/AuthProvider";
import { useChatStore } from "@/stores/useChatStore";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { CallToast } from "./CallToast";
import { useRouter } from "next/navigation";

interface IncomingCall {
  roomId: string;
  from: string;
  callerName: string;
}

export function GlobalCallListener() {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { getChat } = useChatStore();

  useEffect(() => {
    if (!user?._id) return;

    // Create global socket connection for call notifications
    const socket = io("http://localhost:3001", {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Global call listener connected");
    });

    // Listen for incoming calls
    const handleIncomingCall = (data: { roomId: string; from: string; to: string; callerName?: string }) => {
      // Don't show toast if already on call page
      if (window.location.pathname.startsWith("/call")) return;
      
      if (data.to === user._id) {
        // Try to get caller name from chat store
        const chat = getChat(data.roomId);
        const callerName = chat?.members?.fullName || data.callerName || "Unknown User";
        
        setIncomingCall({
          roomId: data.roomId,
          from: data.from,
          callerName,
        });

        // Auto-reject after 60 seconds
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          if (socketRef.current) {
            socketRef.current.emit("call-reject", { roomId: data.roomId });
          }
          setIncomingCall(null);
        }, 60000);
      }
    };

    socket.on("incoming-call", handleIncomingCall);

    // Listen for call cancellation
    socket.on("call-cancelled", (data: { roomId: string }) => {
      if (incomingCall?.roomId === data.roomId) {
        setIncomingCall(null);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      }
    });

    // Listen for call rejection (from another device)
    socket.on("call-rejected", (data: { roomId: string }) => {
      if (incomingCall?.roomId === data.roomId) {
        setIncomingCall(null);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      }
    });

    return () => {
      socket.off("incoming-call", handleIncomingCall);
      socket.off("call-cancelled");
      socket.off("call-rejected");
      socket.disconnect();
      socketRef.current = null;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [user?._id, getChat]);

  const handleAccept = () => {
    if (!socketRef.current || !incomingCall) return;
    
    socketRef.current.emit("call-accept", { roomId: incomingCall.roomId });
    setIncomingCall(null);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    router.push(`/call?roomId=${incomingCall.roomId}&caller=false`);
  };

  const handleReject = () => {
    if (!socketRef.current || !incomingCall) return;
    
    socketRef.current.emit("call-reject", { roomId: incomingCall.roomId });
    setIncomingCall(null);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  if (!incomingCall) return null;

  return (
    <CallToast
      type="incoming"
      roomId={incomingCall.roomId}
      userName={incomingCall.callerName}
      onAccept={handleAccept}
      onReject={handleReject}
    />
  );
}
