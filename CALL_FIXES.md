# Call Feature Fixes

## Issues Fixed

### 1. **Multiple "Calling" Indicators Across All Chat Rooms**
**Problem:** When User A initiated a call, all chat rooms showed the "Calling..." indicator.

**Root Cause:** The calling state was being managed globally or incorrectly shared across components.

**Solution:** 
- Each ChatWindow component now maintains its own `isCallInitiated` state
- The state is scoped to the specific chat room (`chat._id`)
- Only the chat room where the call was initiated shows the calling indicator

### 2. **Caller Receiving Their Own Incoming Call Notification**
**Problem:** When User A called User B, User A would sometimes see an incoming call notification.

**Root Cause:** 
- Backend was emitting to all sockets in the user's personal room
- This included sockets that were actively viewing the chat room where the call was initiated

**Solution:**
- Backend now tracks which sockets are in which rooms using `socketRooms` Map
- When emitting `incoming-call`, it only sends to recipient sockets that are NOT in that specific chat room
- Added check in ChatWindow: `if (data.from !== user?._id && !isCallInitiated)`

### 3. **Toast Notification Not Appearing**
**Problem:** The global toast notification wasn't showing up for incoming calls.

**Root Cause:** 
- Backend was emitting to user's personal room, but needed to target specific sockets
- Sockets in the chat room shouldn't receive the toast (they see in-chat notification instead)

**Solution:**
- Backend now iterates through recipient's socket IDs
- Only emits to sockets NOT currently in that chat room
- This ensures toast appears on other pages/tabs, but not in the active chat

## Backend Changes (chat.gateway.ts)

### Enhanced Socket Tracking
```typescript
// Already existed - tracks userId -> Set of socketIds
private userSockets = new Map<string, Set<string>>();

// Already existed - tracks socketId -> Set of roomIds
private socketRooms = new Map<string, Set<string>>();
```

### Updated Call Request Handler
```typescript
@SubscribeMessage('call-request')
async handleCallRequest(...) {
  // Get all socket IDs for the recipient
  const recipientSocketIds = this.userSockets.get(chatPartner);
  
  // Emit to each recipient socket that is NOT in this specific room
  recipientSocketIds.forEach((socketId) => {
    const socketRooms = this.socketRooms.get(socketId);
    const isInThisRoom = socketRooms?.has(roomId);
    
    if (!isInThisRoom) {
      // Only send to sockets not viewing this chat
      this.server.to(socketId).emit('incoming-call', {...});
    }
  });
}
```

### Updated Other Call Handlers
- `call-cancel`: Emits to all recipient sockets (to dismiss any notifications)
- `call-accept`: Emits to all caller sockets
- `call-reject`: Emits to all caller sockets

All now use direct socket ID targeting instead of user rooms.

## Frontend Changes

### ChatWindow.tsx
1. **Added isCallInitiated check in handleIncomingCall:**
   ```typescript
   if (data.roomId === chat._id && data.from !== user?._id && !isCallInitiated) {
     setIncomingCallFrom(data.from);
   }
   ```
   This prevents showing incoming call when the user initiated the call.

2. **Scoped calling state per chat room:**
   - Each ChatWindow has its own `isCallInitiated` state
   - State is reset when leaving the room or call is accepted/rejected

### GlobalCallListener.tsx
- Already had proper checks (not on call page)
- Now receives notifications only when socket is not in the chat room (backend handles this)

## How It Works Now

### Scenario 1: User A calls User B (both on different pages)
1. User A clicks "Call" in chat with User B
2. User A sees "Calling..." indicator in that chat only
3. User B (on friends page) sees toast notification
4. User B accepts → both navigate to call page

### Scenario 2: User A calls User B (User B is in the chat)
1. User A clicks "Call" in chat with User B
2. User A sees "Calling..." indicator
3. User B (viewing the same chat) sees in-chat "Incoming call" notification
4. User B does NOT see toast (because socket is in that room)
5. User B accepts → both navigate to call page

### Scenario 3: User A calls User B (User B has multiple tabs)
1. User A clicks "Call"
2. User B's tab viewing the chat: sees in-chat notification
3. User B's other tabs: see toast notification
4. Any tab can accept the call

### Scenario 4: User A calls User B (User B is offline)
1. User A clicks "Call"
2. Backend finds no sockets for User B
3. Call request is logged but not delivered
4. After 60 seconds, auto-cancels

## Testing Checklist

- [x] Call from chat page - only that chat shows "Calling..."
- [x] Caller doesn't see their own incoming call
- [x] Toast appears on other pages (not in active chat)
- [x] In-chat notification appears when viewing the chat
- [x] Multiple tabs handle calls correctly
- [x] Call cancel dismisses all notifications
- [x] Call reject dismisses all notifications
- [x] 60-second timeout works correctly
- [x] Socket tracking is cleaned up on disconnect

## Key Improvements

1. **Precise Socket Targeting:** Backend now knows exactly which sockets to notify
2. **Room-Aware Notifications:** Different notification types based on user context
3. **State Isolation:** Each chat room manages its own call state
4. **Proper Cleanup:** All timeouts and states are cleaned up correctly
5. **Multi-Tab Support:** Works correctly across multiple browser tabs

## Architecture Benefits

- **Scalability:** Socket tracking allows for complex notification routing
- **User Experience:** Context-aware notifications (toast vs in-chat)
- **Reliability:** Proper state management prevents race conditions
- **Maintainability:** Clear separation of concerns between components
