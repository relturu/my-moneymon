import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

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

const RARITY_STARS: Record<string, string> = {
  common: '★',
  uncommon: '★★',
  rare: '★★★',
  legendary: '★★★★',
};

const MAX_CONVOS = 3;

function generateConvoSlots(arrivedAt: Date, departsAt: Date): string[] {
  const total = departsAt.getTime() - arrivedAt.getTime();
  const segment = total / MAX_CONVOS;
  return [0, 1, 2].map((i) => {
    const segStart = arrivedAt.getTime() + i * segment;
    return new Date(segStart + Math.random() * segment).toISOString();
  });
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
  const [claiming, setClaiming] = useState(false);
  const [tick, setTick] = useState(0); // forces countdown re-render
  const { setFountain, setInventory, setFairyLog } = useNotifs();

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

    // Mailbox: expired visits with unclaimed materials
    const { data: mailboxData } = await supabase
      .from('fountain_visits')
      .select('*')
      .eq('user_id', authUser.id)
      .eq('is_active', true)
      .eq('materials_claimed', false)
      .lt('departs_at', now);

    const mailboxList: MailboxVisit[] = [];
    for (const visit of (mailboxData as FountainVisit[] | null) ?? []) {
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

  async function claimMailbox() {
    if (claiming || mailboxVisits.length === 0) return;
    setClaiming(true);

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) { setClaiming(false); return; }

    const drops: string[] = [];
    let totalXp = 0;
    let newFairyDiscovered = false;

    for (const visit of mailboxVisits) {
      const wasInteracted = !!visit.interacted_at;
      const isTestVisit = getDevTest().visitId === visit.id;

      if (visit.material) {
        const xp = Math.floor(
          Math.random() * (visit.material.xp_max - visit.material.xp_min + 1)
        ) + visit.material.xp_min;
        if (!isTestVisit) totalXp += xp; // no XP for test visits

        // Upsert inventory
        const { data: existing } = await supabase
          .from('user_inventory').select('*')
          .eq('user_id', authUser.id).eq('material_id', visit.material.id).single();

        const db = supabase as any;
        if (existing) {
          await db.from('user_inventory')
            .update({ quantity: (existing as any).quantity + 1, updated_at: new Date().toISOString() })
            .eq('id', (existing as any).id);
        } else {
          await db.from('user_inventory').insert({
            user_id: authUser.id,
            material_id: visit.material.id,
            quantity: 1,
          });
        }

        drops.push(isTestVisit
          ? `${visit.material.name} (test — no XP)`
          : `${visit.material.name} (+${xp} XP)`);
      }

      // Ensure fairy is discovered in collection
      const db = supabase as any;
      const { data: colExisting } = await supabase
        .from('user_fairy_collection').select('*')
        .eq('user_id', authUser.id).eq('fairy_id', visit.fairy_id).single();

      if (colExisting) {
        await db.from('user_fairy_collection')
          .update({ total_visits: (colExisting as any).total_visits + 1 })
          .eq('id', (colExisting as any).id);
      } else {
        newFairyDiscovered = true;
        await db.from('user_fairy_collection').insert({
          user_id: authUser.id,
          fairy_id: visit.fairy_id,
          friendship_level: wasInteracted ? 1 : 0,
          total_visits: 1,
        });
      }

      // Mark visit complete
      await db.from('fountain_visits')
        .update({ materials_claimed: true, is_active: false })
        .eq('id', visit.id);
    }

    // Apply XP and check level-up
    const db2 = supabase as any;
    if (totalXp > 0 && user) {
      const newXp = (user.fountain_xp ?? 0) + totalXp;
      let newLevel = user.fountain_level ?? 1;

      const { data: allUpgrades } = await supabase
        .from('fountain_upgrades').select('*').order('level', { ascending: true });
      for (const upgrade of (allUpgrades as FountainUpgrade[] | null) ?? []) {
        if (upgrade.level > newLevel && newXp >= upgrade.xp_required) {
          newLevel = upgrade.level;
        }
      }

      await db2.from('users')
        .update({ fountain_xp: newXp, fountain_level: newLevel })
        .eq('id', authUser.id);

      const leveledUp = newLevel > (user.fountain_level ?? 1);
      Alert.alert(
        '📬 Mailbox collected!',
        drops.join('\n') + (leveledUp ? `\n\n✨ Fountain leveled up to ${newLevel}!` : ''),
      );
    } else if (drops.length > 0) {
      Alert.alert('📬 Mailbox collected!', drops.join('\n'));
    }

    // Mark devTest as claimed if the test visit was in this mailbox
    const dt = getDevTest();
    if (dt.active && !dt.claimed && mailboxVisits.some((v) => v.id === dt.visitId)) {
      setDevTest({ claimed: true });
    }

    // Notify other tabs: inventory always gets new items, fairy log if new discovery
    if (drops.length > 0) setInventory(true);
    if (newFairyDiscovered) setFairyLog(true);

    setClaiming(false);
    await load();
  }

  async function startDevTest() {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;

    // Pick a random fairy that has a material drop
    const { data: fairiesData } = await supabase
      .from('fairy_definitions').select('*').not('material_drop_type', 'is', null);
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
  const glowSize = Math.min(1.4, 1 + fountainLevel * 0.04);

  // Suppress unused tick warning — it's used to force countdown re-render
  void tick;

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
          <Text style={[styles.wishText, { color: colors.coin }]}>{user?.coin_balance ?? 0}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Fountain visual */}
        <View style={styles.fountainArea}>
          <TouchableOpacity
            style={styles.fountainTouchable}
            onPress={() => activeFairy ? setSheetOpen(true) : undefined}
            activeOpacity={activeFairy ? 0.85 : 1}>

            <View style={[
              styles.glowRing,
              {
                borderColor: colors.tint,
                opacity: 0.15 + fountainLevel * 0.02,
                transform: [{ scale: glowSize }],
              },
            ]} />

            <View style={styles.fountainTiers}>
              <View style={[styles.tier1, { backgroundColor: colors.tint, opacity: 0.9 }]} />
              <View style={[styles.tier2, { backgroundColor: colors.tint, opacity: 0.8 }]} />
              <View style={[styles.tier3, { backgroundColor: colors.tint, opacity: 0.7 }]} />
              <View style={[styles.basin, { backgroundColor: colors.tint, opacity: 0.6 }]} />
            </View>

            {activeFairy && (
              <View style={[styles.fairyBubble, { backgroundColor: colors.card, borderColor: colors.tint }]}>
                <Text style={styles.fairyBubbleEmoji}>✨</Text>
                <Text style={[styles.fairyBubbleName, { color: colors.tint }]}>
                  {activeFairy.fairy.name}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={[styles.levelLabel, { color: colors.text }]}>Level {fountainLevel}</Text>

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

        {/* Mailbox */}
        {mailboxVisits.length > 0 && (
          <View style={[styles.mailboxCard, { backgroundColor: colors.card, borderColor: colors.coin }]}>
            <View style={styles.mailboxHeader}>
              <Text style={styles.mailboxEmoji}>📬</Text>
              <View style={styles.mailboxInfo}>
                <Text style={[styles.mailboxTitle, { color: colors.text }]}>
                  {mailboxVisits.length === 1
                    ? `${mailboxVisits[0].fairy.name} left a gift!`
                    : `${mailboxVisits.length} fairies left gifts!`}
                </Text>
                <Text style={[styles.mailboxSub, { color: colors.icon }]}>
                  {mailboxVisits.map((v) => v.material?.name ?? '—').join(', ')}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.collectButton, { backgroundColor: colors.coin }]}
              onPress={claimMailbox}
              disabled={claiming}>
              <Text style={styles.collectButtonText}>
                {claiming ? 'Collecting...' : 'Collect'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Action area */}
        {activeFairy ? (
          <View style={styles.actions}>
            {activeFairy.materials_claimed ? (
              /* Gift already collected — fairy still hangs around */
              <View style={[styles.cooldownCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.cooldownLabel, { color: colors.icon }]}>
                  ✓ Gift collected · {activeFairy.fairy.name} is still visiting
                </Text>
                <Text style={[styles.cooldownTime, { color: colors.tint }]}>
                  Leaves in {getTimeLeft(activeFairy.departs_at)}
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: canChat(activeFairy) ? colors.tint : colors.border }]}
                onPress={() => canChat(activeFairy)
                  ? router.push(`/fairy-chat?visitId=${activeFairy.id}` as any)
                  : setSheetOpen(true)}>
                <IconSymbol size={18} name="heart.fill" color="#fff" />
                <Text style={styles.primaryButtonText}>
                  {canChat(activeFairy) ? `Talk to ${activeFairy.fairy.name}` : `Visit ${activeFairy.fairy.name}`}
                </Text>
              </TouchableOpacity>
            )}
            {!activeFairy.materials_claimed && (
              <View style={[styles.cooldownCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.cooldownLabel, { color: colors.icon }]}>
                  {nextConvoText(activeFairy)}
                </Text>
                <Text style={[styles.cooldownTime, { color: colors.tint }]}>
                  Leaves in {getTimeLeft(activeFairy.departs_at)}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.actions}>
            {/* Toss cooldown check */}
            {user?.next_toss_available_at && new Date(user.next_toss_available_at).getTime() > Date.now() ? (
              <View style={[styles.cooldownCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.cooldownLabel, { color: colors.icon }]}>Next fairy in</Text>
                <Text style={[styles.cooldownTime, { color: colors.tint }]}>
                  {getTimeLeft(user.next_toss_available_at)}
                </Text>
                <Text style={[styles.cooldownLabel, { color: colors.icon }]}>
                  Come back soon ✨
                </Text>
              </View>
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
            <TouchableOpacity
              style={[styles.devTestButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={startDevTest}>
              <Text style={[styles.devTestText, { color: colors.icon }]}>
                Test Fairy Material Functionality
              </Text>
            </TouchableOpacity>
          </View>
        )}

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

            <View style={[styles.handle, { backgroundColor: colors.border }]} />

            {activeFairy && (
              <>
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
                    router.push(`/fairy-chat?visitId=${activeFairy.id}` as any);
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

  content: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 32, gap: 20 },

  fountainArea: { alignItems: 'center', paddingTop: 28, gap: 14 },
  fountainTouchable: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  glowRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 40,
  },
  fountainTiers: { alignItems: 'center' },
  tier1: { width: 60, height: 28, borderRadius: 30, marginBottom: -4, zIndex: 4 },
  tier2: { width: 110, height: 32, borderRadius: 30, marginBottom: -4, zIndex: 3 },
  tier3: { width: 160, height: 36, borderRadius: 30, marginBottom: -4, zIndex: 2 },
  basin: { width: 200, height: 40, borderRadius: 20, zIndex: 1 },

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
  xpTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  xpFill: { height: '100%', borderRadius: 4 },
  xpLabel: { fontSize: 12, textAlign: 'center' },

  // Mailbox
  mailboxCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    gap: 12,
  },
  mailboxHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mailboxEmoji: { fontSize: 28 },
  mailboxInfo: { flex: 1 },
  mailboxTitle: { fontSize: 15, fontWeight: '600' },
  mailboxSub: { fontSize: 13, marginTop: 2 },
  collectButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  collectButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  actions: { gap: 10 },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 18,
  },
  primaryButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  cooldownCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  cooldownLabel: { fontSize: 13 },
  cooldownTime: { fontSize: 20, fontWeight: '700' },

  slotInfo: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
  },
  slotText: { fontSize: 13 },

  devTestButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 12,
    alignItems: 'center',
  },
  devTestText: { fontSize: 12 },

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
  sheetFairyName: { fontSize: 22, fontWeight: '700' },
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
});
