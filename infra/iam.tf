# IAM Configuration
# Service accounts and Workload Identity Federation for GitHub Actions

# Service account for Cloud Run services
resource "google_service_account" "cloudrun" {
  provider = google-beta

  project      = google_project.default.project_id
  account_id   = "cloudrun-sa"
  display_name = "Cloud Run Service Account"
  description  = "Service account for Cloud Run backend and frontend services"

  depends_on = [google_project_service.serviceusage]
}

# Grant Firestore access to Cloud Run service account
resource "google_project_iam_member" "cloudrun_firestore" {
  provider = google-beta

  project = google_project.default.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.cloudrun.email}"
}

# Grant Secret Manager access to Cloud Run service account
resource "google_project_iam_member" "cloudrun_secretmanager" {
  provider = google-beta

  project = google_project.default.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.cloudrun.email}"
}

# Service account for GitHub Actions CI/CD
resource "google_service_account" "github_actions" {
  provider = google-beta

  project      = google_project.default.project_id
  account_id   = "github-actions"
  display_name = "GitHub Actions Service Account"
  description  = "Service account for GitHub Actions CI/CD"

  depends_on = [google_project_service.serviceusage]
}

# Grant permissions to GitHub Actions service account
resource "google_project_iam_member" "github_actions_artifact_registry" {
  provider = google-beta

  project = google_project.default.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

resource "google_project_iam_member" "github_actions_cloudrun" {
  provider = google-beta

  project = google_project.default.project_id
  role    = "roles/run.developer"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

resource "google_project_iam_member" "github_actions_sa_user" {
  provider = google-beta

  project = google_project.default.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

# Workload Identity Pool for GitHub Actions
resource "google_iam_workload_identity_pool" "github" {
  provider = google-beta

  project                   = google_project.default.project_id
  workload_identity_pool_id = "github-actions-pool"
  display_name              = "GitHub Actions Pool"
  description               = "Workload Identity Pool for GitHub Actions"

  depends_on = [
    google_project_service.iamcredentials,
    google_project_service.iam,
  ]
}

# Workload Identity Pool Provider for GitHub
resource "google_iam_workload_identity_pool_provider" "github" {
  provider = google-beta

  project                            = google_project.default.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-provider"
  display_name                       = "GitHub Provider"
  description                        = "OIDC provider for GitHub Actions"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  attribute_condition = "assertion.repository == \"${var.github_repo}\""

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

# Allow GitHub Actions to impersonate the service account
resource "google_service_account_iam_member" "github_actions_workload_identity" {
  provider = google-beta

  service_account_id = google_service_account.github_actions.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repo}"
}

