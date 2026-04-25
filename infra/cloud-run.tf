# Cloud Run Configuration
# Backend (FastAPI) and Frontend (Next.js) services

locals {
  docker_registry = "${var.region}-docker.pkg.dev/${var.project_id}/docker"
}

# Backend Cloud Run Service
resource "google_cloud_run_v2_service" "backend" {
  provider = google-beta

  project  = google_project.default.project_id
  name     = "backend"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  deletion_protection = false

  template {
    service_account = google_service_account.cloudrun.email

    scaling {
      min_instance_count = 0
      max_instance_count = 10
    }

    containers {
      # Using placeholder image for initial deployment
      # Real image will be deployed via CI/CD and ignored by lifecycle block
      image = "us-docker.pkg.dev/cloudrun/container/hello"

      ports {
        container_port = 8000
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }

      env {
        name  = "ENVIRONMENT"
        value = "production"
      }

      # CORS allowed origins - set after deployment via CI/CD or manually
      # The frontend URL will be: https://frontend-<hash>-<region>.a.run.app
      env {
        name  = "ALLOWED_ORIGINS"
        value = "http://localhost:3000,http://localhost:8081"
      }

      # Firebase service account credentials from Secret Manager
      env {
        name = "FIREBASE_SERVICE_ACCOUNT_JSON"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.firebase_service_account.secret_id
            version = "latest"
          }
        }
      }

      # Startup probe
      startup_probe {
        http_get {
          path = "/health"
          port = 8000
        }
        initial_delay_seconds = 5
        period_seconds        = 10
        failure_threshold     = 3
      }

      # Liveness probe
      liveness_probe {
        http_get {
          path = "/health"
          port = 8000
        }
        period_seconds = 30
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    time_sleep.wait_for_apis,
    google_artifact_registry_repository.docker,
    google_secret_manager_secret_version.firebase_service_account,
    google_secret_manager_secret_iam_member.cloudrun_firebase_secret,
  ]

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
      # Allow ALLOWED_ORIGINS to be updated independently
      template[0].containers[0].env,
    ]
  }
}

# Frontend Cloud Run Service
# Only created when frontend_platform = "cloudrun"
resource "google_cloud_run_v2_service" "frontend" {
  count    = var.frontend_platform == "cloudrun" ? 1 : 0
  provider = google-beta

  project  = google_project.default.project_id
  name     = "frontend"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  deletion_protection = false

  template {
    service_account = google_service_account.cloudrun.email

    scaling {
      min_instance_count = 0
      max_instance_count = 10
    }

    containers {
      # Using placeholder image for initial deployment
      # Real image will be deployed via CI/CD and ignored by lifecycle block
      image = "us-docker.pkg.dev/cloudrun/container/hello"

      ports {
        container_port = 3000
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      env {
        name  = "NEXT_PUBLIC_API_URL"
        value = "" # Will be set after backend is deployed
      }

      env {
        name  = "NEXT_PUBLIC_FIREBASE_API_KEY"
        value = data.google_firebase_web_app_config.default.api_key
      }

      env {
        name  = "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"
        value = data.google_firebase_web_app_config.default.auth_domain
      }

      env {
        name  = "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
        value = var.project_id
      }

      env {
        name  = "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"
        value = data.google_firebase_web_app_config.default.storage_bucket
      }

      env {
        name  = "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"
        value = data.google_firebase_web_app_config.default.messaging_sender_id
      }

      env {
        name  = "NEXT_PUBLIC_FIREBASE_APP_ID"
        value = google_firebase_web_app.default.app_id
      }

      # FCM VAPID key for web push notifications (optional)
      dynamic "env" {
        for_each = var.fcm_vapid_key != "" ? [1] : []
        content {
          name  = "NEXT_PUBLIC_FIREBASE_VAPID_KEY"
          value = var.fcm_vapid_key
        }
      }

      # Firebase service account credentials from Secret Manager
      # Used by Next.js API routes to verify Firebase tokens
      env {
        name = "FIREBASE_SERVICE_ACCOUNT_JSON"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.firebase_service_account.secret_id
            version = "latest"
          }
        }
      }

      # Startup probe
      startup_probe {
        http_get {
          path = "/"
          port = 3000
        }
        initial_delay_seconds = 5
        period_seconds        = 10
        failure_threshold     = 3
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    time_sleep.wait_for_apis,
    google_artifact_registry_repository.docker,
    google_firebase_web_app.default,
    google_secret_manager_secret_version.firebase_service_account,
    google_secret_manager_secret_iam_member.cloudrun_firebase_secret,
  ]

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
      # Allow env vars to be updated independently via CI/CD
      template[0].containers[0].env,
    ]
  }
}

# Allow unauthenticated access to backend
resource "google_cloud_run_v2_service_iam_member" "backend_public" {
  provider = google-beta

  project  = google_project.default.project_id
  location = var.region
  name     = google_cloud_run_v2_service.backend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Allow unauthenticated access to frontend (only when using Cloud Run)
resource "google_cloud_run_v2_service_iam_member" "frontend_public" {
  count    = var.frontend_platform == "cloudrun" ? 1 : 0
  provider = google-beta

  project  = google_project.default.project_id
  location = var.region
  name     = google_cloud_run_v2_service.frontend[0].name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

