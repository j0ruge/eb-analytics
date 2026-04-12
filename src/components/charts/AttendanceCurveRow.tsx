import React, { useCallback, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { useTheme } from '../../hooks/useTheme';
import { Theme } from '../../theme';
import { AttendanceCurveDatum } from '../../types/dashboard';
import { formatDayMonth } from '../../utils/date';

interface AttendanceCurveRowProps {
  data: AttendanceCurveDatum[];
  onPointPress?: (datum: AttendanceCurveDatum, pointIndex: 0 | 1 | 2) => void;
}

const POINT_LABELS = ['Início', 'Meio', 'Fim'] as const;

export function AttendanceCurveRow({
  data,
  onPointPress,
}: AttendanceCurveRowProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const renderItem = useCallback(({ item: datum }: { item: AttendanceCurveDatum }) => {
    const points: Array<{
      value: number;
      label: string;
      index: 0 | 1 | 2;
    }> = [];
    if (datum.start !== null)
      points.push({ value: datum.start, label: POINT_LABELS[0], index: 0 });
    if (datum.mid !== null)
      points.push({ value: datum.mid, label: POINT_LABELS[1], index: 1 });
    if (datum.end !== null)
      points.push({ value: datum.end, label: POINT_LABELS[2], index: 2 });

    const chartData = points.map((p) => ({
      value: p.value,
      label: p.label,
      onPress: () => {
        onPointPress?.(datum, p.index);
      },
    }));

    return (
      <View style={styles.card}>
        <LineChart
          data={chartData}
          height={120}
          width={140}
          initialSpacing={10}
          endSpacing={10}
          spacing={50}
          thickness={2}
          color={theme.colors.chartPrimary}
          dataPointsColor={theme.colors.chartPrimary}
          dataPointsRadius={4}
          xAxisColor={theme.colors.chartAxis}
          yAxisColor={theme.colors.chartAxis}
          yAxisTextStyle={styles.axisText}
          xAxisLabelTextStyle={styles.axisText}
          rulesColor={theme.colors.chartGrid}
          rulesType="dashed"
          hideYAxisText={false}
          isAnimated
          animationDuration={400}
        />
        <Text style={styles.dateLabel}>{formatDayMonth(datum.date)}</Text>
        <Text style={styles.topicLabel} numberOfLines={1}>
          {datum.topicTitle ?? 'Sem tópico'}
        </Text>
      </View>
    );
  }, [onPointPress, styles, theme.colors]);

  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      data={data}
      keyExtractor={(item) => item.lessonId}
      renderItem={renderItem}
    />
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    scrollContent: {
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.xs,
    },
    card: {
      width: 170,
      marginRight: theme.spacing.md,
      alignItems: 'center',
    },
    axisText: {
      ...theme.typography.caption,
      color: theme.colors.chartAxis,
    },
    dateLabel: {
      ...theme.typography.caption,
      color: theme.colors.text,
      marginTop: theme.spacing.sm,
      fontWeight: '600',
    },
    topicLabel: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      maxWidth: 160,
    },
  });
