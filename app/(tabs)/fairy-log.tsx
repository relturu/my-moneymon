import { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  useWindowDimensions,
  ImageBackground,
  Image,
} from 'react-native';

const FAIRY_PORTRAITS: Record<string, any> = {
  felicity: require('@/assets/images/felicity.png'),
  mallow:   require('@/assets/images/mallow.png'),
  pepper:   require('@/assets/images/pepper.png'),
  webster:  require('@/assets/images/webster.png'),
};
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

import CoinSvg from '@/assets/images/coin.svg';
import { supabase } from '@/lib/supabase';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getDevTest, setDevTest } from '@/lib/dev-test';
import { useNotifs } from '@/lib/notifications';
import type { FairyDefinition, UserFairyCollection } from '@/types/database';

type FairyEntry = FairyDefinition & {
  discovered: boolean;
  collection: UserFairyCollection | null;
};

export default function FairyLogScreen() {
  const { width } = useWindowDimensions();

  const [fairies, setFairies] = useState<FairyEntry[]>([]);
  const [coinBalance, setCoinBalance] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const listRef = useRef<FlatList>(null);
  const { setFairyLog } = useNotifs();

  useFocusEffect(
    useCallback(() => {
      setFairyLog(false);
      load();
      return () => {
        const dt = { ...getDevTest() };
        if (dt.active && dt.claimed) {
          setDevTest({ active: false, claimed: false, inventoryPendingCleanup: !!dt.materialId });
          runFairyLogCleanup(dt);
        }
      };
    }, [])
  );

  async function runFairyLogCleanup(dt: ReturnType<typeof getDevTest>) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !dt.visitId) return;
    const db = supabase as any;

    await db.from('fountain_visits').delete().eq('id', dt.visitId);

    if (dt.fairyId && dt.startedAt) {
      const { data: col } = await supabase
        .from('user_fairy_collection').select('id')
        .eq('user_id', user.id).eq('fairy_id', dt.fairyId)
        .gte('discovered_at', dt.startedAt).single();
      if (col) {
        await db.from('user_fairy_collection').delete().eq('id', (col as any).id);
      }
    }
  }

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
    setCurrentPage(0);
  }

  // Group fairies into pages of 4
  const pages: FairyEntry[][] = [];
  for (let i = 0; i < fairies.length; i += 4) {
    pages.push(fairies.slice(i, i + 4));
  }
  const totalPages = pages.length;

  function goToPage(index: number) {
    if (index < 0 || index >= totalPages) return;
    listRef.current?.scrollToIndex({ index, animated: true });
    setCurrentPage(index);
  }

  function renderFairyCard(fairy: FairyEntry | undefined) {
    if (!fairy) {
      return <View style={styles.card} />;
    }
    return (
      <TouchableOpacity
        style={[
          styles.card,
          fairy.discovered
            ? { backgroundColor: 'rgba(255,255,255,0.10)', borderColor: 'rgba(255,255,255,0.15)' }
            : { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.10)', opacity: 0.65 },
        ]}
        onPress={() => {
          if (fairy.discovered) {
            router.push({ pathname: '/fairy-log-detail' as any, params: { id: fairy.id } });
          }
        }}
        activeOpacity={fairy.discovered ? 0.75 : 1}>

        <View style={[
          styles.portrait,
          { backgroundColor: fairy.discovered ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.12)' },
        ]}>
          {fairy.discovered && fairy.portrait_url && FAIRY_PORTRAITS[fairy.portrait_url]
            ? <Image source={FAIRY_PORTRAITS[fairy.portrait_url]} style={{ width: '85%', height: '85%' }} resizeMode="contain" />
            : <Text style={styles.portraitEmoji}>{fairy.discovered ? '✨' : '🥚'}</Text>}
        </View>

        <Text
          style={[styles.fairyName, { color: fairy.discovered ? '#fff' : 'rgba(255,255,255,0.4)' }]}
          numberOfLines={1}>
          {fairy.discovered ? fairy.name : '???'}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <ImageBackground
      source={require('@/assets/images/home-background.png')}
      style={styles.bg}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>

        {/* Coin badge on background */}
        <View style={styles.topArea}>
          <View style={styles.coinBadge}>
            <CoinSvg width={15} height={15} />
            <Text style={styles.coinText}>{coinBalance}</Text>
          </View>
        </View>

        {/* Main panel */}
        <View style={styles.panel}>
          <View style={styles.handle} />

          {/* Panel header */}
          <View style={styles.panelHeader}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.navigate('/(tabs)/' as any)}>
              <IconSymbol size={20} name="arrow.left" color="#fff" />
            </TouchableOpacity>
            <Text style={styles.panelTitle}>Fairy Log</Text>
          </View>

          {/* Horizontal paged list — 4 fairies per page in 2×2 grid */}
          <FlatList
            ref={listRef}
            data={pages}
            keyExtractor={(_, i) => String(i)}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.pager}
            onMomentumScrollEnd={(e) => {
              const page = Math.round(e.nativeEvent.contentOffset.x / width);
              setCurrentPage(page);
            }}
            renderItem={({ item: pageFairies }) => (
              <View style={[styles.page, { width }]}>
                <View style={styles.gridRow}>
                  {renderFairyCard(pageFairies[0])}
                  {renderFairyCard(pageFairies[1])}
                </View>
                <View style={styles.gridRow}>
                  {renderFairyCard(pageFairies[2])}
                  {renderFairyCard(pageFairies[3])}
                </View>
              </View>
            )}
          />

          {/* Bottom bar: Prev | dots | Next */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[styles.navBtn, currentPage === 0 && styles.navBtnDisabled]}
              onPress={() => goToPage(currentPage - 1)}
              disabled={currentPage === 0}>
              <IconSymbol size={16} name="arrow.left" color="#fff" />
              <Text style={styles.navBtnText}>Prev</Text>
            </TouchableOpacity>

            <View style={styles.dots}>
              {pages.map((_, i) => (
                <TouchableOpacity key={i} onPress={() => goToPage(i)}>
                  <View style={[styles.dot, { backgroundColor: i === currentPage ? '#fff' : 'rgba(255,255,255,0.3)' }]} />
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.navBtn, currentPage >= totalPages - 1 && styles.navBtnDisabled]}
              onPress={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages - 1}>
              <Text style={styles.navBtnText}>Next</Text>
              <IconSymbol size={16} name="chevron.right" color="#fff" />
            </TouchableOpacity>
          </View>

        </View>

      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  safeArea: { flex: 1 },

  topArea: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 20,
  },
  coinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  coinText: { fontSize: 15, fontFamily: 'Kanchenjunga_700Bold', color: '#FCD34D' },

  panel: {
    flex: 1,
    backgroundColor: '#2A3E34',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignSelf: 'center',
    marginBottom: 14,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  backBtn: {
    width: 40, height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelTitle: {
    fontSize: 28,
    fontFamily: 'Kanchenjunga_700Bold',
    color: '#fff',
  },

  pager: { flex: 1 },

  page: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  gridRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },

  card: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portrait: {
    flex: 1,
    width: '100%',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portraitEmoji: { fontSize: 40 },
  fairyName: { fontSize: 15, fontFamily: 'Kanchenjunga_600SemiBold', textAlign: 'center' },

  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  navBtnDisabled: { opacity: 0.4 },
  navBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
