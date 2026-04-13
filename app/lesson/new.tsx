import { useEffect, useCallback, useRef } from "react";
import { View, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { lessonService } from "../../src/services/lessonService";
import { useTheme } from "../../src/hooks/useTheme";
import { useAuth } from "../../src/hooks/useAuth";

export default function NewLessonScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user } = useAuth();
  const hasCreated = useRef(false);

  const handleCreate = useCallback(async () => {
    if (hasCreated.current) return;
    hasCreated.current = true;

    try {
      const newLesson = await lessonService.createLesson(undefined, user?.id ?? null);
      router.replace(`/lesson/${newLesson.id}`);
    } catch (error: any) {
      hasCreated.current = false;
      console.error("Failed to create lesson:", error);
      Alert.alert("Erro", error?.message || "Não foi possível criar a aula.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    }
  }, [router, user?.id]);

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
