import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { useTheme } from '../../hooks/useTheme';
import { Theme } from '../../theme';
import { EngagementDatum } from '../../types/dashboard';
import { parseInputDate } from '../../utils/date';

interface EngagementChartProps {
  data: EngagementDatum[];
  onBarPress?: (datum: EngagementDatum) => void;
}

function formatDayMonth(raw: string): string {
  const d = parseInputDate(raw);
  if (!d) return raw;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

export function EngagementChart({ data, onBarPress }: EngagementChartProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const barData = useMemo(
    () =>
      data.map((datum) => ({
        value: datum.rate,
        label: formatDayMonth(datum.date),
        frontColor: theme.colors.chartPrimary,
        topLabelComponent: () => (
          <Text style={styles.valueLabel}>{datum.rate.toFixed(1)}%</Text>
        ),
        onPress: () => {
          onBarPress?.(datum);
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
    valueLabel: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: theme.spacing.xs,
    },
  });
