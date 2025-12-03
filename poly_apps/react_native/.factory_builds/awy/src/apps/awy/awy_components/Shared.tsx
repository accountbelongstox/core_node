import React from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView, Platform } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import LinearGradient from 'react-native-linear-gradient';
import { useStore } from '@/apps/awy/awy_store';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather as Icon } from '@react-native-vector-icons/feather';
import { getTheme } from '@/apps/awy/awy_theme/theme';
import { createStyles } from '@/apps/awy/awy_theme';

// Export Avatar component for convenience
export { Avatar } from '@/common/components/Avatar';

// 1. Layout Container
export const MobileLayout: React.FC<{ 
  children: React.ReactNode, 
  showNav?: boolean, 
  style?: any 
}> = ({ 
  children, 
  showNav = true,
  style
}) => {
  const { theme } = useStore();
  const colors = getTheme(theme);
  const styles = createStyles(colors);

  return (
    <View style={[styles.mobileLayout, { backgroundColor: colors.bg }, style]}>
      {/* Background Gradient Orbs */}
      <View style={[styles.orb, styles.orb1]} />
      <View style={[styles.orb, styles.orb2]} />
      
      <ScrollView 
        style={styles.contentScroll}
        contentContainerStyle={{ paddingBottom: showNav ? 120 : 20 }}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>

      {showNav && <BottomNav />}
    </View>
  );
};

// 2. Glass Cards - Complete Glassmorphism Effect
export const GlassCard: React.FC<{ 
  children: React.ReactNode, 
  style?: any,
  onPress?: () => void 
}> = ({ children, style, onPress }) => {
  const { theme } = useStore();
  const colors = getTheme(theme);
  const styles = createStyles(colors);
  const isDark = theme === 'dark';
  
  const cardStyle = [
    styles.glassCard,
    {
      backgroundColor: colors.glassBg,
      borderColor: colors.glassBorder,
    },
    style
  ];

  // Glassmorphism effect using BlurView
  // Fix: Add overflow hidden and proper borderRadius to prevent black borders
  const GlassContent = (
    <View style={[cardStyle, { overflow: 'hidden' }]}>
      {Platform.OS === 'ios' ? (
        <BlurView
          blurType={isDark ? 'dark' : 'light'}
          blurAmount={16}
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: colors.cardRadius }
          ]}
        />
      ) : null}
      {/* Semi-transparent background layer for Android and fallback */}
      <View style={[
        StyleSheet.absoluteFill,
        { 
          backgroundColor: colors.glassBg,
          borderRadius: colors.cardRadius 
        }
      ]} />
      {/* Content layer */}
      <View style={{ zIndex: 1 }}>
        {children}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
        {GlassContent}
      </TouchableOpacity>
    );
  }

  return GlassContent;
};

// 3. Primary Button - With Gradient Support
export const Button: React.FC<{
  onPress?: () => void;
  variant?: 'primary' | 'danger' | 'ghost';
  style?: any;
  children: React.ReactNode;
  disabled?: boolean;
}> = ({ 
  onPress,
  variant = 'primary', 
  style,
  children,
  disabled = false
}) => {
  const { theme } = useStore();
  const colors = getTheme(theme);
  const styles = createStyles(colors);
  
  const baseStyle = [
    styles.btn,
    disabled && styles.btnDisabled,
    style
  ];

  const buttonContent = (
    <Text style={styles.btnText}>{children}</Text>
  );

  // Gradient buttons - Fix: Add overflow hidden to prevent black borders
  if (variant === 'primary' && !disabled) {
    return (
      <TouchableOpacity 
        onPress={onPress} 
        activeOpacity={0.8}
        disabled={disabled}
        style={[baseStyle, { overflow: 'hidden' }]}
      >
        <LinearGradient
          colors={colors.primaryGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: colors.btnRadius }
          ]}
        />
        <View style={[styles.btn, { backgroundColor: 'transparent' }]}>
          {buttonContent}
        </View>
      </TouchableOpacity>
    );
  }

  if (variant === 'danger' && !disabled) {
    return (
      <TouchableOpacity 
        onPress={onPress} 
        activeOpacity={0.8}
        disabled={disabled}
        style={[baseStyle, { overflow: 'hidden' }]}
      >
        <LinearGradient
          colors={colors.dangerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: colors.btnRadius }
          ]}
        />
        <View style={[styles.btn, { backgroundColor: 'transparent' }]}>
          {buttonContent}
        </View>
      </TouchableOpacity>
    );
  }

  // Ghost or disabled button
  const buttonStyle = [
    baseStyle,
    variant === 'primary' && styles.btnPrimary,
    variant === 'danger' && styles.btnDanger,
    variant === 'ghost' && styles.btnGhost,
  ];

  return (
    <TouchableOpacity 
      onPress={onPress} 
      style={buttonStyle}
      activeOpacity={0.8}
      disabled={disabled}
    >
      {buttonContent}
    </TouchableOpacity>
  );
};

// 4. Input Field
export const Input: React.FC<{
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  style?: any;
  secureTextEntry?: boolean;
  keyboardType?: any;
  editable?: boolean;
  multiline?: boolean;
}> = ({ 
  value,
  onChangeText,
  placeholder,
  style,
  secureTextEntry,
  keyboardType,
  editable = true,
  multiline = false
}) => {
  const { theme } = useStore();
  const isDark = theme === 'dark';

  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={isDark ? '#94a3b8' : '#64748b'}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      editable={editable}
      multiline={multiline}
      style={[
        localStyles.inputField,
        {
          backgroundColor: isDark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.5)',
          color: isDark ? '#f8fafc' : '#1e293b',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.6)',
        },
        style
      ]}
    />
  );
};

// 5. Floating Navigation Bar
export const BottomNav: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { t, theme } = useStore();
  const isDark = theme === 'dark';

  const isActive = (routeName: string) => {
    // Check if current route matches
    const currentRoute = route.name;
    if (currentRoute === routeName) return true;
    
    // Handle nested navigation - if we're in MainTabs, check the active tab
    try {
      const state = navigation.getState();
      if (state) {
        const currentRouteState = state.routes[state.index];
        if (currentRouteState?.name === 'MainTabs') {
          const tabState = currentRouteState.state;
          if (tabState) {
            const activeTab = tabState.routes[tabState.index]?.name;
            return activeTab === routeName;
          }
        }
      }
    } catch (e) {
      // Fallback to simple check
    }
    return false;
  };

  const colors = getTheme(theme);
  const styles = createStyles(colors);

  const handleNavPress = (routeName: string) => {
    // Use requestAnimationFrame to ensure navigation happens after any pending renders
    requestAnimationFrame(() => {
      navigation.navigate(routeName);
    });
  };

  const handleCenterPress = () => {
    // Use requestAnimationFrame to ensure navigation happens after any pending renders
    requestAnimationFrame(() => {
      navigation.navigate('AddFriend');
    });
  };

  const NavItem = ({ routeName, iconName, label }: { routeName: string, iconName: string, label: string }) => {
    const active = isActive(routeName);
    const color = active ? colors.navActive : colors.navText;

    return (
      <TouchableOpacity 
        onPress={() => handleNavPress(routeName)}
        style={styles.navItem}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} // Increase touch area
      >
        <Icon name={iconName as any} size={24} color={color} />
        <Text style={[styles.navLabel, { color }]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View 
      style={styles.floatingNavContainer}
      pointerEvents="box-none" // Allow touches to pass through container to children
    >
      <View 
        style={[
          styles.floatingNav,
          {
            backgroundColor: colors.navBg,
          }
        ]}
        pointerEvents="box-none" // Allow touches to pass through to children
      >
        <NavItem routeName="MapHome" iconName="map" label={t('tab.map')} />
        <NavItem routeName="FriendsList" iconName="heart" label={t('tab.friends')} />
        
        {/* Center Button - Spacer for layout, then absolute positioned button */}
        <View style={{ width: 56 }} pointerEvents="none" />
        <View style={{ 
          position: 'absolute', 
          left: 0,
          right: 0,
          top: -18,
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 101,
        }}
        pointerEvents="box-none"
        >
          <TouchableOpacity 
            onPress={handleCenterPress}
            activeOpacity={0.8}
            style={{ 
              overflow: 'hidden', 
              borderRadius: 28,
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} // Increase touch area
          >
            <LinearGradient
              colors={colors.primaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.navCenterBtn, { backgroundColor: 'transparent' }]}
            >
              <Icon name="plus" size={28} color="white" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
        
        <NavItem routeName="Shop" iconName="shopping-bag" label={t('tab.shop')} />
        <NavItem routeName="Profile" iconName="user" label={t('tab.me')} />
      </View>
    </View>
  );
};

// 6. Header - With transparent background and styled back button
export const Header: React.FC<{ 
  title: string, 
  backTo?: string, 
  action?: React.ReactNode 
}> = ({ title, backTo, action }) => {
  const navigation = useNavigation<any>();
  const { theme } = useStore();
  const colors = getTheme(theme);
  const isDark = theme === 'dark';

  return (
    <View style={[
      localStyles.appHeader,
      { backgroundColor: 'transparent' } // Transparent background
    ]}>
      <View style={{ width: 40 }}>
        {backTo && (
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={[
              localStyles.backBtn,
              {
                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.4)',
                borderRadius: 20,
              }
            ]}
            activeOpacity={0.7}
          >
            <Icon name="arrow-left" size={20} color={isDark ? '#f8fafc' : '#1e293b'} />
          </TouchableOpacity>
        )}
      </View>
      <Text style={[
        localStyles.headerTitle,
        { 
          color: isDark ? '#f8fafc' : '#1e293b',
          textShadowColor: isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.8)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 2,
        }
      ]}>
        {title}
      </Text>
      <View style={{ width: 40, alignItems: 'flex-end' }}>
        {action}
      </View>
    </View>
  );
};

const localStyles = StyleSheet.create({
  mobileLayout: {
    flex: 1,
    position: 'relative',
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.6,
  },
  orb1: {
    top: '-20%',
    left: '-20%',
    width: '80%',
    height: '50%',
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
  },
  orb2: {
    bottom: '-10%',
    right: '-10%',
    width: '80%',
    height: '50%',
    backgroundColor: 'rgba(168, 85, 247, 0.25)',
  },
  contentScroll: {
    flex: 1,
  },
  glassCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  btn: {
    width: '100%',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: '#3b82f6',
  },
  btnDanger: {
    backgroundColor: '#ef4444',
  },
  btnGhost: {
    backgroundColor: 'transparent',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  inputField: {
    width: '100%',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  floatingNavContainer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  floatingNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 10,
    width: '90%',
    maxWidth: 440,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 48,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginTop: 4,
  },
  navCenterBtn: {
    width: 56,
    height: 56,
    backgroundColor: '#14b8a6',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -24,
    borderWidth: 4,
    borderColor: '#f0f4f8',
    shadowColor: '#14b8a6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingHorizontal: 20,
    zIndex: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
    backBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: -8,
      // Background and border will be added dynamically for glassmorphism effect
    },
});

