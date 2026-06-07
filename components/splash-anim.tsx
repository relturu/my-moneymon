import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

const ICON_SIZE = 140;

export default function SplashAnim({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const rootOpacity = useRef(new Animated.Value(1)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    if (!ready) return;
    Animated.sequence([
      // Text slowly slides up and fades in
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(titleY, {
          toValue: 0,
          duration: 1400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      // Hold on screen
      Animated.delay(1800),
      // Fade the whole splash out before handing off
      Animated.timing(rootOpacity, {
        toValue: 0,
        duration: 700,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => onDone());
  }, [ready]);

  return (
    <Animated.View style={[styles.root, { backgroundColor: colors.background, opacity: rootOpacity }]}>
      <Image
        source={require('@/assets/images/logov2.png')}
        style={styles.logo}
      />
      {/* Extra paddingBottom so translateY slide doesn't get clipped */}
      <Animated.View style={[styles.titleWrap, { opacity: titleOpacity, transform: [{ translateY: titleY }] }]}>
        <Animated.Text style={[styles.title, { color: colors.text }]}>
          moneymon
        </Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE * 0.2,
  },
  titleWrap: {
    marginTop: 18,
    paddingBottom: 50,
  },
  title: {
    fontSize: 36,
    fontFamily: 'Kanchenjunga_700Bold',
    letterSpacing: 1,
  },
});
