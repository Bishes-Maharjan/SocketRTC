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
      log(`✗ Error accessing media devices: ${error.message}`, 'error');
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
      log(`👤 User joined: ${joinedUsername} (${joinedUserId})`, 'info');
      
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
      log(`📞 Received offer from: ${from}`, 'info');

      // Check if we already have a peer connection
      if (remotePeerConnectionRef.current) {
        const state = remotePeerConnectionRef.current.signalingState;
        if (state !== 'stable' && state !== 'closed') {
          log(`⚠ Already in signaling state: ${state}, ignoring offer`, 'warning');
          return;
        }
      }

      try {
        const peerConnection = await createPeerConnection(from);

        log('Setting remote description (offer)...', 'info');
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        log('✓ Remote description set', 'success');

        // Process any pending ICE candidates
        await processPendingIceCandidates();

        log('Creating answer...', 'info');
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        log('✓ Local description set (answer)', 'success');

        log('Sending answer...', 'info');
        socket.emit('answer', { roomId, answer });
      } catch (error: any) {
        log(`✗ Error handling offer: ${error.message}`, 'error');
      }
    });

    socket.on('answer', async ({ from, answer }) => {
      log(`📞 Received answer from: ${from}`, 'info');

      if (!remotePeerConnectionRef.current) {
        log('✗ No peer connection exists', 'error');
        return;
      }

      const state = remotePeerConnectionRef.current.signalingState;
      if (state !== 'have-local-offer') {
        log(`⚠ Wrong state for answer: ${state}`, 'warning');
        return;
      }

      try {
        log('Setting remote description (answer)...', 'info');
        await remotePeerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(answer)
        );
        log('✓ Remote description set', 'success');

        // Process any pending ICE candidates
        await processPendingIceCandidates();
      } catch (error: any) {
        log(`✗ Error handling answer: ${error.message}`, 'error');
      }
    });

    socket.on('ice-candidate', async ({ sender, candidate }) => {
      log(`🧊 Received ICE candidate from: ${sender}`, 'info');

      if (!remotePeerConnectionRef.current) {
        log('⚠ No peer connection yet, skipping candidate', 'warning');
        return;
      }

      // Queue candidate if remote description not set yet
      if (!remotePeerConnectionRef.current.remoteDescription) {
        log('⚠ No remote description yet, queuing candidate', 'warning');
        pendingIceCandidatesRef.current.push(new RTCIceCandidate(candidate));
        return;
      }

      try {
        await remotePeerConnectionRef.current.addIceCandidate(
          new RTCIceCandidate(candidate)
        );
        log('✓ Added ICE candidate', 'success');
      } catch (error: any) {
        log(`✗ Error adding ICE candidate: ${error.message}`, 'error');
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
        log(`✗ Error adding queued ICE candidate: ${error.message}`, 'error');
      }
    }

    pendingIceCandidatesRef.current = [];
    log('✓ Processed all pending ICE candidates', 'success');
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

  return (
    <div className="min-h-screen bg-base-200 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center text-base-content">🎥 Video Call</h1>

        {/* Status Card */}
        <div className="card bg-base-100 shadow-xl mb-6">
          <div className="card-body p-4 text-center">
            <div className="text-lg font-semibold text-base-content">{status}</div>
            {userName && <div className="text-sm text-base-content/60 mt-1">User: {userName}</div>}
            {isConnected && (
              <div className="badge badge-success gap-2 mt-2">
                <span className="w-2 h-2 bg-success-content rounded-full animate-pulse"></span>
                Connected
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        {isInCall && (
          <div className="flex flex-wrap justify-center gap-3 mb-6">
            <button
              onClick={toggleMute}
              className={`btn gap-2 ${isAudioMuted ? 'btn-error' : 'btn-ghost'}`}
            >
              {isAudioMuted ? '🔇' : '🎤'}
              {isAudioMuted ? 'Unmute' : 'Mute'}
            </button>
            <button
              onClick={toggleVideo}
              className={`btn gap-2 ${isVideoOff ? 'btn-error' : 'btn-ghost'}`}
            >
              {isVideoOff ? '📷' : '📹'}
              {isVideoOff ? 'Show' : 'Hide'}
            </button>
            <button onClick={leaveRoom} className="btn btn-error gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
              </svg>
              Leave
            </button>
          </div>
        )}

        {/* Video Container */}
        {isInCall && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* Local Video */}
            <div className="card bg-base-300 shadow-xl overflow-hidden">
              <div className="relative aspect-video bg-base-300">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
                <div className="absolute bottom-3 left-3 badge badge-neutral badge-lg">
                  You (Local)
                </div>
                {localStreamRef.current && (
                  <div className="absolute top-3 left-3 badge badge-success gap-1">
                    <span className="w-2 h-2 bg-success-content rounded-full animate-pulse"></span>
                    Live
                  </div>
                )}
              </div>
            </div>

            {/* Remote Video */}
            <div className="card bg-base-300 shadow-xl overflow-hidden">
              <div className="relative aspect-video bg-base-300">
                {/* Always render the video element so the ref is valid */}
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className={`w-full h-full object-cover ${waitingForRemote ? 'opacity-0' : 'opacity-100'}`}
                />
                
                {/* Overlay for waiting state */}
                {waitingForRemote && (
                  <div className="absolute inset-0 flex items-center justify-center bg-base-300">
                    <div className="text-center">
                      <span className="loading loading-spinner loading-lg text-primary"></span>
                      <div className="mt-4 text-base-content/70 font-semibold">
                        {status.includes('Waiting') ? status : 'Connecting...'}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Badges - only show when connected */}
                {!waitingForRemote && (
                  <>
                    <div className="absolute bottom-3 left-3 badge badge-neutral badge-lg">
                      Remote User
                    </div>
                    <div className="absolute top-3 left-3 badge badge-success gap-1">
                      <span className="w-2 h-2 bg-success-content rounded-full animate-pulse"></span>
                      Live
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Debug Console */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body p-4">
            <h2 className="card-title text-base-content">Debug Console</h2>
            <div className="bg-base-300 rounded-lg p-3 h-64 overflow-y-auto font-mono text-xs space-y-1">
              {logs.map((log, index) => (
                <div
                  key={index}
                  className={`${
                    log.type === 'error'
                      ? 'text-error'
                      : log.type === 'success'
                      ? 'text-success'
                      : log.type === 'warning'
                      ? 'text-warning'
                      : 'text-base-content/70'
                  }`}
                >
                  [{log.timestamp.toLocaleTimeString()}] {log.message}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}