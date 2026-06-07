import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
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
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [coinBalance, setCoinBalance] = useState(0);
  const { setInventory } = useNotifs();

  useFocusEffect(
    useCallback(() => {
      setInventory(false); // clear dot when user opens inventory
      load();
      return () => {
        // Clean up test inventory item when user leaves the inventory tab
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
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>

      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={[styles.title, { color: colors.text }]}>Inventory</Text>
        <View style={[styles.wishBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <IconSymbol size={16} name="heart.fill" color={colors.coin} />
          <Text style={[styles.wishText, { color: colors.coin }]}>{coinBalance}</Text>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, items.length === 0 && styles.empty]}
        ListEmptyComponent={
          <View style={styles.emptyContent}>
            <Text style={styles.emptyEmoji}>🌿</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No materials yet</Text>
            <Text style={[styles.emptyHint, { color: colors.icon }]}>
              Interact with fairies at the fountain to collect drops
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const rarity = item.material?.rarity ?? 'common';
          const rarityColor = RARITY_COLOR[rarity] ?? colors.icon;
          return (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Material icon — left side */}
              <View style={[styles.materialIcon, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <IconSymbol size={28} name="drop.fill" color={rarityColor} />
              </View>

              {/* Info — right side */}
              <View style={styles.materialInfo}>
                <Text style={[styles.materialName, { color: colors.text }]} numberOfLines={1}>
                  {item.material?.name ?? 'Material'}
                </Text>
                <Text style={[styles.materialRarity, { color: rarityColor }]}>
                  {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
                </Text>
                {item.material?.description ? (
                  <Text style={[styles.materialDesc, { color: colors.icon }]} numberOfLines={2}>
                    {item.material.description}
                  </Text>
                ) : null}
              </View>

              {/* Quantity badge — right */}
              <View style={[styles.badge, { backgroundColor: colors.border }]}>
                <Text style={[styles.badgeText, { color: colors.text }]}>x{item.quantity}</Text>
              </View>
            </View>
          );
        }}
      />
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
    paddingBottom: 12,
  },
  title: { fontSize: 26, fontFamily: 'Kanchenjunga_700Bold' },
  wishBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  wishText: { fontSize: 15, fontFamily: 'Kanchenjunga_700Bold' },

  list: { padding: 16, gap: 10, paddingBottom: 32 },
  empty: { flex: 1 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 14,
  },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 'auto',
    flexShrink: 0,
  },
  badgeText: { fontSize: 13, fontFamily: 'Kanchenjunga_700Bold' },

  materialIcon: {
    width: 60,
    height: 60,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  materialInfo: { flex: 1, gap: 3 },
  materialName: { fontSize: 15, fontFamily: 'Kanchenjunga_600SemiBold' },
  materialRarity: { fontSize: 12, fontWeight: '500' },
  materialDesc: { fontSize: 12, lineHeight: 16 },

  emptyContent: { alignItems: 'center', gap: 12, paddingTop: 80 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontFamily: 'Kanchenjunga_600SemiBold' },
  emptyHint: { fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
});
