import { View, Text, FlatList, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useCallback, useState, useMemo } from "react";
import { useFocusEffect } from "expo-router";
import { professorService } from "../../src/services/professorService";
import { Professor } from "../../src/types/professor";
import { useTheme } from "../../src/hooks/useTheme";
import { Theme } from "../../src/theme";
import { AnimatedPressable } from "../../src/components/AnimatedPressable";
import { FAB } from "../../src/components/FAB";
import { formatCpfDisplay } from "../../src/utils/cpf";
import { EmptyState } from "../../src/components/EmptyState";
import { SkeletonLoader } from "../../src/components/SkeletonLoader";
import { ErrorRetry } from "../../src/components/ErrorRetry";

export default function ProfessorsScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const router = useRouter();

  const loadProfessors = useCallback(async () => {
    try {
      setError(false);
      setLoading(true);
      const data = await professorService.getAllProfessors();
      setProfessors(data);
    } catch (err) {
      console.error("Error loading professors:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfessors();
    }, [loadProfessors]),
  );

  const renderItem = ({ item }: { item: Professor }) => (
    <AnimatedPressable
      onPress={() => router.push(`/professors/${item.id}` as any)}
      style={styles.professorItem}
    >
      <View>
        <Text style={styles.professorName}>{item.name}</Text>
        <Text style={styles.professorCpf}>
          CPF: {formatCpfDisplay(item.doc_id)}
        </Text>
      </View>
    </AnimatedPressable>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <SkeletonLoader count={4} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <ErrorRetry onRetry={loadProfessors} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={professors}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="Nenhum professor cadastrado"
            description="Cadastre um professor para associar às aulas"
            actionLabel="Cadastrar professor"
            onAction={() => router.push("/professors/new" as any)}
          />
        }
        contentContainerStyle={styles.listContent}
      />

      <FAB
        onPress={() => router.push("/professors/new" as any)}
        label="Novo Professor"
      />
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    listContent: {
      padding: theme.spacing.md,
    },
    professorItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.sm,
    },
    professorName: {
      ...theme.typography.body,
      fontWeight: "bold",
      color: theme.colors.text,
      marginBottom: theme.spacing.xs,
    },
    professorCpf: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
    },
  });
