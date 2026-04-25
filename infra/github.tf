# GitHub Repository Configuration
# Automatically configures GitHub Actions variables and secrets for CI/CD

# =============================================================================
# GitHub Provider Configuration
# =============================================================================

# Note: You can also set GITHUB_TOKEN environment variable instead of using the variable
# The token needs 'repo' scope (or 'public_repo' for public repositories)

# =============================================================================
# GitHub Actions Variables (non-sensitive values)
# =============================================================================

resource "github_actions_variable" "gcp_project_id" {
  count = var.github_token != "" ? 1 : 0

  repository    = local.github_repo_name
  variable_name = "GCP_PROJECT_ID"
  value         = google_project.default.project_id
}

resource "github_actions_variable" "gcp_region" {
  count = var.github_token != "" ? 1 : 0

  repository    = local.github_repo_name
  variable_name = "GCP_REGION"
  value         = var.region
}

# =============================================================================
# GitHub Actions Secrets (sensitive values)
# =============================================================================

resource "github_actions_secret" "gcp_workload_identity_provider" {
  count = var.github_token != "" ? 1 : 0

  repository      = local.github_repo_name
  secret_name     = "GCP_WORKLOAD_IDENTITY_PROVIDER"
  plaintext_value = google_iam_workload_identity_pool_provider.github.name
}

resource "github_actions_secret" "gcp_service_account" {
  count = var.github_token != "" ? 1 : 0

  repository      = local.github_repo_name
  secret_name     = "GCP_SERVICE_ACCOUNT"
  plaintext_value = google_service_account.github_actions.email
}

# =============================================================================
# Local Variables
# =============================================================================

locals {
  # Extract repo name from "owner/repo" format
  github_repo_name = element(split("/", var.github_repo), 1)
}

