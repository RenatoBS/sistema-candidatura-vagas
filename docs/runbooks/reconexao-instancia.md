# Runbook — reconexão da instância WhatsApp

1. `GET /interno/capacidade` mostra `instancia_desconectada` quando alguma instância não está `CONECTADA`.
2. A empresa abre o app e gera o QR de novo em WhatsApp da empresa.
3. Enquanto a instância está desconectada, os envios e retries daquela empresa ficam pausados. O contador de tentativas não anda.
4. As outras empresas seguem normais.
5. Depois do QR, o monitor volta a enviar a fila `AGENDADA` daquela empresa.
