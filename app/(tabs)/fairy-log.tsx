import { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getDevTest, setDevTest } from '@/lib/dev-test';
import { useNotifs } from '@/lib/notifications';
import type { FairyDefinition, UserFairyCollection } from '@/types/database';

type FairyEntry = FairyDefinition & {
  discovered: boolean;
  collection: UserFairyCollection | null;
};

export default function FairyLogScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
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
      // Empty placeholder to keep 2x2 grid aligned
      return <View style={styles.card} />;
    }
    return (
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: fairy.discovered ? colors.card : colors.background,
            borderColor: colors.border,
            opacity: fairy.discovered ? 1 : 0.65,
          },
        ]}
        onPress={() => {
          if (fairy.discovered) {
            router.push({ pathname: '/fairy-log-detail' as any, params: { id: fairy.id } });
          }
        }}
        activeOpacity={fairy.discovered ? 0.75 : 1}>

        <View style={[
          styles.portrait,
          {
            backgroundColor: fairy.discovered ? colors.background : colors.border,
            borderColor: colors.border,
          },
        ]}>
          {fairy.discovered
            ? <Text style={styles.portraitEmoji}>✨</Text>
            : <Text style={styles.portraitEmoji}>🥚</Text>}
        </View>

        <Text
          style={[styles.fairyName, { color: fairy.discovered ? colors.text : colors.icon }]}
          numberOfLines={1}>
          {fairy.discovered ? fairy.name : '???'}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>

      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={[styles.title, { color: colors.text }]}>Fairy Log</Text>
        <View style={styles.topBarRight}>
          <View style={[styles.wishBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <IconSymbol size={16} name="heart.fill" color={colors.coin} />
            <Text style={[styles.wishText, { color: colors.coin }]}>{coinBalance}</Text>
          </View>
          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.back()}>
            <IconSymbol size={18} name="xmark" color={colors.text} />
          </TouchableOpacity>
        </View>
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
      <View style={[styles.bottomBar, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.navBtn,
            { backgroundColor: colors.card, borderColor: colors.border },
            currentPage === 0 && styles.navBtnDisabled,
          ]}
          onPress={() => goToPage(currentPage - 1)}
          disabled={currentPage === 0}>
          <IconSymbol size={16} name="arrow.left" color={currentPage === 0 ? colors.icon : colors.text} />
          <Text style={[styles.navBtnText, { color: currentPage === 0 ? colors.icon : colors.text }]}>Prev</Text>
        </TouchableOpacity>

        <View style={styles.dots}>
          {pages.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => goToPage(i)}>
              <View style={[styles.dot, { backgroundColor: i === currentPage ? colors.tint : colors.border }]} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[
            styles.navBtn,
            { backgroundColor: colors.card, borderColor: colors.border },
            currentPage >= totalPages - 1 && styles.navBtnDisabled,
          ]}
          onPress={() => goToPage(currentPage + 1)}
          disabled={currentPage >= totalPages - 1}>
          <Text style={[styles.navBtnText, { color: currentPage >= totalPages - 1 ? colors.icon : colors.text }]}>Next</Text>
          <IconSymbol size={16} name="chevron.right" color={currentPage >= totalPages - 1 ? colors.icon : colors.text} />
        </TouchableOpacity>
      </View>

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
  title: { fontSize: 24, fontWeight: '700' },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
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

  pager: { flex: 1 },

  // Each page is the full screen width, 2×2 grid
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
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portraitEmoji: { fontSize: 40 },
  fairyName: { fontSize: 15, fontWeight: '600', textAlign: 'center' },

  // Bottom navigation
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
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
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  navBtnDisabled: { opacity: 0.4 },
  navBtnText: { fontSize: 15, fontWeight: '600' },
});
