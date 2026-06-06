// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<string, ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

const MAPPING = {
  // navigation
  'house.fill': 'home',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'chevron.down': 'expand-more',
  'chevron.up': 'expand-less',
  // tabs
  'sparkles': 'auto-awesome',
  'creditcard.fill': 'credit-card',
  'chart.pie.fill': 'pie-chart',
  'chart.bar.fill': 'bar-chart',
  'scroll.fill': 'assignment',
  'bag.fill': 'shopping-bag',
  'book.closed.fill': 'menu-book',
  // actions
  'plus': 'add',
  'xmark': 'close',
  'trash': 'delete',
  'pencil': 'edit',
  'arrow.left': 'arrow-back',
  'person.fill': 'person',
  'gear': 'settings',
  'magnifyingglass': 'search',
  'clipboard.fill': 'assignment',
  'heart.fill': 'favorite',
  'star.fill': 'star',
  'drop.fill': 'water-drop',
} as IconMapping;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
