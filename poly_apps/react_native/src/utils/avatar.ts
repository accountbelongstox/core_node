import { ImageSourcePropType } from 'react-native';

// Default avatar images (local assets)
// Note: In React Native, require paths must be static and relative to the file
// The path is relative to this file location: src/utils/avatar.ts -> assets/images/avatars/
export const DEFAULT_AVATARS = {
  girl: require('../../assets/images/avatars/default_girl.png'),
  boy: require('../../assets/images/avatars/default_boy.png'),
  default: require('../../assets/images/avatars/default_boy.png'), // Fallback
} as const;

// Remote avatar URLs for mock data
export const AVATAR_URLS = {
  girl: 'https://api.dicebear.com/7.x/avataaars/png?seed=Gril',
  boy: 'https://api.dicebear.com/7.x/avataaars/png?seed=Boy',
  default: 'https://api.dicebear.com/7.x/avataaars/png?seed=Default',
} as const;

/**
 * Get avatar source - supports both local assets and remote URLs
 * @param avatarUrl - Remote URL or local asset path
 * @param gender - Optional gender to determine default avatar
 * @returns Image source for React Native Image component
 */
export const getAvatarSource = (
  avatarUrl?: string | null,
  gender?: 'male' | 'female'
): ImageSourcePropType | { uri: string } => {
  // If no avatar URL provided, use default based on gender
  if (!avatarUrl) {
    if (gender === 'female') {
      return DEFAULT_AVATARS.girl;
    }
    return DEFAULT_AVATARS.boy;
  }

  // Check if it's a remote URL
  if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
    return { uri: avatarUrl };
  }

  // If it's a local path, try to require it
  // Note: In React Native, local images must be required at build time
  // For dynamic local paths, you may need to use a different approach
  try {
    // This will only work for statically known paths
    return { uri: avatarUrl };
  } catch (e) {
    // Fallback to default
    return gender === 'female' ? DEFAULT_AVATARS.girl : DEFAULT_AVATARS.boy;
  }
};

/**
 * Get default avatar URL for mock data
 * @param gender - Gender to determine avatar type
 * @param seed - Optional seed for avatar generation
 * @returns Remote avatar URL
 */
export const getDefaultAvatarUrl = (
  gender?: 'male' | 'female',
  seed?: string
): string => {
  if (seed) {
    return `https://api.dicebear.com/7.x/avataaars/png?seed=${seed}`;
  }
  
  if (gender === 'female') {
    return AVATAR_URLS.girl;
  }
  
  return AVATAR_URLS.boy;
};

/**
 * Avatar component helper - validates and returns avatar source
 * This can be used in components to ensure avatar always has a valid source
 */
export const AvatarHelper = {
  /**
   * Get avatar source with fallback
   */
  getSource: getAvatarSource,
  
  /**
   * Get default URL for mock data
   */
  getDefaultUrl: getDefaultAvatarUrl,
  
  /**
   * Check if avatar URL is valid
   */
  isValidUrl: (url?: string | null): boolean => {
    if (!url) return false;
    return url.startsWith('http://') || url.startsWith('https://');
  },
};

