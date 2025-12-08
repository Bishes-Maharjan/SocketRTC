# SocketRTC 🎥💬

A real-time video calling and chat application built with **Next.js** and **NestJS**, powered by [GetStream.io](https://getstream.io/) for robust communication infrastructure.

This project demonstrates a modern approach to WebRTC video calls, real-time messaging, and secure authentication.

## 🚀 Features

-   **Video Calling**: Full-screen video calls with a modern UI (Google Meet style).
-   **Real-time Chat**: Instant messaging powered by Stream Chat.
-   **Authentication**: Secure login with JWT and Google OAuth strategies.
-   **Incoming Call Notifications**: Global modal notifications for incoming calls.
-   **Responsive Design**: Optimized for desktop and mobile experiences (TailwindCSS + DaisyUI).
-   **State Management**: efficient state handling with Zustand.

## 🛠 Tech Stack

### Frontend
-   **Framework**: [Next.js 15](https://nextjs.org/) (React 19)
-   **Styling**: [TailwindCSS](https://tailwindcss.com/) & [DaisyUI](https://daisyui.com/)
-   **State Management**: [Zustand](https://github.com/pmndrs/zustand)
-   **Real-time SDKs**: `@stream-io/video-react-sdk`, `stream-chat-react`
-   **HTTP Client**: Axios

### Backend
-   **Framework**: [NestJS](https://nestjs.com/)
-   **Language**: TypeScript
-   **Database**: MongoDB (via Mongoose)
-   **WebSockets**: Socket.io (for signaling and custom events)
-   **Auth**: Passport (Google OAuth2, JWT)

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
Create a `.env` file in `backend/` based on `backend.env.example.txt` (or use the contents below):
```bash
# backend/.env

# Server
PORT=3001
FRONTEND_URL=http://localhost:3000

# Stream IO (Get these from getstream.io dashboard)
STREAM_API_KEY=your_stream_api_key
STREAM_API_SECRET=your_stream_api_secret

# Database
MONGO_URI=your_mongodb_connection_string

# Authentication
JWT_SECRET=your_secure_jwt_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback
```
**Start the Backend:**
```bash
pnpm start:dev
```
*> The backend runs on port `3001`. Do NOT change this unless you update the frontend config.*

### 3. Frontend Setup
Open a new terminal tab.
```bash
cd frontend
pnpm install
```
Create a `.env` file in `frontend/` based on `frontend.env.example.txt`:
```bash
# frontend/.env

NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NEXT_PUBLIC_STREAM_API_KEY=your_stream_api_key # Must match backend key
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
    *   The receiver gets an incoming call popup.
    *   On accept, both users are redirected to the video room.
    *   Signaling (offer/answer/ICE) is handled via Backend Socket Gateway.

## 📄 License

[MIT](https://choosealicense.com/licenses/mit/)
