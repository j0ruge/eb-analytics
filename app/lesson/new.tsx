import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { lessonService } from '../../src/services/lessonService';
import { theme } from '../../src/theme';

export default function NewLessonScreen() {
  const router = useRouter();

  useEffect(() => {
    handleCreate();
  }, []);

  async function handleCreate() {
    try {
      const newLesson = await lessonService.createLesson();
      router.replace(`/lesson/${newLesson.id}`);
    } catch (error) {
      console.error('Failed to create lesson:', error);
      router.back();
    }
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );
}
