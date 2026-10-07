import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api, ErroApi } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Banner } from '@/design-system/Banner';
import { Button } from '@/design-system/Button';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Campo } from '@/design-system/Campo';
import { Seletor } from '@/design-system/Seletor';
import { Tela } from '@/design-system/Tela';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { MODELOS_TRABALHO, SENIORIDADES, type ModeloTrabalho, type Senioridade } from '@/vaga/opcoes';

export default function NovaVagaScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { accessToken } = useAuth();
  const empresaId = useEmpresaAtiva();
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [senioridade, setSenioridade] = useState<Senioridade>('PLENO');
  const [modelo, setModelo] = useState<ModeloTrabalho>('REMOTO');
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
            prazoInscricoes: normalizarPrazo(prazo),
            habilidades: habilidade ? [{ nome: habilidade, nivelMinimo: 3, peso: 1, obrigatoria: true }] : [],
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
    <Tela teclado rodape={<Button label={t('vaga.salvar')} onPress={() => void salvar()} />}>
      <Cabecalho titulo={t('vaga.nova')} voltar />
      {erro ? <Banner tipo="erro" texto={erro} /> : null}
      <Campo label={t('vaga.titulo')} value={titulo} onChangeText={setTitulo} />
      <Campo label={t('vaga.descricao')} value={descricao} onChangeText={setDescricao} multiline />
      <Seletor
        label={t('vaga.senioridade')}
        valor={senioridade}
        onChange={setSenioridade}
        opcoes={SENIORIDADES.map((valor) => ({ valor, rotulo: t(`vaga.opcaoSenioridade.${valor}`) }))}
      />
      <Seletor
        label={t('vaga.modelo')}
        valor={modelo}
        onChange={setModelo}
        opcoes={MODELOS_TRABALHO.map((valor) => ({ valor, rotulo: t(`vaga.opcaoModelo.${valor}`) }))}
      />
      <Campo label={t('vaga.localidade')} value={localidade} onChangeText={setLocalidade} />
      <Campo label={t('vaga.prazo')} value={prazo} onChangeText={setPrazo} placeholder={t('vaga.prazoAjuda')} autoCapitalize="none" />
      <Campo label={t('vaga.habilidade')} value={habilidade} onChangeText={setHabilidade} />
    </Tela>
  );
}

/** Aceita também o formato brasileiro (dd/mm/aaaa [hh:mm]) e converte para AAAA-MM-DDTHH:mm. */
export function normalizarPrazo(valor: string): string | null {
  const texto = valor.trim();
  if (!texto) return null;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2}))?$/.exec(texto);
  if (!br) return texto;
  const [, dia, mes, ano, hora = '23', minuto = '59'] = br;
  return `${ano}-${mes}-${dia}T${hora}:${minuto}`;
}
