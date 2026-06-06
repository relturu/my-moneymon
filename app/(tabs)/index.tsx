import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { User, FountainUpgrade, FountainVisit, FairyDefinition, UserFairyCollection } from '@/types/database';

type ActiveFairy = FountainVisit & {
  fairy: FairyDefinition;
  collection: UserFairyCollection | null;
};

const RARITY_STARS: Record<string, string> = {
  common: '★',
  uncommon: '★★',
  rare: '★★★',
  legendary: '★★★★',
};

const INTERACTION_COOLDOWN_HOURS = 8;

export default function FountainScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [user, setUser] = useState<User | null>(null);
  const [currentLevel, setCurrentLevel] = useState<FountainUpgrade | null>(null);
  const [nextLevel, setNextLevel] = useState<FountainUpgrade | null>(null);
  const [activeFairy, setActiveFairy] = useState<ActiveFairy | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [patting, setPatting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  async function load() {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;

    const { data: profile } = await supabase
      .from('users').select('*').eq('id', authUser.id).single();

    setUser(profile as User | null);

    if (profile) {
      const p = profile as User;
      const { data: level } = await supabase
        .from('fountain_upgrades').select('*').eq('level', p.fountain_level).single();
      const { data: next } = await supabase
        .from('fountain_upgrades').select('*').eq('level', p.fountain_level + 1).single();
      setCurrentLevel(level as FountainUpgrade | null);
      setNextLevel(next as FountainUpgrade | null);
    }

    const { data: visits } = await supabase
      .from('fountain_visits')
      .select('*')
      .eq('user_id', authUser.id)
      .eq('is_active', true)
      .order('arrived_at', { ascending: false })
      .limit(1);

    const visitList = visits as FountainVisit[] | null;

    if (visitList && visitList.length > 0) {
      const visit = visitList[0];
      const { data: fairyData } = await supabase
        .from('fairy_definitions')
        .select('*')
        .eq('id', visit.fairy_id)
        .single();

      const fairy = fairyData as FairyDefinition | null;
      if (fairy) {
        const { data: collectionData } = await supabase
          .from('user_fairy_collection')
          .select('*')
          .eq('user_id', authUser.id)
          .eq('fairy_id', fairy.id)
          .single();

        setActiveFairy({
          ...visit,
          fairy,
          collection: (collectionData as UserFairyCollection | null) ?? null,
        });
      }
    } else {
      setActiveFairy(null);
    }
  }

  async function handlePat() {
    if (!activeFairy || !user) return;
    setPatting(true);

    const now = new Date().toISOString();

    await (supabase
      .from('fountain_visits')
      .update({ interacted_at: now }) as any)
      .eq('id', activeFairy.id);

    if (activeFairy.collection) {
      await (supabase
        .from('user_fairy_collection')
        .update({
          last_interaction_at: now,
          friendship_level: activeFairy.collection.friendship_level + 1,
        }) as any)
        .eq('id', activeFairy.collection.id);
    } else {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        await supabase.from('user_fairy_collection').insert({
          user_id: authUser.id,
          fairy_id: activeFairy.fairy_id,
          friendship_level: 1,
          total_visits: 1,
          last_interaction_at: now,
        } as any);
      }
    }

    await load();
    setPatting(false);
  }

  function canPat(): boolean {
    if (!activeFairy?.interacted_at) return true;
    const last = new Date(activeFairy.interacted_at).getTime();
    const now = Date.now();
    return (now - last) / (1000 * 60 * 60) >= INTERACTION_COOLDOWN_HOURS;
  }

  function getVisitTimeLeft(): string {
    if (!activeFairy?.departs_at) return '';
    const diff = new Date(activeFairy.departs_at).getTime() - Date.now();
    if (diff <= 0) return 'Departing soon';
    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${h}h ${m}m`;
  }

  function getCooldownText(): string {
    if (!activeFairy?.interacted_at) return '';
    const last = new Date(activeFairy.interacted_at).getTime();
    const remaining = INTERACTION_COOLDOWN_HOURS * 60 * 60 * 1000 - (Date.now() - last);
    if (remaining <= 0) return '';
    const h = Math.floor(remaining / (1000 * 60 * 60));
    const m = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    return `Next pat available in ${h}h ${m}m`;
  }

  const xpProgress = currentLevel && nextLevel
    ? Math.min(1, (user?.fountain_xp ?? 0) / nextLevel.xp_required)
    : 1;

  const fountainLevel = user?.fountain_level ?? 1;
  const glowSize = Math.min(1.4, 1 + fountainLevel * 0.04);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={[styles.topBarButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push('/quests' as any)}>
          <IconSymbol size={18} name="scroll.fill" color={colors.tint} />
          <Text style={[styles.topBarButtonText, { color: colors.tint }]}>Quests</Text>
        </TouchableOpacity>

        <View style={[styles.wishBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <IconSymbol size={16} name="heart.fill" color={colors.coin} />
          <Text style={[styles.wishText, { color: colors.coin }]}>
            {user?.coin_balance ?? 0}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Fountain visual */}
        <View style={styles.fountainArea}>
          <TouchableOpacity
            style={styles.fountainTouchable}
            onPress={() => activeFairy ? setSheetOpen(true) : router.push('/toss' as any)}
            activeOpacity={0.85}>

            {/* Glow ring */}
            <View style={[
              styles.glowRing,
              {
                borderColor: colors.tint,
                opacity: 0.15 + fountainLevel * 0.02,
                transform: [{ scale: glowSize }],
              },
            ]} />

            {/* Tiered fountain */}
            <View style={styles.fountainTiers}>
              <View style={[styles.tier1, { backgroundColor: colors.tint, opacity: 0.9 }]} />
              <View style={[styles.tier2, { backgroundColor: colors.tint, opacity: 0.8 }]} />
              <View style={[styles.tier3, { backgroundColor: colors.tint, opacity: 0.7 }]} />
              <View style={[styles.basin, { backgroundColor: colors.tint, opacity: 0.6 }]} />
            </View>

            {/* Active fairy indicator */}
            {activeFairy && (
              <View style={[styles.fairyBubble, { backgroundColor: colors.card, borderColor: colors.tint }]}>
                <Text style={styles.fairyBubbleEmoji}>✨</Text>
                <Text style={[styles.fairyBubbleName, { color: colors.tint }]}>
                  {activeFairy.fairy.name}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={[styles.levelLabel, { color: colors.text }]}>
            Level {fountainLevel}
          </Text>

          {/* XP progress */}
          {nextLevel && (
            <View style={styles.xpRow}>
              <View style={[styles.xpTrack, { backgroundColor: colors.border }]}>
                <View style={[styles.xpFill, {
                  backgroundColor: colors.tint,
                  width: `${Math.round(xpProgress * 100)}%` as any,
                }]} />
              </View>
              <Text style={[styles.xpLabel, { color: colors.icon }]}>
                {user?.fountain_xp ?? 0} / {nextLevel.xp_required} XP
              </Text>
            </View>
          )}
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          {activeFairy ? (
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.tint }]}
              onPress={() => setSheetOpen(true)}>
              <IconSymbol size={18} name="heart.fill" color="#fff" />
              <Text style={styles.primaryButtonText}>Visit {activeFairy.fairy.name}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.tint }]}
              onPress={() => router.push('/toss' as any)}>
              <IconSymbol size={18} name="heart.fill" color="#fff" />
              <Text style={styles.primaryButtonText}>Wish ♥</Text>
            </TouchableOpacity>
          )}

          <View style={[styles.slotInfo, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.slotText, { color: colors.icon }]}>
              {currentLevel?.fairy_slots ?? 1} fairy slot{(currentLevel?.fairy_slots ?? 1) > 1 ? 's' : ''} · Level {fountainLevel}
            </Text>
          </View>
        </View>

      </ScrollView>

      {/* Fairy Interaction Bottom Sheet */}
      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setSheetOpen(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.card }]}
            onPress={(e) => e.stopPropagation()}>

            {/* Drag handle */}
            <View style={[styles.handle, { backgroundColor: colors.border }]} />

            {activeFairy && (
              <>
                {/* Header */}
                <View style={styles.sheetHeader}>
                  <View style={[styles.fairyPortrait, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={styles.portraitEmoji}>✨</Text>
                  </View>
                  <View style={styles.sheetHeaderInfo}>
                    <Text style={[styles.sheetFairyName, { color: colors.text }]}>
                      {activeFairy.fairy.name}
                    </Text>
                    <Text style={[styles.sheetRarity, { color: colors.coin }]}>
                      {RARITY_STARS[activeFairy.fairy.rarity] ?? '★'}
                    </Text>
                    {activeFairy.departs_at && (
                      <Text style={[styles.sheetTimer, { color: colors.icon }]}>
                        Visit ends in {getVisitTimeLeft()}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Friendship */}
                <View style={styles.friendshipRow}>
                  <Text style={[styles.friendshipLabel, { color: colors.text }]}>
                    Friendship · Lv {activeFairy.collection?.friendship_level ?? 0}
                  </Text>
                  <View style={[styles.friendshipTrack, { backgroundColor: colors.border }]}>
                    <View style={[styles.friendshipFill, {
                      backgroundColor: colors.tint,
                      width: `${Math.min(100, (activeFairy.collection?.friendship_level ?? 0) * 10)}%` as any,
                    }]} />
                  </View>
                </View>

                {/* Pat button */}
                <TouchableOpacity
                  style={[
                    styles.patButton,
                    {
                      backgroundColor: canPat() ? colors.tint : colors.border,
                      opacity: patting ? 0.7 : 1,
                    },
                  ]}
                  onPress={handlePat}
                  disabled={!canPat() || patting}>
                  <Text style={[styles.patButtonText, { color: canPat() ? '#fff' : colors.icon }]}>
                    {patting ? 'Patting...' : `Pat ${activeFairy.fairy.name}`}
                  </Text>
                </TouchableOpacity>

                {!canPat() && (
                  <Text style={[styles.cooldownText, { color: colors.icon }]}>
                    {getCooldownText()}
                  </Text>
                )}

                {/* Possible drops */}
                {activeFairy.fairy.material_drop_type && (
                  <View style={styles.dropsRow}>
                    <Text style={[styles.dropsLabel, { color: colors.icon }]}>Possible drops</Text>
                    <View style={[styles.dropChip, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <IconSymbol size={14} name="drop.fill" color={colors.tint} />
                      <Text style={[styles.dropText, { color: colors.text }]}>
                        {activeFairy.fairy.material_drop_type}
                      </Text>
                    </View>
                  </View>
                )}
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

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
    paddingBottom: 4,
  },
  topBarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  topBarButtonText: { fontSize: 14, fontWeight: '600' },
  wishBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  wishText: { fontSize: 16, fontWeight: '700' },

  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 24,
  },

  fountainArea: {
    alignItems: 'center',
    paddingTop: 32,
    gap: 16,
  },
  fountainTouchable: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  glowRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 40,
  },
  fountainTiers: {
    alignItems: 'center',
    gap: 0,
  },
  tier1: {
    width: 60,
    height: 28,
    borderRadius: 30,
    marginBottom: -4,
    zIndex: 4,
  },
  tier2: {
    width: 110,
    height: 32,
    borderRadius: 30,
    marginBottom: -4,
    zIndex: 3,
  },
  tier3: {
    width: 160,
    height: 36,
    borderRadius: 30,
    marginBottom: -4,
    zIndex: 2,
  },
  basin: {
    width: 200,
    height: 40,
    borderRadius: 20,
    zIndex: 1,
  },

  fairyBubble: {
    position: 'absolute',
    top: -24,
    right: -20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1.5,
    zIndex: 10,
  },
  fairyBubbleEmoji: { fontSize: 14 },
  fairyBubbleName: { fontSize: 13, fontWeight: '600' },

  levelLabel: { fontSize: 18, fontWeight: '700' },

  xpRow: { width: '100%', gap: 6 },
  xpTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    width: '100%',
  },
  xpFill: { height: '100%', borderRadius: 4 },
  xpLabel: { fontSize: 12, textAlign: 'center' },

  actions: { gap: 12 },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 18,
  },
  primaryButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  slotInfo: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
  },
  slotText: { fontSize: 13 },

  // Bottom sheet
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 18,
    paddingBottom: 40,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 4,
  },

  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  fairyPortrait: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portraitEmoji: { fontSize: 32 },
  sheetHeaderInfo: { flex: 1, gap: 4 },
  sheetFairyName: { fontSize: 22, fontWeight: '700' },
  sheetRarity: { fontSize: 18 },
  sheetTimer: { fontSize: 13 },

  friendshipRow: { gap: 8 },
  friendshipLabel: { fontSize: 15, fontWeight: '600' },
  friendshipTrack: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  friendshipFill: { height: '100%', borderRadius: 5 },

  patButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  patButtonText: { fontSize: 16, fontWeight: '700' },
  cooldownText: { fontSize: 13, textAlign: 'center' },

  dropsRow: { gap: 8 },
  dropsLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
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
});
