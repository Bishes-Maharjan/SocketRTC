### Live at <a href='https://streamify-frontend-t8hu.onrender.com/'> Render </a>

If not, contact me or try it locally

## About

A small project to use getstream.io for video calling and chatting. My first attempt towards it so the user qol isnt great. I could have implemented a mailer module to check the users email authenticity but decided not to because I wanted any one to come and try this without needing an authentic email

### How to run

To run this project in your own local device you would need to copy the both env files to .env of their respective folder

## Setup ENVs

### Backend

Visit <a href='https://getstream.io/'> getstream.io </a> for

```bash

STREAM_API_KEY=
STREAM_API_SECRET=
```

Visit <a href='https://console.cloud.google.com/'>cloud console</a> for

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

Make up your own JWT_SECRET

Use your own mongodb uri or <a href='https://www.mongodb.com/'>Mongo DB Atlas</a> for the uri
If ur using the mongo db atlas, be sure to allow acces from anywhere in your network access settings for atlas.
The remaining fields can be empty.

### Frontend

```bash
NEXT_PUBLIC_STREAM_API_KEY= STREAM_API_KEY #Same as your backend getstream.io api key
```

## To run

DO NOT CHANGE THE PORT IN BACKEND FROM 3001
MAKE SURE TO RUN THE NEXT APP ON localhost:3000 , it will run in 3000 at default but if not be sure to add that port in main.ts of the backend in the enableCors origin.

In your terminal, open the repo
then

```bash
mv backend.env.example.txt backend/.env
cd backend
pnpm install && pnpm start dev
```

open another terminal

```bash
mv frontend.env.example.txt frontend/.env
cd frontend
pnpm install && pnpm dev
```

## Tech Stack

Next and Nest

Thats it.
Signing off.
# SocketRTC
