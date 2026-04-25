# Backend

FastAPI backend service with Firebase authentication.

## Setup

```bash
uv sync
```

## Firebase Configuration

To enable Firebase authentication, you need to set up the Firebase Admin SDK credentials:

### Option 1: Service Account File (Recommended for local development)

1. Go to [Firebase Console](https://console.firebase.google.com/) → Your Project → Project Settings → Service Accounts
2. Click "Generate new private key" to download the JSON file
3. Save it as `firebase-service-account.json` in the backend directory
4. Set the environment variable:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json
```

### Option 2: Service Account JSON String (For containerized deployments)

Set the entire JSON content as an environment variable:

```bash
export FIREBASE_SERVICE_ACCOUNT_JSON='{"type": "service_account", ...}'
```

### Option 3: Default Credentials (For GCP environments)

When running on Google Cloud (Cloud Run, Cloud Functions, etc.), the default service account will be used automatically.

## Environment Variables

Create a `.env` file in the backend directory:

```env
# Firebase credentials (choose one)
GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json
# FIREBASE_SERVICE_ACCOUNT_JSON={"type": "service_account", ...}

# CORS allowed origins (comma-separated)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8081
```

## Run

```bash
uv run python main.py
```

Server runs at http://localhost:8000.

## API Endpoints

### Public Endpoints

- `GET /` - Root endpoint
- `GET /health` - Health check

### Protected Endpoints (Require Firebase token)

- `GET /me` - Get current user info
- `GET /protected` - Example protected route

### Optional Auth Endpoints

- `GET /greeting` - Personalized greeting (works with or without auth)

## Format

We have a check to ensure the code is formatted consistently

```bash
uv run ruff format
```

## Using Protected Routes

From the frontend or mobile app, include the Firebase ID token in the Authorization header:

```typescript
// Frontend/Expo-app example using the api.ts helper
import { apiGet } from "@/lib/api";

const userData = await apiGet("/me");
```
