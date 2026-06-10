import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1C1917',
    background: '#F1F3EA',
    tint: '#425F4F',
    icon: '#78716C',
    tabIconDefault: '#A8A29E',
    tabIconSelected: '#425F4F',
    // app-specific
    coin: '#F59E0B',
    income: '#10B981',
    expense: '#EF4444',
    card: '#FFFFFF',
    border: '#D6DDD0',
  },
  dark: {
    text: '#F5F5F4',
    background: '#0D1610',
    tint: '#9FC044',
    icon: '#A8A29E',
    tabIconDefault: '#6B7280',
    tabIconSelected: '#9FC044',
    // app-specific
    coin: '#FCD34D',
    income: '#34D399',
    expense: '#F87171',
    card: '#1A2420',
    border: '#2A3D35',
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
