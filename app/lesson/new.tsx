import { useEffect, useCallback, useRef, useMemo } from "react";
import { View, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { lessonService } from "../../src/services/lessonService";
import { useTheme } from "../../src/hooks/useTheme";
import { useAuth } from "../../src/hooks/useAuth";
import { Theme } from "../../src/theme";

export default function NewLessonScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { user } = useAuth();
  const hasCreated = useRef(false);

  const handleCreate = useCallback(async () => {
    if (hasCreated.current) return;
    hasCreated.current = true;

    try {
      const newLesson = await lessonService.createLesson(undefined, user?.id ?? null);
      router.replace(`/lesson/${newLesson.id}`);
    } catch (error: unknown) {
      hasCreated.current = false;
      console.error("Failed to create lesson:", error);
      Alert.alert(
        "Erro",
        error instanceof Error ? error.message : "Não foi possível criar a aula.",
        [{ text: "OK", onPress: () => router.back() }],
      );
    }
  }, [router, user?.id]);

  useEffect(() => {
    handleCreate();
  }, [handleCreate]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.background,
    },
  });
