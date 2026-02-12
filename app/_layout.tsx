import { Stack } from "expo-router";
import { useEffect } from "react";
import { initializeDatabase } from "../src/db/client";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { useTheme } from "../src/hooks/useTheme";

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
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    initializeDatabase().catch((err) => console.error("DB Init Error:", err));
  }, []);

  return (
    <ThemeProvider>
      <RootStack />
    </ThemeProvider>
  );
}
