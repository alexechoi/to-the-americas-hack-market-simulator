# Artifact Registry Configuration
# Docker container registry for storing container images

resource "google_artifact_registry_repository" "docker" {
  provider = google-beta

  project       = google_project.default.project_id
  location      = var.region
  repository_id = "docker"
  description   = "Docker container registry for application images"
  format        = "DOCKER"

  # Cleanup policy to remove old untagged images
  cleanup_policies {
    id     = "delete-untagged"
    action = "DELETE"

    condition {
      tag_state  = "UNTAGGED"
      older_than = "604800s" # 7 days
    }
  }

  # Keep at least 5 tagged versions
  cleanup_policies {
    id     = "keep-minimum-versions"
    action = "KEEP"

    most_recent_versions {
      keep_count = 5
    }
  }

  depends_on = [google_project_service.artifactregistry]
}

