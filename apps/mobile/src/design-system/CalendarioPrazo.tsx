import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, tipo, toque } from './tokens';
import {
  deslocarMes,
  diaPermitido,
  HORAS,
  hojeEmBrasilia,
  MINUTOS,
  montarPrazo,
  partesDoPrazo,
  semanasDoMes,
} from '@/vaga/prazo';


interface CalendarioPrazoProps {
  /** Prazo atual (`dd/mm/aaaa hh:mm`); vazio/incompleto abre no mês de hoje. */
  value: string;
  onChange: (prazo: string) => void;
}

function doisDigitos(valor: number): string {
  return String(valor).padStart(2, '0');
}

/** Calendário mensal + seletor de hora e minuto, sem módulo nativo (igual no web, iOS e Android). */
export function CalendarioPrazo({ value, onChange }: CalendarioPrazoProps) {
  const { t } = useTranslation();
  const hoje = hojeEmBrasilia();
  const atual = partesDoPrazo(value);
  const [visivel, setVisivel] = useState({ ano: atual?.ano ?? hoje.ano, mes: atual?.mes ?? hoje.mes });
  const [hora, setHora] = useState(atual?.hora ?? 23);
  const [minuto, setMinuto] = useState(atual?.minuto ?? 59);
  const meses = t('calendario.meses', { returnObjects: true }) as string[];
  const diasDaSemana = t('calendario.diasDaSemana', { returnObjects: true }) as string[];
  const podeVoltar = visivel.ano * 12 + visivel.mes > hoje.ano * 12 + hoje.mes;

  function escolherDia(dia: number) {
    onChange(montarPrazo({ ano: visivel.ano, mes: visivel.mes, dia, hora, minuto }));
  }

  function escolherHorario(novaHora: number, novoMinuto: number) {
    setHora(novaHora);
    setMinuto(novoMinuto);
    if (atual) onChange(montarPrazo({ ...atual, hora: novaHora, minuto: novoMinuto }));
  }

  return (
    <View style={styles.painel}>
      <View style={styles.cabecalho}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('calendario.mesAnterior')}
          disabled={!podeVoltar}
          onPress={() => setVisivel((v) => deslocarMes(v, -1))}
          style={[styles.seta, !podeVoltar ? styles.desabilitado : null]}
        >
          <Text style={styles.setaTexto}>‹</Text>
        </Pressable>
        <Text style={styles.mes} accessibilityRole="header">
          {meses[visivel.mes - 1]} {visivel.ano}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('calendario.proximoMes')}
          onPress={() => setVisivel((v) => deslocarMes(v, 1))}
          style={styles.seta}
        >
          <Text style={styles.setaTexto}>›</Text>
        </Pressable>
      </View>

      <View style={styles.linha}>
        {diasDaSemana.map((nome, indice) => (
          <Text key={`${nome}-${indice}`} style={styles.diaSemana}>
            {nome}
          </Text>
        ))}
      </View>
      {semanasDoMes(visivel.ano, visivel.mes).map((semana, indiceSemana) => (
        <View key={indiceSemana} style={styles.linha}>
          {semana.map((dia, indiceDia) => {
            if (dia === null) return <View key={indiceDia} style={styles.celula} />;
            const permitido = diaPermitido(visivel.ano, visivel.mes, dia, hoje);
            const selecionado = atual?.ano === visivel.ano && atual.mes === visivel.mes && atual.dia === dia;
            return (
              <Pressable
                key={indiceDia}
                accessibilityRole="button"
                accessibilityLabel={`${dia} ${meses[visivel.mes - 1]} ${visivel.ano}`}
                accessibilityState={{ disabled: !permitido, selected: selecionado }}
                disabled={!permitido}
                onPress={() => escolherDia(dia)}
                style={[styles.celula, styles.dia, selecionado ? styles.diaSelecionado : null]}
              >
                <Text style={[styles.diaTexto, !permitido ? styles.diaBloqueado : null, selecionado ? styles.diaTextoSelecionado : null]}>
                  {dia}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}

      <Text style={styles.rotulo}>{t('calendario.hora')}</Text>
      <View style={styles.opcoes} accessibilityRole="radiogroup" accessibilityLabel={t('calendario.hora')}>
        {HORAS.map((h) => (
          <Opcao key={h} rotulo={doisDigitos(h)} ativo={h === hora} onPress={() => escolherHorario(h, minuto)} />
        ))}
      </View>
      <Text style={styles.rotulo}>{t('calendario.minuto')}</Text>
      <View style={styles.opcoes} accessibilityRole="radiogroup" accessibilityLabel={t('calendario.minuto')}>
        {MINUTOS.map((m) => (
          <Opcao key={m} rotulo={doisDigitos(m)} ativo={m === minuto} onPress={() => escolherHorario(hora, m)} />
        ))}
      </View>
      <Text style={styles.resumo}>{atual ? t('calendario.escolhido', { prazo: montarPrazo(atual) }) : t('calendario.escolhaDia')}</Text>
    </View>
  );
}

function Opcao({ rotulo, ativo, onPress }: { rotulo: string; ativo: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: ativo, checked: ativo }}
      accessibilityLabel={rotulo}
      onPress={onPress}
      style={[styles.opcao, ativo ? styles.opcaoAtiva : null]}
    >
      <Text style={[styles.opcaoTexto, ativo ? styles.opcaoTextoAtivo : null]}>{rotulo}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  painel: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  cabecalho: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seta: { width: toque.minAltura, height: toque.minAltura, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  setaTexto: { ...tipo.secao, color: colors.primary },
  desabilitado: { opacity: 0.3 },
  mes: { ...tipo.destaque, color: colors.text },
  linha: { flexDirection: 'row' },
  diaSemana: { flex: 1, textAlign: 'center', ...tipo.legenda, color: colors.textMuted },
  celula: { flex: 1, aspectRatio: 1, margin: 1 },
  dia: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  diaSelecionado: { backgroundColor: colors.primary },
  diaTexto: { ...tipo.corpo, color: colors.text },
  diaBloqueado: { color: colors.textMuted, opacity: 0.35 },
  diaTextoSelecionado: { color: colors.onPrimary, fontWeight: '700' },
  rotulo: { ...tipo.legenda, color: colors.text, marginTop: spacing.sm },
  opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  opcao: { minWidth: 44, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm },
  opcaoAtiva: { backgroundColor: colors.primary, borderColor: colors.primary },
  opcaoTexto: { ...tipo.legenda, color: colors.text },
  opcaoTextoAtivo: { color: colors.onPrimary, fontWeight: '700' },
  resumo: { ...tipo.destaque, color: colors.text, marginTop: spacing.sm },
});
