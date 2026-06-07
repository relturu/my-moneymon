import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import type { Session } from '@supabase/supabase-js';
import { useFonts } from 'expo-font';
import {
  Kanchenjunga_400Regular,
  Kanchenjunga_500Medium,
  Kanchenjunga_600SemiBold,
  Kanchenjunga_700Bold,
} from '@expo-google-fonts/kanchenjunga';

import { supabase } from '@/lib/supabase';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { NotifProvider } from '@/lib/notifications';
import SplashAnim from '@/components/splash-anim';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    Kanchenjunga_400Regular,
    Kanchenjunga_500Medium,
    Kanchenjunga_600SemiBold,
    Kanchenjunga_700Bold,
  });
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [splashDone, setSplashDone] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (loading || !splashDone || !fontsLoaded) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, loading, splashDone, fontsLoaded, segments]);

  return (
    <NotifProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        {!splashDone && <SplashAnim onDone={() => setSplashDone(true)} />}
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="toss" options={{ headerShown: false, presentation: 'card' }} />
          <Stack.Screen name="quests" options={{ headerShown: false, presentation: 'card' }} />
          <Stack.Screen name="fairy-log-detail" options={{ headerShown: false, presentation: 'card' }} />
          <Stack.Screen name="fairy-chat" options={{ headerShown: false, presentation: 'card' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </NotifProvider>
  );
}
