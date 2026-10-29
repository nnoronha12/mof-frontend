import type { CSSProperties } from 'react';
import tinycolor from 'tinycolor2';
import { ThemeColors } from '../WeaveAiChat';

export const getSidebarThemeVars = (
  themeColors: ThemeColors,
): CSSProperties => {
  const primary = themeColors.primary;

  return {
    '--sidebar-theme-primary': primary,
    '--sidebar-search-focus': primary,
    '--sidebar-theme-primary-soft': tinycolor(primary).lighten(42).toHexString(),
    '--sidebar-theme-primary-surface': tinycolor(primary)
      .setAlpha(0.1)
      .toRgbString(),
    '--sidebar-theme-primary-hover': tinycolor(primary)
      .setAlpha(0.14)
      .toRgbString(),
    '--sidebar-theme-primary-muted': tinycolor(primary)
      .setAlpha(0.12)
      .toRgbString(),
    '--sidebar-pin-color': tinycolor(primary).darken(28).toHexString(),
  } as CSSProperties;
};
