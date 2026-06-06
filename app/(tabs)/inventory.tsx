import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { UserInventory, Material } from '@/types/database';

type InventoryItem = UserInventory & { material: Material | null };

const RARITY_COLOR: Record<string, string> = {
  common: '#A8A29E',
  uncommon: '#10B981',
  rare: '#7C3AED',
  legendary: '#F59E0B',
};

export default function InventoryScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [coinBalance, setCoinBalance] = useState(0);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

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
        numColumns={2}
        contentContainerStyle={[styles.grid, items.length === 0 && styles.empty]}
        columnWrapperStyle={styles.row}
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
              {/* Quantity badge */}
              <View style={[styles.badge, { backgroundColor: rarityColor }]}>
                <Text style={styles.badgeText}>×{item.quantity}</Text>
              </View>

              {/* Material icon placeholder */}
              <View style={[styles.materialIcon, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <IconSymbol size={28} name="drop.fill" color={rarityColor} />
              </View>

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
  title: { fontSize: 26, fontWeight: '700' },
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

  grid: { padding: 16, gap: 12 },
  row: { gap: 12 },
  empty: { flex: 1 },

  card: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 6,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
    zIndex: 1,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  materialIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  materialName: { fontSize: 15, fontWeight: '600' },
  materialRarity: { fontSize: 12, fontWeight: '500' },
  materialDesc: { fontSize: 12, lineHeight: 16 },

  emptyContent: { alignItems: 'center', gap: 12, paddingTop: 80 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptyHint: { fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
});
