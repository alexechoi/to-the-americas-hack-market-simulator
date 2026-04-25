# Vercel Deployment Configuration
# Deploys the frontend to Vercel instead of Cloud Run
# Only created when frontend_platform = "vercel"

# =============================================================================
# Vercel Project
# =============================================================================

resource "vercel_project" "frontend" {
  count = var.frontend_platform == "vercel" ? 1 : 0

  name      = "${var.project_id}-frontend"
  framework = "nextjs"

  git_repository = {
    type = "github"
    repo = var.github_repo
  }

  root_directory = "frontend"

  build_command    = "npm run build"
  output_directory = ".next"

  # Environment variables (non-sensitive, available at build time)
  environment = [
    {
      key    = "NEXT_PUBLIC_API_URL"
      value  = google_cloud_run_v2_service.backend.uri
      target = ["production", "preview"]
    },
    {
      key    = "NEXT_PUBLIC_FIREBASE_API_KEY"
      value  = data.google_firebase_web_app_config.default.api_key
      target = ["production", "preview"]
    },
    {
      key    = "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"
      value  = data.google_firebase_web_app_config.default.auth_domain
      target = ["production", "preview"]
    },
    {
      key    = "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
      value  = var.project_id
      target = ["production", "preview"]
    },
    {
      key    = "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"
      value  = data.google_firebase_web_app_config.default.storage_bucket
      target = ["production", "preview"]
    },
    {
      key    = "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"
      value  = data.google_firebase_web_app_config.default.messaging_sender_id
      target = ["production", "preview"]
    },
    {
      key    = "NEXT_PUBLIC_FIREBASE_APP_ID"
      value  = google_firebase_web_app.default.app_id
      target = ["production", "preview"]
    },
  ]

  depends_on = [
    google_firebase_web_app.default,
    google_cloud_run_v2_service.backend,
  ]
}

# =============================================================================
# Sensitive Environment Variables (stored as secrets)
# =============================================================================

# Firebase service account for API route token verification
resource "vercel_project_environment_variable" "firebase_service_account" {
  count = var.frontend_platform == "vercel" ? 1 : 0

  project_id = vercel_project.frontend[0].id
  key        = "FIREBASE_SERVICE_ACCOUNT_JSON"
  value      = base64decode(google_service_account_key.firebase_admin.private_key)
  target     = ["production", "preview"]
  sensitive  = true
}

# VAPID key for push notifications (if configured)
resource "vercel_project_environment_variable" "vapid_key" {
  count = var.frontend_platform == "vercel" && var.fcm_vapid_key != "" ? 1 : 0

  project_id = vercel_project.frontend[0].id
  key        = "NEXT_PUBLIC_FIREBASE_VAPID_KEY"
  value      = var.fcm_vapid_key
  target     = ["production", "preview"]
  sensitive  = false
}

# =============================================================================
# Vercel Deployment (trigger initial deployment)
# =============================================================================

# Note: Vercel will automatically deploy on git push via the connected repository.
# For manual/Terraform-triggered deployments, you would use vercel_deployment resource.

