import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { FountainVisit, FairyDefinition, UserFairyCollection } from '@/types/database';

// Three conversation sets — indexed by convo_count (0, 1, 2)
const DIALOGUES: ((name: string) => string[])[] = [
  (name) => [
    `*${name} glances up with curious eyes*`,
    "Oh... a visitor. I don't often see humans so close.",
    "This water calls to wanderers, I think.",
    "Stay awhile... if you'd like. ✨",
  ],
  (name) => [
    `Ah, you again. I'm glad you came back.`,
    "I've been watching the ripples in the water.",
    "Each wish tells a story, you know.",
    `Yours feels like one worth listening to, ${name.split(' ')[0]}. 🌊`,
  ],
  (name) => [
    "The time has nearly come for me to leave.",
    `*${name} touches the fountain gently*`,
    "I'll carry a piece of this place with me.",
    "Until we meet again — may your wishes find their way. 🌸",
  ],
];

function formatDuration(ms: number): string {
  if (ms <= 0) return '0m';
  const h = Math.floor(ms / (1000 * 60 * 60));
  const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function getNextAvailableSlot(visit: FountainVisit): string | null {
  const slots = [...(visit.convo_slots ?? [])].sort();
  const used = visit.convo_count ?? 0;
  return slots[used] ?? null;
}

export default function FairyChatScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { visitId } = useLocalSearchParams<{ visitId: string }>();

  const [visit, setVisit] = useState<FountainVisit | null>(null);
  const [fairy, setFairy] = useState<FairyDefinition | null>(null);
  const [collection, setCollection] = useState<UserFairyCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tick, setTick] = useState(0);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

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
    setFairy(fairyData as FairyDefinition | null);

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      const { data: colData } = await supabase
        .from('user_fairy_collection').select('*')
        .eq('user_id', authUser.id).eq('fairy_id', v.fairy_id).single();
      setCollection(colData as UserFairyCollection | null);
    }

    setLoading(false);
  }

  function advancePhrase() {
    if (!fairy || !visit) return;
    const dialogue = DIALOGUES[visit.convo_count ?? 0](fairy.name);
    if (phraseIndex < dialogue.length - 1) {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      setPhraseIndex(phraseIndex + 1);
    } else {
      setDone(true);
    }
  }

  async function finishConvo() {
    if (!visit || !fairy || saving) return;
    setSaving(true);

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) { setSaving(false); return; }

    const db = supabase as any;
    const newConvoCount = (visit.convo_count ?? 0) + 1;
    const now = new Date().toISOString();

    await db.from('fountain_visits')
      .update({ convo_count: newConvoCount, interacted_at: now })
      .eq('id', visit.id);

    if (collection) {
      await db.from('user_fairy_collection')
        .update({ friendship_level: collection.friendship_level + 1, last_interaction_at: now })
        .eq('id', collection.id);
    } else {
      await db.from('user_fairy_collection').insert({
        user_id: authUser.id,
        fairy_id: fairy.id,
        friendship_level: 1,
        total_visits: 0,
        last_interaction_at: now,
      });
    }

    setSaving(false);

    // After the first conversation, navigate to gift screen (collect gift immediately)
    // Subsequent convos just go back to the fountain
    if (newConvoCount === 1) {
      router.replace(`/fairy-gift?visitId=${visit.id}` as any);
    } else {
      router.back();
    }
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
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <IconSymbol size={22} name="arrow.left" color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.errorText, { color: colors.icon }]}>Visit not found.</Text>
      </SafeAreaView>
    );
  }

  const convoCount = visit.convo_count ?? 0;
  const nextSlot = getNextAvailableSlot(visit);
  const isAvailable = nextSlot ? Date.now() >= new Date(nextSlot).getTime() : false;
  const allDone = convoCount >= 3;
  const dialogue = DIALOGUES[Math.min(convoCount, 2)](fairy.name);
  const timeUntilNext = nextSlot ? new Date(nextSlot).getTime() - Date.now() : 0;

  // Force re-render for countdown — tick is used implicitly
  void tick;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>

      {/* Back button */}
      <SafeAreaView style={styles.safeTop}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.back()}>
          <IconSymbol size={20} name="arrow.left" color={colors.text} />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Fountain background tiers — centered, large, behind everything */}
      <View style={styles.fountainBg} pointerEvents="none">
        <View style={[styles.bgTier1, { backgroundColor: colors.tint, opacity: 0.12 }]} />
        <View style={[styles.bgTier2, { backgroundColor: colors.tint, opacity: 0.09 }]} />
        <View style={[styles.bgTier3, { backgroundColor: colors.tint, opacity: 0.06 }]} />
        <View style={[styles.bgBasin, { backgroundColor: colors.tint, opacity: 0.04 }]} />
      </View>

      {/* Fairy centered */}
      <View style={styles.fairyArea}>
        <View style={[styles.portrait, { backgroundColor: colors.card, borderColor: colors.tint }]}>
          <Text style={styles.portraitEmoji}>✨</Text>
        </View>
        <Text style={[styles.fairyName, { color: colors.text }]}>{fairy.name}</Text>
        <Text style={[styles.fairyRarity, { color: colors.coin }]}>
          {'★'.repeat({ common: 1, uncommon: 2, rare: 3, legendary: 4 }[fairy.rarity] ?? 1)}
        </Text>
        <Text style={[styles.convoCount, { color: colors.icon }]}>
          {convoCount}/3 conversations this visit
        </Text>
      </View>

      {/* Speech area */}
      <View style={styles.speechArea}>
        {allDone ? (
          <View style={[styles.speechBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.phrase, { color: colors.icon }]}>
              {fairy.name} has nothing more to say this visit...
            </Text>
            <Text style={[styles.tapHint, { color: colors.tint }]}>
              Come back next time ✨
            </Text>
          </View>
        ) : !isAvailable ? (
          <View style={[styles.speechBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.phrase, { color: colors.icon }]}>
              {fairy.name} isn't ready to talk yet...
            </Text>
            <Text style={[styles.nextConvoLabel, { color: colors.text }]}>Next conversation in</Text>
            <Text style={[styles.nextConvoTime, { color: colors.tint }]}>
              {formatDuration(timeUntilNext)}
            </Text>
          </View>
        ) : done ? (
          <View style={[styles.speechBox, { backgroundColor: colors.card, borderColor: colors.tint }]}>
            <Text style={[styles.phrase, { color: colors.text }]}>
              {fairy.name} smiles softly.
            </Text>
            <TouchableOpacity
              style={[styles.doneButton, { backgroundColor: colors.tint }]}
              onPress={finishConvo}
              disabled={saving}>
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.doneButtonText}>See you later ✨</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.speechBox, { backgroundColor: colors.card, borderColor: colors.tint }]}
            onPress={advancePhrase}
            activeOpacity={0.85}>
            <Animated.Text style={[styles.phrase, { color: colors.text, opacity: fadeAnim }]}>
              {dialogue[phraseIndex]}
            </Animated.Text>
            <Text style={[styles.tapHint, { color: colors.tint }]}>
              {phraseIndex < dialogue.length - 1 ? 'Tap to continue...' : 'Tap to finish'}
            </Text>
          </TouchableOpacity>
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

  // Fountain circles in background
  fountainBg: {
    position: 'absolute',
    bottom: 160,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  bgTier1: { width: 120, height: 56, borderRadius: 60, marginBottom: -8, zIndex: 4 },
  bgTier2: { width: 220, height: 64, borderRadius: 60, marginBottom: -8, zIndex: 3 },
  bgTier3: { width: 320, height: 72, borderRadius: 60, marginBottom: -8, zIndex: 2 },
  bgBasin: { width: 400, height: 80, borderRadius: 40, zIndex: 1 },

  // Fairy centered in upper portion
  fairyArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 10,
  },
  portrait: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  portraitEmoji: { fontSize: 56 },
  fairyName: { fontSize: 28, fontWeight: '700' },
  fairyRarity: { fontSize: 20 },
  convoCount: { fontSize: 13 },

  // Speech box at bottom
  speechArea: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  speechBox: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 24,
    gap: 14,
    minHeight: 140,
    justifyContent: 'center',
  },
  phrase: { fontSize: 17, lineHeight: 26, textAlign: 'center' },
  tapHint: { fontSize: 13, textAlign: 'center', fontStyle: 'italic' },
  nextConvoLabel: { fontSize: 13, textAlign: 'center' },
  nextConvoTime: { fontSize: 28, fontWeight: '800', textAlign: 'center' },

  doneButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  doneButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  errorText: { textAlign: 'center', marginTop: 100, fontSize: 16 },
});
