# IaC — Terraform (esqueleto)

Infraestrutura como código para os ambientes **dev** e **staging**.

> **Status Fase 1:** esqueleto apenas. Nenhum recurso é provisionado automaticamente nesta fase.

## Estrutura

```text
infra/terraform/
  modules/
    secrets/     # Placeholder do cofre de segredos
  environments/
    dev/         # Variáveis e backend do ambiente de desenvolvimento
    staging/     # Variáveis e backend do ambiente de staging
```

## Pré-requisitos (quando for provisionar)

1. Conta de nuvem configurada pelo Renato (F1-10).
2. Backend remoto do Terraform (S3 + DynamoDB ou equivalente).
3. Credenciais via variáveis de ambiente ou cofre — **nunca** no repositório.

## Uso futuro

```bash
cd infra/terraform/environments/dev
terraform init
terraform plan
# terraform apply  # somente com aprovação do Renato
```

## Cofre de segredos

O módulo `modules/secrets` documenta os segredos esperados:

- `DATABASE_URL`
- `REDIS_URL`
- `UAZAPI_ADMIN_TOKEN`
- Chaves S3, LiveKit, LLM, STT
- Credenciais APNs/FCM (Fase 6)

A implementação concreta depende da decisão Q20 (hospedagem/região).
