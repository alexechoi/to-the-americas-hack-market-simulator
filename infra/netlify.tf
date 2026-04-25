# Netlify Deployment Configuration
# Manages environment variables for a Netlify site
# Only used when frontend_platform = "netlify"
#
# PREREQUISITE: Create the Netlify site manually in the Netlify UI first:
#   1. Go to https://app.netlify.com and create a new site
#   2. Connect it to your GitHub repo (frontend directory)
#   3. Copy the Site ID from Site Settings > General > Site ID
#   4. Set netlify_site_id in terraform.tfvars
#
# Terraform will then manage environment variables for the site.

# =============================================================================
# Netlify Site (Data Source - references existing site)
# =============================================================================

data "netlify_site" "frontend" {
  count = var.frontend_platform == "netlify" ? 1 : 0

  id = var.netlify_site_id
}

# =============================================================================
# Environment Variables
# =============================================================================

resource "netlify_environment_variable" "api_url" {
  count = var.frontend_platform == "netlify" ? 1 : 0

  site_id = data.netlify_site.frontend[0].id
  key     = "NEXT_PUBLIC_API_URL"
  scopes  = ["builds", "functions", "runtime"]

  values = [{
    value   = google_cloud_run_v2_service.backend.uri
    context = "all"
  }]
}

resource "netlify_environment_variable" "firebase_api_key" {
  count = var.frontend_platform == "netlify" ? 1 : 0

  site_id = data.netlify_site.frontend[0].id
  key     = "NEXT_PUBLIC_FIREBASE_API_KEY"
  scopes  = ["builds", "functions", "runtime"]

  values = [{
    value   = data.google_firebase_web_app_config.default.api_key
    context = "all"
  }]
}

resource "netlify_environment_variable" "firebase_auth_domain" {
  count = var.frontend_platform == "netlify" ? 1 : 0

  site_id = data.netlify_site.frontend[0].id
  key     = "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"
  scopes  = ["builds", "functions", "runtime"]

  values = [{
    value   = data.google_firebase_web_app_config.default.auth_domain
    context = "all"
  }]
}

resource "netlify_environment_variable" "firebase_project_id" {
  count = var.frontend_platform == "netlify" ? 1 : 0

  site_id = data.netlify_site.frontend[0].id
  key     = "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
  scopes  = ["builds", "functions", "runtime"]

  values = [{
    value   = var.project_id
    context = "all"
  }]
}

resource "netlify_environment_variable" "firebase_storage_bucket" {
  count = var.frontend_platform == "netlify" ? 1 : 0

  site_id = data.netlify_site.frontend[0].id
  key     = "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"
  scopes  = ["builds", "functions", "runtime"]

  values = [{
    value   = data.google_firebase_web_app_config.default.storage_bucket
    context = "all"
  }]
}

resource "netlify_environment_variable" "firebase_messaging_sender_id" {
  count = var.frontend_platform == "netlify" ? 1 : 0

  site_id = data.netlify_site.frontend[0].id
  key     = "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"
  scopes  = ["builds", "functions", "runtime"]

  values = [{
    value   = data.google_firebase_web_app_config.default.messaging_sender_id
    context = "all"
  }]
}

resource "netlify_environment_variable" "firebase_app_id" {
  count = var.frontend_platform == "netlify" ? 1 : 0

  site_id = data.netlify_site.frontend[0].id
  key     = "NEXT_PUBLIC_FIREBASE_APP_ID"
  scopes  = ["builds", "functions", "runtime"]

  values = [{
    value   = google_firebase_web_app.default.app_id
    context = "all"
  }]
}

# Firebase service account for API route token verification (sensitive)
resource "netlify_environment_variable" "firebase_service_account" {
  count = var.frontend_platform == "netlify" ? 1 : 0

  site_id = data.netlify_site.frontend[0].id
  key     = "FIREBASE_SERVICE_ACCOUNT_JSON"
  scopes  = ["builds", "functions", "runtime"]

  values = [{
    value   = base64decode(google_service_account_key.firebase_admin.private_key)
    context = "all"
  }]
}

# VAPID key for push notifications (if configured)
resource "netlify_environment_variable" "vapid_key" {
  count = var.frontend_platform == "netlify" && var.fcm_vapid_key != "" ? 1 : 0

  site_id = data.netlify_site.frontend[0].id
  key     = "NEXT_PUBLIC_FIREBASE_VAPID_KEY"
  scopes  = ["builds", "functions", "runtime"]

  values = [{
    value   = var.fcm_vapid_key
    context = "all"
  }]
}

