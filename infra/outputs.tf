# Terraform Outputs
# Values exported for use in CI/CD and application configuration

output "project_id" {
  description = "The GCP project ID"
  value       = google_project.default.project_id
}

output "project_number" {
  description = "The GCP project number"
  value       = google_project.default.number
}

# Cloud Run URLs
output "backend_url" {
  description = "The URL of the backend Cloud Run service"
  value       = google_cloud_run_v2_service.backend.uri
}

output "frontend_url" {
  description = "The URL of the frontend service (Cloud Run, Vercel, or Netlify)"
  value = (
    var.frontend_platform == "cloudrun" ? google_cloud_run_v2_service.frontend[0].uri :
    var.frontend_platform == "vercel" ? (length(vercel_project.frontend) > 0 ? "https://${vercel_project.frontend[0].name}.vercel.app" : null) :
    var.frontend_platform == "netlify" ? (length(data.netlify_site.frontend) > 0 ? "https://${data.netlify_site.frontend[0].name}.netlify.app" : null) :
    null
  )
}

output "frontend_platform" {
  description = "The platform where the frontend is deployed"
  value       = var.frontend_platform
}

# Artifact Registry
output "docker_registry" {
  description = "The Docker registry URL for container images"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/docker"
}

# Workload Identity Federation
output "workload_identity_provider" {
  description = "The Workload Identity Provider resource name for GitHub Actions"
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "github_actions_service_account" {
  description = "The service account email for GitHub Actions"
  value       = google_service_account.github_actions.email
}

# Firebase Configuration
output "firebase_config" {
  description = "Firebase configuration for web apps"
  value = {
    api_key             = data.google_firebase_web_app_config.default.api_key
    auth_domain         = data.google_firebase_web_app_config.default.auth_domain
    project_id          = var.project_id
    storage_bucket      = data.google_firebase_web_app_config.default.storage_bucket
    messaging_sender_id = data.google_firebase_web_app_config.default.messaging_sender_id
    app_id              = google_firebase_web_app.default.app_id
    vapid_key           = var.fcm_vapid_key != "" ? var.fcm_vapid_key : null
  }
  sensitive = true
}

# Firebase iOS App Configuration (for Expo)
output "firebase_ios_config" {
  description = "Firebase configuration for iOS app (GoogleService-Info.plist content)"
  value = var.expo_ios_bundle_id != "" ? {
    app_id               = google_firebase_apple_app.expo[0].app_id
    bundle_id            = var.expo_ios_bundle_id
    project_id           = var.project_id
    api_key              = data.google_firebase_web_app_config.default.api_key
    storage_bucket       = data.google_firebase_web_app_config.default.storage_bucket
    messaging_sender_id  = data.google_firebase_web_app_config.default.messaging_sender_id
    config_filename      = data.google_firebase_apple_app_config.expo[0].config_filename
    config_file_contents = data.google_firebase_apple_app_config.expo[0].config_file_contents
  } : null
  sensitive = true
}

# Firebase Android App Configuration (for Expo)
output "firebase_android_config" {
  description = "Firebase configuration for Android app (google-services.json content)"
  value = var.expo_android_package_name != "" ? {
    app_id               = google_firebase_android_app.expo[0].app_id
    package_name         = var.expo_android_package_name
    project_id           = var.project_id
    api_key              = data.google_firebase_web_app_config.default.api_key
    storage_bucket       = data.google_firebase_web_app_config.default.storage_bucket
    messaging_sender_id  = data.google_firebase_web_app_config.default.messaging_sender_id
    config_filename      = data.google_firebase_android_app_config.expo[0].config_filename
    config_file_contents = data.google_firebase_android_app_config.expo[0].config_file_contents
  } : null
  sensitive = true
}

# Firebase Admin SDK Service Account
# Use this to save the service account JSON locally for development:
# terraform output -raw firebase_service_account_json > ../backend/firebase-service-account.json
output "firebase_service_account_json" {
  description = "Firebase Admin SDK service account JSON for local development"
  value       = base64decode(google_service_account_key.firebase_admin.private_key)
  sensitive   = true
}

output "firebase_service_account_email" {
  description = "Firebase Admin SDK service account email"
  value       = google_service_account.firebase_admin.email
}

