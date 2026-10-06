# Placeholder do cofre de segredos.
# Implementação concreta será definida após a decisão Q20 (hospedagem/região).

variable "environment" {
  description = "Ambiente (dev, staging, production)"
  type        = string
}

variable "secret_names" {
  description = "Lista de nomes de segredos gerenciados"
  type        = list(string)
  default = [
    "DATABASE_URL",
    "REDIS_URL",
    "UAZAPI_ADMIN_TOKEN",
    "S3_ACCESS_KEY",
    "S3_SECRET_KEY",
    "LIVEKIT_API_KEY",
    "LIVEKIT_API_SECRET",
    "LLM_API_KEY",
    "STT_API_KEY",
  ]
}

output "secret_names" {
  description = "Nomes dos segredos esperados no cofre"
  value       = var.secret_names
}

output "environment" {
  value = var.environment
}
