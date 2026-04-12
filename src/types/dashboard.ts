export const DASHBOARD_LIMITS = {
  timeSeries: 12,
  trend: 26,
} as const;

export type ChartCardStatus = 'loading' | 'success' | 'error';

export interface DashboardResult<T> {
  data: T[];
  excludedCount: number;
}

export interface LateArrivalDatum {
  lessonId: string;
  date: string;
  percent: number;
  attendanceStart: number;
  attendanceEnd: number;
  lateCount: number;
  isInconsistent: boolean;
}

export interface AttendanceCurveDatum {
  lessonId: string;
  date: string;
  topicTitle: string | null;
  start: number | null;
  mid: number | null;
  end: number | null;
}

export interface TrendDatum {
  lessonId: string;
  date: string;
  attendanceEnd: number;
}

export interface PunctualityDatum {
  lessonId: string;
  date: string;
  minutesLate: number;
}

export interface EngagementDatum {
  lessonId: string;
  date: string;
  rate: number;
  uniqueParticipants: number;
  attendanceEnd: number;
}
