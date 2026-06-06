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

const RARITY_STARS: Record<string, string> = {
  common: '★',
  uncommon: '★★',
  rare: '★★★',
  legendary: '★★★★',
};

const RARITY_COLOR: Record<string, string> = {
  common: '#A8A29E',
  uncommon: '#10B981',
  rare: '#7C3AED',
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

  useEffect(() => {
    if (id) loadFairy(id);
  }, [id]);

  async function loadFairy(fairyId: string) {
    const { data: { user } } = await supabase.auth.getUser();

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

    // Load all fairy IDs for navigation
    const { data: allFairies } = await supabase
      .from('fairy_definitions')
      .select('id')
      .order('rarity', { ascending: true });

    const ids = (allFairies as { id: string }[] | null ?? []).map((f) => f.id);
    setAllFairyIds(ids);
    setCurrentIndex(ids.indexOf(fairyId));
  }

  function navigateTo(index: number) {
    const newId = allFairyIds[index];
    if (newId) {
      router.replace({ pathname: '/fairy-log-detail' as any, params: { id: newId } });
    }
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

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={[styles.navButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.back()}>
          <IconSymbol size={20} name="arrow.left" color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {fairy.name}
        </Text>
        <View style={styles.topBarRight} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* Card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>

          {/* Name tab */}
          <View style={[styles.nameTab, { backgroundColor: colors.tint }]}>
            <Text style={styles.nameTabText}>{fairy.name}</Text>
          </View>

          <View style={styles.cardBody}>
            {/* Portrait */}
            <View style={styles.portraitColumn}>
              <View style={[styles.portrait, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={styles.portraitEmoji}>✨</Text>
              </View>
              <Text style={[styles.rarityStars, { color: rarityColor }]}>
                {RARITY_STARS[fairy.rarity] ?? '★'}
              </Text>
              <Text style={[styles.rarityLabel, { color: rarityColor }]}>
                {fairy.rarity.charAt(0).toUpperCase() + fairy.rarity.slice(1)}
              </Text>
            </View>

            {/* Info */}
            <View style={styles.infoColumn}>
              <Text style={[styles.infoLabel, { color: colors.icon }]}>Friendship</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>Lv {friendshipLevel}</Text>

              <View style={[styles.friendshipTrack, { backgroundColor: colors.background }]}>
                <View style={[styles.friendshipFill, {
                  backgroundColor: colors.tint,
                  width: `${Math.round(friendshipProgress * 100)}%` as any,
                }]} />
              </View>

              <Text style={[styles.infoLabel, { color: colors.icon, marginTop: 8 }]}>Total Visits</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {fairy.collection?.total_visits ?? 0}
              </Text>

              {fairy.lore ? (
                <Text style={[styles.lore, { color: colors.icon }]} numberOfLines={4}>
                  "{fairy.lore}"
                </Text>
              ) : null}
            </View>
          </View>

          {/* Drops */}
          {fairy.dropMaterial && (
            <View style={[styles.dropsSection, { borderTopColor: colors.border }]}>
              <Text style={[styles.dropsLabel, { color: colors.icon }]}>DROPS</Text>
              <View style={[styles.dropChip, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <IconSymbol size={14} name="drop.fill" color={rarityColor} />
                <Text style={[styles.dropText, { color: colors.text }]}>{fairy.dropMaterial.name}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Prev / Next navigation */}
        <View style={styles.navRow}>
          <TouchableOpacity
            style={[
              styles.navBtn,
              { backgroundColor: colors.card, borderColor: colors.border },
              currentIndex === 0 && styles.navBtnDisabled,
            ]}
            onPress={() => navigateTo(currentIndex - 1)}
            disabled={currentIndex === 0}>
            <IconSymbol size={18} name="arrow.left" color={currentIndex === 0 ? colors.icon : colors.text} />
            <Text style={[styles.navBtnText, { color: currentIndex === 0 ? colors.icon : colors.text }]}>
              Prev
            </Text>
          </TouchableOpacity>

          <Text style={[styles.pageText, { color: colors.icon }]}>
            {currentIndex + 1} / {allFairyIds.length}
          </Text>

          <TouchableOpacity
            style={[
              styles.navBtn,
              { backgroundColor: colors.card, borderColor: colors.border },
              currentIndex === allFairyIds.length - 1 && styles.navBtnDisabled,
            ]}
            onPress={() => navigateTo(currentIndex + 1)}
            disabled={currentIndex === allFairyIds.length - 1}>
            <Text style={[styles.navBtnText, { color: currentIndex === allFairyIds.length - 1 ? colors.icon : colors.text }]}>
              Next
            </Text>
            <IconSymbol
              size={18}
              name="chevron.right"
              color={currentIndex === allFairyIds.length - 1 ? colors.icon : colors.text}
            />
          </TouchableOpacity>
        </View>

      </ScrollView>
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
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  topBarRight: { width: 42 },

  content: { padding: 20, gap: 20 },

  card: {
    borderRadius: 20,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  nameTab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignSelf: 'flex-start',
    borderBottomRightRadius: 16,
  },
  nameTabText: { color: '#fff', fontSize: 18, fontWeight: '700' },

  cardBody: {
    flexDirection: 'row',
    padding: 16,
    gap: 16,
  },
  portraitColumn: {
    alignItems: 'center',
    gap: 8,
    width: 100,
  },
  portrait: {
    width: 90,
    height: 90,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portraitEmoji: { fontSize: 48 },
  rarityStars: { fontSize: 20 },
  rarityLabel: { fontSize: 12, fontWeight: '600' },

  infoColumn: { flex: 1, gap: 4 },
  infoLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 18, fontWeight: '700' },

  friendshipTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginVertical: 4,
  },
  friendshipFill: { height: '100%', borderRadius: 4 },

  lore: {
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
    marginTop: 8,
  },

  dropsSection: {
    borderTopWidth: 1,
    padding: 16,
    gap: 10,
  },
  dropsLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  dropChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dropText: { fontSize: 14 },

  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  navBtnDisabled: { opacity: 0.4 },
  navBtnText: { fontSize: 14, fontWeight: '600' },
  pageText: { fontSize: 13 },
});
