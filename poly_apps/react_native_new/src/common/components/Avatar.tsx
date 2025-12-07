import React from 'react';
import { Image, ImageStyle, StyleSheet, View, ViewStyle } from 'react-native';
import { getAvatarSource } from '../utils/avatar';

interface AvatarProps {
  uri?: string | null;
  gender?: 'male' | 'female';
  size?: number;
  style?: ImageStyle | ViewStyle;
  borderRadius?: number;
}

/**
 * Avatar component with automatic fallback to default avatars
 * Supports both remote URLs and local assets
 */
export const Avatar: React.FC<AvatarProps> = ({
  uri,
  gender,
  size = 56,
  style,
  borderRadius,
}) => {
  const source = getAvatarSource(uri, gender);
  const finalBorderRadius = borderRadius ?? size / 2;

  // Extract border styles from style prop if provided
  const imageStyle: any = {
    width: size,
    height: size,
    borderRadius: finalBorderRadius,
  };

  // Apply border styles to container if provided
  const containerStyle: any = {
    width: size,
    height: size,
    borderRadius: finalBorderRadius,
    overflow: 'hidden',
  };

  if (style && typeof style === 'object') {
    if ('borderWidth' in style) {
      containerStyle.borderWidth = (style as any).borderWidth;
    }
    if ('borderColor' in style) {
      containerStyle.borderColor = (style as any).borderColor;
    }
  }

  // Debug: Log source for troubleshooting
  if (__DEV__) {
    const sourceInfo = typeof source === 'object' && 'uri' in source 
      ? `remote: ${source.uri}` 
      : 'local asset';
    console.log('Avatar source:', sourceInfo, 'size:', size);
  }

  return (
    <View style={[styles.container, containerStyle]}>
      <Image
        source={source}
        style={[styles.image, imageStyle]}
        resizeMode="cover"
        // Critical: For network images, width and height must be specified in style (already in imageStyle)
        onError={(error) => {
          console.log('Avatar load error:', error.nativeEvent.error);
          // Try to load fallback
          if (__DEV__) {
            console.log('Attempting to load fallback avatar');
          }
        }}
        onLoad={() => {
          if (__DEV__) {
            console.log('Avatar loaded successfully');
          }
        }}
        onLoadStart={() => {
          if (__DEV__) {
            console.log('Avatar loading started');
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  image: {
    backgroundColor: '#e2e8f0',
  },
});

