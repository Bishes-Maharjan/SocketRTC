'use client';

import { useAuth } from '@/auth/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { io, Socket } from 'socket.io-client';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

type LogType = 'info' | 'success' | 'warning' | 'error';

interface LogEntry {
  timestamp: Date;
  message: string;
  type: LogType;
}

export default function VideoCallPage({ roomId }: { roomId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  
  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remotePeerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const remotePeerIdRef = useRef<string | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidate[]>([]);
  const chatSocketRef = useRef<Socket | null>(null);
  const isInitializingRef = useRef(false);

  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [status, setStatus] = useState('Initializing...');
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [waitingForRemote, setWaitingForRemote] = useState(true);

  // Logger function - limit logs to prevent memory issues
  const log = (message: string, type: LogType = 'info') => {
    console.log(`[${type.toUpperCase()}]`, message);
    setLogs((prev) => {
      const newLogs = [...prev, { timestamp: new Date(), message, type }];
      // Keep only last 100 logs
      return newLogs.slice(-100);
    });
  };
// Auto-start call on mount
  useEffect(() => {
    startCall();

    return () => {
      // Cleanup on unmount
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (remotePeerConnectionRef.current) {
        remotePeerConnectionRef.current.close();
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (chatSocketRef.current) {
        chatSocketRef.current.disconnect();
      }
    };
  }, []);

  // Initialize call
  const startCall = async () => {
    if (isInitializingRef.current) {
      log('Already initializing, skipping...', 'warning');
      return;
    }

    isInitializingRef.current = true;

    try {
      log('Requesting media devices...', 'info');

      // Get local media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      localStreamRef.current = stream;
      log(`✓ Got local stream with ${stream.getTracks().length} tracks`, 'success');

      // Set state to show video container
      setIsInCall(true);
      setStatus('Connecting to room...');

      // Initialize socket connection
      log('Connecting to signaling server...', 'info');
      const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001', {
        withCredentials: true,
        transports: ['websocket', 'polling'],
      });

      socketRef.current = socket;
      setupSocketListeners(socket);
      
    } catch (error: any) {
      log(`✗ Error accessing media devices: ${error?.message}`, 'error');
      toast.error('Could not access camera/microphone. Please check permissions.');
      setStatus('Failed to access media devices');
      setIsInCall(false);
      isInitializingRef.current = false;
    }
  };

  // Attach local stream to video element when it's ready
  useEffect(() => {
    if (localStreamRef.current && localVideoRef.current && isInCall) {
      log('Attaching local stream to video element...', 'info');
      localVideoRef.current.srcObject = localStreamRef.current;
      
      localVideoRef.current.onloadedmetadata = () => {
        log('✓ Local video metadata loaded', 'success');
      };

      localVideoRef.current.onplay = () => {
        log('✓ Local video playing', 'success');
      };

      localVideoRef.current.play().catch(e => {
        log(`✗ Local video play() failed: ${e.message}`, 'error');
      });
    }
  }, [isInCall]);

  // Setup socket event listeners
  const setupSocketListeners = (socket: Socket) => {
    socket.on('connect', () => {
      log(`✓ Connected to signaling server (socket.id: ${socket.id})`, 'success');
      setIsConnected(true);

      // Join room
      log(`Joining video room: ${roomId}`, 'info');
      socket.emit('join-video-room', roomId);
    });

    socket.on('disconnect', () => {
      log('✗ Disconnected from signaling server', 'error');
      setIsConnected(false);
      setStatus('Connection lost');
    });

    socket.on('connect_error', (error) => {
      log(`✗ Connection error: ${error.message}`, 'error');
    });

    socket.on('error', (error: any) => {
      log(`✗ Socket error: ${error.message || JSON.stringify(error)}`, 'error');
    });

    socket.on('chatting-partner', async ({ chatPartner, currentUserId, username }) => {
      setUserId(currentUserId);
      setUserName(username);

      log('✓ Joined room successfully', 'success');
      log(`Your userId: ${currentUserId}`, 'info');
      log(`Chat partner: ${chatPartner || 'None (waiting)'}`, 'info');

      setStatus(`Connected as ${username}`);

      // Store remote peer ID even if we don't initiate yet
      if (chatPartner && chatPartner !== currentUserId) {
        remotePeerIdRef.current = chatPartner;
        
        // Determine if we're the initiator
        const isInitiator = new URLSearchParams(window.location.search).get('initiator') === 'true';
        
        if (isInitiator) {
          log(`You are the CALLER - creating offer for ${chatPartner}`, 'info');
          // Small delay to ensure both peers are ready
          await new Promise(resolve => setTimeout(resolve, 500));
          await initiateCall(chatPartner);
        } else {
          log(`You are the RECEIVER - waiting for offer from ${chatPartner}`, 'info');
          setStatus('Waiting for caller to connect...');
        }
      } else {
        log('Waiting for another user to join...', 'warning');
        setStatus('Waiting for another user...');
        setWaitingForRemote(true);
      }
    });

    socket.on('user-joined', async ({ userId: joinedUserId, username: joinedUsername }) => {
      log(`User joined: ${joinedUsername} (${joinedUserId})`, 'info');
      
      // If we're the caller, RE-SEND the offer when receiver joins
      const isInitiator = new URLSearchParams(window.location.search).get('initiator') === 'true';
      
      if (isInitiator) {
        log(`Receiver joined - re-sending offer`, 'info');
        remotePeerIdRef.current = joinedUserId;
        
        // Close existing peer connection and start fresh
        if (remotePeerConnectionRef.current) {
          remotePeerConnectionRef.current.close();
          remotePeerConnectionRef.current = null;
        }
        pendingIceCandidatesRef.current = [];
        
        await new Promise(resolve => setTimeout(resolve, 300));
        await initiateCall(joinedUserId);
      }
    });

    socket.on('offer', async ({ from, offer }) => {
      log(` Received offer from: ${from}`, 'info');

      // Check if we already have a peer connection
      if (remotePeerConnectionRef.current) {
        const state = remotePeerConnectionRef.current.signalingState;
        if (state !== 'stable' && state !== 'closed') {
          log(` Already in signaling state: ${state}, ignoring offer`, 'warning');
          return;
        }
      }

      try {
        const peerConnection = await createPeerConnection(from);

        log('Setting remote description (offer)...', 'info');
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        log(' Remote description set', 'success');

        // Process any pending ICE candidates
        await processPendingIceCandidates();

        log('Creating answer...', 'info');
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        log(' Local description set (answer)', 'success');

        log('Sending answer...', 'info');
        socket.emit('answer', { roomId, answer });
      } catch (error: any) {
        log(` Error handling offer: ${error.message}`, 'error');
      }
    });

    socket.on('answer', async ({ from, answer }) => {
      log(` Received answer from: ${from}`, 'info');

      if (!remotePeerConnectionRef.current) {
        log(' No peer connection exists', 'error');
        return;
      }

      const state = remotePeerConnectionRef.current.signalingState;
      if (state !== 'have-local-offer') {
        log(`  Wrong state for answer: ${state}`, 'warning');
        return;
      }

      try {
        log(' Setting remote description (answer)...', 'info');
        await remotePeerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(answer)
        );
        log(' Remote description set', 'success');

        // Process any pending ICE candidates
        await processPendingIceCandidates();
      } catch (error: any) {
        log(` Error handling answer: ${error.message}`, 'error');
      }
    });

    socket.on('ice-candidate', async ({ sender, candidate }) => {
      log(` Received ICE candidate from: ${sender}`, 'info');

      if (!remotePeerConnectionRef.current) {
        log(' No peer connection yet, skipping candidate', 'warning');
        return;
      }

      // Queue candidate if remote description not set yet
      if (!remotePeerConnectionRef.current.remoteDescription) {
        log(' No remote description yet, queuing candidate', 'warning');
        pendingIceCandidatesRef.current.push(new RTCIceCandidate(candidate));
        return;
      }

      try {
        await remotePeerConnectionRef.current.addIceCandidate(
          new RTCIceCandidate(candidate)
        );
        log(' Added ICE candidate', 'success');
      } catch (error: any) {
        log(` Error adding ICE candidate: ${error.message}`, 'error');
      }
    });

    socket.on('user-disconnected', (disconnectedUserId) => {
      log(`User disconnected: ${disconnectedUserId}`, 'warning');

      if (disconnectedUserId === remotePeerIdRef.current) {
        handleRemoteDisconnect();
      }
    });
  };

  // Process pending ICE candidates after remote description is set
  const processPendingIceCandidates = async () => {
    if (pendingIceCandidatesRef.current.length === 0) return;

    log(`Processing ${pendingIceCandidatesRef.current.length} pending ICE candidates`, 'info');

    for (const candidate of pendingIceCandidatesRef.current) {
      try {
        await remotePeerConnectionRef.current?.addIceCandidate(candidate);
      } catch (error: any) {
        log(` Error adding queued ICE candidate: ${error.message}`, 'error');
      }
    }

    pendingIceCandidatesRef.current = [];
    log(' Processed all pending ICE candidates', 'success');
  };

  // Initiate call (caller only)
  const initiateCall = async (peerId: string) => {
    try {
      const peerConnection = await createPeerConnection(peerId);

      log('Creating offer...', 'info');
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      log('✓ Local description set (offer)', 'success');

      log('Sending offer...', 'info');
      socketRef.current?.emit('offer', { roomId, offer });
    } catch (error: any) {
      log(`✗ Error initiating call: ${error.message}`, 'error');
    }
  };

  // Create peer connection
  const createPeerConnection = async (peerId: string): Promise<RTCPeerConnection> => {
    log(`Creating peer connection with: ${peerId}`, 'info');

    // Close existing connection if any
    if (remotePeerConnectionRef.current) {
      remotePeerConnectionRef.current.close();
    }

    const peerConnection = new RTCPeerConnection(ICE_SERVERS);
    remotePeerConnectionRef.current = peerConnection;
    remotePeerIdRef.current = peerId;

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        log(`Adding local ${track.kind} track`, 'info');
        peerConnection.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        log('Sending ICE candidate', 'info');
        socketRef.current?.emit('ice-candidate', {
          roomId,
          candidate: event.candidate,
        });
      } else {
        log('✓ ICE gathering complete', 'success');
      }
    };

    // Handle incoming tracks
    peerConnection.ontrack = (event) => {
      log(`✓ Received remote ${event.track.kind} track`, 'success');

      if (event.streams && event.streams[0]) {
        log('✓ Setting remote stream', 'success');
        
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
          remoteVideoRef.current.muted = false;
          setWaitingForRemote(false);
          setStatus('Connected!');
        }
      }
    };

    // Monitor connection state
    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      log(`Connection state: ${state}`, 'info');
      
      if (state === 'connected') {
        log('✓ Peer connection established!', 'success');
        setStatus('Connected!');
      } else if (state === 'failed' || state === 'disconnected') {
        log(`✗ Connection ${state}`, 'error');
        handleRemoteDisconnect();
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      log(`ICE connection state: ${peerConnection.iceConnectionState}`, 'info');
    };

    peerConnection.onicegatheringstatechange = () => {
      log(`ICE gathering state: ${peerConnection.iceGatheringState}`, 'info');
    };

    peerConnection.onsignalingstatechange = () => {
      log(`Signaling state: ${peerConnection.signalingState}`, 'info');
    };

    return peerConnection;
  };

  // Handle remote peer disconnect
  const handleRemoteDisconnect = () => {
    if (remotePeerConnectionRef.current) {
      remotePeerConnectionRef.current.close();
      remotePeerConnectionRef.current = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    remotePeerIdRef.current = null;
    pendingIceCandidatesRef.current = [];
    setWaitingForRemote(true);
    setStatus('Remote peer disconnected');
  };

  // Toggle audio
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
        log(audioTrack.enabled ? '🎤 Audio unmuted' : '🔇 Audio muted', 'info');
      }
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
        log(videoTrack.enabled ? '📹 Video enabled' : '📷 Video disabled', 'info');
      }
    }
  };

  // Leave room
  const leaveRoom = () => {
    log('Leaving room...', 'info');

    // Stop all tracks first
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop();
        log(`Stopped ${track.kind} track`, 'info');
      });
      localStreamRef.current = null;
    }

    // Clear video elements
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
      localVideoRef.current.pause();
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
      remoteVideoRef.current.pause();
    }

    // Close peer connection
    if (remotePeerConnectionRef.current) {
      remotePeerConnectionRef.current.close();
      remotePeerConnectionRef.current = null;
    }

    // Disconnect sockets
    if (socketRef.current) {
      socketRef.current.emit('leave-video-room', { roomId });
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    if (chatSocketRef.current) {
      chatSocketRef.current.disconnect();
      chatSocketRef.current = null;
    }

    // Reset state
    isInitializingRef.current = false;
    pendingIceCandidatesRef.current = [];
    setIsInCall(false);
    setIsConnected(false);
    setStatus('Disconnected');
    setIsAudioMuted(false);
    setIsVideoOff(false);
    setWaitingForRemote(true);

    log('✓ Cleanup complete', 'success');
    
    // Navigate back
    router.push(`/chat?chatId=${roomId}`);
  };

  // Listen for call rejection
  useEffect(() => {
    if (!user?._id) return;

    const chatSocket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    chatSocketRef.current = chatSocket;

    chatSocket.on('rejectCall', (data: { to: string; from: string; roomId: string }) => {
      if (data.to === user._id && data.roomId === roomId) {
        log('❌ Call rejected by recipient', 'error');
        toast.error('Call was declined');
        leaveRoom();
      }
    });

    return () => {
      chatSocket.off('rejectCall');
      chatSocket.disconnect();
    };
  }, [user?._id, roomId]);

  
  // State for debug console visibility
  const [showDebug, setShowDebug] = useState(false);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col">
      {/* Main Video Area */}
      <div className="flex-1 relative overflow-hidden">
        {isInCall ? (
          <>
            {/* Remote Video - Full Screen */}
            <div className="absolute inset-0">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className={`w-full h-full object-cover transition-opacity duration-500 ${waitingForRemote ? 'opacity-0' : 'opacity-100'}`}
              />
              
              {/* Waiting Overlay */}
              {waitingForRemote && (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
                  <div className="text-center">
                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center mx-auto mb-6 animate-pulse">
                      <svg className="w-16 h-16 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div className="flex items-center justify-center gap-3 mb-4">
                      <span className="loading loading-dots loading-lg text-primary"></span>
                    </div>
                    <p className="text-white/70 text-lg font-medium">
                      {status.includes('Waiting') ? 'Waiting for participant...' : status}
                    </p>
                    <p className="text-white/40 text-sm mt-2">Make sure your partner has joined the call</p>
                  </div>
                </div>
              )}

              {/* Connected Badge */}
              {!waitingForRemote && (
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-full px-4 py-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  <span className="text-white text-sm font-medium">Connected</span>
                </div>
              )}
            </div>

            {/* Local Video - Picture in Picture */}
            <div className="absolute bottom-24 right-4 w-48 md:w-64 aspect-video rounded-xl overflow-hidden shadow-2xl border-2 border-white/10 bg-gray-900 hover:scale-105 transition-transform cursor-move z-10">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />
              {/* Muted indicator */}
              {isAudioMuted && (
                <div className="absolute bottom-2 right-2 bg-red-500 rounded-full p-1.5">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
              {/* Video off indicator */}
              {isVideoOff && (
                <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-white text-xl font-semibold">
                    {userName?.charAt(0).toUpperCase() || 'Y'}
                  </div>
                </div>
              )}
              <div className="absolute bottom-2 left-2 text-white text-xs bg-black/50 rounded px-2 py-0.5">
                You
              </div>
            </div>
          </>
        ) : (
          /* Loading State */
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <span className="loading loading-spinner loading-lg text-primary"></span>
              <p className="text-white/70 mt-4">{status}</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls Bar */}
      {isInCall && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-16 pb-6">
          <div className="flex items-center justify-center gap-4">
            {/* Mute Button */}
            <button
              onClick={toggleMute}
              className={`group relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 ${
                isAudioMuted 
                  ? 'bg-red-500 hover:bg-red-600' 
                  : 'bg-white/10 hover:bg-white/20 backdrop-blur-sm'
              }`}
              title={isAudioMuted ? 'Unmute' : 'Mute'}
            >
              {isAudioMuted ? (
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                </svg>
              )}
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-white/60 text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {isAudioMuted ? 'Unmute' : 'Mute'}
              </span>
            </button>

            {/* Video Toggle Button */}
            <button
              onClick={toggleVideo}
              className={`group relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 ${
                isVideoOff 
                  ? 'bg-red-500 hover:bg-red-600' 
                  : 'bg-white/10 hover:bg-white/20 backdrop-blur-sm'
              }`}
              title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
            >
              {isVideoOff ? (
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" />
                  <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                </svg>
              )}
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-white/60 text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {isVideoOff ? 'Start video' : 'Stop video'}
              </span>
            </button>

            {/* End Call Button */}
            <button
              onClick={leaveRoom}
              className="group relative w-16 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all duration-200"
              title="Leave call"
            >
              <svg className="w-7 h-7 text-white rotate-[135deg]" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-white/60 text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                Leave
              </span>
            </button>

            {/* Debug Toggle */}
            <button
              onClick={() => setShowDebug(!showDebug)}
              className={`group relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                showDebug ? 'bg-primary' : 'bg-white/10 hover:bg-white/20'
              } backdrop-blur-sm ml-4`}
              title="Toggle debug console"
            >
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </button>
          </div>

          {/* Room ID */}
          <div className="text-center mt-4">
            <span className="text-white/40 text-xs">Room: {roomId.slice(0, 8)}...</span>
          </div>
        </div>
      )}

      {/* Debug Console - Slide up panel */}
      {showDebug && (
        <div className="absolute bottom-32 left-4 right-4 max-w-2xl mx-auto bg-gray-900/95 backdrop-blur-sm rounded-xl border border-white/10 shadow-2xl overflow-hidden z-20">
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
            <h3 className="text-white/80 text-sm font-medium">Debug Console</h3>
            <button onClick={() => setShowDebug(false)} className="text-white/40 hover:text-white/80">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="h-48 overflow-y-auto p-3 font-mono text-xs space-y-0.5">
            {logs.map((log, index) => (
              <div
                key={index}
                className={`${
                  log.type === 'error'
                    ? 'text-red-400'
                    : log.type === 'success'
                    ? 'text-green-400'
                    : log.type === 'warning'
                    ? 'text-yellow-400'
                    : 'text-gray-400'
                }`}
              >
                <span className="text-gray-600">[{log.timestamp.toLocaleTimeString()}]</span> {log.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}