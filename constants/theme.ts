import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1C1917',
    background: '#FFFBF5',
    tint: '#7C3AED',
    icon: '#78716C',
    tabIconDefault: '#A8A29E',
    tabIconSelected: '#7C3AED',
    // app-specific
    coin: '#F59E0B',
    income: '#10B981',
    expense: '#EF4444',
    card: '#FFFFFF',
    border: '#E7E5E4',
  },
  dark: {
    text: '#F5F5F4',
    background: '#0F0A1E',
    tint: '#A78BFA',
    icon: '#A8A29E',
    tabIconDefault: '#6B7280',
    tabIconSelected: '#A78BFA',
    // app-specific
    coin: '#FCD34D',
    income: '#34D399',
    expense: '#F87171',
    card: '#1C1427',
    border: '#292142',
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
