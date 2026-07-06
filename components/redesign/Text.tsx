// Typed text primitives for the redesign. Wrap the TYPE scale (lib/redesign.ts)
// so screens never hand-roll fontFamily/size/lineHeight. Color defaults to the
// theme's primary text; pass `color` to override. These are the ONLY way text
// should be rendered in redesign screens — keeps the type system consistent and
// makes a global type change a one-file edit.
import React from 'react';
import { Text as RNText, TextProps, StyleProp, TextStyle } from 'react-native';
import { useTheme } from '../../lib/theme';
import { TYPE } from '../../lib/redesign';

type Variant = keyof typeof TYPE;

interface Props extends TextProps {
  variant?: Variant;
  color?: string;
  style?: StyleProp<TextStyle>;
  children: React.ReactNode;
}

export function T({ variant = 'body', color, style, children, ...rest }: Props) {
  const { colors } = useTheme();
  return (
    <RNText
      style={[TYPE[variant], { color: color ?? colors.text }, style]}
      {...rest}
    >
      {children}
    </RNText>
  );
}

// Convenience wrappers for the most common civic moments.
export const Serif = (p: Omit<Props, 'variant'> & { variant?: Variant }) => (
  <T variant={p.variant ?? 'titleSerif'} {...p} />
);
export const Mono = (p: Omit<Props, 'variant'> & { variant?: Variant }) => (
  <T variant={p.variant ?? 'monoData'} {...p} />
);

// Gold uppercase section label. Defaults its color to gold — the recurring
// "eyebrow" above every section in the redesign.
export function Eyebrow({ color, style, children, ...rest }: Omit<Props, 'variant'>) {
  const { colors } = useTheme();
  return (
    <T variant="eyebrow" color={color ?? colors.gold} style={style} {...rest}>
      {children}
    </T>
  );
}
