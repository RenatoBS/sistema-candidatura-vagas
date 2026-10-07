import { useEffect } from 'react';

/**
 * Registra o token Expo quando expo-notifications estiver instalado.
 * A dependência nativa é opcional nesta fase: sem ela o hook é um no-op.
 */
export function useRegistroPush(apiUrl: string, accessToken: string | null): void {
  useEffect(() => {
    if (!accessToken) return;
    let ativo = true;
    // @ts-expect-error Dependência opcional; o app segue compilando sem o pacote nativo.
    void import('expo-notifications').then(async (Notifications) => {
      if (!ativo) return;
      const permissao = await Notifications.requestPermissionsAsync();
      if (permissao.status !== 'granted') return;
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      const plataforma = 'WEB';
      await fetch(`${apiUrl}/dispositivos-push`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ token, plataforma }),
      });
    }).catch(() => undefined);
    return () => { ativo = false; };
  }, [accessToken, apiUrl]);
}
