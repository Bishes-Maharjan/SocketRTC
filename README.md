# SocketRTC 🎥💬

A real-time video calling and chat application built with **Next.js** and **NestJS**, featuring a **custom-built WebRTC Gateway** for peer-to-peer video communication.

This project demonstrates a deep implementation of WebRTC signaling using Socket.io, handling offers, answers, and ICE candidates manually without relying on external video SDKs.

## 🚀 Features

-   **Custom WebRTC Implementation**: Built from scratch using native `RTCPeerConnection` for full control over the video pipeline.
-   **Real-time Signaling**: Socket.io-powered gateway for instant connection handling.
-   **Video Calling**: Full-screen video calls with a modern UI (Google Meet style).
-   **Real-time Chat**: Messaging system integrated with the calling experience.
-   **Authentication**: Secure login with JWT and Google OAuth strategies.
-   **Incoming Call Notifications**: Global modal notifications for incoming calls.
-   **Responsive Design**: Optimized for desktop and mobile experiences (TailwindCSS + DaisyUI).
-   **State Management**: efficient state handling with Zustand.

## 🛠 Tech Stack

### Backend
-   **Framework**: [NestJS](https://nestjs.com/)
-   **Language**: TypeScript
-   **Real-time**: **Socket.io** (Custom Signaling Gateway)
-   **Database**: MongoDB (via Mongoose)
-   **Auth**: Passport (Google OAuth2, JWT)

### Frontend
-   **Framework**: [Next.js 15](https://nextjs.org/) (React 19)
-   **Styling**: [TailwindCSS](https://tailwindcss.com/) & [DaisyUI](https://daisyui.com/)
-   **WebRTC**: Native Browser APIs (`navigator.mediaDevices`, `RTCPeerConnection`)
-   **State Management**: [Zustand](https://github.com/pmndrs/zustand)
-   **HTTP Client**: Axios

## 📋 Prerequisites

Ensure you have the following installed:
-   **Node.js** (v18+ recommended)
-   **pnpm** (Package manager)
-   **MongoDB** (Local instance or Atlas URI)

## ⚙️ Installation & Setup

This is a monorepo containing both `frontend` and `backend`.

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd clz-project
```

### 2. Backend Setup
```bash
cd backend
pnpm install
```
Create a `.env` file in `backend/`:
```bash
# backend/.env

# Server
PORT=3001
NODE_ENV=development
# FRONTEND_URL=http://localhost:3000 # Optional/Used for CORS in production

# Authentication
JWT_SECRET=your_super_long_secure_secret_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback

# Database
MONGO_URI=mongodb://localhost:27017/streamify
```
**Start the Backend:**
```bash
pnpm start:dev
```
*> The backend runs on port `3001`.*

### 3. Frontend Setup
Open a new terminal tab.
```bash
cd frontend
pnpm install
```
Create a `.env` file in `frontend/`:
```bash
# frontend/.env

NEXT_PUBLIC_API_URL=http://localhost:3001
NODE_ENV=development
```
**Start the Frontend:**
```bash
pnpm dev
```
*> The frontend runs on `http://localhost:3000`.*

## 🏃 Running the Application

1.  Ensure **MongoDB** is running.
2.  Start Backend: `pnpm start:dev` (in `/backend`)
3.  Start Frontend: `pnpm dev` (in `/frontend`)
4.  Visit `http://localhost:3000` in your browser.

## 🤝 Application Flow (Video)

1.  **Sign Up/Login**: Users authenticate securely.
2.  **Friend List**: Add friends by email.
3.  **Chat**: Click a friend to start chatting.
4.  **Video Call**: Click the video icon in chat to initiate a call.
    *   **Signaling**: The App uses a custom `video.gateway.ts` to exchange SDP and ICE candidates.
    *   **Connection**: A direct P2P mesh connection is established between users.

## 📄 License

[MIT](https://choosealicense.com/licenses/mit/)
