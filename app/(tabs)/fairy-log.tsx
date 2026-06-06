import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { FairyDefinition, UserFairyCollection } from '@/types/database';

type FairyEntry = FairyDefinition & {
  discovered: boolean;
  collection: UserFairyCollection | null;
};

const RARITY_STARS: Record<string, string> = {
  common: '★',
  uncommon: '★★',
  rare: '★★★',
  legendary: '★★★★',
};

export default function FairyLogScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [fairies, setFairies] = useState<FairyEntry[]>([]);
  const [coinBalance, setCoinBalance] = useState(0);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('users').select('coin_balance').eq('id', user.id).single();
    setCoinBalance((profile as any)?.coin_balance ?? 0);

    const { data: allFairies } = await supabase
      .from('fairy_definitions')
      .select('*')
      .order('rarity', { ascending: true });

    const { data: discovered } = await supabase
      .from('user_fairy_collection')
      .select('*')
      .eq('user_id', user.id);

    const collectionMap = new Map<string, UserFairyCollection>();
    (discovered as UserFairyCollection[] | null)?.forEach((c) => {
      collectionMap.set(c.fairy_id, c);
    });

    const entries: FairyEntry[] = (allFairies as FairyDefinition[] | null ?? []).map((f) => {
      const col = collectionMap.get(f.id) ?? null;
      return { ...f, discovered: !!col, collection: col };
    });

    setFairies(entries);
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>

      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.titleRow}>
          <IconSymbol size={24} name="book.closed.fill" color={colors.tint} />
          <Text style={[styles.title, { color: colors.text }]}>Fairy Log</Text>
        </View>
        <View style={[styles.wishBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <IconSymbol size={16} name="heart.fill" color={colors.coin} />
          <Text style={[styles.wishText, { color: colors.coin }]}>{coinBalance}</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <Text style={[styles.statsText, { color: colors.icon }]}>
          {fairies.filter((f) => f.discovered).length} / {fairies.length} discovered
        </Text>
      </View>

      <FlatList
        data={fairies}
        keyExtractor={(f) => f.id}
        numColumns={2}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.card,
              {
                backgroundColor: item.discovered ? colors.card : colors.background,
                borderColor: item.discovered ? colors.border : colors.border,
                opacity: item.discovered ? 1 : 0.7,
              },
            ]}
            onPress={() => {
              if (item.discovered) {
                router.push({ pathname: '/fairy-log-detail' as any, params: { id: item.id } });
              }
            }}
            activeOpacity={item.discovered ? 0.75 : 1}>

            {/* Portrait or egg silhouette */}
            <View style={[
              styles.portrait,
              {
                backgroundColor: item.discovered ? colors.background : colors.border,
                borderColor: colors.border,
              },
            ]}>
              {item.discovered
                ? <Text style={styles.portraitEmoji}>✨</Text>
                : <Text style={styles.eggEmoji}>🥚</Text>}
            </View>

            {/* Name */}
            <Text style={[styles.fairyName, { color: item.discovered ? colors.text : colors.icon }]} numberOfLines={1}>
              {item.discovered ? item.name : '? ? ?'}
            </Text>

            {/* Rarity stars (only if discovered) */}
            {item.discovered && (
              <Text style={[styles.rarityStars, { color: colors.coin }]}>
                {RARITY_STARS[item.rarity] ?? '★'}
              </Text>
            )}

            {/* Friendship level (only if discovered) */}
            {item.discovered && item.collection && (
              <Text style={[styles.friendshipText, { color: colors.icon }]}>
                Friendship Lv {item.collection.friendship_level}
              </Text>
            )}
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 24, fontWeight: '700' },
  wishBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  wishText: { fontSize: 15, fontWeight: '700' },

  statsRow: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  statsText: { fontSize: 13 },

  grid: { padding: 16, gap: 12, paddingBottom: 32 },
  row: { gap: 12 },

  card: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 6,
    alignItems: 'center',
  },
  portrait: {
    width: 72,
    height: 72,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  portraitEmoji: { fontSize: 36 },
  eggEmoji: { fontSize: 36 },
  fairyName: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  rarityStars: { fontSize: 14 },
  friendshipText: { fontSize: 11 },
});
