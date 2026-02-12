import { useEffect, useCallback } from "react";
import { View, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { lessonService } from "../../src/services/lessonService";
import { useTheme } from "../../src/hooks/useTheme";

export default function NewLessonScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  const handleCreate = useCallback(async () => {
    try {
      const newLesson = await lessonService.createLesson();
      router.replace(`/lesson/${newLesson.id}`);
    } catch (error: any) {
      console.error("Failed to create lesson:", error);
      Alert.alert("Erro", error?.message || "Não foi possível criar a aula.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    }
  }, [router]);

  useEffect(() => {
    handleCreate();
  }, [handleCreate]);

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: theme.colors.background,
      }}
    >
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );
}
