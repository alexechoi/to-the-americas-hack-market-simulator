# Input Variables for Terraform Configuration

variable "project_id" {
  description = "The unique identifier for the GCP project"
  type        = string
}

variable "project_name" {
  description = "The display name for the GCP project"
  type        = string
  default     = "Full Stack Super Template"
}

variable "region" {
  description = "The GCP region for resources"
  type        = string
  default     = "us-central1"
}

variable "billing_account" {
  description = "The billing account ID to associate with the project"
  type        = string
}

variable "github_repo" {
  description = "The GitHub repository in format 'owner/repo' for Workload Identity Federation"
  type        = string
}

variable "github_token" {
  description = "GitHub personal access token for setting repository secrets/variables. Requires 'repo' scope. Leave empty to skip GitHub configuration (you'll need to set secrets manually)."
  type        = string
  default     = ""
  sensitive   = true
}

# =============================================================================
# Firebase Auth - Google Sign-In Configuration
# =============================================================================
# To enable Google Sign-In via Terraform, provide OAuth client credentials.
# Create them in Google Cloud Console > APIs & Services > Credentials.
# Alternatively, configure Google Sign-In in the Firebase Console after deploy.

variable "oauth_client_id" {
  description = "Optional: Google OAuth client ID for Google Sign-In. Create in Google Cloud Console > APIs & Services > Credentials. Leave empty to configure Google Sign-In manually in Firebase Console."
  type        = string
  default     = ""
}

variable "oauth_client_secret" {
  description = "Optional: Google OAuth client secret. Required if oauth_client_id is provided."
  type        = string
  default     = ""
  sensitive   = true
}

# =============================================================================
# Firebase Auth - Apple Sign-In Configuration
# =============================================================================
# Apple Sign-In requires credentials from Apple Developer Console.
# To enable, provide all apple_* variables below.
#
# Setup steps:
# 1. Create an App ID with Sign In with Apple capability
# 2. Create a Services ID for web authentication
# 3. Create a Sign In with Apple key
# See: https://firebase.google.com/docs/auth/ios/apple

variable "apple_team_id" {
  description = "Apple Developer Team ID (found in Apple Developer account membership)"
  type        = string
  default     = ""
}

variable "apple_services_id" {
  description = "Apple Services ID (client_id) - create in Apple Developer Console > Identifiers > Services IDs"
  type        = string
  default     = ""
}

variable "apple_key_id" {
  description = "Apple Sign-In Key ID - create in Apple Developer Console > Keys"
  type        = string
  default     = ""
}

variable "apple_private_key" {
  description = "Apple Sign-In private key content (.p8 file contents)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "apple_bundle_id" {
  description = "Apple app bundle ID for iOS app (e.g., com.yourcompany.app)"
  type        = string
  default     = ""
}

# Expo Mobile App Configuration
variable "expo_ios_bundle_id" {
  description = "iOS Bundle ID for the Expo app (e.g., com.yourcompany.expoapp)"
  type        = string
  default     = ""
}

variable "expo_android_package_name" {
  description = "Android Package Name for the Expo app (e.g., com.yourcompany.expoapp)"
  type        = string
  default     = ""
}

# Push Notifications Configuration
variable "fcm_vapid_key" {
  description = "Firebase Cloud Messaging VAPID key for web push notifications. Generate in Firebase Console: Project Settings > Cloud Messaging > Web Push certificates"
  type        = string
  default     = ""
  sensitive   = true
}

# =============================================================================
# Frontend Deployment Platform
# =============================================================================

variable "frontend_platform" {
  description = "Platform to deploy the frontend. Options: 'cloudrun' (default), 'vercel', 'netlify'"
  type        = string
  default     = "cloudrun"

  validation {
    condition     = contains(["cloudrun", "vercel", "netlify"], var.frontend_platform)
    error_message = "frontend_platform must be one of: cloudrun, vercel, netlify"
  }
}

# Vercel Configuration (required if frontend_platform = "vercel")
variable "vercel_api_token" {
  description = "Vercel API token. Get from: https://vercel.com/account/tokens"
  type        = string
  default     = ""
  sensitive   = true
}

variable "vercel_org_id" {
  description = "Vercel organization/team ID. Find in Vercel dashboard settings."
  type        = string
  default     = ""
}

# Netlify Configuration (required if frontend_platform = "netlify")
variable "netlify_token" {
  description = "Netlify personal access token. Get from: https://app.netlify.com/user/applications#personal-access-tokens"
  type        = string
  default     = ""
  sensitive   = true
}

variable "netlify_site_id" {
  description = "Netlify Site ID. Create the site in the Netlify UI first, then find the ID in Site Settings > General > Site ID"
  type        = string
  default     = ""
}

variable "netlify_team_slug" {
  description = "Netlify team slug (from your Netlify team URL, e.g., app.netlify.com/teams/YOUR-TEAM-SLUG)"
  type        = string
  default     = ""
}

