'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
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
  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remotePeerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const remotePeerIdRef = useRef<string | null>(null);
  const hasSetLocalVideo = useRef<boolean>(false);

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

      // Get local media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
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

    if (remotePeerConnectionRef.current) {
      remotePeerConnectionRef.current.close();
      remotePeerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.emit('leave-video-room', { roomId });
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    // Reset local video ref
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
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
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center">🎥 WebRTC Video Call</h1>

        {/* Status */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6 text-center">
          <div className="text-lg font-semibold">{status}</div>
          {userId && <div className="text-sm text-gray-400 mt-1">User: {userName}</div>}
          {isConnected && (
            <div className="text-sm text-green-400 mt-1">● Connected to server</div>
          )}
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-4 mb-6">
          {!isInCall ? (
            <button
              onClick={startCall}
              className="bg-blue-600 hover:bg-blue-700 px-8 py-3 rounded-lg font-semibold transition"
            >
              Start Call
            </button>
          ) : (
            <>
              <button
                onClick={toggleMute}
                className={`px-6 py-3 rounded-lg font-semibold transition ${
                  isAudioMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                {isAudioMuted ? '🔇 Unmute' : '🎤 Mute'}
              </button>
              <button
                onClick={toggleVideo}
                className={`px-6 py-3 rounded-lg font-semibold transition ${
                  isVideoOff ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                {isVideoOff ? '📷 Show Video' : '📹 Hide Video'}
              </button>
              <button
                onClick={leaveRoom}
                className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-lg font-semibold transition"
              >
                Leave Room
              </button>
            </>
          )}
        </div>

        {/* Video Container */}
        {isInCall && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Local Video */}
            <div className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted={true}  // ALWAYS muted - this is YOUR video/audio
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }} // Mirror effect for local video
              />
              <div className="absolute bottom-4 left-4 bg-black bg-opacity-60 px-3 py-1 rounded">
                You (Local)
              </div>
              {/* Debug indicator */}
              {localStreamRef.current && (
                <div className="absolute top-4 left-4 bg-green-600 text-xs px-2 py-1 rounded">
                  ● Live
                </div>
              )}
            </div>

            {/* Remote Video */}
            <div className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video">
              {waitingForRemote ? (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <div className="text-4xl mb-2">⏳</div>
                    <div>Waiting for remote user...</div>
                  </div>
                </div>
              ) : (
                <>
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    muted={false}  // NOT muted - this is the OTHER person's video/audio
                    className="w-full h-full object-cover"
                    onLoadedMetadata={() => log('✓ Remote video metadata loaded', 'success')}
                    onPlay={() => log('✓ Remote video is playing', 'success')}
                    onError={(e) => log(`✗ Remote video error: ${e}`, 'error')}
                  />
                  <div className="absolute bottom-4 left-4 bg-black bg-opacity-60 px-3 py-1 rounded">
                    Remote User
                  </div>
                  <div className="absolute top-4 left-4 bg-green-600 text-xs px-2 py-1 rounded">
                    ● Live
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Debug Console */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-xl font-bold mb-3">Debug Console</h2>
          <div className="bg-black rounded p-3 h-64 overflow-y-auto font-mono text-sm space-y-1">
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
                    : 'text-gray-300'
                }`}
              >
                [{log.timestamp.toLocaleTimeString()}] {log.message}
              </div>
            ))}
            {logs.length === 0 && (
              <div className="text-gray-500">No logs yet. Click "Start Call" to begin.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}