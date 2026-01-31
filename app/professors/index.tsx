import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { professorService } from "../../src/services/professorService";
import { Professor } from "../../src/types/professor";
import { theme } from "../../src/theme";

export default function ProfessorsScreen() {
  const [professors, setProfessors] = useState<Professor[]>([]);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      loadProfessors();
    }, [])
  );

  async function loadProfessors() {
    const data = await professorService.getAllProfessors();
    setProfessors(data);
  }

  const renderItem = ({ item }: { item: Professor }) => (
    <TouchableOpacity
      style={styles.professorItem}
      onPress={() => router.push(`/professors/${item.id}` as any)}
    >
      <View>
        <Text style={styles.professorName}>{item.name}</Text>
        <Text style={styles.professorCpf}>CPF: {formatCpf(item.doc_id)}</Text>
      </View>
    </TouchableOpacity>
  );

  function formatCpf(cpf: string): string {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={professors}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Nenhum professor cadastrado.</Text>
        }
        contentContainerStyle={styles.listContent}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/professors/new" as any)}
      >
        <Text style={styles.fabText}>+ Novo Professor</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
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
    fontSize: 16,
    fontWeight: "bold",
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  professorCpf: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  emptyText: {
    textAlign: "center",
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xl,
  },
  fab: {
    position: "absolute",
    bottom: theme.spacing.lg,
    right: theme.spacing.lg,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
