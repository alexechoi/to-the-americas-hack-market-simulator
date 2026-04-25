This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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

## Firebase Authentication

This app includes Firebase Authentication with:

- Email/password sign-in
- Google sign-in
- Apple sign-in

### Routes

- `/auth/login` - Sign in page
- `/auth/signup` - Sign up page
- `/dashboard` - Protected dashboard (requires authentication)

### User Data

When a user signs up, a Firestore document is created at `/users/{uid}` containing user profile data and consent timestamps.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
