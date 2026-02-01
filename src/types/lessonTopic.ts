export interface LessonTopic {
  id: string;
  series_id: string;
  title: string;
  suggested_date: string | null;
  sequence_order: number;
  created_at: string;
}

// Tipo expandido para exibição (com JOIN)
export interface LessonTopicWithSeries extends LessonTopic {
  series_code: string;
  series_title: string;
}
