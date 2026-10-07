import { useState } from 'react';
import { useTranslation } from 'react-i18next';


import { Button } from './Button';
import { CalendarioPrazo } from './CalendarioPrazo';
import { Campo } from './Campo';
import { Seletor } from './Seletor';
import { ATALHOS_PRAZO_DIAS, mascararPrazo, prazoEmDias, problemaDoPrazo } from '@/vaga/prazo';

interface CampoPrazoProps {
  value: string;
  onChangeText: (valor: string) => void;
  /** Mostra a mensagem de erro do prazo (ex.: depois de tentar salvar). */
  validar?: boolean;
}

/** Prazo (horário de Brasília): calendário com seletor de hora, atalhos "em N dias" e digitação com máscara. */
export function CampoPrazo({ value, onChangeText, validar = false }: CampoPrazoProps) {
  const { t } = useTranslation();
  const [calendarioAberto, setCalendarioAberto] = useState(false);
  const problema = validar ? problemaDoPrazo(value) : null;
  const atalhoAtivo = ATALHOS_PRAZO_DIAS.find((dias) => prazoEmDias(dias) === value);
  return (
    <>
      <Seletor
        label={t('vaga.prazoAtalhos')}
        valor={atalhoAtivo ? String(atalhoAtivo) : ''}
        onChange={(dias) => onChangeText(prazoEmDias(Number(dias)))}
        opcoes={ATALHOS_PRAZO_DIAS.map((dias) => ({ valor: String(dias), rotulo: t('vaga.emDias', { n: dias }) }))}
      />
      <Campo
        label={t('vaga.prazo')}
        value={value}
        onChangeText={(texto) => onChangeText(mascararPrazo(texto))}
        placeholder={t('vaga.prazoAjuda')}
        autoCapitalize="none"
        keyboardType="number-pad"
        erro={problema ? t(`vaga.prazoProblema.${problema}`) : undefined}
      />
      <Button
        label={calendarioAberto ? t('calendario.fechar') : t('calendario.abrir')}
        variante="secundario"
        onPress={() => setCalendarioAberto((aberto) => !aberto)}
      />
      {calendarioAberto ? <CalendarioPrazo value={value} onChange={onChangeText} /> : null}
    </>
  );
}
