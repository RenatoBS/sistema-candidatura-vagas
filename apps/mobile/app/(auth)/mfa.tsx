import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text } from 'react-native';

import { api, ErroApi } from '@/api/cliente';
import { rotaInicial } from '@/auth/acesso';
import { useAuth } from '@/auth/AuthContext';
import { segredoDaUri, segredoEmGrupos } from '@/auth/mfa';
import { Banner } from '@/design-system/Banner';
import { Button } from '@/design-system/Button';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Campo } from '@/design-system/Campo';
import { Cartao } from '@/design-system/Cartao';
import { estilos } from '@/design-system/estilos';
import { Tela } from '@/design-system/Tela';
import { colors, tipo } from '@/design-system/tokens';

export default function MfaScreen() {
  const { t } = useTranslation();
  const { accessToken, entrar } = useAuth();
  const router = useRouter();
  const [uri, setUri] = useState('');
  const [codigo, setCodigo] = useState('');
  const [codigos, setCodigos] = useState<string[]>([]);
  const [erro, setErro] = useState('');

  function mensagem(falha: unknown): string {
    return falha instanceof ErroApi ? falha.message : t('comum.erro');
  }

  async function iniciar() {
    setErro('');
    try {
      const resposta = await api<{ otpauthUrl: string }>('/auth/mfa/iniciar', { method: 'POST' }, accessToken);
      setUri(resposta.otpauthUrl);
      setCodigos([]);
    } catch (falha) {
      setErro(mensagem(falha));
    }
  }

  async function confirmar() {
    setErro('');
    try {
      const resposta = await api<{ codigosRecuperacao: string[] }>(
        '/auth/mfa/confirmar',
        { method: 'POST', body: JSON.stringify({ codigo }) },
        accessToken,
      );
      setCodigos(resposta.codigosRecuperacao);
    } catch (falha) {
      setErro(mensagem(falha));
    }
  }

  async function verificar(depoisDeConfirmar = false) {
    setErro('');
    try {
      const tokens = await api<{ accessToken: string; refreshToken: string }>(
        '/auth/mfa/verificar',
        { method: 'POST', body: JSON.stringify({ codigo }) },
        accessToken,
      );
      const nova = await entrar(tokens);
      router.replace(rotaInicial(nova));
    } catch (falha) {
      if (depoisDeConfirmar) {
        setCodigo('');
        setErro(t('auth.mfaContinuarErro'));
      } else {
        setErro(mensagem(falha));
      }
    }
  }

  const segredo = uri ? segredoDaUri(uri) : null;
  const confirmado = codigos.length > 0;

  return (
    <Tela teclado>
      <Cabecalho titulo={t('auth.mfaTitulo')} voltar />
      {erro ? <Banner tipo="erro" texto={erro} /> : null}
      {confirmado ? (
        <>
          <Banner tipo="ok" texto={t('auth.mfaConfirmado')} />
          <Cartao>
            <Text style={estilos.corpo}>{t('auth.codigosRecuperacao')}</Text>
            {codigos.map((item) => (
              <Text key={item} selectable style={styles.codigo}>
                {item}
              </Text>
            ))}
          </Cartao>
          <Button label={t('comum.continuar')} onPress={() => void verificar(true)} />
          <Campo label={t('auth.codigo')} value={codigo} onChangeText={setCodigo} autoCapitalize="none" keyboardType="number-pad" />
          <Button label={t('auth.mfaVerificar')} variante="secundario" onPress={() => void verificar()} />
        </>
      ) : (
        <>
          <Button label={t('auth.mfaIniciar')} onPress={() => void iniciar()} />
          {uri ? (
            <Cartao>
              <Text style={estilos.corpo}>{t('auth.mfaInstrucao')}</Text>
              {segredo ? (
                <>
                  <Text style={estilos.legenda}>{t('auth.mfaSegredo')}</Text>
                  <Text selectable style={styles.codigo} accessibilityLabel={t('auth.mfaSegredo')}>
                    {segredoEmGrupos(segredo)}
                  </Text>
                </>
              ) : null}
              <Text style={estilos.legenda}>{t('auth.mfaUri')}</Text>
              <Text selectable style={estilos.mudo}>
                {uri}
              </Text>
            </Cartao>
          ) : null}
          <Campo label={t('auth.codigo')} value={codigo} onChangeText={setCodigo} autoCapitalize="none" keyboardType="number-pad" />
          {uri ? <Button label={t('auth.mfaConfirmar')} variante="secundario" onPress={() => void confirmar()} /> : null}
          <Button label={t('auth.mfaVerificar')} onPress={() => void verificar()} />
        </>
      )}
    </Tela>
  );
}

const styles = StyleSheet.create({
  codigo: { ...tipo.destaque, color: colors.text, fontFamily: Platform.select({ ios: 'Courier', default: 'monospace' }), letterSpacing: 1 },
});
