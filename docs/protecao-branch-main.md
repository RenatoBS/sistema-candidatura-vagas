# Checklist — proteção da branch `main`

> **Responsável:** Renato (F1-09 / F1-10). Agentes **não** alteram settings do GitHub via API.

## Configuração recomendada no GitHub

Acesse: **Settings → Branches → Branch protection rules → Add rule** (branch: `main`)

### Regras obrigatórias

- [ ] **Require a pull request before merging**
  - [ ] Require approvals: **1** (Renato)
  - [ ] Dismiss stale pull request approvals when new commits are pushed
- [ ] **Require status checks to pass before merging**
  - [ ] `Lint, typecheck e testes`
  - [ ] `Migrações em banco efêmero`
  - [ ] `Build`
  - [ ] `Varredura de segredos`
- [ ] **Require branches to be up to date before merging**
- [ ] **Do not allow bypassing the above settings** (exceto para admins, se desejado)
- [ ] **Restrict who can push to matching branches** — apenas Renato (ou ninguém; merge só via PR)
- [ ] **Require linear history** (opcional, recomendado)

### Regras adicionais recomendadas

- [ ] **Require conversation resolution before merging**
- [ ] **Require signed commits** (opcional)
- [ ] Habilitar **Dependabot security updates**
- [ ] Habilitar **secret scanning** e **push protection** (GitHub Advanced Security, se disponível)

## Política de revisão (decisão I2)

- PRs de tarefas de agentes: **revisão cruzada** (outro agente) + **aprovação do Renato**.
- PRs pequenas de docs/config: apenas Renato (a critério dele).

## Verificação

Após configurar, abra um PR de teste e confirme que:

1. Merge direto em `main` é bloqueado.
2. CI precisa estar verde.
3. Aprovação do Renato é exigida.
