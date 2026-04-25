# Reflex — Frontend

Multi-agent market simulator. Inject a headline, watch a population of trader personas react in real time, and see how price moves before it moves.

Built with [Next.js](https://nextjs.org), Firebase Authentication, and Firestore.

## Getting Started

### 1. Configure Firebase

Copy the environment example file and fill in your Firebase configuration:

```bash
cp .env.example .env.local
```

Get your Firebase config values from the [Firebase Console](https://console.firebase.google.com/) -> Project Settings -> General -> Your apps -> Web app.

### 2. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Authentication

Reflex uses Firebase Authentication with:

- Email/password sign-in
- Google sign-in
- Apple sign-in

### Routes

- `/` — Marketing landing page
- `/auth/login` — Sign in page
- `/auth/signup` — Sign up page
- `/dashboard` — Protected app surface (requires authentication)

### User Data

When a user signs up, a Firestore document is created at `/users/{uid}` containing user profile data and consent timestamps.
