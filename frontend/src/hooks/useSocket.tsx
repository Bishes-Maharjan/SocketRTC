"use client";

import { useAuthUser } from "@/hooks/useAuthUser";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  joinRoom: () => {},
  leaveRoom: () => {},
});

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within SocketProvider");
  }
  return context;
};

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthUser();
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const currentRoomsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    console.log("SocketProvider useEffect running, user._id:", user?._id, "isLoading:", isLoading);
    
    // Don't do anything while auth is loading
    if (isLoading) return;

    if (!user?._id) {
      console.log("No user and not loading, cleaning up socket");
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
        currentRoomsRef.current.clear();
      }
      return;
    }

    // Initialize socket connection only once
    if (!socketRef.current) {
      console.log("Creating new socket connection...");
      const newSocket = io(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001", {
        withCredentials: true,
        transports: ["websocket", "polling"],
      });

      newSocket.on("connect", () => {
        console.log("ChatGateway socket connected:", newSocket.id);
        console.log("User auto-joined to personal room: user:" + user._id);
        console.log("Setting isConnected to TRUE and socket state");
        setIsConnected(true);
        setSocket(newSocket); // ALSO set socket here on connect
        
        // Rejoin chat rooms after reconnection
        currentRoomsRef.current.forEach((roomId) => {
          console.log("Rejoining room:", roomId);
          newSocket.emit("join-room", { roomId });
        });
      });

      newSocket.on("disconnect", () => {
        console.log("ChatGateway socket disconnected");
        setIsConnected(false);
      });

      newSocket.on("connect_error", (error) => {
        console.error("Socket connection error:", error);
        setIsConnected(false);
      });

      socketRef.current = newSocket;
      setSocket(newSocket); // Set immediately (will be null until connected)
      console.log("Socket stored in ref and state");
    } else {
      console.log("Socket already exists, skipping creation");
    }

    return () => {
      console.log("Effect cleanup called (not disconnecting)");
    };
  }, [user?._id]);

  const joinRoom = useCallback((roomId: string) => {
    console.log("joinRoom called:", roomId, "isConnected:", isConnected);
    if (socketRef.current && isConnected) {
      socketRef.current.emit("join-room", { roomId });
      currentRoomsRef.current.add(roomId);
      console.log("Joined room:", roomId);
    } else {
      console.log("Cannot join room - socket not ready");
    }
  }, [isConnected]);

  const leaveRoom = useCallback((roomId: string) => {
    console.log("leaveRoom called:", roomId);
    if (socketRef.current && isConnected) {
      socketRef.current.emit("leave-room", { roomId });
      currentRoomsRef.current.delete(roomId);
      console.log("Left room:", roomId);
    }
  }, [isConnected]);

  const contextValue = useMemo(() => ({
    socket,
    isConnected,
    joinRoom,
    leaveRoom,
  }), [socket, isConnected, joinRoom, leaveRoom]);

  console.log("SocketProvider rendering with:", contextValue);

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
}