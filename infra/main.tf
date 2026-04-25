# Main Terraform Configuration
# Creates GCP project and enables required APIs

# Create a new Google Cloud project
resource "google_project" "default" {
  provider = google-beta.no_user_project_override

  name            = var.project_name
  project_id      = var.project_id
  billing_account = var.billing_account

  # Required for the project to display in Firebase console
  labels = {
    "firebase" = "enabled"
  }
}

# Enable the required underlying Service Usage API
resource "google_project_service" "serviceusage" {
  provider = google-beta.no_user_project_override

  project = google_project.default.project_id
  service = "serviceusage.googleapis.com"

  disable_on_destroy = false
}

# Enable the Firebase Management API
resource "google_project_service" "firebase" {
  provider = google-beta.no_user_project_override

  project = google_project.default.project_id
  service = "firebase.googleapis.com"

  disable_on_destroy = false
}

# Enable Cloud Run API
resource "google_project_service" "cloudrun" {
  provider = google-beta

  project = google_project.default.project_id
  service = "run.googleapis.com"

  disable_on_destroy = false

  depends_on = [google_project_service.serviceusage]
}

# GCP APIs need propagation time after enablement before resources can be created
resource "time_sleep" "wait_for_apis" {
  create_duration = "60s"

  depends_on = [
    google_project_service.cloudrun,
    google_project_service.artifactregistry,
    google_project_service.secretmanager,
    google_project_service.iam,
  ]
}

# Enable Artifact Registry API
resource "google_project_service" "artifactregistry" {
  provider = google-beta

  project = google_project.default.project_id
  service = "artifactregistry.googleapis.com"

  disable_on_destroy = false

  depends_on = [google_project_service.serviceusage]
}

# Enable Firestore API
resource "google_project_service" "firestore" {
  provider = google-beta

  project = google_project.default.project_id
  service = "firestore.googleapis.com"

  disable_on_destroy = false

  depends_on = [google_project_service.serviceusage]
}

# Enable Identity Platform API (for Firebase Auth)
resource "google_project_service" "identitytoolkit" {
  provider = google-beta

  project = google_project.default.project_id
  service = "identitytoolkit.googleapis.com"

  disable_on_destroy = false

  depends_on = [google_project_service.serviceusage]
}

# Enable IAM Credentials API (for Workload Identity Federation)
resource "google_project_service" "iamcredentials" {
  provider = google-beta

  project = google_project.default.project_id
  service = "iamcredentials.googleapis.com"

  disable_on_destroy = false

  depends_on = [google_project_service.serviceusage]
}

# Enable IAM API (for Workload Identity Pool)
resource "google_project_service" "iam" {
  provider = google-beta

  project = google_project.default.project_id
  service = "iam.googleapis.com"

  disable_on_destroy = false

  depends_on = [google_project_service.serviceusage]
}

# Enable Cloud Resource Manager API
resource "google_project_service" "cloudresourcemanager" {
  provider = google-beta

  project = google_project.default.project_id
  service = "cloudresourcemanager.googleapis.com"

  disable_on_destroy = false

  depends_on = [google_project_service.serviceusage]
}

# Enable Secret Manager API
resource "google_project_service" "secretmanager" {
  provider = google-beta

  project = google_project.default.project_id
  service = "secretmanager.googleapis.com"

  disable_on_destroy = false

  depends_on = [google_project_service.serviceusage]
}

# Enable Firebase Cloud Messaging API
resource "google_project_service" "fcm" {
  provider = google-beta

  project = google_project.default.project_id
  service = "fcm.googleapis.com"

  disable_on_destroy = false

  depends_on = [google_project_service.serviceusage]
}


