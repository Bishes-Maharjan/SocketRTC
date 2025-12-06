"use client";
import {
  LoaderIcon,
  MicIcon,
  MicOffIcon,
  PhoneOffIcon,
  VideoIcon,
  VideoOffIcon
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

type ConnectionState = "connecting" | "connected" | "disconnected" | "failed";

export default function CallPage() {
  const router = useRouter();
  const params = useSearchParams();
  const roomId = params.get("roomId") || "";

  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remotePeerIdRef = useRef<string | null>(null);
  const iceCandidateQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const hasCreatedOfferRef = useRef<boolean>(false);
  
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [remoteConnected, setRemoteConnected] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [statusMessage, setStatusMessage] = useState("Connecting...");

  // Call duration timer
  useEffect(() => {
    if (connectionState !== "connected" || !remoteConnected) return;

    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [connectionState, remoteConnected]);

  // Format call duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    if (!roomId) {
      router.push("/chat");
      return;
    }

    let socket: Socket;
    let pc: RTCPeerConnection;
    let localStream: MediaStream;

    const setupCall = async () => {
      try {
        // Get media first
        console.log("Requesting media devices...");
        localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localStreamRef.current = localStream;
        
        // Set video source and play with error handling
        if (localVideoRef.current) {
          try {
            localVideoRef.current.srcObject = localStream;
            // Use play() with catch instead of await to prevent blocking
            localVideoRef.current.play().catch((err) => {
              // Ignore abort errors - they happen when component unmounts
              if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
                console.error("Error playing local video:", err);
              }
            });
          } catch (err) {
            console.error("Error setting local video:", err);
          }
        }

        // Initialize socket
        socket = io("http://localhost:3001", {
          withCredentials: true,
          transports: ["websocket", "polling"],
        });
        socketRef.current = socket;

        // Create peer connection
        pc = new RTCPeerConnection({
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
          ],
        });
        pcRef.current = pc;

        // Add local tracks to peer connection
        localStream.getTracks().forEach((track) => {
          console.log(`Adding local ${track.kind} track`);
          pc.addTrack(track, localStream);
        });

        // Set up remote stream
        remoteStreamRef.current = new MediaStream();
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStreamRef.current;
        }

        // Monitor connection state
        pc.onconnectionstatechange = () => {
          console.log("Connection state:", pc.connectionState);
          setConnectionState(pc.connectionState as ConnectionState);
          
          if (pc.connectionState === "connected") {
            setRemoteConnected(true);
            setStatusMessage("Connected");
          } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
            setRemoteConnected(false);
            setStatusMessage("Connection lost");
          }
        };

        pc.oniceconnectionstatechange = () => {
          console.log("ICE connection state:", pc.iceConnectionState);
        };

        pc.ontrack = (event) => {
          console.log("Received remote track:", event.track.kind, event.track.id);
          console.log("Track event streams:", event.streams);
          
          // Use the stream from the event if available
          if (event.streams && event.streams.length > 0) {
            const remoteStream = event.streams[0];
            console.log("Remote stream received with tracks:", remoteStream.getTracks().map(t => ({ kind: t.kind, id: t.id, enabled: t.enabled })));
            
            // Stop old tracks if stream exists
            if (remoteStreamRef.current) {
              remoteStreamRef.current.getTracks().forEach(track => {
                track.stop();
                console.log(`Stopped old ${track.kind} track`);
              });
            }
            
            // Use the stream directly from the event
            remoteStreamRef.current = remoteStream;
            
            // Update video element
            if (remoteVideoRef.current) {
              try {
                remoteVideoRef.current.srcObject = remoteStream;
                remoteVideoRef.current.play().catch(err => {
                  if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
                    console.error("Error playing remote video:", err);
                  }
                });
                console.log("Remote video element updated");
              } catch (err) {
                console.error("Error setting remote video srcObject:", err);
              }
            }
            
            setRemoteConnected(true);
            setStatusMessage("Connected");
          } else if (event.track) {
            // Fallback: if no stream, create one and add the track
            console.log("No stream in event, creating new stream for track");
            if (!remoteStreamRef.current) {
              remoteStreamRef.current = new MediaStream();
            }
            remoteStreamRef.current.addTrack(event.track);
            
            if (remoteVideoRef.current) {
              try {
                remoteVideoRef.current.srcObject = remoteStreamRef.current;
                remoteVideoRef.current.play().catch(err => {
                  if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
                    console.error("Error playing remote video:", err);
                  }
                });
              } catch (err) {
                console.error("Error setting remote video srcObject:", err);
              }
            }
            
            setRemoteConnected(true);
            setStatusMessage("Connected");
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate && socket) {
            console.log("Sending ICE candidate to room");
            socket.emit("ice-candidate", { roomId, candidate: event.candidate });
          } else {
            console.log("ICE gathering complete");
          }
        };

        // Socket event handlers
        const handleConnect = () => {
          console.log("Socket connected, joining video room:", roomId);
          socket.emit("join-video-room", roomId);
        };

        const handleChattingPartner = async (data: {
          chatPartner: string | null;
          currentUserId: string;
          username: string;
        }) => {
          console.log("Chatting partner:", data);
          console.log("Current signaling state:", pc.signalingState);
          console.log("Has created offer:", hasCreatedOfferRef.current);
          setStatusMessage(`Connected as ${data.username}`);
          
          // If there's a chat partner and we haven't created an offer yet, initiate connection
          if (data.chatPartner) {
            remotePeerIdRef.current = data.chatPartner;
            
            // Only create offer if we haven't created one and we're in stable state
            if (!hasCreatedOfferRef.current && pc.signalingState === "stable") {
              console.log("Partner found, initiating connection");
              hasCreatedOfferRef.current = true;
              
              try {
                console.log("Creating offer...");
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                console.log("Sending offer");
                socket.emit("offer", { roomId, offer });
                setStatusMessage("Connecting...");
              } catch (error) {
                console.error("Error creating offer:", error);
                hasCreatedOfferRef.current = false;
              }
            } else {
              console.log("Waiting for offer from partner (already created offer or not in stable state)");
              setStatusMessage("Waiting for call...");
            }
          } else {
            setStatusMessage("Waiting for another user...");
          }
        };

        const handleUserJoined = (peerId: string) => {
          console.log("User joined:", peerId);
          setStatusMessage("Another user is connecting...");
          // The backend will re-send chatting-partner event, which will trigger offer creation
        };

        const handleOffer = async (data: { from: string; offer: RTCSessionDescriptionInit }) => {
          console.log("Received offer from:", data.from);
          console.log("Current signaling state:", pc.signalingState);
          console.log("Has created offer:", hasCreatedOfferRef.current);
          
          // If we already created an offer, we're the caller - ignore this offer
          if (hasCreatedOfferRef.current) {
            console.log("Already created offer (we're the caller), ignoring incoming offer");
            return;
          }
          
          // Mark that we received an offer so we don't try to create one
          hasCreatedOfferRef.current = true;
          remotePeerIdRef.current = data.from;
          
          // Only handle if in stable state
          if (pc.signalingState !== "stable") {
            console.log("Not in stable state, will retry. Current state:", pc.signalingState);
            // Wait a bit and check again (in case we're still setting up)
            setTimeout(async () => {
              if (pc.signalingState === "stable") {
                try {
                  console.log("Retrying offer handling...");
                  await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
                  const answer = await pc.createAnswer();
                  await pc.setLocalDescription(answer);
                  socket.emit("answer", { roomId, answer });
                  setStatusMessage("Connecting...");
                  await processQueuedIceCandidates(pc);
                } catch (error) {
                  console.error("Error handling offer on retry:", error);
                }
              }
            }, 100);
            return;
          }
          
          try {
            console.log("Setting remote description (offer)...");
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            console.log("Creating answer...");
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            console.log("Sending answer");
            socket.emit("answer", { roomId, answer });
            setStatusMessage("Connecting...");
            
            // Process queued ICE candidates
            await processQueuedIceCandidates(pc);
          } catch (error) {
            console.error("Error handling offer:", error);
            hasCreatedOfferRef.current = false; // Reset on error
          }
        };

        const handleAnswer = async (data: { from: string; answer: RTCSessionDescriptionInit }) => {
          console.log("Received answer from:", data.from);
          
          if (pc.signalingState === "have-local-offer") {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
              console.log("Answer set successfully");
              setStatusMessage("Connecting...");
              
              // Process queued ICE candidates
              await processQueuedIceCandidates(pc);
            } catch (error) {
              console.error("Error handling answer:", error);
            }
          } else {
            console.warn("Cannot set answer - wrong state:", pc.signalingState);
          }
        };

        // Helper function to process queued ICE candidates
        const processQueuedIceCandidates = async (peerConnection: RTCPeerConnection) => {
          if (iceCandidateQueueRef.current.length > 0) {
            console.log(`Processing ${iceCandidateQueueRef.current.length} queued ICE candidates`);
            const candidates = [...iceCandidateQueueRef.current];
            iceCandidateQueueRef.current = [];
            
            for (const candidate of candidates) {
              try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                console.log("Added queued ICE candidate");
              } catch (error) {
                console.error("Error adding queued ICE candidate:", error);
              }
            }
          }
        };

        const handleIceCandidate = async (data: {
          sender: string;
          candidate: RTCIceCandidateInit;
        }) => {
          // Only process ICE candidates from the remote peer, not from ourselves
          if (!remotePeerIdRef.current || data.sender !== remotePeerIdRef.current) {
            console.log("Ignoring ICE candidate - not from remote peer. Sender:", data.sender, "Remote peer:", remotePeerIdRef.current);
            return;
          }
          
          console.log("Received ICE candidate from remote peer:", data.sender);
          
          if (pc.remoteDescription) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
              console.log("ICE candidate added successfully");
            } catch (error) {
              console.error("Error adding ICE candidate:", error);
            }
          } else {
            // Queue candidate if remote description not set yet
            console.log("Queuing ICE candidate from remote peer");
            iceCandidateQueueRef.current.push(data.candidate);
          }
        };

        const handleUserDisconnected = (disconnectedUserId: string) => {
          console.log("User disconnected:", disconnectedUserId);
          if (disconnectedUserId === remotePeerIdRef.current) {
            setRemoteConnected(false);
            setStatusMessage("User disconnected");
            // Optionally end call or wait for reconnection
          }
        };

        socket.on("connect", handleConnect);
        socket.on("chatting-partner", handleChattingPartner);
        socket.on("user-joined", handleUserJoined);
        socket.on("offer", handleOffer);
        socket.on("answer", handleAnswer);
        socket.on("ice-candidate", handleIceCandidate);
        socket.on("user-disconnected", handleUserDisconnected);

        setConnectionState("connecting");
        setStatusMessage("Connecting...");
      } catch (error) {
        console.error("Error setting up call:", error);
        alert("Could not access camera/microphone. Please check permissions.");
        router.push(`/chat`);
      }
    };

    setupCall();

    return () => {
      // Cleanup
      console.log("Cleaning up call page...");
      
      // Stop all media tracks FIRST
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => {
          t.stop();
          console.log(`Stopped ${t.kind} track`);
        });
        localStreamRef.current = null;
      }
      
      if (remoteStreamRef.current) {
        remoteStreamRef.current.getTracks().forEach((t) => {
          t.stop();
        });
        remoteStreamRef.current = null;
      }
      
      // Clear video sources
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
      
      // Clear ICE candidate queue
      iceCandidateQueueRef.current = [];
      hasCreatedOfferRef.current = false;
      
      // Close peer connection
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
        console.log("Peer connection closed");
      }
      
      // Disconnect socket
      if (socketRef.current) {
        socketRef.current.off("connect");
        socketRef.current.off("chatting-partner");
        socketRef.current.off("user-joined");
        socketRef.current.off("offer");
        socketRef.current.off("answer");
        socketRef.current.off("ice-candidate");
        socketRef.current.off("user-disconnected");
        socketRef.current.emit("leave-video-room", { roomId });
        socketRef.current.disconnect();
        socketRef.current = null;
        console.log("Socket disconnected");
      }
    };
  }, [roomId, router]);

  const toggleMute = () => {
    if (!localStreamRef.current) return;
    
    const audioTracks = localStreamRef.current.getAudioTracks();
    audioTracks.forEach((track) => {
      track.enabled = !track.enabled;
    });
    setMuted(!muted);
  };

  const toggleVideo = () => {
    if (!localStreamRef.current) return;
    
    const videoTracks = localStreamRef.current.getVideoTracks();
    videoTracks.forEach((track) => {
      track.enabled = !track.enabled;
    });
    setVideoOff(!videoOff);
  };

  const endCall = () => {
    console.log("Ending call...");
    
    // Stop all media tracks FIRST
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop();
        console.log(`Stopped ${track.kind} track`);
      });
      localStreamRef.current = null;
    }
    
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      remoteStreamRef.current = null;
    }
    
    // Clear video sources
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    
    // Close peer connection
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    
    // Disconnect socket
    if (socketRef.current) {
      socketRef.current.emit("leave-video-room", { roomId });
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    // Navigate back
    router.push(`/chat?chatId=${roomId}`);
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-base-300 to-base-200">
      {/* Header with status */}
      <div className="bg-base-100 border-b border-base-300 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${
            connectionState === "connected" && remoteConnected 
              ? "bg-success animate-pulse" 
              : connectionState === "connecting"
              ? "bg-warning animate-pulse"
              : "bg-error"
          }`}></div>
          <span className="font-semibold text-base-content">
            {statusMessage}
          </span>
        </div>
        
        {connectionState === "connected" && remoteConnected && (
          <div className="text-base-content/60 font-mono">
            {formatDuration(callDuration)}
          </div>
        )}
      </div>

      {/* Video Grid */}
      <div className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Remote Video (larger) */}
        <div className="relative bg-black rounded-2xl overflow-hidden shadow-2xl order-2 lg:order-1">
          {!remoteConnected && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-base-300/50 backdrop-blur-sm z-10">
              <LoaderIcon className="size-12 text-primary animate-spin mb-4" />
              <p className="text-base-content/80 text-lg font-medium">
                Waiting for other user...
              </p>
            </div>
          )}
          <video 
            ref={remoteVideoRef} 
            autoPlay 
            playsInline
            muted={false}
            className="w-full h-full object-cover"
            onLoadedMetadata={() => {
              console.log("Remote video metadata loaded");
              remoteVideoRef.current?.play().catch(err => {
                console.error("Error auto-playing remote video:", err);
              });
            }}
          />
          <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg">
            <span className="text-white text-sm font-medium">Remote User</span>
          </div>
        </div>

        {/* Local Video (smaller) */}
        <div className="relative bg-black rounded-2xl overflow-hidden shadow-xl order-1 lg:order-2 lg:max-h-[400px]">
          {videoOff && (
            <div className="absolute inset-0 flex items-center justify-center bg-base-300 z-10">
              <div className="text-center">
                <VideoOffIcon className="size-16 text-base-content/40 mx-auto mb-2" />
                <p className="text-base-content/60">Camera Off</p>
              </div>
            </div>
          )}
          <video 
            ref={localVideoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg">
            <span className="text-white text-sm font-medium">You</span>
          </div>
          
          {/* Status indicators on local video */}
          <div className="absolute top-4 right-4 flex gap-2">
            {muted && (
              <div className="bg-error/90 backdrop-blur-sm p-2 rounded-full">
                <MicOffIcon className="size-5 text-error-content" />
              </div>
            )}
            {videoOff && (
              <div className="bg-error/90 backdrop-blur-sm p-2 rounded-full">
                <VideoOffIcon className="size-5 text-error-content" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-base-100 border-t border-base-300 px-6 py-6">
        <div className="max-w-md mx-auto flex items-center justify-center gap-4">
          {/* Mute Button */}
          <button
            onClick={toggleMute}
            className={`btn btn-circle btn-lg ${
              muted ? "btn-error" : "btn-ghost"
            } transition-all`}
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? (
              <MicOffIcon className="size-6" />
            ) : (
              <MicIcon className="size-6" />
            )}
          </button>

          {/* Video Toggle Button */}
          <button
            onClick={toggleVideo}
            className={`btn btn-circle btn-lg ${
              videoOff ? "btn-error" : "btn-ghost"
            } transition-all`}
            title={videoOff ? "Turn on camera" : "Turn off camera"}
          >
            {videoOff ? (
              <VideoOffIcon className="size-6" />
            ) : (
              <VideoIcon className="size-6" />
            )}
          </button>

          {/* End Call Button */}
          <button
            onClick={endCall}
            className="btn btn-circle btn-lg btn-error text-error-content hover:scale-110 transition-transform"
            title="End call"
          >
            <PhoneOffIcon className="size-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
