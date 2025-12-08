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
  const hasSetLocalVideo = useRef<boolean>(false);
  const chatSocketRef = useRef<Socket | null>(null);

  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [status, setStatus] = useState('Not connected');
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [waitingForRemote, setWaitingForRemote] = useState(false);

  // Logger function
  const log = (message: string, type: LogType = 'info') => {
    console.log(`[${type.toUpperCase()}]`, message);
    setLogs((prev) => [...prev, { timestamp: new Date(), message, type }]);
  };

  // Initialize call
  const startCall = async () => {
    try {
      log('Requesting media devices...', 'info');

      // Get local media stream with echo cancellation
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

      log(
        `✓ Got local stream with ${stream.getTracks().length} tracks`,
        'success'
      );
      stream.getTracks().forEach((track) => {
        log(`  - ${track.kind} track: ${track.label}`, 'info');
      });

      // IMMEDIATELY show the video container and set state
      setIsInCall(true);
      
      // Wait for next tick to ensure video element is rendered
      await new Promise(resolve => setTimeout(resolve, 100));

      // Now attach the stream
      if (localVideoRef.current && !hasSetLocalVideo.current) {
        log('Attaching local stream to video element...', 'info');
        localVideoRef.current.srcObject = stream;
        hasSetLocalVideo.current = true;
        
        // Add event listeners
        localVideoRef.current.onloadedmetadata = () => {
          log('✓ Local video metadata loaded', 'success');
        };

        localVideoRef.current.onplay = () => {
          log('✓ Local video is playing', 'success');
        };

        localVideoRef.current.onerror = (e) => {
          log(`✗ Local video error: ${e}`, 'error');
        };

        // Explicitly play
        try {
          await localVideoRef.current.play();
          log('✓ Local video play() succeeded', 'success');
        } catch (e) {
          log(`✗ Local video play() failed: ${e}`, 'error');
        }
      } else if (!localVideoRef.current) {
        log('✗ Local video ref is null!', 'error');
      }

      // Initialize socket AFTER setting up video
      log('Connecting to signaling server...', 'info');
      const socket = io('http://localhost:3001', {
        withCredentials: true,
        transports: ['websocket', 'polling'],
      });

      socketRef.current = socket;
      setupSocketListeners(socket);
      
    } catch (error) {
      log(`✗ Error accessing media devices: ${error}`, 'error');
      alert('Could not access camera/microphone. Please check permissions.');
    }
  };

  // Setup socket event listeners
  const setupSocketListeners = (socket: Socket) => {
    socket.on('connect', () => {
      log(`✓ Connected to signaling server (socket.id: ${socket.id})`, 'success');
      setIsConnected(true);

      // Join room
      log(`Joining room: ${roomId}`, 'info');
      socket.emit('join-video-room', roomId);
    });

    socket.on('disconnect', () => {
      log('✗ Disconnected from signaling server', 'error');
      setIsConnected(false);
      setStatus('Connection lost. Please rejoin.');
    });

    socket.on('connect_error', (error) => {
      log(`✗ Connection error: ${error.message}`, 'error');
    });

    socket.on('error', (error) => {
      log(`✗ Socket error: ${JSON.stringify(error)}`, 'error');
    });

    socket.on('chatting-partner', async ({ chatPartner, currentUserId, username }) => {
      setUserId(currentUserId);
      setUserName(username);

      log('✓ Joined room successfully', 'success');
      log(`Your userId: ${currentUserId}`, 'info');
      log(`Your username: ${username}`, 'info');
      log(`Chat partner: ${chatPartner || 'None (waiting)'}`, 'info');

      setStatus(`Connected to room as ${username}`);

      if (chatPartner) {
        log(`Initiating peer connection with: ${chatPartner}`, 'info');
        const peerConnection = await createPeerConnection(chatPartner);

        // Create and send offer
        log('Creating offer...', 'info');
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        log('✓ Local description set (offer)', 'success');

        log(`Sending offer to room: ${roomId}`, 'info');
        socket.emit('offer', { roomId, offer });
      } else {
        log('Waiting for another user to join...', 'warning');
        setStatus('Waiting for another user...');
        setWaitingForRemote(true);
      }
    });

    socket.on('offer', async ({ from, offer }) => {
      log(`Received offer from: ${from}`, 'info');

      const peerConnection = await createPeerConnection(from);

      log('Setting remote description (offer)...', 'info');
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      log('✓ Remote description set (offer)', 'success');

      log('Creating answer...', 'info');
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      log('✓ Local description set (answer)', 'success');

      log(`Sending answer to room: ${roomId}`, 'info');
      socket.emit('answer', { roomId, answer });
    });

    socket.on('answer', async ({ from, answer }) => {
      log(`Received answer from: ${from}`, 'info');

      if (remotePeerConnectionRef.current) {
        log('Setting remote description (answer)...', 'info');
        await remotePeerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(answer)
        );
        log('✓ Remote description set (answer)', 'success');
      } else {
        log('✗ No peer connection exists to set answer', 'error');
      }
    });

    socket.on('ice-candidate', async ({ sender, candidate }) => {
      log(`Received ICE candidate from: ${sender}`, 'info');

      if (remotePeerConnectionRef.current) {
        try {
          await remotePeerConnectionRef.current.addIceCandidate(
            new RTCIceCandidate(candidate)
          );
          log('✓ Added ICE candidate', 'success');
        } catch (error) {
          log(`✗ Error adding ICE candidate: ${error}`, 'error');
        }
      } else {
        log('✗ No peer connection exists for ICE candidate', 'warning');
      }
    });

    socket.on('user-disconnected', (disconnectedUserId) => {
      log(`User disconnected: ${disconnectedUserId}`, 'warning');

      if (disconnectedUserId === remotePeerIdRef.current) {
        if (remotePeerConnectionRef.current) {
          remotePeerConnectionRef.current.close();
          remotePeerConnectionRef.current = null;
        }

        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }

        remotePeerIdRef.current = null;
        setWaitingForRemote(true);
        setStatus(`Waiting for another user in room: ${roomId}`);
      }
    });
  };

  // Create peer connection
  const createPeerConnection = async (peerId: string): Promise<RTCPeerConnection> => {
    log(`Creating peer connection with: ${peerId}`, 'info');

    const peerConnection = new RTCPeerConnection(ICE_SERVERS);
    remotePeerConnectionRef.current = peerConnection;
    remotePeerIdRef.current = peerId;

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        log(`Adding local ${track.kind} track to peer connection`, 'info');
        peerConnection.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        log(`Sending ICE candidate to room: ${roomId}`, 'info');
        socketRef.current?.emit('ice-candidate', {
          roomId,
          candidate: event.candidate,
        });
      } else {
        log('ICE gathering complete', 'success');
      }
    };

    // Handle incoming tracks
    peerConnection.ontrack = (event) => {
      log(`✓ Received remote ${event.track.kind} track`, 'success');

      if (event.streams && event.streams[0]) {
        log(
          `✓ Remote stream received with ${event.streams[0].getTracks().length} tracks`,
          'success'
        );
        
        if (remoteVideoRef.current) {
          // Set the remote stream
          remoteVideoRef.current.srcObject = event.streams[0];
          
          // IMPORTANT: Remote video should NOT be muted (we want to hear them)
          // But make sure it's not playing local echo
          remoteVideoRef.current.muted = false;
          
          setWaitingForRemote(false);
        }
        
        setStatus('Connected with remote peer');
      } else {
        log('✗ No streams in track event', 'error');
      }
    };

    // Monitor connection state
    peerConnection.onconnectionstatechange = () => {
      log(`Connection state: ${peerConnection.connectionState}`, 'info');
      
      if (peerConnection.connectionState === 'connected') {
        log('✓ Peer connection established!', 'success');
        setStatus(`Connected in room: ${roomId}`);
      } else if (
        peerConnection.connectionState === 'failed' ||
        peerConnection.connectionState === 'disconnected'
      ) {
        log(`✗ Connection ${peerConnection.connectionState}`, 'error');
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }
        setWaitingForRemote(true);
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

  // Toggle audio
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
        log(audioTrack.enabled ? 'Audio unmuted' : 'Audio muted', 'info');
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
        log(videoTrack.enabled ? 'Video enabled' : 'Video disabled', 'info');
      }
    }
  };

  // Leave room
  const leaveRoom = () => {
    log('Leaving room...', 'info');

    // IMPORTANT: Clear video srcObject BEFORE stopping tracks (Chrome fix)
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
      localVideoRef.current.pause();
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
      remoteVideoRef.current.pause();
    }

    // Now stop the tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop();
        log(`Stopped ${track.kind} track`, 'info');
      });
      localStreamRef.current = null;
    }

    if (remotePeerConnectionRef.current) {
      remotePeerConnectionRef.current.close();
      remotePeerConnectionRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.emit('leave-video-room', { roomId });
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    hasSetLocalVideo.current = false;
    setIsInCall(false);
    setIsConnected(false);
    setStatus('Disconnected');
    setIsAudioMuted(false);
    setIsVideoOff(false);
    setWaitingForRemote(false);

    log('✓ Left room and cleaned up', 'success');
  };

  // Effect to handle local video when component mounts/updates
  useEffect(() => {
    if (localStreamRef.current && localVideoRef.current && isInCall && !hasSetLocalVideo.current) {
      log('useEffect: Attaching local stream to video element...', 'info');
      localVideoRef.current.srcObject = localStreamRef.current;
      hasSetLocalVideo.current = true;

      localVideoRef.current.onloadedmetadata = () => {
        log('✓ Local video metadata loaded (from useEffect)', 'success');
      };

      localVideoRef.current.onplay = () => {
        log('✓ Local video is playing (from useEffect)', 'success');
      };

      localVideoRef.current.play().catch(e => {
        log(`✗ Local video play() failed (from useEffect): ${e}`, 'error');
      });
    }
  }, [isInCall, localStreamRef.current]);

  // Listen for rejectCall events (caller receives rejection)
  useEffect(() => {
    if (!user?._id) return;

    // Connect to chat gateway to listen for rejectCall
    const chatSocket = io('http://localhost:3001', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    chatSocketRef.current = chatSocket;

    chatSocket.on('connect', () => {
      console.log('Chat socket connected for rejectCall listening');
    });

    chatSocket.on('rejectCall', (data: { to: string; from: string; roomId: string }) => {
      // Check if the rejection is for us (we are the caller)
      if (data.to === user._id && data.roomId === roomId) {
        log('Call rejected by recipient', 'error');
        toast.error('Call denied', {
          position: 'top-center',
        });
        
        // Leave the room automatically
        leaveRoom();
        
        // Navigate back to chat after a short delay
        setTimeout(() => {
          router.push(`/chat?chatId=${roomId}`);
        }, 1000);
      }
    });

    return () => {
      chatSocket.off('rejectCall');
      chatSocket.disconnect();
      chatSocketRef.current = null;
    };
  }, [user?._id, roomId, router]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
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
            {userId && <div className="text-sm text-base-content/60 mt-1">User: {userName}</div>}
            {isConnected && (
              <div className="badge badge-success gap-2 mt-2">
                <span className="w-2 h-2 bg-success-content rounded-full animate-pulse"></span>
                Connected
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap justify-center gap-3 mb-6">
          {!isInCall ? (
            <button
              onClick={startCall}
              className="btn btn-primary btn-lg gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Start Call
            </button>
          ) : (
            <>
              <button
                onClick={toggleMute}
                className={`btn gap-2 ${
                  isAudioMuted ? 'btn-error' : 'btn-ghost'
                }`}
              >
                {isAudioMuted ? '🔇' : '🎤'}
                {isAudioMuted ? 'Unmute' : 'Mute'}
              </button>
              <button
                onClick={toggleVideo}
                className={`btn gap-2 ${
                  isVideoOff ? 'btn-error' : 'btn-ghost'
                }`}
              >
                {isVideoOff ? '📷' : '📹'}
                {isVideoOff ? 'Show' : 'Hide'}
              </button>
              <button
                onClick={leaveRoom}
                className="btn btn-error gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                </svg>
                Leave
              </button>
            </>
          )}
        </div>

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
                  muted={true}
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
                {waitingForRemote ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <span className="loading loading-spinner loading-lg text-primary"></span>
                      <div className="mt-4 text-base-content/70">Waiting for remote user...</div>
                    </div>
                  </div>
                ) : (
                  <>
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      muted={false}
                      className="w-full h-full object-cover"
                      onLoadedMetadata={() => log('✓ Remote video metadata loaded', 'success')}
                      onPlay={() => log('✓ Remote video is playing', 'success')}
                      onError={(e) => log(`✗ Remote video error: ${e}`, 'error')}
                    />
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
              {logs.length === 0 && (
                <div className="text-base-content/50">No logs yet. Click "Start Call" to begin.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}