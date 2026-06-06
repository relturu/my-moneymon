import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { User, FountainUpgrade } from '@/types/database';

export default function FountainScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [user, setUser] = useState<User | null>(null);
  const [currentLevel, setCurrentLevel] = useState<FountainUpgrade | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();
      setUser(profile);

      if (profile) {
        const { data: level } = await supabase
          .from('fountain_upgrades')
          .select('*')
          .eq('level', profile.fountain_level)
          .single();
        setCurrentLevel(level);
      }
    }
    load();
  }, []);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}>

        {/* Coin bar */}
        <View style={[styles.coinBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.coinText, { color: colors.coin }]}>
            ✦ {user?.coin_balance ?? 0} coins
          </Text>
        </View>

        {/* Fountain */}
        <View style={styles.fountainSection}>
          <Text style={styles.fountainEmoji}>🌊</Text>
          <Text style={[styles.fountainName, { color: colors.text }]}>
            {currentLevel?.name ?? 'The Fountain'}
          </Text>
          <Text style={[styles.fountainDesc, { color: colors.icon }]}>
            {currentLevel?.description ?? ''}
          </Text>
          <Text style={[styles.xpText, { color: colors.tint }]}>
            XP: {user?.fountain_xp ?? 0} / {currentLevel?.xp_required ?? '—'}
          </Text>
        </View>

        {/* Fairy slots */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Fairy Visits</Text>
          <Text style={[styles.cardBody, { color: colors.icon }]}>
            {currentLevel
              ? `${currentLevel.fairy_slots} slot${currentLevel.fairy_slots > 1 ? 's' : ''} available`
              : '—'}
          </Text>
          <Text style={[styles.cardHint, { color: colors.icon }]}>
            No fairies visiting right now
          </Text>
        </View>

        {/* Toss button */}
        <TouchableOpacity
          style={[styles.tossButton, { backgroundColor: colors.tint }]}
          onPress={() => {}}>
          <Text style={styles.tossButtonText}>✦ Toss Coins</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  content: { padding: 20, gap: 16 },
  coinBar: {
    borderRadius: 12, borderWidth: 1,
    padding: 12, alignItems: 'center',
  },
  coinText: { fontSize: 18, fontWeight: '700' },
  fountainSection: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  fountainEmoji: { fontSize: 72 },
  fountainName: { fontSize: 22, fontWeight: '700', marginTop: 8 },
  fountainDesc: { fontSize: 14, textAlign: 'center' },
  xpText: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 6 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardBody: { fontSize: 14 },
  cardHint: { fontSize: 13 },
  tossButton: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  tossButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
