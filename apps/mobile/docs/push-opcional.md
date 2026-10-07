# Push opcional (F6-07)

`useRegistroPush` tenta carregar `expo-notifications` dinamicamente. Esta versão do app não inclui essa dependência nativa: sem ela, o hook não registra dispositivo e continua funcionando. Para ativar no cliente, instale/configure `expo-notifications` no projeto Expo e envie o token para `POST /dispositivos-push`.
