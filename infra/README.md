# Infrastructure

Terraform configuration for provisioning GCP infrastructure.

## ⚠️ Do NOT Create the GCP Project Manually

Terraform creates the project for you. You only need a **Billing Account ID** before starting.

## Quickstart

```bash
# 1. Install & authenticate
brew install terraform google-cloud-sdk
gcloud auth application-default login

# 2. Configure
cd infra
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your billing_account, project_id, and github_repo

# 3. Deploy
terraform init
terraform apply

# 4. Get Firebase config for frontend
terraform output -json firebase_config | jq -r '
  "NEXT_PUBLIC_FIREBASE_API_KEY=\(.api_key)",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=\(.auth_domain)",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID=\(.project_id)",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=\(.storage_bucket)",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=\(.messaging_sender_id)",
  "NEXT_PUBLIC_FIREBASE_APP_ID=\(.app_id)"
' > ../frontend/.env.local

# 5. Get Firebase config for Expo app (only if expo_ios_bundle_id / expo_android_package_name are set)
# For iOS: Download GoogleService-Info.plist
terraform output -json firebase_ios_config | jq -e -r '.config_file_contents' | base64 -d > ../expo-app/GoogleService-Info.plist 2>/dev/null && echo "✓ iOS config saved" || echo "⚠ iOS app not configured (set expo_ios_bundle_id)"

# For Android: Download google-services.json
terraform output -json firebase_android_config | jq -e -r '.config_file_contents' | base64 -d > ../expo-app/google-services.json 2>/dev/null && echo "✓ Android config saved" || echo "⚠ Android app not configured (set expo_android_package_name)"

# 6. Get Firebase Admin SDK credentials for backend (local development)
terraform output -raw firebase_service_account_json > ../backend/firebase-service-account.json

# 7. (Optional) If you set github_token, secrets are configured automatically!
# Otherwise, manually configure GitHub Actions:
terraform output workload_identity_provider  # → GCP_WORKLOAD_IDENTITY_PROVIDER secret
terraform output github_actions_service_account  # → GCP_SERVICE_ACCOUNT secret
```

## Mobile App Configuration (Optional)

To enable Firebase for the Expo mobile app, set these variables in `terraform.tfvars`:

```hcl
expo_ios_bundle_id        = "com.yourcompany.expoapp"
expo_android_package_name = "com.yourcompany.expoapp"
```

After running `terraform apply`, download the Firebase config files:

```bash
# iOS: GoogleService-Info.plist (only works if expo_ios_bundle_id was set)
terraform output -json firebase_ios_config | jq -e -r '.config_file_contents' | base64 -d > ../expo-app/GoogleService-Info.plist

# Android: google-services.json (only works if expo_android_package_name was set)
terraform output -json firebase_android_config | jq -e -r '.config_file_contents' | base64 -d > ../expo-app/google-services.json
```

> **Note:** These commands will fail with "null cannot be iterated" if the mobile apps aren't configured. Set `expo_ios_bundle_id` and/or `expo_android_package_name` in your `terraform.tfvars` first.

Then run `npm run prebuild` in the expo-app directory to generate native projects.

## Backend Authentication Setup

The backend uses Firebase Admin SDK to verify authentication tokens. Terraform automatically:

1. Creates a dedicated `firebase-admin-sdk` service account with `firebaseauth.admin` role
2. Generates a service account key and stores it in Secret Manager
3. Configures Cloud Run to inject the credentials via `FIREBASE_SERVICE_ACCOUNT_JSON` environment variable

### For Local Development

Download the service account credentials:

```bash
terraform output -raw firebase_service_account_json > ../backend/firebase-service-account.json
```

Then set the environment variable before running the backend:

```bash
cd backend
export GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json
uv run python main.py
```

### For Production (Cloud Run)

No manual configuration needed. The backend container automatically receives the Firebase credentials from Secret Manager at runtime.

## Frontend Deployment Platforms

By default, both backend and frontend deploy to Google Cloud Run. You can optionally deploy the frontend to **Vercel** or **Netlify** instead.

### Option 1: Cloud Run (Default)

No additional configuration needed. This is the default.

```hcl
frontend_platform = "cloudrun"
```

### Option 2: Vercel

1. Get a Vercel API token from [vercel.com/account/tokens](https://vercel.com/account/tokens)
2. Find your org/team ID in Vercel dashboard settings
3. Configure in `terraform.tfvars`:

```hcl
frontend_platform = "vercel"
vercel_api_token  = "your-vercel-token"
vercel_org_id     = "your-org-id"  # Optional, for team deployments
```

Terraform will:

- Create a Vercel project linked to your GitHub repo
- Set all Firebase environment variables automatically
- Inject the Firebase service account for API route authentication

### Option 3: Netlify

1. **Create the site manually** in the [Netlify UI](https://app.netlify.com):
   - Click "Add new site" → "Import an existing project"
   - Connect to your GitHub repo
   - Set base directory to `frontend`
   - Build command: `npm run build`
   - Publish directory: `.next`
2. Copy the **Site ID** from Site Settings → General → Site ID
3. Get a Netlify access token from [app.netlify.com/user/applications](https://app.netlify.com/user/applications#personal-access-tokens)
4. Configure in `terraform.tfvars`:

```hcl
frontend_platform = "netlify"
netlify_token     = "your-netlify-token"
netlify_site_id   = "your-site-id"    # From step 2
netlify_team_slug = "your-team-slug"  # From your Netlify URL
```

Terraform will:

- Configure all Firebase environment variables on your existing site
- Inject the Firebase service account for API route authentication

> **Note:** The Netlify Terraform provider doesn't support creating sites, so you must create the site manually first. Terraform manages environment variables only.

### Environment Variables

Regardless of platform, Terraform automatically configures these environment variables:

| Variable                         | Description                                 |
| -------------------------------- | ------------------------------------------- |
| `NEXT_PUBLIC_FIREBASE_*`         | Firebase client configuration               |
| `NEXT_PUBLIC_API_URL`            | Backend API URL (Cloud Run)                 |
| `FIREBASE_SERVICE_ACCOUNT_JSON`  | Firebase Admin credentials for API routes   |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Push notification VAPID key (if configured) |

## GitHub Actions CI/CD Setup

The deploy workflow needs 4 values configured in your GitHub repository. You have two options:

### Option A: Automatic (Recommended)

Set `github_token` in your `terraform.tfvars` and Terraform will configure everything automatically:

```hcl
github_token = "ghp_xxxxxxxxxxxx"  # Needs 'repo' scope
```

Get a token from [github.com/settings/tokens](https://github.com/settings/tokens) with **repo** scope.

### Option B: Manual

If you don't provide a token, set these manually in GitHub (Settings → Secrets and variables → Actions):

**Variables:**
- `GCP_PROJECT_ID` → `terraform output project_id`
- `GCP_REGION` → `terraform output -raw` (your region, e.g., `us-central1`)

**Secrets:**
- `GCP_WORKLOAD_IDENTITY_PROVIDER` → `terraform output workload_identity_provider`
- `GCP_SERVICE_ACCOUNT` → `terraform output github_actions_service_account`

## Firebase Authentication

Firebase Auth is automatically configured with **Email/Password** enabled by default.

### Google Sign-In (Optional)

To enable Google Sign-In via Terraform, create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials):

1. Go to **APIs & Services > Credentials**
2. Create an **OAuth 2.0 Client ID** (Web application type)
3. Add authorized redirect URI: `https://<project-id>.firebaseapp.com/__/auth/handler`
4. Set the credentials in `terraform.tfvars`:

```hcl
oauth_client_id     = "your-client-id.apps.googleusercontent.com"
oauth_client_secret = "your-client-secret"
```

Alternatively, leave these empty and configure Google Sign-In directly in the [Firebase Console](https://console.firebase.google.com) under **Authentication > Sign-in method** after running `terraform apply`.

### Apple Sign-In (Optional)

To enable Apple Sign-In, you need credentials from [Apple Developer Console](https://developer.apple.com/account):

1. **Create an App ID** with "Sign In with Apple" capability
2. **Create a Services ID** for web authentication:
   - Enable "Sign In with Apple"
   - Add your domains and return URLs
3. **Create a Key** with "Sign In with Apple":
   - Download the `.p8` file (one-time download!)
   - Note the Key ID
4. Find your **Team ID** in the Membership section

Then configure in `terraform.tfvars`:

```hcl
apple_team_id     = "ABCD123456"                    # 10-char Team ID
apple_services_id = "com.yourcompany.app.signin"   # Services ID
apple_key_id      = "KEYID12345"                   # Key ID
apple_private_key = "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
apple_bundle_id   = "com.yourcompany.app"          # iOS bundle ID
```

## What Gets Created

- GCP Project with Firebase, Firestore, Cloud Run, Artifact Registry
- Cloud Run backend service
- Frontend on Cloud Run, Vercel, or Netlify (based on `frontend_platform`)
- **Firebase Auth** with Email/Password enabled (Google Sign-In optional via OAuth credentials)
- **Apple Sign-In** (if credentials provided)
- GitHub Actions Workload Identity for keyless CI/CD
- GitHub Actions variables/secrets (if `github_token` provided)
- Firebase iOS and Android apps (optional, for Expo mobile app)
- Firebase Admin SDK service account with credentials in Secret Manager

## Next Steps

1. Push to GitHub to trigger CI/CD and deploy your actual app
2. View your URLs: `terraform output backend_url` and `terraform output frontend_url`

## Destroying

```bash
terraform destroy
```
