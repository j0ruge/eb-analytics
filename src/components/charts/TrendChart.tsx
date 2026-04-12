import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { useTheme } from '../../hooks/useTheme';
import { Theme } from '../../theme';
import { TrendDatum } from '../../types/dashboard';
import { parseInputDate } from '../../utils/date';

interface TrendChartProps {
  data: TrendDatum[];
  onPointPress?: (datum: TrendDatum) => void;
}

function formatDayMonth(raw: string): string {
  const d = parseInputDate(raw);
  if (!d) return raw;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

export function TrendChart({ data, onPointPress }: TrendChartProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const chartData = useMemo(
    () =>
      data.map((datum, idx) => ({
        value: datum.attendanceEnd,
        label: idx % 4 === 0 ? formatDayMonth(datum.date) : '',
        onPress: () => {
          onPointPress?.(datum);
        },
      })),
    [data, onPointPress],
  );

  return (
    <View style={styles.container}>
      <LineChart
        data={chartData}
        thickness={2}
        color={theme.colors.chartPrimary}
        dataPointsColor={theme.colors.chartPrimary}
        dataPointsRadius={3}
        xAxisColor={theme.colors.chartAxis}
        yAxisColor={theme.colors.chartAxis}
        yAxisTextStyle={styles.axisText}
        xAxisLabelTextStyle={styles.axisText}
        rulesColor={theme.colors.chartGrid}
        rulesType="dashed"
        initialSpacing={12}
        endSpacing={12}
        spacing={28}
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
  });
