import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';

import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme';
import { dashboardService } from '../../src/services/dashboardService';
import { useChartCardState } from '../../src/hooks/useChartCardState';
import { ChartCard } from '../../src/components/charts/ChartCard';
import { ChartTooltip } from '../../src/components/charts/ChartTooltip';
import { DashboardEmptyState } from '../../src/components/charts/DashboardEmptyState';
import { LateArrivalChart } from '../../src/components/charts/LateArrivalChart';
import { AttendanceCurveRow } from '../../src/components/charts/AttendanceCurveRow';
import { TrendChart } from '../../src/components/charts/TrendChart';
import { PunctualityChart } from '../../src/components/charts/PunctualityChart';
import { EngagementChart } from '../../src/components/charts/EngagementChart';
import { formatDayMonth } from '../../src/utils/date';

interface TooltipState {
  lessonId: string;
  lines: string[];
  anchorX: number;
  anchorY: number;
}

function pluralExcluded(count: number): string {
  if (count === 1) return '1 aula excluída por dados incompletos';
  return `${count} aulas excluídas por dados incompletos`;
}

export default function DashboardScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();

  const lateArrival = useChartCardState(
    useCallback(() => dashboardService.getLateArrivalIndex(), []),
  );
  const curves = useChartCardState(
    useCallback(() => dashboardService.getAttendanceCurves(), []),
  );
  const trend = useChartCardState(
    useCallback(() => dashboardService.getAttendanceTrend(), []),
  );
  const punctuality = useChartCardState(
    useCallback(() => dashboardService.getPunctuality(), []),
  );
  const engagement = useChartCardState(
    useCallback(() => dashboardService.getEngagementRate(), []),
  );

  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const lateArrivalChartRef = useRef<View>(null);
  const curvesChartRef = useRef<View>(null);
  const trendChartRef = useRef<View>(null);
  const punctualityChartRef = useRef<View>(null);
  const engagementChartRef = useRef<View>(null);

  useFocusEffect(
    useCallback(() => {
      lateArrival.reload();
      curves.reload();
      trend.reload();
      punctuality.reload();
      engagement.reload();
    }, [
      lateArrival.reload,
      curves.reload,
      trend.reload,
      punctuality.reload,
      engagement.reload,
    ]),
  );

  const openTooltip = useCallback(
    (
      ref: React.RefObject<View | null>,
      lessonId: string,
      lines: string[],
    ) => {
      ref.current?.measureInWindow((x, y, width) => {
        setTooltip({
          lessonId,
          lines,
          anchorX: x + width / 2,
          anchorY: y + 24,
        });
      });
    },
    [],
  );

  const closeTooltip = useCallback(() => setTooltip(null), []);
  const openLesson = useCallback(() => {
    if (!tooltip) return;
    const lessonId = tooltip.lessonId;
    setTooltip(null);
    router.push(`/lesson/${lessonId}`);
  }, [tooltip, router]);

  const lateArrivalAccessibility = useMemo(() => {
    if (lateArrival.status === 'error') {
      return 'Erro ao carregar Índice de Chegada Tardia. Toque em Tentar novamente para recarregar.';
    }
    if (lateArrival.status !== 'success' || lateArrival.data.length === 0) {
      return 'Índice de Chegada Tardia';
    }
    const avg =
      lateArrival.data.reduce((sum, d) => sum + d.percent, 0) /
      lateArrival.data.length;
    return `Índice de Chegada Tardia das últimas ${lateArrival.data.length} aulas, média ${avg.toFixed(1)}%`;
  }, [lateArrival.status, lateArrival.data]);

  const curvesAccessibility = useMemo(() => {
    if (curves.status === 'error') {
      return 'Erro ao carregar Curva de Presença. Toque em Tentar novamente para recarregar.';
    }
    return `Curva de Presença por Aula. ${curves.data.length} aulas.`;
  }, [curves.status, curves.data.length]);

  const trendAccessibility = useMemo(() => {
    if (trend.status === 'error') {
      return 'Erro ao carregar Tendência de Presença. Toque em Tentar novamente para recarregar.';
    }
    if (trend.status !== 'success' || trend.data.length === 0) {
      return 'Tendência de Presença Final';
    }
    const avg =
      trend.data.reduce((sum, d) => sum + d.attendanceEnd, 0) /
      trend.data.length;
    return `Tendência de Presença Final das últimas ${trend.data.length} aulas, média ${avg.toFixed(1)} pessoas`;
  }, [trend.status, trend.data]);

  const punctualityAccessibility = useMemo(() => {
    if (punctuality.status === 'error') {
      return 'Erro ao carregar Pontualidade. Toque em Tentar novamente para recarregar.';
    }
    if (punctuality.status !== 'success' || punctuality.data.length === 0) {
      return 'Pontualidade do Início';
    }
    const avg =
      punctuality.data.reduce((sum, d) => sum + d.minutesLate, 0) /
      punctuality.data.length;
    return `Pontualidade das últimas ${punctuality.data.length} aulas, média ${avg.toFixed(1)} minutos`;
  }, [punctuality.status, punctuality.data]);

  const engagementAccessibility = useMemo(() => {
    if (engagement.status === 'error') {
      return 'Erro ao carregar Taxa de Engajamento. Toque em Tentar novamente para recarregar.';
    }
    if (engagement.status !== 'success' || engagement.data.length === 0) {
      return 'Taxa de Engajamento';
    }
    const avg =
      engagement.data.reduce((sum, d) => sum + d.rate, 0) /
      engagement.data.length;
    return `Taxa de Engajamento das últimas ${engagement.data.length} aulas, média ${avg.toFixed(1)}%`;
  }, [engagement.status, engagement.data]);

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <ChartCard
          title="Índice de Chegada Tardia"
          subtitlePrefix="% de pessoas que chegaram depois do início"
          status={lateArrival.status}
          count={lateArrival.data.length}
          errorMessage={lateArrival.errorMessage ?? undefined}
          onRetry={lateArrival.reload}
          footnote={
            lateArrival.excludedCount > 0
              ? pluralExcluded(lateArrival.excludedCount)
              : undefined
          }
          accessibilityLabel={lateArrivalAccessibility}
        >
          {lateArrival.data.length >= 2 ? (
            <View ref={lateArrivalChartRef} collapsable={false}>
              <LateArrivalChart
                data={lateArrival.data}
                onBarPress={(datum) =>
                  openTooltip(lateArrivalChartRef, datum.lessonId, [
                    formatDayMonth(datum.date),
                    `Início: ${datum.attendanceStart}`,
                    `Fim: ${datum.attendanceEnd}`,
                    `Atrasaram: ${datum.lateCount} (${datum.percent.toFixed(1)}%)`,
                  ])
                }
              />
            </View>
          ) : (
            <DashboardEmptyState message="Coleta pelo menos 2 aulas para ver seu primeiro gráfico" />
          )}
        </ChartCard>

        <ChartCard
          title="Curva de Presença por Aula"
          subtitlePrefix="Como a turma chega, fica e sai"
          status={curves.status}
          count={curves.data.length}
          errorMessage={curves.errorMessage ?? undefined}
          onRetry={curves.reload}
          accessibilityLabel={curvesAccessibility}
        >
          {curves.data.length >= 1 ? (
            <View ref={curvesChartRef} collapsable={false}>
              <AttendanceCurveRow
                data={curves.data}
                onPointPress={(datum, pointIndex) => {
                  const labels = ['Início', 'Meio', 'Fim'] as const;
                  const values = [datum.start, datum.mid, datum.end];
                  openTooltip(curvesChartRef, datum.lessonId, [
                    formatDayMonth(datum.date),
                    datum.topicTitle ?? 'Sem tópico',
                    `${labels[pointIndex]}: ${values[pointIndex] ?? '—'}`,
                  ]);
                }}
              />
            </View>
          ) : (
            <DashboardEmptyState message="Nenhuma aula com contagens suficientes ainda" />
          )}
        </ChartCard>

        <ChartCard
          title="Tendência de Presença Final"
          subtitlePrefix="A turma está crescendo, estável ou diminuindo?"
          status={trend.status}
          count={trend.data.length}
          errorMessage={trend.errorMessage ?? undefined}
          onRetry={trend.reload}
          accessibilityLabel={trendAccessibility}
        >
          {trend.data.length >= 2 ? (
            <View ref={trendChartRef} collapsable={false}>
              <TrendChart
                data={trend.data}
                onPointPress={(datum) =>
                  openTooltip(trendChartRef, datum.lessonId, [
                    formatDayMonth(datum.date),
                    `Presença final: ${datum.attendanceEnd}`,
                  ])
                }
              />
            </View>
          ) : (
            <DashboardEmptyState message="Coleta pelo menos 2 aulas para ver a tendência" />
          )}
        </ChartCard>

        <ChartCard
          title="Pontualidade do Início"
          subtitlePrefix="Quantos minutos depois das 10:00 a aula começou"
          status={punctuality.status}
          count={punctuality.data.length}
          errorMessage={punctuality.errorMessage ?? undefined}
          onRetry={punctuality.reload}
          accessibilityLabel={punctualityAccessibility}
        >
          {punctuality.data.length >= 2 ? (
            <View ref={punctualityChartRef} collapsable={false}>
              <PunctualityChart
                data={punctuality.data}
                onBarPress={(datum) =>
                  openTooltip(punctualityChartRef, datum.lessonId, [
                    formatDayMonth(datum.date),
                    `Atraso: ${datum.minutesLate} min`,
                  ])
                }
              />
            </View>
          ) : (
            <DashboardEmptyState message="Coleta pelo menos 2 aulas para ver a pontualidade" />
          )}
        </ChartCard>

        <ChartCard
          title="Taxa de Engajamento"
          subtitlePrefix="Quantos participaram em relação à turma total"
          status={engagement.status}
          count={engagement.data.length}
          errorMessage={engagement.errorMessage ?? undefined}
          onRetry={engagement.reload}
          accessibilityLabel={engagementAccessibility}
        >
          {engagement.data.length >= 1 ? (
            <View ref={engagementChartRef} collapsable={false}>
              <EngagementChart
                data={engagement.data}
                onBarPress={(datum) =>
                  openTooltip(engagementChartRef, datum.lessonId, [
                    formatDayMonth(datum.date),
                    `Participantes únicos: ${datum.uniqueParticipants}`,
                    `Presença final: ${datum.attendanceEnd}`,
                    `Engajamento: ${datum.rate.toFixed(1)}%`,
                  ])
                }
              />
            </View>
          ) : (
            <DashboardEmptyState message="Nenhuma aula com engajamento ainda" />
          )}
        </ChartCard>
      </ScrollView>

      <ChartTooltip
        visible={tooltip !== null}
        anchorX={tooltip?.anchorX ?? 0}
        anchorY={tooltip?.anchorY ?? 0}
        lines={tooltip?.lines ?? []}
        onDismiss={closeTooltip}
        onViewLesson={openLesson}
      />
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingVertical: theme.spacing.md,
    },
  });
