import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Alert,
  ActivityIndicator,
  Switch,
  ScrollView,
} from 'react-native';

import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  isAdmin,
  getSnapshot,
  isGodModeEnabled,
  setGodModeEnabled,
  restoreSnapshot,
  jumpToLevel,
  maxEverything,
  resetToStart,
  godAdjustCoins,
  godAdjustXP,
  godJumpToLevel,
  godAddFairy,
} from '@/lib/admin';

type Props = {
  userId: string;
  userEmail: string | null;
};

const LEVELS = [1, 2, 3, 4, 5];

export default function AdminTestPanel({ userId, userEmail }: Props) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [panelOpen, setPanelOpen] = useState(false);
  const [godMode, setGodMode] = useState(false);
  const [hasSnapshot, setHasSnapshot] = useState(false);
  const [loading, setLoading] = useState(false);

  // Live god mode display values
  const [coins, setCoins] = useState(0);
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);

  useEffect(() => {
    if (panelOpen) {
      const gm = isGodModeEnabled();
      setGodMode(gm);
      setHasSnapshot(getSnapshot() !== null);
      if (gm) loadUserData();
    }
  }, [panelOpen]);

  if (!isAdmin(userEmail)) return null;

  async function loadUserData() {
    const { data } = await supabase
      .from('users')
      .select('coin_balance,fountain_xp,fountain_level')
      .eq('id', userId)
      .single();
    if (data) {
      setCoins((data as any).coin_balance ?? 0);
      setXp((data as any).fountain_xp ?? 0);
      setLevel((data as any).fountain_level ?? 1);
    }
  }

  function handleGodModeToggle(value: boolean) {
    setGodMode(value);
    setGodModeEnabled(value);
    if (value) loadUserData();
  }

  // ── God Mode actions (no snapshots) ──────────────────────────────────────────

  async function handleAdjustCoins(delta: number) {
    setLoading(true);
    try {
      const next = await godAdjustCoins(userId, delta);
      setCoins(next);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdjustXP(delta: number) {
    setLoading(true);
    try {
      const { xp: newXp, level: newLevel } = await godAdjustXP(userId, delta);
      setXp(newXp);
      setLevel(newLevel);
    } finally {
      setLoading(false);
    }
  }

  async function handleGodJumpToLevel(l: number) {
    setLoading(true);
    try {
      const { xp: newXp, level: newLevel } = await godJumpToLevel(userId, l);
      setXp(newXp);
      setLevel(newLevel);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddFairy() {
    setLoading(true);
    try {
      const name = await godAddFairy(userId);
      if (name) {
        Alert.alert('Fairy Added', `${name} discovered!`);
      } else {
        Alert.alert('All fairies already discovered!');
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Preset actions (with snapshots) ──────────────────────────────────────────

  async function handleJumpToLevel(l: number) {
    setLoading(true);
    try {
      await jumpToLevel(userId, l);
      setPanelOpen(false);
      setHasSnapshot(true);
      Alert.alert('Done', `Jumped to level ${l}. Navigate to profile to confirm.`);
    } finally {
      setLoading(false);
    }
  }

  function handleMaxEverything() {
    Alert.alert(
      'Max Everything?',
      'Set level 5, 1500 XP, 1000 coins, and unlock all fairies and materials.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Max Everything',
          onPress: async () => {
            setLoading(true);
            try {
              await maxEverything(userId);
              setPanelOpen(false);
              setHasSnapshot(true);
              Alert.alert('Done', 'Everything maxed out!');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }

  function handleResetToStart() {
    Alert.alert(
      'Reset to Start?',
      'Deletes all fairies, inventory, visits, quests, and coin history. Resets to 100 coins, level 1.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await resetToStart(userId);
              setPanelOpen(false);
              setHasSnapshot(true);
              Alert.alert('Done', 'Reset to starting state.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }

  async function handleUndo() {
    if (!hasSnapshot) return;
    setLoading(true);
    try {
      await restoreSnapshot(userId);
      setPanelOpen(false);
      setHasSnapshot(false);
      Alert.alert('Done', 'Undid last action. Navigate to any tab to refresh.');
    } finally {
      setLoading(false);
    }
  }

  const fabActive = isGodModeEnabled();

  return (
    <>
      <TouchableOpacity
        style={[
          styles.fab,
          {
            backgroundColor: fabActive ? colors.tint : colors.card,
            borderColor: fabActive ? colors.tint : colors.border,
          },
        ]}
        onPress={() => setPanelOpen(true)}>
        <Text style={styles.fabEmoji}>🧪</Text>
      </TouchableOpacity>

      <Modal
        visible={panelOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPanelOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setPanelOpen(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.card }]}
            onPress={(e) => e.stopPropagation()}>

            <View style={[styles.handle, { backgroundColor: colors.border }]} />

            {/* Header + toggle */}
            <View style={styles.headerRow}>
              <View>
                <Text style={[styles.title, { color: colors.text }]}>Admin Panel</Text>
                <Text style={[styles.subtitle, { color: colors.icon }]}>test@moneymon.app</Text>
              </View>
              <View style={styles.toggleGroup}>
                <Text style={[styles.toggleLabel, { color: godMode ? colors.tint : colors.icon }]}>
                  God Mode
                </Text>
                <Switch
                  value={godMode}
                  onValueChange={handleGodModeToggle}
                  trackColor={{ false: colors.border, true: colors.tint }}
                  thumbColor="#fff"
                />
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
              {godMode ? (
                // ── GOD MODE: live controls ──────────────────────────────────
                <View style={styles.godBody}>

                  {/* Coins stepper */}
                  <View style={styles.section}>
                    <Text style={[styles.sectionLabel, { color: colors.icon }]}>COINS</Text>
                    <View style={styles.stepperRow}>
                      {[-100, -10].map((d) => (
                        <TouchableOpacity
                          key={d}
                          style={[styles.stepBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                          onPress={() => handleAdjustCoins(d)}
                          disabled={loading}>
                          <Text style={[styles.stepBtnText, { color: colors.text }]}>{d}</Text>
                        </TouchableOpacity>
                      ))}
                      <View style={[styles.stepValue, { backgroundColor: colors.background, borderColor: colors.border }]}>
                        <Text style={[styles.stepValueText, { color: colors.coin }]}>♥ {coins}</Text>
                      </View>
                      {[10, 100].map((d) => (
                        <TouchableOpacity
                          key={d}
                          style={[styles.stepBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                          onPress={() => handleAdjustCoins(d)}
                          disabled={loading}>
                          <Text style={[styles.stepBtnText, { color: colors.text }]}>+{d}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* XP stepper */}
                  <View style={styles.section}>
                    <Text style={[styles.sectionLabel, { color: colors.icon }]}>FOUNTAIN XP</Text>
                    <View style={styles.stepperRow}>
                      {[-100, -50].map((d) => (
                        <TouchableOpacity
                          key={d}
                          style={[styles.stepBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                          onPress={() => handleAdjustXP(d)}
                          disabled={loading}>
                          <Text style={[styles.stepBtnText, { color: colors.text }]}>{d}</Text>
                        </TouchableOpacity>
                      ))}
                      <View style={[styles.stepValue, { backgroundColor: colors.background, borderColor: colors.border }]}>
                        <Text style={[styles.stepValueText, { color: colors.tint }]}>{xp} XP</Text>
                      </View>
                      {[50, 100].map((d) => (
                        <TouchableOpacity
                          key={d}
                          style={[styles.stepBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                          onPress={() => handleAdjustXP(d)}
                          disabled={loading}>
                          <Text style={[styles.stepBtnText, { color: colors.text }]}>+{d}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Level chips */}
                  <View style={styles.section}>
                    <Text style={[styles.sectionLabel, { color: colors.icon }]}>FOUNTAIN LEVEL</Text>
                    <View style={styles.levelRow}>
                      {LEVELS.map((l) => (
                        <TouchableOpacity
                          key={l}
                          style={[
                            styles.levelChip,
                            {
                              backgroundColor: level === l ? colors.tint : colors.background,
                              borderColor: level === l ? colors.tint : colors.border,
                            },
                          ]}
                          onPress={() => handleGodJumpToLevel(l)}
                          disabled={loading}>
                          <Text style={[styles.levelChipText, { color: level === l ? '#fff' : colors.tint }]}>
                            {l}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Add fairy */}
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: colors.tint }]}
                    onPress={handleAddFairy}
                    disabled={loading}>
                    <Text style={styles.actionButtonText}>+ Add Random Fairy</Text>
                  </TouchableOpacity>

                </View>
              ) : (
                // ── PRESET MODE: bulk actions ────────────────────────────────
                <View style={styles.godBody}>

                  <View style={styles.section}>
                    <Text style={[styles.sectionLabel, { color: colors.icon }]}>JUMP TO LEVEL</Text>
                    <View style={styles.levelRow}>
                      {LEVELS.map((l) => (
                        <TouchableOpacity
                          key={l}
                          style={[styles.levelChip, { backgroundColor: colors.background, borderColor: colors.tint }]}
                          onPress={() => handleJumpToLevel(l)}
                          disabled={loading}>
                          <Text style={[styles.levelChipText, { color: colors.tint }]}>{l}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: colors.tint }]}
                    onPress={handleMaxEverything}
                    disabled={loading}>
                    <Text style={styles.actionButtonText}>Max Everything</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: colors.expense }]}
                    onPress={handleResetToStart}
                    disabled={loading}>
                    <Text style={styles.actionButtonText}>Reset to Start</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      styles.undoButton,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        opacity: hasSnapshot ? 1 : 0.4,
                      },
                    ]}
                    onPress={handleUndo}
                    disabled={!hasSnapshot || loading}>
                    <Text style={[styles.actionButtonText, { color: colors.text }]}>
                      Undo Last Action
                    </Text>
                  </TouchableOpacity>

                </View>
              )}
            </ScrollView>

            {loading && <ActivityIndicator color={colors.tint} style={{ marginTop: 4 }} />}

          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  fabEmoji: { fontSize: 22 },

  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 48,
    maxHeight: '85%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 2 },
  toggleGroup: { alignItems: 'flex-end', gap: 4 },
  toggleLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },

  scroll: { flexGrow: 0 },
  godBody: { gap: 16 },

  section: { gap: 10 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },

  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: 'center',
    minWidth: 44,
  },
  stepBtnText: { fontSize: 13, fontWeight: '600' },
  stepValue: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  stepValueText: { fontSize: 14, fontWeight: '700' },

  levelRow: { flexDirection: 'row', gap: 8 },
  levelChip: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 12,
    alignItems: 'center',
  },
  levelChipText: { fontSize: 16, fontWeight: '700' },

  actionButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  undoButton: { borderWidth: 1.5 },
  actionButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
