import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import CoinSvg from '@/assets/images/coin.svg';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { User } from '@/types/database';

export default function ProfileScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftUsername, setDraftUsername] = useState('');
  const [saveError, setSaveError] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadUser();
    }, [])
  );

  async function loadUser() {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;
    const { data } = await supabase.from('users').select('*').eq('id', authUser.id).single();
    setUser(data);
    setDraftUsername(data?.user_name ?? '');
    setLoading(false);
  }

  function startEditing() {
    setDraftUsername(user?.user_name ?? '');
    setSaveError('');
    setEditing(true);
  }

  function cancelEditing() {
    setDraftUsername(user?.user_name ?? '');
    setSaveError('');
    setEditing(false);
  }

  async function saveChanges() {
    if (!draftUsername.trim()) {
      setSaveError('Username cannot be empty.');
      return;
    }
    setSaving(true);
    setSaveError('');
    const { error } = await supabase
      .from('users')
      .update({ user_name: draftUsername.trim() })
      .eq('id', user!.id);
    if (error) {
      setSaveError(error.message);
      setSaving(false);
      return;
    }
    setUser((prev) => prev ? { ...prev, user_name: draftUsername.trim() } : prev);
    setSaving(false);
    setEditing(false);
  }

  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
        },
      },
    ]);
  }

  const initials = user?.user_name
    ? user.user_name.slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? '??';

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator style={{ flex: 1 }} color={colors.tint} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* Header */}
        <Text style={[styles.title, { color: colors.text }]}>Profile</Text>

        {/* Avatar + name */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, { backgroundColor: '#425F4D' }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={[styles.displayName, { color: colors.text }]}>
            {user?.user_name ?? 'No username'}
          </Text>
          <Text style={[styles.email, { color: colors.icon }]}>{user?.email ?? ''}</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <CoinSvg width={18} height={18} />
              <Text style={[styles.statValue, { color: colors.coin }]}>{user?.coin_balance ?? 0}</Text>
            </View>
            <Text style={[styles.statLabel, { color: colors.icon }]}>Coins</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: '#B7C8BF', borderWidth: 1.5 }]}>
            <Text style={[styles.statValue, { color: '#69835C' }]}>Lv. {user?.fountain_level ?? 1}</Text>
            <Text style={[styles.statLabel, { color: colors.icon }]}>Fountain</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: '#B7C8BF', borderWidth: 1.5 }]}>
            <Text style={[styles.statValue, { color: '#69835C' }]}>{user?.fountain_xp ?? 0}</Text>
            <Text style={[styles.statLabel, { color: colors.icon }]}>XP</Text>
          </View>
        </View>

        {/* Edit info */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: '#B7C8BF' }]}>
          <View style={[styles.sectionHeader, { backgroundColor: 'rgba(183,200,191,0.18)' }]}>
            <Text style={[styles.sectionTitle, { color: '#425F4D' }]}>Account Info</Text>
            {!editing ? (
              <TouchableOpacity onPress={startEditing}>
                <Text style={[styles.editLink, { color: '#69835C' }]}>Edit</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={cancelEditing}>
                <Text style={[styles.editLink, { color: colors.icon }]}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Username */}
          <View style={[styles.field, { borderTopColor: colors.border }]}>
            <Text style={[styles.fieldLabel, { color: colors.icon }]}>Username</Text>
            {editing ? (
              <TextInput
                style={[styles.fieldInput, { color: colors.text, borderColor: '#69835C' }]}
                value={draftUsername}
                onChangeText={setDraftUsername}
                autoCapitalize="none"
                autoFocus
              />
            ) : (
              <Text style={[styles.fieldValue, { color: colors.text }]}>
                {user?.user_name ?? '—'}
              </Text>
            )}
          </View>

          {/* Email — display only */}
          <View style={[styles.field, { borderTopColor: colors.border }]}>
            <Text style={[styles.fieldLabel, { color: colors.icon }]}>Email</Text>
            <Text style={[styles.fieldValue, { color: colors.text }]}>{user?.email ?? '—'}</Text>
          </View>

          {saveError ? (
            <Text style={styles.saveError}>{saveError}</Text>
          ) : null}

          {editing && (
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: '#425F4D' }]}
              onPress={saveChanges}
              disabled={saving}>
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.saveButtonText}>Save Changes</Text>}
            </TouchableOpacity>
          )}
        </View>

        {/* Sign out */}
        <TouchableOpacity
          style={[styles.signOutButton, { borderColor: colors.expense }]}
          onPress={handleSignOut}>
          <Text style={[styles.signOutText, { color: colors.expense }]}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 16 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 4 },

  avatarSection: { alignItems: 'center', gap: 6, paddingVertical: 8 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  avatarText: { fontSize: 28, fontWeight: '700', color: '#fff' },
  displayName: { fontSize: 20, fontWeight: '700' },
  email: { fontSize: 14 },

  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontSize: 18, fontWeight: '700' },
  statLabel: { fontSize: 12 },

  section: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  editLink: { fontSize: 14, fontWeight: '500' },

  field: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    gap: 12,
  },
  fieldLabel: { fontSize: 14, width: 80 },
  fieldValue: { fontSize: 14, flex: 1, textAlign: 'right' },
  fieldInput: {
    flex: 1,
    fontSize: 14,
    textAlign: 'right',
    borderBottomWidth: 1.5,
    paddingBottom: 2,
  },
  saveError: {
    color: '#EF4444',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  saveButton: {
    margin: 16,
    marginTop: 4,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },

  signOutButton: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  signOutText: { fontSize: 16, fontWeight: '600' },
});
