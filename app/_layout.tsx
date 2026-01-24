import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { initializeDatabase } from '../src/db/client';
import { TouchableOpacity, Text } from 'react-native';
import { theme } from '../src/theme';

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    initializeDatabase().catch(err => console.error('DB Init Error:', err));
  }, []);

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#007AFF',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen 
        name="index" 
        options={{
          title: 'EBD Insights',
          headerRight: () => (
            <TouchableOpacity onPress={() => router.push('/sync')}>
              <Text style={{ color: '#fff', fontWeight: 'bold', marginRight: 10 }}>Sinc</Text>
            </TouchableOpacity>
          )
        }} 
      />
      <Stack.Screen name="lesson/new" options={{ title: 'Nova Aula' }} />
      <Stack.Screen name="lesson/[id]" options={{ title: 'Detalhes da Aula' }} />
      <Stack.Screen name="sync/index" options={{ title: 'Sincronizar' }} />
    </Stack>
  );
}
