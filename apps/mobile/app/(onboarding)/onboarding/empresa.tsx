import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api, ErroApi } from '@/api/cliente';
import type { SessaoApp } from '@/auth/acesso';
import { useAuth } from '@/auth/AuthContext';
import { Banner } from '@/design-system/Banner';
import { Button } from '@/design-system/Button';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Campo } from '@/design-system/Campo';
import { Tela } from '@/design-system/Tela';

export default function CadastroEmpresaScreen() {
  const { t } = useTranslation();
  const { accessToken, entrar } = useAuth();
  const router = useRouter();
  const [razaoSocial, setRazao] = useState('');
  const [nomeFantasia, setFantasia] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [dominio, setDominio] = useState('');
  const [responsavelNome, setResponsavel] = useState('');
  const [responsavelEmail, setEmail] = useState('');
  const [erro, setErro] = useState('');

  async function enviar() {
    setErro('');
    try {
      await cadastrar();
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : t('comum.erro'));
    }
  }

  async function cadastrar() {
    const resposta = await api<{
      empresa: { id: string };
      sessao: { accessToken: string; refreshToken: string; perfil: SessaoApp };
    }>(
      '/empresas/cadastro',
      {
        method: 'POST',
        body: JSON.stringify({ razaoSocial, nomeFantasia, cnpj, dominio, responsavelNome, responsavelEmail }),
      },
      accessToken,
    );
    await entrar(
      { accessToken: resposta.sessao.accessToken, refreshToken: resposta.sessao.refreshToken },
      resposta.sessao.perfil,
    );
    router.replace('/empresa/verificacao');
  }

  return (
    <Tela teclado>
      <Cabecalho titulo={t('onboarding.empresa')} voltar />
      {erro ? <Banner tipo="erro" texto={erro} /> : null}
      <Campo label={t('empresa.razao')} value={razaoSocial} onChangeText={setRazao} />
      <Campo label={t('empresa.fantasia')} value={nomeFantasia} onChangeText={setFantasia} />
      <Campo label={t('empresa.cnpj')} value={cnpj} onChangeText={setCnpj} autoCapitalize="none" />
      <Campo label={t('empresa.dominio')} value={dominio} onChangeText={setDominio} autoCapitalize="none" />
      <Campo label={t('empresa.responsavel')} value={responsavelNome} onChangeText={setResponsavel} />
      <Campo
        label={t('empresa.emailResponsavel')}
        value={responsavelEmail}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <Button label={t('comum.enviar')} onPress={() => void enviar()} />
    </Tela>
  );
}
