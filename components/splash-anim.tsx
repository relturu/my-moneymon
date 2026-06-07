import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import LogoIcon from '@/assets/images/logo.svg';

const ICON_SIZE = 100;

export default function SplashAnim({ onDone }: { onDone: () => void }) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const iconY = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(350),
      Animated.parallel([
        // Icon slides up
        Animated.timing(iconY, {
          toValue: -52,
          duration: 650,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        // Title fades + rises in with a slight delay
        Animated.sequence([
          Animated.delay(220),
          Animated.parallel([
            Animated.timing(titleOpacity, {
              toValue: 1,
              duration: 480,
              useNativeDriver: true,
            }),
            Animated.timing(titleY, {
              toValue: 0,
              duration: 480,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]),
      Animated.delay(520),
    ]).start(() => onDone());
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Animated.View style={{ transform: [{ translateY: iconY }] }}>
          <LogoIcon width={ICON_SIZE} height={ICON_SIZE} />
        </Animated.View>
        <Animated.Text
          style={[
            styles.title,
            { color: colors.text, opacity: titleOpacity, transform: [{ translateY: titleY }] },
          ]}
        >
          moneymon
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 100, justifyContent: 'center', alignItems: 'center' },
  content: { alignItems: 'center' },
  title: {
    fontSize: 36,
    fontFamily: 'Kanchenjunga_700Bold',
    letterSpacing: 1,
    marginTop: 18,
  },
});
