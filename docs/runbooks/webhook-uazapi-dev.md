# Runbook — webhook da Uazapi em desenvolvimento

A Uazapi precisa alcançar a API pela internet. Com a API em `localhost:3000`, abra um túnel e aponte `API_PUBLIC_URL` para ele.

1. Suba a API: `pnpm --filter @scv/api dev`.
2. Abra o túnel (uma das opções):
   - `cloudflared tunnel --url http://localhost:3000`
   - `ngrok http 3000`
3. Copie a URL pública (`https://....trycloudflare.com` ou `https://....ngrok-free.app`) para `API_PUBLIC_URL` no `.env` local e reinicie a API.
4. Defina `UAZAPI_WEBHOOK_SECRET` (qualquer valor longo e aleatório; é obrigatório quando `UAZAPI_*` está configurado).
5. Conecte a instância pelo app. O monitor registra o webhook como
   `<API_PUBLIC_URL>/api/v1/webhooks/whatsapp/uazapi/<instanciaId>?segredo=<UAZAPI_WEBHOOK_SECRET>`.
6. Se a URL do túnel mudar, atualize `API_PUBLIC_URL` e desconecte/reconecte a instância para re-registrar o webhook.

Fora de desenvolvimento a API **não sobe** com `API_PUBLIC_URL` apontando para `localhost`. Nunca cole o segredo em issues, PRs ou logs.
