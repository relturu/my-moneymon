import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getDevTest, setDevTest } from '@/lib/dev-test';
import { useNotifs } from '@/lib/notifications';
import type { FountainVisit, FairyDefinition, Material, FountainUpgrade, UserFairyCollection } from '@/types/database';

const FAIRY_PORTRAITS: Record<string, any> = {
  felicity: require('@/assets/images/felicity.png'),
  mallow:   require('@/assets/images/mallow.png'),
  pearl:    require('@/assets/images/pearl.png'),
  pepper:   require('@/assets/images/pepper.png'),
  webster:  require('@/assets/images/webster.png'),
};

export default function FairyGiftScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { visitId } = useLocalSearchParams<{ visitId: string }>();
  const { setInventory, setFairyLog } = useNotifs();

  const [visit, setVisit] = useState<FountainVisit | null>(null);
  const [fairy, setFairy] = useState<FairyDefinition | null>(null);
  const [material, setMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [collected, setCollected] = useState(false);
  const [xpGained, setXpGained] = useState(0);
  const [materialName, setMaterialName] = useState('');

  useEffect(() => {
    if (visitId) load();
  }, [visitId]);

  async function load() {
    setLoading(true);
    const { data: visitData } = await supabase
      .from('fountain_visits').select('*').eq('id', visitId).single();
    const v = visitData as FountainVisit | null;
    if (!v) { setLoading(false); return; }
    setVisit(v);

    const { data: fairyData } = await supabase
      .from('fairy_definitions').select('*').eq('id', v.fairy_id).single();
    const f = fairyData as FairyDefinition | null;
    setFairy(f);

    if (f?.material_drop_type) {
      const { data: matData } = await supabase
        .from('materials').select('*').eq('name', f.material_drop_type).single();
      setMaterial(matData as Material | null);
    }

    setLoading(false);
  }

  async function collectGift() {
    if (!visit || !fairy || collecting) return;
    setCollecting(true);

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) { setCollecting(false); return; }

    const isTestVisit = getDevTest().visitId === visit.id;
    const db = supabase as any;

    let earnedXp = 0;

    // Upsert inventory
    if (material) {
      const xp = Math.floor(
        Math.random() * (material.xp_max - material.xp_min + 1)
      ) + material.xp_min;
      if (!isTestVisit) earnedXp = xp;

      const { data: existing } = await supabase
        .from('user_inventory').select('*')
        .eq('user_id', authUser.id).eq('material_id', material.id).single();

      if (existing) {
        await db.from('user_inventory')
          .update({ quantity: (existing as any).quantity + 1, updated_at: new Date().toISOString() })
          .eq('id', (existing as any).id);
      } else {
        await db.from('user_inventory').insert({
          user_id: authUser.id,
          material_id: material.id,
          quantity: 1,
        });
      }

      setMaterialName(material.name);
    }

    // Update/insert user_fairy_collection (increment total_visits, detect new fairy)
    let newFairyDiscovered = false;
    const { data: colData } = await supabase
      .from('user_fairy_collection').select('*')
      .eq('user_id', authUser.id).eq('fairy_id', visit.fairy_id).single();

    if (colData) {
      if ((colData as UserFairyCollection).total_visits === 0) newFairyDiscovered = true;
      await db.from('user_fairy_collection')
        .update({ total_visits: (colData as any).total_visits + 1 })
        .eq('id', (colData as any).id);
    } else {
      newFairyDiscovered = true;
      await db.from('user_fairy_collection').insert({
        user_id: authUser.id,
        fairy_id: visit.fairy_id,
        friendship_level: 1,
        total_visits: 1,
        last_interaction_at: new Date().toISOString(),
      });
    }

    // Mark gift as collected on the visit (fairy stays active until departs_at)
    await db.from('fountain_visits')
      .update({ materials_claimed: true })
      .eq('id', visit.id);

    // Apply XP and level-up check (real visits only)
    if (earnedXp > 0) {
      const { data: userData } = await supabase
        .from('users').select('*').eq('id', authUser.id).single();
      const u = userData as any;
      if (u) {
        const newXp = (u.fountain_xp ?? 0) + earnedXp;
        let newLevel = u.fountain_level ?? 1;
        const { data: allUpgrades } = await supabase
          .from('fountain_upgrades').select('*').order('level', { ascending: true });
        for (const upgrade of (allUpgrades as FountainUpgrade[] | null) ?? []) {
          if (upgrade.level > newLevel && newXp >= upgrade.xp_required) {
            newLevel = upgrade.level;
          }
        }
        await db.from('users')
          .update({ fountain_xp: newXp, fountain_level: newLevel })
          .eq('id', authUser.id);
      }
    }

    // Dev test: expire the visit immediately so it disappears from fountain on return
    if (isTestVisit) {
      await db.from('fountain_visits')
        .update({ departs_at: new Date(Date.now() - 1000).toISOString() })
        .eq('id', visit.id);
      setDevTest({ claimed: true });
    }

    setXpGained(earnedXp);
    if (material) setInventory(true);
    if (newFairyDiscovered) setFairyLog(true);

    setCollecting(false);
    setCollected(true);
  }

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.tint} style={{ flex: 1 }} />
      </View>
    );
  }

  if (!visit || !fairy) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.back()}>
          <IconSymbol size={20} name="arrow.left" color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.errorText, { color: colors.icon }]}>Visit not found.</Text>
      </SafeAreaView>
    );
  }

  const isTestVisit = getDevTest().visitId === visit.id;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>

      {/* Fountain background */}
      <View style={styles.fountainBg} pointerEvents="none">
        <View style={[styles.bgTier1, { backgroundColor: colors.tint, opacity: 0.12 }]} />
        <View style={[styles.bgTier2, { backgroundColor: colors.tint, opacity: 0.09 }]} />
        <View style={[styles.bgTier3, { backgroundColor: colors.tint, opacity: 0.06 }]} />
        <View style={[styles.bgBasin, { backgroundColor: colors.tint, opacity: 0.04 }]} />
      </View>

      <SafeAreaView style={styles.safeTop}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.back()}>
          <IconSymbol size={20} name="arrow.left" color={colors.text} />
        </TouchableOpacity>
      </SafeAreaView>

      <View style={styles.content}>

        {/* Fairy portrait */}
        <View style={styles.fairyArea}>
          <View style={[styles.portrait, { backgroundColor: colors.card, borderColor: colors.tint }]}>
            {fairy.portrait_url && FAIRY_PORTRAITS[fairy.portrait_url]
              ? <Image source={FAIRY_PORTRAITS[fairy.portrait_url]} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
              : <Text style={styles.portraitEmoji}>✨</Text>}
          </View>
          <Text style={[styles.fairyName, { color: colors.text }]}>{fairy.name}</Text>
          <Text style={[styles.fairyRarity, { color: colors.coin }]}>
            {'★'.repeat({ common: 1, rare: 2, mythical: 3, legendary: 4 }[fairy.rarity] ?? 1)}
          </Text>
        </View>

        {collected ? (
          /* Post-collection state */
          <View style={[styles.giftCard, { backgroundColor: colors.card, borderColor: colors.tint }]}>
            <Text style={styles.giftEmoji}>🎁</Text>
            <Text style={[styles.giftTitle, { color: colors.text }]}>Gift collected!</Text>
            {materialName ? (
              <Text style={[styles.giftSub, { color: colors.icon }]}>
                {isTestVisit
                  ? `${materialName} (test — no XP)`
                  : `${materialName}${xpGained > 0 ? ` · ${xpGained}XP` : ''}`}
              </Text>
            ) : null}
            <Text style={[styles.hangingNote, { color: colors.icon }]}>
              {fairy.name} is still at the fountain until their visit ends ✨
            </Text>
            <TouchableOpacity
              style={[styles.doneButton, { backgroundColor: colors.tint }]}
              onPress={() => router.back()}>
              <Text style={styles.doneButtonText}>Back to fountain</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Pre-collection state */
          <View style={[styles.giftCard, { backgroundColor: colors.card, borderColor: colors.coin }]}>
            <Text style={styles.giftEmoji}>🎁</Text>
            <Text style={[styles.giftTitle, { color: colors.text }]}>
              {fairy.name} left you a gift!
            </Text>
            <TouchableOpacity
              style={[styles.collectButton, { backgroundColor: colors.coin }]}
              onPress={collectGift}
              disabled={collecting}>
              {collecting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.collectButtonText}>Open Gift ✨</Text>}
            </TouchableOpacity>
          </View>
        )}

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  safeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },

  fountainBg: {
    position: 'absolute',
    bottom: 140,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  bgTier1: { width: 120, height: 56, borderRadius: 60, marginBottom: -8 },
  bgTier2: { width: 220, height: 64, borderRadius: 60, marginBottom: -8 },
  bgTier3: { width: 320, height: 72, borderRadius: 60, marginBottom: -8 },
  bgBasin: { width: 400, height: 80, borderRadius: 40 },

  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
    justifyContent: 'center',
    gap: 28,
  },

  fairyArea: { alignItems: 'center', gap: 10 },
  portrait: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portraitEmoji: { fontSize: 44 },
  fairyName: { fontSize: 26, fontWeight: '700' },
  fairyRarity: { fontSize: 18 },

  giftCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 28,
    alignItems: 'center',
    gap: 16,
  },
  giftEmoji: { fontSize: 52 },
  giftTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  giftSub: { fontSize: 14, textAlign: 'center' },

  materialChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  materialName: { fontSize: 15, fontWeight: '600' },

  collectButton: {
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 40,
    alignItems: 'center',
    minWidth: 160,
  },
  collectButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  hangingNote: { fontSize: 13, textAlign: 'center', fontStyle: 'italic' },

  doneButton: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  doneButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  errorText: { textAlign: 'center', marginTop: 100, fontSize: 16 },
});
