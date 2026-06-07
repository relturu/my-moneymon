import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ImageBackground,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { FountainVisit, FairyDefinition, UserFairyCollection } from '@/types/database';

const FAIRY_DIALOGUE: Record<string, string[]> = {
  Webster:  ['...', "You're still here.", 'Hmm. Good.'],
  Felicity: ['Hi hi! You came to see me!', 'Did you check your budget today?', "Keep it up! I'll be back soon ♡"],
  Mallow:   ['Oh, hello... I was just resting.', "It's cozy here by the fountain.", "I hope you're taking care of yourself too."],
  Pepper:   ['Hey! Finally! I thought you forgot me.', 'I dropped something for you, did you grab it?', "Okay, okay, I'll come back. Promise!"],
  Pearl:    ['...', 'The water remembers those who listen.', 'You have been faithful. That is enough.'],
};

const FAIRY_PORTRAITS: Record<string, any> = {
  felicity: require('@/assets/images/felicity.png'),
  mallow:   require('@/assets/images/mallow.png'),
  pepper:   require('@/assets/images/pepper.png'),
  webster:  require('@/assets/images/webster.png'),
};

export default function FairyChatScreen() {
  const { visitId, convoIndex: convoIndexParam } = useLocalSearchParams<{ visitId: string; convoIndex: string }>();
  const { width } = useWindowDimensions();
  const convoIndex = parseInt(convoIndexParam ?? '0', 10);

  const [visit, setVisit] = useState<FountainVisit | null>(null);
  const [fairy, setFairy] = useState<FairyDefinition | null>(null);
  const [collection, setCollection] = useState<UserFairyCollection | null>(null);
  const [coinBalance, setCoinBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
      const { data: profileData } = await supabase
        .from('users').select('coin_balance').eq('id', authUser.id).single();
      setCoinBalance((profileData as any)?.coin_balance ?? 0);

      const { data: colData } = await supabase
        .from('user_fairy_collection').select('*')
        .eq('user_id', authUser.id).eq('fairy_id', v.fairy_id).single();
      setCollection(colData as UserFairyCollection | null);
    }

    setLoading(false);
  }

  async function handleDone() {
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

    // First conversation unlocks the gift — route to gift screen
    if (newConvoCount === 1) {
      router.replace(`/fairy-gift?visitId=${visit.id}` as any);
    } else {
      router.back();
    }
  }

  if (loading) {
    return (
      <ImageBackground
        source={require('@/assets/images/home-background.png')}
        style={{ flex: 1 }}
        resizeMode="cover">
        <ActivityIndicator color="#fff" style={{ flex: 1 }} />
      </ImageBackground>
    );
  }

  if (!visit || !fairy) {
    return (
      <ImageBackground
        source={require('@/assets/images/home-background.png')}
        style={{ flex: 1 }}
        resizeMode="cover">
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <IconSymbol size={18} name="xmark" color="#fff" />
          </TouchableOpacity>
          <Text style={styles.errorText}>Visit not found.</Text>
        </SafeAreaView>
      </ImageBackground>
    );
  }

  const dialogueLine = FAIRY_DIALOGUE[fairy.name]?.[convoIndex % 3] ?? '...';
  const portrait = fairy.portrait_url ? FAIRY_PORTRAITS[fairy.portrait_url] : null;

  return (
    <ImageBackground
      source={require('@/assets/images/home-background.png')}
      style={styles.bg}
      resizeMode="cover">
      <SafeAreaView style={styles.safeArea} edges={['top']}>

        {/* Top row: coin badge left, close button right */}
        <View style={styles.topRow}>
          <View style={styles.coinBadge}>
            <Text style={styles.coinEmoji}>🪙</Text>
            <Text style={styles.coinText}>{coinBalance}</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <IconSymbol size={18} name="xmark" color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Middle: fairy portrait centered */}
        <View style={styles.middle}>
          {portrait
            ? <Image
                source={portrait}
                style={{ width: width * 0.65, height: width * 0.65 }}
                resizeMode="contain"
              />
            : <Text style={styles.portraitEmoji}>✨</Text>
          }
        </View>

        {/* Bottom dialogue card */}
        <View style={styles.dialogueCard}>
          <View style={styles.nameChip}>
            <Text style={styles.nameChipText}>{fairy.name}</Text>
          </View>
          <Text style={styles.dialogueText}>{dialogueLine}</Text>
          <TouchableOpacity
            style={styles.advanceBtn}
            onPress={handleDone}
            disabled={saving}>
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <IconSymbol size={20} name="chevron.right" color="#fff" />
            }
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  safeArea: { flex: 1 },

  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  coinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  coinEmoji: { fontSize: 16 },
  coinText: { fontSize: 16, fontFamily: 'Kanchenjunga_700Bold', color: '#FCD34D' },

  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  middle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portraitEmoji: { fontSize: 100 },

  dialogueCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    gap: 12,
  },
  nameChip: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: '#2A3E34',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  nameChipText: {
    fontSize: 13,
    fontFamily: 'Kanchenjunga_600SemiBold',
    color: '#2A3E34',
  },
  dialogueText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#1A2E24',
  },
  advanceBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },

  errorText: { color: '#fff', textAlign: 'center', marginTop: 100 },
});
