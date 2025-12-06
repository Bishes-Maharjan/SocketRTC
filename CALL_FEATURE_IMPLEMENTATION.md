# Video Call Feature Implementation

## Overview
Implemented a comprehensive WebRTC video call system with the following features:
- One-on-one video calls between chat users
- Global incoming call notifications (toast)
- Auto-cancel after 60 seconds if not answered
- Call status indicators
- Audio/video mute controls
- Proper UI transitions

## Components Created/Modified

### Frontend Components

#### 1. **IncomingCallToast.tsx** (NEW)
- Toast notification for incoming calls
- Displays caller name and avatar
- 60-second countdown timer with progress bar
- Accept/Decline buttons
- Auto-cancels on timeout
- Pulsing animation for visual attention

#### 2. **GlobalCallListener.tsx** (NEW)
- Global socket listener for incoming calls
- Works across all pages (except call page itself)
- Manages call state (incoming, cancelled, rejected)
- Integrates with chat store to get caller names
- Handles call acceptance/rejection/timeout

#### 3. **Call Page** (UPDATED: `frontend/src/app/call/page.tsx`)
Enhanced with:
- Modern gradient UI design
- Connection status indicators (connecting/connected/disconnected)
- Call duration timer
- Improved video layout (remote video larger, local video smaller)
- Status badges on local video (muted/video off indicators)
- Better control buttons with icons
- Loading state while waiting for remote user
- Proper cleanup on disconnect

#### 4. **ChatWindow.tsx** (UPDATED)
Added:
- Call initiation button
- "Calling..." indicator with animated dots
- Call cancellation after 60 seconds
- Cancel button while calling
- Incoming call notification (in-chat)
- Socket event handlers for call lifecycle

#### 5. **Root Client Layout** (UPDATED: `frontend/src/app/root-client-layout.tsx`)
- Added GlobalCallListener component
- Renders for all authenticated users
- Ensures call notifications work everywhere

### Backend Gateway Updates

#### **ChatGateway** (UPDATED: `backend/src/chat/gateways/chat.gateway.ts`)
Added events:
- `call-request`: Initiates a call, includes caller name
- `call-cancel`: Cancels an ongoing call request
- `call-accept`: Accepts an incoming call
- `call-reject`: Rejects an incoming call

Emits:
- `incoming-call`: Notifies recipient with caller info
- `call-cancelled`: Notifies when caller cancels
- `call-accepted`: Notifies caller when accepted
- `call-rejected`: Notifies caller when rejected

## Call Flow

### Initiating a Call
1. User clicks "Call" button in chat
2. Button changes to "Cancel" with calling indicator
3. Socket emits `call-request` to backend
4. Backend sends `incoming-call` to recipient's personal room
5. 60-second timeout starts
6. If timeout expires, auto-cancels and emits `call-cancel`

### Receiving a Call
1. GlobalCallListener receives `incoming-call` event
2. Toast notification appears with caller name
3. 60-second countdown timer starts
4. User can Accept or Decline
5. On Accept: Navigates to `/call?roomId=X&caller=false`
6. On Decline/Timeout: Emits `call-reject`

### During Call
1. WebRTC peer connection established
2. Local and remote video streams displayed
3. Connection status shown (connecting → connected)
4. Call duration timer starts when connected
5. Users can toggle audio/video
6. Status indicators show muted/video off state

### Ending Call
1. User clicks "End Call" button
2. Streams stopped, peer connection closed
3. Navigates back to chat
4. Socket emits `leave-video-room`

## Key Features

### 1. Auto-Cancel (60 seconds)
- Caller: Timeout in ChatWindow component
- Receiver: Timeout in IncomingCallToast component
- Both emit `call-reject` on timeout

### 2. Global Notifications
- Toast appears on ALL pages (except call page)
- Uses personal user rooms for delivery
- Persists across navigation
- Dismisses on accept/reject/cancel

### 3. Status Indicators
- Connection state: connecting/connected/disconnected
- Call duration timer (MM:SS format)
- Audio muted indicator (red badge)
- Video off indicator (red badge)
- Waiting for remote user animation

### 4. UI/UX Enhancements
- Smooth animations and transitions
- Pulsing effects for incoming calls
- Gradient backgrounds
- Responsive layout (mobile/desktop)
- Clear visual feedback for all actions

## Socket Events Reference

### Client → Server
- `call-request`: { roomId: string }
- `call-accept`: { roomId: string }
- `call-reject`: { roomId: string }
- `call-cancel`: { roomId: string }
- `join-video-room`: roomId (string)
- `leave-video-room`: { roomId: string }
- `offer`: { roomId: string, offer: RTCSessionDescriptionInit }
- `answer`: { roomId: string, answer: RTCSessionDescriptionInit }
- `ice-candidate`: { roomId: string, candidate: RTCIceCandidateInit }

### Server → Client
- `incoming-call`: { roomId: string, from: string, to: string, callerName: string }
- `call-accepted`: { roomId: string, accepter: string }
- `call-rejected`: { roomId: string, rejecter: string }
- `call-cancelled`: { roomId: string, canceller: string }
- `offer`: { from: string, offer: RTCSessionDescriptionInit }
- `answer`: { from: string, answer: RTCSessionDescriptionInit }
- `ice-candidate`: { sender: string, candidate: RTCIceCandidateInit }
- `user-disconnected`: (userId: string)

## Testing Checklist

- [ ] Call initiation from chat
- [ ] Incoming call toast appears
- [ ] Accept call navigates to call page
- [ ] Reject call dismisses notification
- [ ] Auto-cancel after 60 seconds (both sides)
- [ ] Video/audio streams work
- [ ] Mute/unmute audio
- [ ] Show/hide video
- [ ] Call duration timer
- [ ] End call returns to chat
- [ ] Toast appears on all pages
- [ ] Multiple browser tabs/devices
- [ ] Connection state indicators
- [ ] Proper cleanup on disconnect

## Future Enhancements

1. **Call History**: Track call duration and history
2. **Screen Sharing**: Add screen share capability
3. **Group Calls**: Support multiple participants
4. **Call Quality**: Network quality indicators
5. **Recording**: Record calls (with permission)
6. **Notifications**: Browser notifications for incoming calls
7. **Ringtone**: Audio ringtone for incoming calls
8. **Busy State**: Handle when user is already in a call
9. **Call Logs**: Store call metadata in database
10. **Mobile Optimization**: Better mobile UI/UX
