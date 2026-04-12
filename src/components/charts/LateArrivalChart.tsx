import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { useTheme } from '../../hooks/useTheme';
import { Theme } from '../../theme';
import { LateArrivalDatum } from '../../types/dashboard';
import { parseInputDate } from '../../utils/date';

interface LateArrivalChartProps {
  data: LateArrivalDatum[];
  onBarPress?: (
    datum: LateArrivalDatum,
    position: { x: number; y: number },
  ) => void;
}

function formatDayMonth(raw: string): string {
  const d = parseInputDate(raw);
  if (!d) return raw;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

function colorFor(theme: Theme, datum: LateArrivalDatum): string {
  if (datum.isInconsistent) return theme.colors.chartMuted;
  if (datum.percent > 60) return theme.colors.chartWarning;
  if (datum.percent >= 40) return theme.colors.chartPrimary;
  return theme.colors.chartNeutral;
}

export function LateArrivalChart({ data, onBarPress }: LateArrivalChartProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const barData = useMemo(
    () =>
      data.map((datum) => ({
        value: datum.percent,
        label: formatDayMonth(datum.date),
        frontColor: colorFor(theme, datum),
        topLabelComponent: () => (
          <Text style={styles.valueLabel}>{datum.percent.toFixed(1)}%</Text>
        ),
        onPress: (_item: unknown, _idx: number, x: number, y: number) => {
          onBarPress?.(datum, { x, y });
        },
      })),
    [data, theme, styles.valueLabel, onBarPress],
  );

  return (
    <View style={styles.container}>
      <BarChart
        data={barData}
        barWidth={22}
        spacing={18}
        initialSpacing={12}
        endSpacing={12}
        noOfSections={5}
        maxValue={100}
        yAxisTextStyle={styles.axisText}
        xAxisLabelTextStyle={styles.axisText}
        xAxisColor={theme.colors.chartAxis}
        yAxisColor={theme.colors.chartAxis}
        rulesColor={theme.colors.chartGrid}
        rulesType="dashed"
        showReferenceLine1
        referenceLine1Position={50}
        referenceLine1Config={{
          color: theme.colors.chartReferenceLine,
          dashWidth: 4,
          dashGap: 4,
          labelText: '50% de atraso',
          labelTextStyle: styles.referenceLabel,
        }}
        isAnimated
        animationDuration={400}
      />
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.sm,
    },
    axisText: {
      ...theme.typography.caption,
      color: theme.colors.chartAxis,
    },
    referenceLabel: {
      ...theme.typography.caption,
      color: theme.colors.chartAxis,
    },
    valueLabel: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: theme.spacing.xs,
    },
  });
