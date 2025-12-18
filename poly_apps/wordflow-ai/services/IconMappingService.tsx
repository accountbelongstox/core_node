/**
 * Icon Mapping Service
 * Maps generic icon names from backend to actual icon components or emojis
 *
 * Architecture:
 * Backend sends: { code: 'en', icon: 'flag-usa' }
 * Frontend maps: 'flag-usa' → React component or emoji
 *
 * Benefits:
 * - Decoupling: Backend doesn't need to know about frontend icon libraries
 * - Flexibility: Easy to switch icon libraries or add new ones
 * - Extensibility: New icons can be added without backend changes
 */

import React from 'react';
import {
  Globe,
  Languages,
  Flag,
  Globe2,
} from 'lucide-react';

/**
 * Icon mapping result
 */
interface IconMapping {
  component?: React.ComponentType<any>;
  emoji?: string;
  lucideIcon?: React.ComponentType<any>;
}

/**
 * Icon Mapping Registry
 * Maps generic icon names to actual implementations
 */
const ICON_REGISTRY: Record<string, IconMapping> = {
  // Generic global icons
  'globe': { lucideIcon: Globe, emoji: '🌐' },
  'globe-alt': { lucideIcon: Globe2, emoji: '🌍' },
  'languages': { lucideIcon: Languages, emoji: '🗣️' },
  'flag': { lucideIcon: Flag, emoji: '🚩' },

  // Country flag emojis - ISO 3166-1 alpha-2 codes
  'flag-usa': { emoji: '🇺🇸' },
  'flag-us': { emoji: '🇺🇸' },
  'flag-cn': { emoji: '🇨🇳' },
  'flag-china': { emoji: '🇨🇳' },
  'flag-jp': { emoji: '🇯🇵' },
  'flag-japan': { emoji: '🇯🇵' },
  'flag-gb': { emoji: '🇬🇧' },
  'flag-uk': { emoji: '🇬🇧' },
  'flag-de': { emoji: '🇩🇪' },
  'flag-germany': { emoji: '🇩🇪' },
  'flag-fr': { emoji: '🇫🇷' },
  'flag-france': { emoji: '🇫🇷' },
  'flag-es': { emoji: '🇪🇸' },
  'flag-spain': { emoji: '🇪🇸' },
  'flag-it': { emoji: '🇮🇹' },
  'flag-italy': { emoji: '🇮🇹' },
  'flag-ru': { emoji: '🇷🇺' },
  'flag-russia': { emoji: '🇷🇺' },
  'flag-kr': { emoji: '🇰🇷' },
  'flag-korea': { emoji: '🇰🇷' },
  'flag-br': { emoji: '🇧🇷' },
  'flag-brazil': { emoji: '🇧🇷' },
  'flag-pt': { emoji: '🇵🇹' },
  'flag-portugal': { emoji: '🇵🇹' },
  'flag-mx': { emoji: '🇲🇽' },
  'flag-mexico': { emoji: '🇲🇽' },
  'flag-ar': { emoji: '🇦🇷' },
  'flag-argentina': { emoji: '🇦🇷' },
  'flag-in': { emoji: '🇮🇳' },
  'flag-india': { emoji: '🇮🇳' },
  'flag-id': { emoji: '🇮🇩' },
  'flag-indonesia': { emoji: '🇮🇩' },
  'flag-tr': { emoji: '🇹🇷' },
  'flag-turkey': { emoji: '🇹🇷' },
  'flag-sa': { emoji: '🇸🇦' },
  'flag-saudi': { emoji: '🇸🇦' },
  'flag-ae': { emoji: '🇦🇪' },
  'flag-uae': { emoji: '🇦🇪' },
  'flag-th': { emoji: '🇹🇭' },
  'flag-thailand': { emoji: '🇹🇭' },
  'flag-vn': { emoji: '🇻🇳' },
  'flag-vietnam': { emoji: '🇻🇳' },
  'flag-ph': { emoji: '🇵🇭' },
  'flag-philippines': { emoji: '🇵🇭' },
  'flag-pl': { emoji: '🇵🇱' },
  'flag-poland': { emoji: '🇵🇱' },
  'flag-nl': { emoji: '🇳🇱' },
  'flag-netherlands': { emoji: '🇳🇱' },
  'flag-se': { emoji: '🇸🇪' },
  'flag-sweden': { emoji: '🇸🇪' },
  'flag-no': { emoji: '🇳🇴' },
  'flag-norway': { emoji: '🇳🇴' },
  'flag-dk': { emoji: '🇩🇰' },
  'flag-denmark': { emoji: '🇩🇰' },
  'flag-fi': { emoji: '🇫🇮' },
  'flag-finland': { emoji: '🇫🇮' },
  'flag-gr': { emoji: '🇬🇷' },
  'flag-greece': { emoji: '🇬🇷' },
  'flag-il': { emoji: '🇮🇱' },
  'flag-israel': { emoji: '🇮🇱' },
  'flag-eg': { emoji: '🇪🇬' },
  'flag-egypt': { emoji: '🇪🇬' },
  'flag-za': { emoji: '🇿🇦' },
  'flag-southafrica': { emoji: '🇿🇦' },
  'flag-au': { emoji: '🇦🇺' },
  'flag-australia': { emoji: '🇦🇺' },
  'flag-nz': { emoji: '🇳🇿' },
  'flag-newzealand': { emoji: '🇳🇿' },
  'flag-ca': { emoji: '🇨🇦' },
  'flag-canada': { emoji: '🇨🇦' },
  'flag-ch': { emoji: '🇨🇭' },
  'flag-switzerland': { emoji: '🇨🇭' },
  'flag-at': { emoji: '🇦🇹' },
  'flag-austria': { emoji: '🇦🇹' },
  'flag-be': { emoji: '🇧🇪' },
  'flag-belgium': { emoji: '🇧🇪' },
  'flag-cz': { emoji: '🇨🇿' },
  'flag-czech': { emoji: '🇨🇿' },
  'flag-hu': { emoji: '🇭🇺' },
  'flag-hungary': { emoji: '🇭🇺' },
  'flag-ro': { emoji: '🇷🇴' },
  'flag-romania': { emoji: '🇷🇴' },
  'flag-ua': { emoji: '🇺🇦' },
  'flag-ukraine': { emoji: '🇺🇦' },
  'flag-my': { emoji: '🇲🇾' },
  'flag-malaysia': { emoji: '🇲🇾' },
  'flag-sg': { emoji: '🇸🇬' },
  'flag-singapore': { emoji: '🇸🇬' },
  'flag-hk': { emoji: '🇭🇰' },
  'flag-hongkong': { emoji: '🇭🇰' },
  'flag-tw': { emoji: '🇹🇼' },
  'flag-taiwan': { emoji: '🇹🇼' },
  'flag-pk': { emoji: '🇵🇰' },
  'flag-pakistan': { emoji: '🇵🇰' },
  'flag-bd': { emoji: '🇧🇩' },
  'flag-bangladesh': { emoji: '🇧🇩' },
  'flag-ir': { emoji: '🇮🇷' },
  'flag-iran': { emoji: '🇮🇷' },
  'flag-iq': { emoji: '🇮🇶' },
  'flag-iraq': { emoji: '🇮🇶' },
  'flag-af': { emoji: '🇦🇫' },
  'flag-afghanistan': { emoji: '🇦🇫' },
  'flag-np': { emoji: '🇳🇵' },
  'flag-nepal': { emoji: '🇳🇵' },
  'flag-lk': { emoji: '🇱🇰' },
  'flag-srilanka': { emoji: '🇱🇰' },
  'flag-mm': { emoji: '🇲🇲' },
  'flag-myanmar': { emoji: '🇲🇲' },
  'flag-kh': { emoji: '🇰🇭' },
  'flag-cambodia': { emoji: '🇰🇭' },
  'flag-la': { emoji: '🇱🇦' },
  'flag-laos': { emoji: '🇱🇦' },
};

/**
 * Icon Rendering Mode
 */
export type IconRenderMode = 'component' | 'emoji' | 'auto';

/**
 * Icon Mapping Service Class
 */
class IconMappingServiceClass {
  /**
   * Get icon mapping by generic name
   */
  getMapping(iconName: string): IconMapping | null {
    if (!iconName) return null;

    const normalizedName = iconName.toLowerCase().trim();
    return ICON_REGISTRY[normalizedName] || null;
  }

  /**
   * Get emoji for an icon name
   */
  getEmoji(iconName: string, fallback: string = '🌐'): string {
    const mapping = this.getMapping(iconName);
    return mapping?.emoji || fallback;
  }

  /**
   * Get Lucide icon component for an icon name
   */
  getLucideIcon(iconName: string): React.ComponentType<any> | null {
    const mapping = this.getMapping(iconName);
    return mapping?.lucideIcon || null;
  }

  /**
   * Render icon based on mode
   * @param iconName - Generic icon name from backend
   * @param mode - Rendering mode: 'component', 'emoji', or 'auto'
   * @param className - Optional className for component mode
   * @param fallback - Fallback emoji if icon not found
   */
  render(
    iconName: string,
    mode: IconRenderMode = 'auto',
    className?: string,
    fallback: string = '🌐'
  ): React.ReactNode {
    const mapping = this.getMapping(iconName);

    if (!mapping) {
      return <span className={className}>{fallback}</span>;
    }

    // Auto mode: prefer emoji for flags, component for generic icons
    if (mode === 'auto') {
      if (iconName.includes('flag-') && mapping.emoji) {
        return <span className={className}>{mapping.emoji}</span>;
      }
      if (mapping.lucideIcon) {
        const IconComponent = mapping.lucideIcon;
        return <IconComponent className={className} />;
      }
      if (mapping.emoji) {
        return <span className={className}>{mapping.emoji}</span>;
      }
    }

    // Component mode: prefer lucide icons
    if (mode === 'component') {
      if (mapping.lucideIcon) {
        const IconComponent = mapping.lucideIcon;
        return <IconComponent className={className} />;
      }
      // Fallback to emoji wrapped in span
      if (mapping.emoji) {
        return <span className={className}>{mapping.emoji}</span>;
      }
    }

    // Emoji mode: prefer emojis
    if (mode === 'emoji') {
      if (mapping.emoji) {
        return <span className={className}>{mapping.emoji}</span>;
      }
      // Fallback to component if available
      if (mapping.lucideIcon) {
        const IconComponent = mapping.lucideIcon;
        return <IconComponent className={className} />;
      }
    }

    return <span className={className}>{fallback}</span>;
  }

  /**
   * Check if an icon name exists in registry
   */
  hasIcon(iconName: string): boolean {
    return !!this.getMapping(iconName);
  }

  /**
   * Register a new icon mapping (for extensibility)
   */
  registerIcon(iconName: string, mapping: IconMapping): void {
    ICON_REGISTRY[iconName.toLowerCase().trim()] = mapping;
  }

  /**
   * Get all registered icon names
   */
  getAllIconNames(): string[] {
    return Object.keys(ICON_REGISTRY);
  }

  /**
   * Auto-generate flag icon name from language code
   * e.g., 'en' → 'flag-us', 'zh' → 'flag-cn'
   */
  getFlagIconName(langCode: string): string {
    const mapping: Record<string, string> = {
      'en': 'flag-us',
      'zh': 'flag-cn',
      'ja': 'flag-jp',
      'ko': 'flag-kr',
      'de': 'flag-de',
      'fr': 'flag-fr',
      'es': 'flag-es',
      'it': 'flag-it',
      'ru': 'flag-ru',
      'pt': 'flag-pt',
      'ar': 'flag-sa',
      'hi': 'flag-in',
      'tr': 'flag-tr',
      'vi': 'flag-vn',
      'th': 'flag-th',
      'id': 'flag-id',
      'pl': 'flag-pl',
      'nl': 'flag-nl',
      'sv': 'flag-se',
      'no': 'flag-no',
      'da': 'flag-dk',
      'fi': 'flag-fi',
      'el': 'flag-gr',
      'he': 'flag-il',
      'fa': 'flag-ir',
      'uk': 'flag-ua',
      'cs': 'flag-cz',
      'hu': 'flag-hu',
      'ro': 'flag-ro',
    };

    return mapping[langCode] || 'globe';
  }

  /**
   * Debug: Get icon mapping details
   */
  debugMapping(iconName: string): void {
    const mapping = this.getMapping(iconName);
    console.log('[IconMappingService] Debug:', {
      iconName,
      mapping,
      hasEmoji: !!mapping?.emoji,
      hasLucideIcon: !!mapping?.lucideIcon,
      exists: this.hasIcon(iconName),
    });
  }
}

export const IconMappingService = new IconMappingServiceClass();

// Type definitions for external use
export type { IconMapping };

