import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Alert,
  ImageBackground,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

import CoinSvg from '@/assets/images/coin.svg';
import GiftSvg from '@/assets/images/gift.svg';
import QuestSvg from '@/assets/images/quest.svg';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getDevTest, setDevTest } from '@/lib/dev-test';
import { useNotifs } from '@/lib/notifications';
import type {
  User,
  FountainUpgrade,
  FountainVisit,
  FairyDefinition,
  UserFairyCollection,
  Material,
} from '@/types/database';

type ActiveFairy = FountainVisit & {
  fairy: FairyDefinition;
  collection: UserFairyCollection | null;
};

type MailboxVisit = FountainVisit & {
  fairy: FairyDefinition;
  material: Material | null;
};

type CollectedVisit = FountainVisit & {
  fairy: FairyDefinition;
  material: Material | null;
};

const RARITY_STARS: Record<string, string> = {
  common: '★',
  rare: '★★',
  mythical: '★★★',
  legendary: '★★★★',
};

const MAX_CONVOS = 3;

const FAIRY_PORTRAITS: Record<string, any> = {
  felicity: require('@/assets/images/felicity.png'),
  mallow:   require('@/assets/images/mallow.png'),
  pearl:    require('@/assets/images/pearl.png'),
  pepper:   require('@/assets/images/pepper.png'),
  webster:  require('@/assets/images/webster.png'),
};

function formatArrivalDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '0m';
  const h = Math.floor(ms / (1000 * 60 * 60));
  const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function FountainScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [user, setUser] = useState<User | null>(null);
  const [currentLevel, setCurrentLevel] = useState<FountainUpgrade | null>(null);
  const [nextLevel, setNextLevel] = useState<FountainUpgrade | null>(null);
  const [activeFairy, setActiveFairy] = useState<ActiveFairy | null>(null);
  const [mailboxVisits, setMailboxVisits] = useState<MailboxVisit[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [giftSheetOpen, setGiftSheetOpen] = useState(false);
  const [collectedHistory, setCollectedHistory] = useState<CollectedVisit[]>([]);
  const [tick, setTick] = useState(0); // forces countdown re-render
  const { setFountain } = useNotifs();

  const bottomTranslateY = useSharedValue(0);

  const pullGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) {
        bottomTranslateY.value = e.translationY * 0.35;
      }
    })
    .onEnd(() => {
      bottomTranslateY.value = withSpring(0, {
        damping: 12,
        stiffness: 180,
        mass: 0.8,
      });
    });

  const bottomAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bottomTranslateY.value }],
  }));

  // Re-render countdown every minute
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

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
    const p = profile as User | null;
    setUser(p);

    if (p) {
      const { data: level } = await supabase
        .from('fountain_upgrades').select('*').eq('level', p.fountain_level).single();
      const { data: next } = await supabase
        .from('fountain_upgrades').select('*').eq('level', p.fountain_level + 1).single();
      setCurrentLevel(level as FountainUpgrade | null);
      setNextLevel(next as FountainUpgrade | null);
    }

    const now = new Date().toISOString();

    // Active visit: departs_at in the future — materials_claimed can be true if gift was collected early
    const { data: activeData } = await supabase
      .from('fountain_visits')
      .select('*')
      .eq('user_id', authUser.id)
      .eq('is_active', true)
      .gt('departs_at', now)
      .order('arrived_at', { ascending: false })
      .limit(1);

    const activeList = activeData as FountainVisit[] | null;
    if (activeList && activeList.length > 0) {
      const visit = activeList[0];
      const { data: fairyData } = await supabase
        .from('fairy_definitions').select('*').eq('id', visit.fairy_id).single();
      const fairy = fairyData as FairyDefinition | null;
      if (fairy) {
        const { data: colData } = await supabase
          .from('user_fairy_collection').select('*')
          .eq('user_id', authUser.id).eq('fairy_id', fairy.id).single();
        setActiveFairy({ ...visit, fairy, collection: (colData as UserFairyCollection | null) ?? null });
      }
    } else {
      setActiveFairy(null);
    }

    // Mailbox: expired visits, OR active visits where user already chatted (gift unlocked early)
    const { data: expiredVisits } = await supabase
      .from('fountain_visits')
      .select('*')
      .eq('user_id', authUser.id)
      .eq('is_active', true)
      .eq('materials_claimed', false)
      .lt('departs_at', now);

    const { data: chattedVisits } = await supabase
      .from('fountain_visits')
      .select('*')
      .eq('user_id', authUser.id)
      .eq('is_active', true)
      .eq('materials_claimed', false)
      .gt('departs_at', now)
      .gt('convo_count', 0);

    const mailboxData = [
      ...(expiredVisits as FountainVisit[] | null ?? []),
      ...(chattedVisits as FountainVisit[] | null ?? []),
    ];

    const mailboxList: MailboxVisit[] = [];
    for (const visit of mailboxData) {
      const { data: fairyData } = await supabase
        .from('fairy_definitions').select('*').eq('id', visit.fairy_id).single();
      const fairy = fairyData as FairyDefinition | null;
      if (!fairy) continue;
      let material: Material | null = null;
      if (fairy.material_drop_type) {
        const { data: matData } = await supabase
          .from('materials').select('*').eq('name', fairy.material_drop_type).single();
        material = (matData as Material | null) ?? null;
      }
      mailboxList.push({ ...visit, fairy, material });
    }
    setMailboxVisits(mailboxList);

    // Collected history: up to 10 most recently collected visits
    const { data: collectedData } = await supabase
      .from('fountain_visits')
      .select('*')
      .eq('user_id', authUser.id)
      .eq('materials_claimed', true)
      .order('arrived_at', { ascending: false })
      .limit(10);

    const historyList: CollectedVisit[] = [];
    for (const visit of (collectedData as FountainVisit[] | null) ?? []) {
      const { data: fairyData } = await supabase
        .from('fairy_definitions').select('*').eq('id', visit.fairy_id).single();
      const fairy = fairyData as FairyDefinition | null;
      if (!fairy) continue;
      let material: Material | null = null;
      if (fairy.material_drop_type) {
        const { data: matData } = await supabase
          .from('materials').select('*').eq('name', fairy.material_drop_type).single();
        material = (matData as Material | null) ?? null;
      }
      historyList.push({ ...visit, fairy, material });
    }
    setCollectedHistory(historyList);

    // Cleanup: visits that expired naturally after an early gift collect — mark is_active=false
    const db = supabase as any;
    await db.from('fountain_visits')
      .update({ is_active: false })
      .eq('user_id', authUser.id)
      .eq('is_active', true)
      .eq('materials_claimed', true)
      .lt('departs_at', now);

    // Fountain dot: show when a fairy is visiting OR mailbox has uncollected items
    const hasFairy = !!(activeList && activeList.length > 0);
    setFountain(hasFairy || mailboxList.length > 0);

    // Cooldown trigger: if no fairies active or in mailbox, set next_toss_available_at (skip for dev test)
    const dt = getDevTest();
    if (!hasFairy && mailboxList.length === 0 && p && p.next_toss_available_at == null && !dt.active) {
      const { data: recentVisits } = await supabase
        .from('fountain_visits')
        .select('id')
        .eq('user_id', authUser.id)
        .eq('is_active', false)
        .limit(1);
      if (recentVisits && recentVisits.length > 0) {
        const hours = Math.floor(Math.random() * 7) + 6; // 6–12 hours
        const nextToss = new Date(Date.now() + hours * 3600000).toISOString();
        await db.from('users').update({ next_toss_available_at: nextToss }).eq('id', authUser.id);
        setUser({ ...p, next_toss_available_at: nextToss });
      }
    }
  }

  async function startDevTest() {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;

    // Pick a random fairy that has a material drop
    const { data: fairiesData } = await supabase
      .from('fairy_definitions').select('*').not('material_drop_type', 'is', null).not('portrait_url', 'is', null);
    const fairies = (fairiesData as FairyDefinition[] | null) ?? [];
    if (fairies.length === 0) return;
    const fairy = fairies[Math.floor(Math.random() * fairies.length)];

    let materialId: string | null = null;
    if (fairy.material_drop_type) {
      const { data: mat } = await supabase
        .from('materials').select('id').eq('name', fairy.material_drop_type).single();
      materialId = (mat as any)?.id ?? null;
    }

    const now = new Date();
    const arrivedAt = now;
    // Departs in 10 min so it shows as an active fairy at the fountain
    const departsAt = new Date(now.getTime() + 10 * 60 * 1000);
    // First slot is immediately available; others are after departs (won't be reached in dev flow)
    const convoSlots = [
      new Date(now.getTime() - 1000).toISOString(),
      new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
      new Date(now.getTime() + 8 * 60 * 1000).toISOString(),
    ];

    const db = supabase as any;
    const { data: visitData } = await db.from('fountain_visits').insert({
      user_id: authUser.id,
      fairy_id: fairy.id,
      coins_spent: 0,
      arrived_at: arrivedAt.toISOString(),
      departs_at: departsAt.toISOString(),
      is_active: true,
      materials_claimed: false,
      convo_slots: convoSlots,
      convo_count: 0,
    }).select().single();

    setDevTest({
      active: true,
      claimed: false,
      visitId: (visitData as any)?.id ?? null,
      fairyId: fairy.id,
      materialId,
      startedAt: now.toISOString(),
    });

    await load();
  }

  async function handleShoo() {
    if (!activeFairy) return;
    Alert.alert(
      `Shoo ${activeFairy.fairy.name} away?`,
      'They\'ll leave immediately without dropping anything.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Shoo',
          style: 'destructive',
          onPress: async () => {
            const db = supabase as any;
            await db.from('fountain_visits')
              .update({ is_active: false, materials_claimed: true })
              .eq('id', activeFairy.id);
            setSheetOpen(false);
            await load();
          },
        },
      ]
    );
  }

  function getTimeLeft(isoString: string | null): string {
    if (!isoString) return '';
    return formatDuration(new Date(isoString).getTime() - Date.now());
  }

  function getNextConvoSlot(visit: ActiveFairy): string | null {
    const slots = [...(visit.convo_slots ?? [])].sort();
    const used = visit.convo_count ?? 0;
    return slots[used] ?? null;
  }

  function canChat(visit: ActiveFairy): boolean {
    const used = visit.convo_count ?? 0;
    if (used >= MAX_CONVOS) return false;
    const next = getNextConvoSlot(visit);
    return !!next && Date.now() >= new Date(next).getTime();
  }

  function nextConvoText(visit: ActiveFairy): string {
    const used = visit.convo_count ?? 0;
    if (used >= MAX_CONVOS) return 'All conversations complete';
    const next = getNextConvoSlot(visit);
    if (!next) return '';
    const ms = new Date(next).getTime() - Date.now();
    if (ms <= 0) return 'Ready to talk!';
    return `Next conversation in ${formatDuration(ms)}`;
  }

  const fountainLevel = user?.fountain_level ?? 1;
  const xpProgress = nextLevel
    ? Math.min(1, (user?.fountain_xp ?? 0) / nextLevel.xp_required)
    : 1;

  // Suppress unused tick warning — it's used to force countdown re-render
  void tick;

  return (
    <GestureDetector gesture={pullGesture}>
    <View collapsable={false} style={styles.bg}>
    <ImageBackground
      source={require('@/assets/images/home-background.png')}
      style={styles.bg}
      resizeMode="cover">
      <SafeAreaView style={styles.safeArea}>

        {/* Top row: coin+quests left, mailbox right */}
        <View style={styles.topRow}>
          {/* Left: coin badge + quests button + gift button stacked */}
          <View style={styles.topLeft}>
            <View style={styles.coinBadge}>
              <CoinSvg width={28} height={28} />
              <Text style={styles.coinText}>{user?.coin_balance ?? 0}</Text>
            </View>
            <TouchableOpacity
              style={styles.topIconBtn}
              onPress={() => router.push('/quests' as any)}>
              <QuestSvg width={36} height={36} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.topIconBtn}
              onPress={() => setGiftSheetOpen(true)}>
              <GiftSvg width={36} height={36} />
              {mailboxVisits.length > 0 && (
                <View style={styles.mailboxDot} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Middle spacer — fairy bubble if visiting */}
        <View style={styles.middle}>
          {activeFairy && (
            <TouchableOpacity
              style={styles.fairyBubble}
              onPress={() => canChat(activeFairy)
                ? router.push(`/fairy-chat?visitId=${activeFairy.id}&convoIndex=${activeFairy.convo_count ?? 0}` as any)
                : setSheetOpen(true)}>
              {activeFairy.fairy.portrait_url && FAIRY_PORTRAITS[activeFairy.fairy.portrait_url]
                ? <Image source={FAIRY_PORTRAITS[activeFairy.fairy.portrait_url]} style={styles.fairyBubblePortrait} resizeMode="contain" />
                : <Text style={styles.fairyBubbleEmoji}>✨</Text>}
            </TouchableOpacity>
          )}
        </View>

        {/* Bottom info overlay — all white text */}
        <Animated.View style={[styles.bottomOverlay, bottomAnimStyle]}>

          <Text style={styles.fountainTitle}>Wish Fountain</Text>
          <Text style={styles.levelLabel}>Level {fountainLevel}</Text>

          {nextLevel && (
            <View style={styles.xpRow}>
              <View style={styles.xpTrack}>
                <View style={[styles.xpFill, { width: `${Math.round(xpProgress * 100)}%` as any }]} />
              </View>
              <Text style={styles.xpLabel}>
                {user?.fountain_xp ?? 0} / {nextLevel.xp_required}XP
              </Text>
            </View>
          )}

          {activeFairy ? (
            <View style={styles.actions}>
              {!activeFairy.materials_claimed && (
                <Text style={styles.infoText}>{nextConvoText(activeFairy)}</Text>
              )}
            </View>
          ) : (
            <View style={styles.actions}>
              {user?.next_toss_available_at && new Date(user.next_toss_available_at).getTime() > Date.now() ? (
                <>
                  <Text style={styles.infoText}>Next fairy in</Text>
                  <Text style={styles.timerText}>{getTimeLeft(user.next_toss_available_at)}</Text>
                  <Text style={styles.infoText}>Come back soon ✨</Text>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: colors.tint }]}
                  onPress={() => router.push('/toss' as any)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <CoinSvg width={20} height={20} />
                    <Text style={styles.primaryButtonText}>Wish</Text>
                  </View>
                </TouchableOpacity>
              )}
<TouchableOpacity onPress={startDevTest}>
                <Text style={styles.devTestText}>Test Fairy Material Functionality</Text>
              </TouchableOpacity>
            </View>
          )}

        </Animated.View>

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

            <View style={[styles.handle, { backgroundColor: colors.border }]} />

            {activeFairy && (
              <>
                <View style={styles.sheetHeader}>
                  <View style={[styles.fairyPortrait, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    {activeFairy.fairy.portrait_url && FAIRY_PORTRAITS[activeFairy.fairy.portrait_url]
                      ? <Image source={FAIRY_PORTRAITS[activeFairy.fairy.portrait_url]} style={{ width: '100%', height: '100%', borderRadius: 36 }} resizeMode="contain" />
                      : <Text style={styles.portraitEmoji}>✨</Text>}
                  </View>
                  <View style={styles.sheetHeaderInfo}>
                    <Text style={[styles.sheetFairyName, { color: colors.text }]}>
                      {activeFairy.fairy.name}
                    </Text>
                    <Text style={[styles.sheetRarity, { color: colors.coin }]}>
                      {RARITY_STARS[activeFairy.fairy.rarity] ?? '★'}
                    </Text>
                    <Text style={[styles.sheetTimer, { color: colors.icon }]}>
                      Leaves in {getTimeLeft(activeFairy.departs_at)}
                    </Text>
                  </View>
                </View>

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

                <TouchableOpacity
                  style={[
                    styles.patButton,
                    { backgroundColor: canChat(activeFairy) ? colors.tint : colors.border },
                  ]}
                  onPress={() => {
                    setSheetOpen(false);
                    router.push(`/fairy-chat?visitId=${activeFairy.id}&convoIndex=${activeFairy.convo_count ?? 0}` as any);
                  }}
                  disabled={!canChat(activeFairy)}>
                  <Text style={[styles.patButtonText, { color: canChat(activeFairy) ? '#fff' : colors.icon }]}>
                    {canChat(activeFairy) ? `Talk to ${activeFairy.fairy.name}` : 'Not ready to talk'}
                  </Text>
                </TouchableOpacity>

                <Text style={[styles.cooldownText, { color: colors.icon }]}>
                  {nextConvoText(activeFairy)}
                </Text>

                <Text style={[styles.cooldownText, { color: colors.icon }]}>
                  {(activeFairy.convo_count ?? 0)}/{MAX_CONVOS} conversations this visit
                </Text>

                {activeFairy.fairy.material_drop_type && (
                  <View style={styles.dropsRow}>
                    <Text style={[styles.dropsLabel, { color: colors.icon }]}>Possible drops</Text>
                    <View style={[styles.dropChip, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <IconSymbol size={14} name="drop.fill" color={colors.tint} />
                      <Text style={[styles.dropText, { color: colors.text }]}>
                        {activeFairy.fairy.material_drop_type}
                      </Text>
                    </View>
                    <Text style={[styles.dropHint, { color: colors.icon }]}>
                      Collect from mailbox when {activeFairy.fairy.name} leaves
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.shooButton, { borderColor: colors.border }]}
                  onPress={handleShoo}>
                  <Text style={[styles.shooButtonText, { color: colors.icon }]}>
                    Shoo Away
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Gift History Bottom Sheet */}
      <Modal
        visible={giftSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setGiftSheetOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setGiftSheetOpen(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: '#E8EDE4' }]}
            onPress={(e) => e.stopPropagation()}>

            <View style={[styles.handle, { backgroundColor: 'rgba(0,0,0,0.12)' }]} />
            <Text style={[styles.giftSheetTitle, { color: '#2A3A1E' }]}>Gift Mailbox</Text>

            <ScrollView showsVerticalScrollIndicator={false}>

              {mailboxVisits.length > 0 && (
                <>
                  <Text style={[styles.giftSectionLabel, { color: 'rgba(0,0,0,0.45)' }]}>PENDING</Text>
                  {mailboxVisits.map(v => (
                    <TouchableOpacity
                      key={v.id}
                      style={[styles.giftRow, { borderColor: 'rgba(0,0,0,0.06)' }]}
                      onPress={() => { setGiftSheetOpen(false); router.push(`/fairy-gift?visitId=${v.id}` as any); }}>
                      <View style={[styles.giftRowPortrait, { backgroundColor: 'rgba(0,0,0,0.05)' }]}>
                        {v.fairy.portrait_url && FAIRY_PORTRAITS[v.fairy.portrait_url]
                          ? <Image source={FAIRY_PORTRAITS[v.fairy.portrait_url]} style={{ width: '100%', height: '100%', borderRadius: 20 }} resizeMode="contain" />
                          : <Text style={{ fontSize: 18 }}>✨</Text>}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.giftRowName, { color: '#2A3A1E' }]}>{v.fairy.name}</Text>
                        <Text style={[styles.giftRowSub, { color: 'rgba(0,0,0,0.45)' }]}>Gift ready to open</Text>
                      </View>
                      <Text style={[styles.giftRowAction, { color: '#425F4F' }]}>Open →</Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {collectedHistory.length > 0 && (
                <>
                  <Text style={[styles.giftSectionLabel, { color: 'rgba(0,0,0,0.45)' }]}>COLLECTED</Text>
                  {collectedHistory.map(v => (
                    <View key={v.id} style={[styles.giftRow, { borderColor: 'rgba(0,0,0,0.06)' }]}>
                      <View style={[styles.giftRowPortrait, { backgroundColor: 'rgba(0,0,0,0.05)' }]}>
                        {v.fairy.portrait_url && FAIRY_PORTRAITS[v.fairy.portrait_url]
                          ? <Image source={FAIRY_PORTRAITS[v.fairy.portrait_url]} style={{ width: '100%', height: '100%', borderRadius: 20 }} resizeMode="contain" />
                          : <Text style={{ fontSize: 18 }}>✨</Text>}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.giftRowName, { color: '#2A3A1E' }]}>{v.fairy.name}</Text>
                        <Text style={[styles.giftRowSub, { color: 'rgba(0,0,0,0.45)' }]}>
                          {v.material ? v.material.name : 'No drop'} · {formatArrivalDate(v.arrived_at)}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 16, color: 'rgba(0,0,0,0.45)' }}>✓</Text>
                    </View>
                  ))}
                </>
              )}

              {mailboxVisits.length === 0 && collectedHistory.length === 0 && (
                <Text style={[styles.giftEmptyText, { color: 'rgba(0,0,0,0.45)' }]}>
                  No gifts yet. Summon a fairy to get started!
                </Text>
              )}

            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

    </SafeAreaView>
    </ImageBackground>
    </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  safeArea: { flex: 1 },

  // Top row
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  topLeft: { alignItems: 'flex-start', gap: 8 },
  coinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  coinEmoji: { fontSize: 16 },
  coinText: { fontSize: 36, fontFamily: 'Kanchenjunga_700Bold', color: '#FCD34D' },
  topIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topIconEmoji: { fontSize: 22 },
  mailboxDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: 'transparent',
  },

  // Middle — fairy bubble floats here
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fairyBubble: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fairyBubbleEmoji: { fontSize: 80 },
  fairyBubblePortrait: { width: 180, height: 180 },
  fairyBubbleName: { fontSize: 14, fontFamily: 'Kanchenjunga_700Bold', color: '#F1F3EA' },

  // Bottom overlay — white text info
  bottomOverlay: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 6,
  },
  fountainTitle: { fontSize: 22, lineHeight: 38, fontFamily: 'Kanchenjunga_700Bold', color: '#fff', textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  levelLabel: { fontSize: 15, fontFamily: 'Kanchenjunga_600SemiBold', color: 'rgba(255,255,255,0.85)' },
  xpRow: { gap: 4, marginBottom: 4 },
  xpTrack: { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.3)' },
  xpFill: { height: '100%', borderRadius: 3, backgroundColor: '#fff' },
  xpLabel: { fontSize: 11, color: 'rgba(255,255,255,0.75)' },

  actions: { gap: 8 },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    overflow: 'visible',
  },
  primaryButtonText: { color: '#fff', fontSize: 17, fontFamily: 'Kanchenjunga_700Bold', paddingRight: 4 },
  infoText: { fontSize: 13, color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
  timerText: { fontSize: 22, fontFamily: 'Kanchenjunga_700Bold', color: '#fff', textAlign: 'center' },
  devTestText: { fontSize: 12, color: 'rgba(255,255,255,0.55)', textAlign: 'center', textDecorationLine: 'underline' },

  // Bottom sheet
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 18,
    paddingBottom: 40,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },

  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
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
  sheetFairyName: { fontSize: 22, fontFamily: 'Kanchenjunga_700Bold' },
  sheetRarity: { fontSize: 18 },
  sheetTimer: { fontSize: 13 },

  friendshipRow: { gap: 8 },
  friendshipLabel: { fontSize: 15, fontWeight: '600' },
  friendshipTrack: { height: 10, borderRadius: 5, overflow: 'hidden' },
  friendshipFill: { height: '100%', borderRadius: 5 },

  patButton: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  patButtonText: { fontSize: 16, fontWeight: '700' },
  cooldownText: { fontSize: 13, textAlign: 'center' },

  dropsRow: { gap: 6 },
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
  dropHint: { fontSize: 12, fontStyle: 'italic' },

  shooButton: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  shooButtonText: { fontSize: 14, fontWeight: '500' },

  // Gift history sheet
  giftSheetTitle: { fontSize: 20, fontFamily: 'Kanchenjunga_700Bold', marginBottom: 4 },
  giftSectionLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 4 },
  giftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  giftRowPortrait: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  giftRowName: { fontSize: 15, fontFamily: 'Kanchenjunga_700Bold' },
  giftRowSub: { fontSize: 12, marginTop: 2 },
  giftRowAction: { fontSize: 14, fontWeight: '600' },
  giftEmptyText: { fontSize: 14, textAlign: 'center', marginTop: 24, fontStyle: 'italic' },
});
