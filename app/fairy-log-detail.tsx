import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { FairyDefinition, UserFairyCollection, Material } from '@/types/database';

type FairyDetail = FairyDefinition & {
  collection: UserFairyCollection | null;
  dropMaterial: Material | null;
};

const RARITY_COLOR: Record<string, string> = {
  common: '#A8A29E',
  rare: '#10B981',
  mythical: '#7C3AED',
  legendary: '#F59E0B',
};

const FRIENDSHIP_MAX = 10;

export default function FairyLogDetailScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const { id } = useLocalSearchParams<{ id: string }>();
  const [fairy, setFairy] = useState<FairyDetail | null>(null);
  const [allFairyIds, setAllFairyIds] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [coinBalance, setCoinBalance] = useState(0);

  useEffect(() => {
    if (id) loadFairy(id);
  }, [id]);

  async function loadFairy(fairyId: string) {
    const { data: { user } } = await supabase.auth.getUser();

    const { data: profile } = await supabase
      .from('users').select('coin_balance').eq('id', user?.id ?? '').single();
    setCoinBalance((profile as any)?.coin_balance ?? 0);

    const { data: fairyData } = await supabase
      .from('fairy_definitions')
      .select('*')
      .eq('id', fairyId)
      .single();

    if (!fairyData) return;
    const f = fairyData as FairyDefinition;

    let collection: UserFairyCollection | null = null;
    if (user) {
      const { data: col } = await supabase
        .from('user_fairy_collection')
        .select('*')
        .eq('user_id', user.id)
        .eq('fairy_id', fairyId)
        .single();
      collection = (col as UserFairyCollection | null) ?? null;
    }

    let dropMaterial: Material | null = null;
    if (f.material_drop_type) {
      const { data: mat } = await supabase
        .from('materials')
        .select('*')
        .eq('name', f.material_drop_type)
        .single();
      dropMaterial = (mat as Material | null) ?? null;
    }

    setFairy({ ...f, collection, dropMaterial });

    if (user) {
      const { data: discoveredCol } = await supabase
        .from('user_fairy_collection')
        .select('fairy_id')
        .eq('user_id', user.id);

      const ids = (discoveredCol as { fairy_id: string }[] | null ?? []).map((c) => c.fairy_id);
      setAllFairyIds(ids);
      setCurrentIndex(ids.indexOf(fairyId));
    }
  }

  function navigateTo(index: number) {
    const newId = allFairyIds[index];
    if (newId) loadFairy(newId);
  }

  if (!fairy) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={styles.loading}>
          <Text style={[styles.loadingText, { color: colors.icon }]}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const rarityColor = RARITY_COLOR[fairy.rarity] ?? colors.icon;
  const friendshipLevel = fairy.collection?.friendship_level ?? 0;
  const friendshipProgress = Math.min(1, friendshipLevel / FRIENDSHIP_MAX);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>

      {/* Top bar: back button | Fairy Log title | coin badge */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={[styles.navButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.back()}>
          <IconSymbol size={20} name="arrow.left" color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Fairy Log</Text>
        <View style={[styles.coinBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <IconSymbol size={14} name="heart.fill" color={colors.coin} />
          <Text style={[styles.coinText, { color: colors.coin }]}>{coinBalance}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Name + portrait row */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={[styles.fairyName, { color: colors.text }]}>{fairy.name}</Text>

            {/* Rarity tag */}
            <View style={styles.tagsRow}>
              <View style={[styles.tag, { borderColor: rarityColor }]}>
                <Text style={[styles.tagText, { color: rarityColor }]}>
                  {fairy.rarity.charAt(0).toUpperCase() + fairy.rarity.slice(1)}
                </Text>
              </View>
            </View>

            {/* Friendship */}
            <Text style={[styles.friendshipLabel, { color: colors.text }]}>
              Friendship Level {friendshipLevel}
            </Text>
            <View style={[styles.friendshipTrack, { backgroundColor: colors.border }]}>
              <View style={[styles.friendshipFill, {
                backgroundColor: colors.tint,
                width: `${Math.round(friendshipProgress * 100)}%` as any,
              }]} />
            </View>
          </View>

          {/* Portrait */}
          <View style={[styles.portrait, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={styles.portraitEmoji}>✨</Text>
          </View>
        </View>

        {/* Lore */}
        {fairy.lore ? (
          <Text style={[styles.lore, { color: colors.icon }]}>"{fairy.lore}"</Text>
        ) : null}

        {/* Drops */}
        {fairy.dropMaterial && (
          <View style={styles.dropsSection}>
            <Text style={[styles.dropsLabel, { color: colors.text }]}>Drops</Text>
            <View style={styles.dropsRow}>
              <View style={styles.dropItem}>
                <View style={[styles.dropThumb, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <IconSymbol size={22} name="drop.fill" color={rarityColor} />
                </View>
                <Text style={[styles.dropName, { color: colors.text }]}>{fairy.dropMaterial.name}</Text>
              </View>
            </View>
          </View>
        )}

      </ScrollView>

      {/* Bottom navigation */}
      <View style={[styles.bottomNav, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.navBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.back()}>
          <IconSymbol size={16} name="arrow.left" color={colors.text} />
          <Text style={[styles.navBtnText, { color: colors.text }]}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.navBtn,
            { backgroundColor: colors.card, borderColor: colors.border },
            currentIndex >= allFairyIds.length - 1 && styles.navBtnDisabled,
          ]}
          onPress={() => navigateTo(currentIndex + 1)}
          disabled={currentIndex >= allFairyIds.length - 1}>
          <Text style={[styles.navBtnText, {
            color: currentIndex >= allFairyIds.length - 1 ? colors.icon : colors.text,
          }]}>Next</Text>
          <IconSymbol
            size={16}
            name="chevron.right"
            color={currentIndex >= allFairyIds.length - 1 ? colors.icon : colors.text}
          />
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 12,
  },
  navButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, fontSize: 20, fontWeight: '700' },
  coinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  coinText: { fontSize: 14, fontWeight: '700' },

  content: { padding: 20, gap: 20, paddingBottom: 12 },

  // Header row: name+tags+friendship left, portrait right
  headerRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  headerLeft: { flex: 1, gap: 10 },
  fairyName: { fontSize: 22, fontWeight: '700' },

  tagsRow: { flexDirection: 'row', gap: 8 },
  tag: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  tagText: { fontSize: 13, fontWeight: '600' },

  friendshipLabel: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  friendshipTrack: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  friendshipFill: { height: '100%', borderRadius: 5 },

  portrait: {
    width: 110,
    height: 130,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  portraitEmoji: { fontSize: 52 },

  lore: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },

  // Drops
  dropsSection: { gap: 12 },
  dropsLabel: { fontSize: 15, fontWeight: '700' },
  dropsRow: { flexDirection: 'row', gap: 16 },
  dropItem: { alignItems: 'center', gap: 6 },
  dropThumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropName: { fontSize: 12, fontWeight: '500' },

  // Bottom nav
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  navBtnDisabled: { opacity: 0.4 },
  navBtnText: { fontSize: 15, fontWeight: '600' },
});
