# Terraform and Provider Configuration

terraform {
  required_version = ">= 1.0.0"

  required_providers {
    google-beta = {
      source  = "hashicorp/google-beta"
      version = ">= 5.0.0"
    }
    time = {
      source  = "hashicorp/time"
      version = ">= 0.9.0"
    }
    vercel = {
      source  = "vercel/vercel"
      version = "~> 5.0"
    }
    netlify = {
      source  = "netlify/netlify"
      version = ">= 0.2.0"
    }
    github = {
      source  = "integrations/github"
      version = ">= 6.0.0"
    }
  }
}

# =============================================================================
# Google Cloud Providers
# =============================================================================

# Default provider with user project override for quota billing
provider "google-beta" {
  user_project_override = true
}

# Provider without user project override for initial project creation
# Used before the project exists to accept quota checks
provider "google-beta" {
  alias                 = "no_user_project_override"
  user_project_override = false
}

# =============================================================================
# Vercel Provider (only used when frontend_platform = "vercel")
# =============================================================================

provider "vercel" {
  # API token from VERCEL_API_TOKEN env var or vercel_api_token variable
  api_token = var.vercel_api_token != "" ? var.vercel_api_token : null
  team      = var.vercel_org_id != "" ? var.vercel_org_id : null
}

# =============================================================================
# Netlify Provider (only used when frontend_platform = "netlify")
# =============================================================================

provider "netlify" {
  # Use a placeholder token when Netlify is not the selected platform to avoid
  # provider authentication errors. All Netlify resources use count = 0 when
  # frontend_platform != "netlify", so no actual API calls are made.
  token             = var.netlify_token != "" ? var.netlify_token : (var.frontend_platform != "netlify" ? "unused-placeholder" : null)
  default_team_slug = var.netlify_team_slug != "" ? var.netlify_team_slug : null
}

# =============================================================================
# GitHub Provider (for setting repository secrets/variables)
# =============================================================================

provider "github" {
  # Token from GITHUB_TOKEN env var or github_token variable
  token = var.github_token != "" ? var.github_token : null
  owner = local.github_owner
}

locals {
  # Extract owner from "owner/repo" format
  github_owner = element(split("/", var.github_repo), 0)
}

