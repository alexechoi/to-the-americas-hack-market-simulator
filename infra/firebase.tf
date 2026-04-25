# Firebase Configuration
# Enables Firebase services, Authentication, and Firestore

# Enable Firebase services for the project
resource "google_firebase_project" "default" {
  provider = google-beta

  project = google_project.default.project_id

  depends_on = [
    google_project_service.firebase,
    google_project_service.serviceusage,
  ]
}

# Create Firestore database in native mode
resource "google_firestore_database" "default" {
  provider = google-beta

  project     = google_project.default.project_id
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"

  # Enable delete protection in production
  delete_protection_state = "DELETE_PROTECTION_DISABLED"
  deletion_policy         = "DELETE"

  depends_on = [
    google_firebase_project.default,
    google_project_service.firestore,
  ]
}

# Firestore Security Rules
# Users can read/write their own document at /users/{userId}
# All other access is denied by default

locals {
  firestore_rules = "service cloud.firestore { match /databases/{database}/documents { match /users/{userId} { allow read, write: if request.auth != null && request.auth.uid == userId; } match /{document=**} { allow read, write: if false; } } }"
}

resource "google_firebaserules_ruleset" "firestore" {
  provider = google-beta
  project  = google_project.default.project_id

  source {
    files {
      content = local.firestore_rules
      name    = "firestore.rules"
    }
  }

  depends_on = [google_firestore_database.default]
}

resource "google_firebaserules_release" "firestore" {
  provider = google-beta
  project  = google_project.default.project_id

  name         = "cloud.firestore"
  ruleset_name = "projects/${google_project.default.project_id}/rulesets/${google_firebaserules_ruleset.firestore.name}"

  lifecycle {
    replace_triggered_by = [google_firebaserules_ruleset.firestore]
  }
}

# Configure Identity Platform (Firebase Auth)
resource "google_identity_platform_config" "default" {
  provider = google-beta

  project = google_project.default.project_id

  # Enable email link sign-in
  sign_in {
    allow_duplicate_emails = false

    email {
      enabled           = true
      password_required = true
    }
  }

  # Authorized domains for auth
  authorized_domains = [
    "localhost",
    "${var.project_id}.firebaseapp.com",
    "${var.project_id}.web.app",
  ]

  depends_on = [
    google_firebase_project.default,
    google_project_service.identitytoolkit,
  ]
}

# =============================================================================
# Google Sign-In Provider
# =============================================================================
# To enable Google Sign-In via Terraform, provide oauth_client_id and oauth_client_secret.
#
# Create OAuth credentials in Google Cloud Console:
#   1. Go to APIs & Services > Credentials
#   2. Create an OAuth 2.0 Client ID (Web application)
#   3. Add authorized redirect URIs for Firebase Auth
#   4. Set oauth_client_id and oauth_client_secret in terraform.tfvars
#
# Alternatively, configure Google Sign-In directly in the Firebase Console
# under Authentication > Sign-in method after running terraform apply.

resource "google_identity_platform_default_supported_idp_config" "google" {
  provider = google-beta

  count = var.oauth_client_id != "" ? 1 : 0

  project       = google_project.default.project_id
  idp_id        = "google.com"
  client_id     = var.oauth_client_id
  client_secret = var.oauth_client_secret
  enabled       = true

  depends_on = [google_identity_platform_config.default]
}

# =============================================================================
# Apple Sign-In Provider
# =============================================================================
# Requires Apple Developer account credentials. Apple Sign-In needs:
# - Apple Team ID (from Apple Developer account)
# - Service ID (client_id) configured in Apple Developer Console
# - Key ID and Private Key for Sign In with Apple
#
# To enable, provide: apple_services_id, apple_team_id, apple_key_id, apple_private_key

resource "google_identity_platform_default_supported_idp_config" "apple" {
  provider = google-beta

  count = var.apple_team_id != "" ? 1 : 0

  project   = google_project.default.project_id
  idp_id    = "apple.com"
  client_id = var.apple_services_id
  client_secret = jsonencode({
    teamId     = var.apple_team_id
    keyId      = var.apple_key_id
    privateKey = var.apple_private_key
  })
  enabled = true

  depends_on = [google_identity_platform_config.default]
}

# Create Firebase Web App (for frontend configuration)
resource "google_firebase_web_app" "default" {
  provider = google-beta

  project      = google_project.default.project_id
  display_name = "Web App"

  depends_on = [google_firebase_project.default]
}

# Get Firebase Web App configuration
data "google_firebase_web_app_config" "default" {
  provider = google-beta

  project    = google_project.default.project_id
  web_app_id = google_firebase_web_app.default.app_id

  depends_on = [google_firebase_web_app.default]
}

# Create Firebase iOS App (for Expo)
resource "google_firebase_apple_app" "expo" {
  provider = google-beta
  count    = var.expo_ios_bundle_id != "" ? 1 : 0

  project      = google_project.default.project_id
  display_name = "Expo iOS App"
  bundle_id    = var.expo_ios_bundle_id

  deletion_policy = "DELETE"

  depends_on = [google_firebase_project.default]
}

# Get Firebase iOS App configuration
data "google_firebase_apple_app_config" "expo" {
  provider = google-beta
  count    = var.expo_ios_bundle_id != "" ? 1 : 0

  project = google_project.default.project_id
  app_id  = google_firebase_apple_app.expo[0].app_id

  depends_on = [google_firebase_apple_app.expo]
}

# Create Firebase Android App (for Expo)
resource "google_firebase_android_app" "expo" {
  provider = google-beta
  count    = var.expo_android_package_name != "" ? 1 : 0

  project      = google_project.default.project_id
  display_name = "Expo Android App"
  package_name = var.expo_android_package_name

  deletion_policy = "DELETE"

  depends_on = [google_firebase_project.default]
}

# Get Firebase Android App configuration
data "google_firebase_android_app_config" "expo" {
  provider = google-beta
  count    = var.expo_android_package_name != "" ? 1 : 0

  project = google_project.default.project_id
  app_id  = google_firebase_android_app.expo[0].app_id

  depends_on = [google_firebase_android_app.expo]
}

