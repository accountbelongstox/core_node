import React from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView } from 'react-native';
import { useStore } from '../store';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather as Icon } from '@react-native-vector-icons/feather';

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
  const isDark = theme === 'dark';

  return (
    <View style={[localStyles.mobileLayout, { backgroundColor: isDark ? '#0f172a' : '#f0f4f8' }, style]}>
      {/* Background Gradient Orbs */}
      <View style={[localStyles.orb, localStyles.orb1]} />
      <View style={[localStyles.orb, localStyles.orb2]} />
      
      <ScrollView 
        style={localStyles.contentScroll}
        contentContainerStyle={{ paddingBottom: showNav ? 120 : 20 }}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>

      {showNav && <BottomNav />}
    </View>
  );
};

// 2. Glass Cards
export const GlassCard: React.FC<{ 
  children: React.ReactNode, 
  style?: any,
  onPress?: () => void 
}> = ({ children, style, onPress }) => {
  const { theme } = useStore();
  const isDark = theme === 'dark';
  
  const cardStyle = [
    localStyles.glassCard,
    {
      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.4)',
      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.6)',
    },
    style
  ];

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
        <View style={cardStyle}>
          {children}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={cardStyle}>
      {children}
    </View>
  );
};

// 3. Primary Button
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
  const buttonStyle = [
    localStyles.btn,
    variant === 'primary' && localStyles.btnPrimary,
    variant === 'danger' && localStyles.btnDanger,
    variant === 'ghost' && localStyles.btnGhost,
    disabled && localStyles.btnDisabled,
    style
  ];

  return (
    <TouchableOpacity 
      onPress={onPress} 
      style={buttonStyle}
      activeOpacity={0.8}
      disabled={disabled}
    >
      <Text style={localStyles.btnText}>{children}</Text>
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

  const NavItem = ({ routeName, iconName, label }: { routeName: string, iconName: string, label: string }) => {
    const active = isActive(routeName);
    const color = active ? '#14b8a6' : (isDark ? '#94a3b8' : '#64748b');

    return (
      <TouchableOpacity 
        onPress={() => navigation.navigate(routeName)}
        style={localStyles.navItem}
        activeOpacity={0.7}
      >
        <Icon name={iconName} size={24} color={color} />
        <Text style={[localStyles.navLabel, { color }]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={localStyles.floatingNavContainer}>
      <View style={[
        localStyles.floatingNav,
        {
          backgroundColor: isDark ? '#1e293b' : '#ffffff',
        }
      ]}>
        <NavItem routeName="MapHome" iconName="home" label={t('tab.home')} />
        <NavItem routeName="AIAssistant" iconName="zap" label={t('tab.ai')} />
        
        <TouchableOpacity 
          onPress={() => navigation.navigate('AddFriend')}
          style={localStyles.navCenterBtn}
          activeOpacity={0.8}
        >
          <Icon name="plus" size={28} color="white" />
        </TouchableOpacity>
        
        <NavItem routeName="Shop" iconName="shopping-bag" label={t('tab.shop')} />
        <NavItem routeName="Profile" iconName="user" label={t('tab.me')} />
      </View>
    </View>
  );
};

// 6. Header
export const Header: React.FC<{ 
  title: string, 
  backTo?: string, 
  action?: React.ReactNode 
}> = ({ title, backTo, action }) => {
  const navigation = useNavigation<any>();
  const { theme } = useStore();
  const isDark = theme === 'dark';

  return (
    <View style={[
      localStyles.appHeader,
      { backgroundColor: isDark ? '#0f172a' : '#f0f4f8' }
    ]}>
      <View style={{ width: 40 }}>
        {backTo && (
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={localStyles.backBtn}
            activeOpacity={0.7}
          >
            <Icon name="chevron-left" size={24} color={isDark ? '#f8fafc' : '#1e293b'} />
          </TouchableOpacity>
        )}
      </View>
      <Text style={[
        localStyles.headerTitle,
        { color: isDark ? '#f8fafc' : '#1e293b' }
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
  },
});

