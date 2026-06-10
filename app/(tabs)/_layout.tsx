import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import ProfileSvg from '@/assets/images/profile.svg';
import FinanceSvg from '@/assets/images/finance.svg';
import InventorySvg from '@/assets/images/inventory.svg';
import FairyLogSvg from '@/assets/images/fairyLog.svg';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import { useNotifs } from '@/lib/notifications';
import AdminTestPanel from '@/components/admin-test-panel';

const DOT_SIZE = 9;
const DOT_COLOR = '#EF4444';

export default function TabLayout() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { fountain, inventory, fairyLog, setFountain } = useNotifs();
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  // On mount, check whether there's an active fairy visit or uncollected mailbox items.
  // This ensures the fountain dot appears even before the user opens the fountain tab.
  useEffect(() => {
    async function checkFountain() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setAdminUserId(user.id);
      setAdminEmail(user.email ?? null);

      const now = new Date().toISOString();
      const { data } = await supabase
        .from('fountain_visits')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .eq('materials_claimed', false)
        .limit(1);
      if (((data as any[]) ?? []).length > 0) {
        setFountain(true);
      }
    }
    checkFountain();
  }, []);

  const dot = (color: string) => ({
    position: 'absolute' as const,
    top: -1,
    right: -5,
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: DOT_COLOR,
    borderWidth: 1.5,
    borderColor: color,
  });

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        initialRouteName="index"
        screenOptions={{
          tabBarActiveTintColor: colors.tint,
          tabBarInactiveTintColor: colors.tabIconDefault,
          tabBarStyle: { backgroundColor: colors.background },
          headerShown: false,
          tabBarButton: HapticTab,
        }}>
        <Tabs.Screen
          name="inventory"
          options={{
            title: 'Inventory',
            tabBarIcon: () => (
              <View style={{ position: 'relative' }}>
                <InventorySvg width={26} height={26} />
                {inventory && <View style={dot(colors.background)} />}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="fairy-log"
          options={{
            title: 'Fairy Log',
            tabBarIcon: () => (
              <View style={{ position: 'relative' }}>
                <FairyLogSvg width={26} height={26} />
                {fairyLog && <View style={dot(colors.background)} />}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => (
              <View style={{ position: 'relative' }}>
                <IconSymbol size={26} name="sparkles" color={color} />
                {fountain && <View style={dot(colors.background)} />}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="finance"
          options={{
            title: 'Finance',
            tabBarIcon: () => (
              <FinanceSvg width={26} height={26} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Me',
            tabBarIcon: () => (
              <ProfileSvg width={26} height={26} />
            ),
          }}
        />
      </Tabs>
      {adminUserId && <AdminTestPanel userId={adminUserId} userEmail={adminEmail} />}
    </View>
  );
}
