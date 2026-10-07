import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { executarAcaoAdmin, type CaminhoAcaoAdmin } from '@/admin/acao-admin';
import { validarAcaoAdmin } from '@/admin/regras';
import { ErroApi } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';

/** Fluxo compartilhado das ações de moderação: senha só na reautenticação, motivo só na ação. */
export function useAcaoAdmin(aoConcluir: () => Promise<unknown>) {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [senha, setSenha] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function executar(empresaId: string, caminho: CaminhoAcaoAdmin) {
    setErro('');
    setSucesso('');
    const problema = validarAcaoAdmin(caminho, senha, motivo);
    if (problema) {
      setErro(problema === 'senha' ? t('admin.senhaObrigatoria') : t('admin.motivoObrigatorio'));
      return;
    }
    setOcupado(true);
    try {
      await executarAcaoAdmin({ empresaId, caminho, senha, motivo, accessToken });
      setSenha('');
      setMotivo('');
      setSucesso(t('admin.acaoConcluida'));
      await aoConcluir();
    } catch (falha) {
      setErro(falha instanceof ErroApi && falha.status < 500 ? falha.message : t('admin.acaoErro'));
    } finally {
      setOcupado(false);
    }
  }

  return { senha, setSenha, motivo, setMotivo, erro, sucesso, ocupado, executar };
}
