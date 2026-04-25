# Full Stack Super Template

![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Expo](https://img.shields.io/badge/Expo_54-000020?style=for-the-badge&logo=expo&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![Terraform](https://img.shields.io/badge/Terraform-7B42BC?style=for-the-badge&logo=terraform&logoColor=white)
![Google Cloud](https://img.shields.io/badge/Google_Cloud-4285F4?style=for-the-badge&logo=googlecloud&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)

Production-ready template with web frontend, mobile app, API backend, and infrastructure-as-code.

| Component                         | Stack                            |
| --------------------------------- | -------------------------------- |
| [frontend/](./frontend/README.md) | Next.js 16 + React 19 + Tailwind |
| [backend/](./backend/README.md)   | FastAPI + Python 3.13            |
| [expo-app/](./expo-app/README.md) | Expo 54 + React Native           |
| [infra/](./infra/README.md)       | Terraform (GCP, Firebase, CI/CD) |

Frontend deploys to **Cloud Run**, **Vercel**, or **Netlify** (configurable).

---
# Example project

Here is an example of this template used in a real project: [https://github.com/alexechoi/bookmarks-app](https://github.com/alexechoi/bookmarks-app)

---

## Quickstart

### Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/downloads) installed
- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) installed
- GCP Billing Account ID (find at [console.cloud.google.com/billing](https://console.cloud.google.com/billing))

### 1. Deploy Infrastructure

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your values:

```hcl
# You don't need to make the gcp project - terraform will generate it but ensure you set a unique project_id
project_id      = "my-project-id"
project_name    = "My Project"
billing_account = "XXXXXX-XXXXXX-XXXXXX"
github_repo     = "your-org/your-repo"

# Mobile app (enables Firebase iOS/Android apps)
expo_ios_bundle_id        = "com.yourcompany.app"
expo_android_package_name = "com.yourcompany.app"

# You need to add the VAPID key later after the first run
fcm_vapid_key = "your-vapid-key"

# Optional: Deploy frontend to Vercel or Netlify instead of Cloud Run
# frontend_platform = "vercel"
# vercel_api_token  = "your-token"
```

```bash
gcloud auth application-default login
terraform init
terraform apply
```

### 2. Export Config (after terraform apply)

```bash
# Frontend environment variables
terraform output -json firebase_config | jq -r '
  "NEXT_PUBLIC_FIREBASE_API_KEY=\(.api_key)",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=\(.auth_domain)",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID=\(.project_id)",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=\(.storage_bucket)",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=\(.messaging_sender_id)",
  "NEXT_PUBLIC_FIREBASE_APP_ID=\(.app_id)"
' > ../frontend/.env

# Backend credentials (for local dev)
terraform output -raw firebase_service_account_json > ../backend/firebase-service-account.json

# Mobile app config (if expo bundle IDs configured)
terraform output -json firebase_ios_config | jq -r '.config_file_contents' | base64 -d > ../expo-app/GoogleService-Info.plist
terraform output -json firebase_android_config | jq -r '.config_file_contents' | base64 -d > ../expo-app/google-services.json

# CI/CD secrets for GitHub Actions
terraform output workload_identity_provider    # → GCP_WORKLOAD_IDENTITY_PROVIDER
terraform output github_actions_service_account # → GCP_SERVICE_ACCOUNT
```

### 3. Run Locally

```bash
# Backend
cd backend
export GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json
uv sync && uv run python main.py  # http://localhost:8000

# Frontend (new terminal)
cd frontend
npm install && npm run dev  # http://localhost:3000

# Mobile (new terminal, optional)
cd expo-app
npm install && npm run prebuild
npm run ios  # or npm run android
```

---

## Optional Configuration

Add these to `terraform.tfvars` before running `terraform apply` another time:

```hcl
# Web push notifications (get from Firebase Console > Cloud Messaging > Web Push certificates)
fcm_vapid_key = "your-vapid-key"

# Frontend platform (default: cloudrun)
frontend_platform = "vercel"  # or "netlify"
vercel_api_token  = "your-token"

# For Netlify: create site in UI first, then provide the site ID
# netlify_token   = "your-token"
# netlify_site_id = "your-site-id"
```

### iOS Push Notifications (APNs)

1. Create APNs key at [Apple Developer Console](https://developer.apple.com/account/resources/authkeys/list)
2. Upload `.p8` file to Firebase Console > Project Settings > Cloud Messaging > Apple app configuration
3. Rebuild: `npm run prebuild && npm run ios`

---

## Documentation

- [Frontend Setup](./frontend/README.md)
- [Backend Setup](./backend/README.md)
- [Mobile App Setup](./expo-app/README.md)
- [Infrastructure Details](./infra/README.md)
