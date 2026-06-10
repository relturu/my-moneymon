import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ImageBackground, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';

import CoinSvg from '@/assets/images/coin.svg';
import { supabase } from '@/lib/supabase';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getDevTest, clearDevTest } from '@/lib/dev-test';
import { useNotifs } from '@/lib/notifications';
import type { UserInventory, Material } from '@/types/database';

type InventoryItem = UserInventory & { material: Material | null };

const RARITY_COLOR: Record<string, string> = {
  common: '#A8A29E',
  rare: '#10B981',
  mythical: '#7C3AED',
  legendary: '#F59E0B',
};

export default function InventoryScreen() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [coinBalance, setCoinBalance] = useState(0);
  const { setInventory } = useNotifs();

  useFocusEffect(
    useCallback(() => {
      setInventory(false);
      load();
      return () => {
        const dt = { ...getDevTest() };
        if (dt.inventoryPendingCleanup && dt.materialId) {
          clearDevTest();
          runInventoryCleanup(dt.materialId);
        }
      };
    }, [])
  );

  async function runInventoryCleanup(materialId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const db = supabase as any;
    const { data: inv } = await supabase
      .from('user_inventory').select('id, quantity')
      .eq('user_id', user.id).eq('material_id', materialId).single();
    if (!inv) return;
    const qty = (inv as any).quantity as number;
    if (qty <= 1) {
      await db.from('user_inventory').delete().eq('id', (inv as any).id);
    } else {
      await db.from('user_inventory').update({ quantity: qty - 1 }).eq('id', (inv as any).id);
    }
  }

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from('users').select('coin_balance').eq('id', user.id).single();
    setCoinBalance((profile as any)?.coin_balance ?? 0);
    const { data } = await supabase
      .from('user_inventory')
      .select('*, material:materials(*)')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    setItems((data as InventoryItem[] | null) ?? []);
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

          {/* Panel header with back button */}
          <View style={styles.panelHeader}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.navigate('/(tabs)')}>
              <IconSymbol size={20} name="arrow.left" color="#fff" />
            </TouchableOpacity>
            <Text style={styles.panelTitle}>Inventory</Text>
          </View>

          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.list, items.length === 0 && styles.listEmpty]}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.divider} />}
            ListEmptyComponent={
              <View style={styles.emptyContent}>
                <Text style={styles.emptyEmoji}>🌿</Text>
                <Text style={styles.emptyTitle}>No materials yet</Text>
                <Text style={styles.emptyHint}>
                  Interact with fairies at the fountain to collect drops
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const rarity = item.material?.rarity ?? 'common';
              const rarityColor = RARITY_COLOR[rarity] ?? '#A8A29E';
              const xpMin = item.material?.xp_min;
              const xpMax = item.material?.xp_max;
              const expLabel = xpMin != null
                ? `${xpMin}${xpMax != null && xpMax !== xpMin ? `–${xpMax}` : ''}XP`
                : null;

              return (
                <View style={styles.itemRow}>
                  <View style={styles.thumbWrap}>
                    <View style={[styles.thumb, { borderColor: rarityColor + '55' }]}>
                      <IconSymbol size={36} name="drop.fill" color={rarityColor} />
                    </View>
                    <View style={styles.qtyBadge}>
                      <Text style={styles.qtyText}>x{item.quantity}</Text>
                    </View>
                  </View>
                  <View style={styles.info}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {item.material?.name ?? 'Material'}
                    </Text>
                    {expLabel ? <Text style={styles.expText}>{expLabel}</Text> : null}
                    {item.material?.description ? (
                      <Text style={styles.itemDesc} numberOfLines={2}>
                        {item.material.description}
                      </Text>
                    ) : null}
                    <Text style={[styles.rarityTag, { color: rarityColor }]}>
                      {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
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

  list: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 8 },
  listEmpty: { flex: 1 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 14 },

  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  thumbWrap: { position: 'relative', flexShrink: 0 },
  thumb: {
    width: 80, height: 80,
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBadge: {
    position: 'absolute',
    bottom: -6, left: -6,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  qtyText: { fontSize: 12, fontFamily: 'Kanchenjunga_700Bold', color: '#fff' },

  info: { flex: 1, gap: 3 },
  itemName: { fontSize: 20, fontFamily: 'Kanchenjunga_700Bold', color: '#fff' },
  expText: { fontSize: 14, fontFamily: 'Kanchenjunga_600SemiBold', color: '#FCD34D' },
  itemDesc: { fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 18 },
  rarityTag: { fontSize: 12, fontFamily: 'Kanchenjunga_500Medium', marginTop: 2 },

  emptyContent: { alignItems: 'center', gap: 12, paddingTop: 60 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontFamily: 'Kanchenjunga_600SemiBold', color: '#fff' },
  emptyHint: { fontSize: 14, textAlign: 'center', paddingHorizontal: 32, color: 'rgba(255,255,255,0.6)' },
});
