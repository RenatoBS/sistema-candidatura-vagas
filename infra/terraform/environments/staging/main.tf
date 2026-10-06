terraform {
  required_version = ">= 1.5.0"

  # Backend remoto — configurar quando a conta de nuvem estiver pronta (F1-10).
  # backend "s3" {
  #   bucket = "scv-terraform-state-staging"
  #   key    = "staging/terraform.tfstate"
  #   region = "sa-east-1"
  # }
}

module "secrets" {
  source      = "../../modules/secrets"
  environment = "staging"
}

output "secrets_placeholder" {
  value = module.secrets.secret_names
}
