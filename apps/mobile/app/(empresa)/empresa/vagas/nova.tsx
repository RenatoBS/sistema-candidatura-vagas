import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { api, ErroApi } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Banner } from '@/design-system/Banner';
import { Button } from '@/design-system/Button';
import { Campo } from '@/design-system/Campo';
import { colors, spacing } from '@/design-system/tokens';

export default function NovaVagaScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { sessao, accessToken } = useAuth();
  const empresaId = sessao?.empresaAtivaId ?? sessao?.empresas[0]?.empresaId ?? '';
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [senioridade, setSenioridade] = useState('PLENO');
  const [modelo, setModelo] = useState('REMOTO');
  const [localidade, setLocalidade] = useState('');
  const [prazo, setPrazo] = useState('');
  const [habilidade, setHabilidade] = useState('');
  const [erro, setErro] = useState('');

  async function salvar() {
    setErro('');
    try {
      const criada = await api<{ id: string }>(
        `/empresas/${empresaId}/vagas`,
        {
          method: 'POST',
          body: JSON.stringify({
            titulo,
            descricao,
            senioridade,
            modelo,
            localidade: localidade || null,
            prazoInscricoes: prazo || null,
            habilidades: habilidade
              ? [{ nome: habilidade, nivelMinimo: 3, peso: 1, obrigatoria: true }]
              : [],
          }),
        },
        accessToken,
      );
      router.replace(`/empresa/vagas/${criada.id}`);
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : t('comum.erro'));
    }
  }

  return (
    <View style={styles.tela}>
      <Text style={styles.titulo}>{t('vaga.nova')}</Text>
      {erro ? <Banner tipo="erro" texto={erro} /> : null}
      <Campo label={t('vaga.titulo')} value={titulo} onChangeText={setTitulo} />
      <Campo label={t('vaga.descricao')} value={descricao} onChangeText={setDescricao} multiline />
      <Campo label={t('vaga.senioridade')} value={senioridade} onChangeText={setSenioridade} autoCapitalize="none" />
      <Campo label={t('vaga.modelo')} value={modelo} onChangeText={setModelo} autoCapitalize="none" />
      <Campo label={t('vaga.localidade')} value={localidade} onChangeText={setLocalidade} />
      <Campo label={t('vaga.prazo')} value={prazo} onChangeText={setPrazo} placeholder={t('vaga.prazoAjuda')} autoCapitalize="none" />
      <Campo label={t('vaga.habilidade')} value={habilidade} onChangeText={setHabilidade} />
      <View style={styles.acao}>
        <Button label={t('vaga.salvar')} onPress={() => void salvar()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  titulo: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  acao: { marginTop: spacing.md },
});
