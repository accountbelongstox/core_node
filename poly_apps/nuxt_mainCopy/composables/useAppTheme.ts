import { computed, onMounted } from 'vue';
import type { BaseTheme } from '@/theme/base-theme.config';

export function useAppTheme(theme: BaseTheme) {
  const config = computed(() => theme.getConfig());

  const colors = computed(() => config.value.colors);
  const gradients = computed(() => config.value.gradients);
  const shadows = computed(() => config.value.shadows);
  const spacing = computed(() => config.value.spacing);
  const typography = computed(() => config.value.typography);
  const borderRadius = computed(() => config.value.borderRadius);
  const customStyles = computed(() => config.value.customStyles || {});

  const getColor = (colorKey: keyof typeof colors.value) => {
    return colors.value[colorKey];
  };

  const getGradient = (gradientKey: keyof typeof gradients.value) => {
    return gradients.value[gradientKey];
  };

  const getShadow = (shadowKey: keyof typeof shadows.value) => {
    return shadows.value[shadowKey];
  };

  const getSpacing = (spacingKey: keyof typeof spacing.value) => {
    return spacing.value[spacingKey];
  };

  const getBorderRadius = (radiusKey: keyof typeof borderRadius.value) => {
    return borderRadius.value[radiusKey];
  };

  const getCustomStyle = (styleKey: string) => {
    return customStyles.value[styleKey];
  };

  const applyCSSVariables = () => {
    if (typeof window !== 'undefined') {
      theme.applyCSSVariables();
    }
  };

  onMounted(() => {
    applyCSSVariables();
  });

  return {
    config,
    colors,
    gradients,
    shadows,
    spacing,
    typography,
    borderRadius,
    customStyles,
    getColor,
    getGradient,
    getShadow,
    getSpacing,
    getBorderRadius,
    getCustomStyle,
    applyCSSVariables,
  };
}
