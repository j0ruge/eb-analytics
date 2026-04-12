import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { useTheme } from '../../hooks/useTheme';
import { Theme } from '../../theme';
import { PunctualityDatum } from '../../types/dashboard';
import { parseInputDate } from '../../utils/date';

interface PunctualityChartProps {
  data: PunctualityDatum[];
  onBarPress?: (
    datum: PunctualityDatum,
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

function colorFor(theme: Theme, minutes: number): string {
  if (minutes < 0) return theme.colors.chartNeutral;
  if (minutes > 5) return theme.colors.chartWarning;
  return theme.colors.chartPrimary;
}

export function PunctualityChart({
  data,
  onBarPress,
}: PunctualityChartProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const barData = useMemo(
    () =>
      data.map((datum) => ({
        value: datum.minutesLate,
        label: formatDayMonth(datum.date),
        frontColor: colorFor(theme, datum.minutesLate),
        topLabelComponent: () => (
          <Text style={styles.valueLabel}>{`${datum.minutesLate}`}</Text>
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
        noOfSections={4}
        yAxisTextStyle={styles.axisText}
        xAxisLabelTextStyle={styles.axisText}
        xAxisColor={theme.colors.chartAxis}
        yAxisColor={theme.colors.chartAxis}
        rulesColor={theme.colors.chartGrid}
        rulesType="dashed"
        showReferenceLine1
        referenceLine1Position={5}
        referenceLine1Config={{
          color: theme.colors.chartReferenceLine,
          dashWidth: 4,
          dashGap: 4,
          labelText: '5 min',
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
