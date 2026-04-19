import { Stack } from "expo-router";
import { useEffect } from "react";
import { initializeDatabase } from "../src/db/client";
import { AuthProvider } from "../src/contexts/AuthProvider";
import { SyncProvider } from "../src/contexts/SyncProvider";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { useTheme } from "../src/hooks/useTheme";
import { registerE2EHarness } from "../src/testing/e2eHarness";

function RootStack() {
  const { theme } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.primary,
        },
        headerTintColor: theme.colors.background,
        headerTitleStyle: {
          fontWeight: "bold",
        },
        contentStyle: {
          backgroundColor: theme.colors.background,
        },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="lesson/new" options={{ title: "Nova Aula" }} />
      <Stack.Screen
        name="lesson/[id]"
        options={{ title: "Detalhes da Aula" }}
      />
      <Stack.Screen
        name="professors/new"
        options={{ title: "Novo Professor" }}
      />
      <Stack.Screen
        name="professors/[id]"
        options={{ title: "Editar Professor" }}
      />
      <Stack.Screen name="series/new" options={{ title: "Nova Série" }} />
      <Stack.Screen
        name="series/[id]"
        options={{ title: "Detalhes da Série" }}
      />
      <Stack.Screen name="topics/new" options={{ title: "Novo Tópico" }} />
      <Stack.Screen
        name="topics/[id]"
        options={{ title: "Detalhes do Tópico" }}
      />
      <Stack.Screen name="settings" options={{ title: "Configurações" }} />
      <Stack.Screen name="login" options={{ title: "Entrar" }} />
      <Stack.Screen name="register" options={{ title: "Criar Conta" }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    initializeDatabase()
      .then(() => registerE2EHarness())
      .catch((err) => console.error("DB Init Error:", err));
  }, []);

  return (
    <AuthProvider>
      <SyncProvider>
        <ThemeProvider>
          <RootStack />
        </ThemeProvider>
      </SyncProvider>
    </AuthProvider>
  );
}
