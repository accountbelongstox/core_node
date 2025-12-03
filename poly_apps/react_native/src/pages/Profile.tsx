import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView } from 'react-native';
import { MobileLayout, GlassCard } from '../components/Shared';
import { useStore } from '../store';
import { useNavigation } from '@react-navigation/native';
import { Feather as Icon } from '@react-native-vector-icons/feather';
import { getTheme } from '../styles/theme';

const Profile: React.FC = () => {
  const { user, logout, theme, toggleTheme, language, setLanguage, t } = useStore();
  const navigation = useNavigation<any>();
  const colors = getTheme(theme);

  if (!user) return null;

  const MenuItem = ({ iconName, label, onPress, value }: any) => (
    <TouchableOpacity 
      onPress={onPress}
      style={[localStyles.menuItem, { borderBottomColor: 'rgba(0,0,0,0.05)' }]}
      activeOpacity={0.7}
    >
      <View style={localStyles.menuItemLeft}>
        <View style={[localStyles.iconBox, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
          <Icon name={iconName} size={18} color={colors.primary} />
        </View>
        <Text style={[localStyles.menuItemLabel, { color: colors.textPrimary }]}>{label}</Text>
      </View>
      <View style={localStyles.menuItemRight}>
        {value && <Text style={[localStyles.menuItemValue, { color: colors.textSecondary }]}>{value}</Text>}
        {(onPress) && <Icon name="chevron-right" size={16} color={colors.textSecondary} />}
      </View>
    </TouchableOpacity>
  );

  return (
    <MobileLayout>
      {/* Banner */}
      <View style={[localStyles.profileBanner, { backgroundColor: colors.primary }]} />
      
      {/* Overlapping Header */}
      <View style={localStyles.profileHeaderOverlay}>
        <Image source={{ uri: user.avatar }} style={[localStyles.avatarOverlap, { borderColor: colors.bg }]} />
        <Text style={[localStyles.userName, { color: colors.textPrimary }]}>{user.name}</Text>
        <Text style={[localStyles.userPhone, { color: colors.textSecondary }]}>{user.phone}</Text>
      </View>

      <View style={localStyles.content}>
        {/* Actions Row */}
        <View style={localStyles.actionsRow}>
          <TouchableOpacity 
            style={localStyles.actionCard}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <GlassCard style={localStyles.actionCardInner}>
              <Icon name="qr-code" size={20} color={colors.primary} />
              <Text style={[localStyles.actionCardText, { color: colors.textPrimary }]}>My Code</Text>
            </GlassCard>
          </TouchableOpacity>
          <TouchableOpacity 
            style={localStyles.actionCard}
            onPress={() => navigation.navigate('Settings')}
          >
            <GlassCard style={localStyles.actionCardInner}>
              <Icon name="settings" size={20} color={colors.primary} />
              <Text style={[localStyles.actionCardText, { color: colors.textPrimary }]}>{t('me.settings')}</Text>
            </GlassCard>
          </TouchableOpacity>
        </View>

        {/* Settings Group */}
        <GlassCard style={localStyles.settingsCard}>
          <MenuItem 
            iconName="user" 
            label={t('me.profile')} 
            onPress={() => navigation.navigate('EditProfile')}
          />
          <MenuItem 
            iconName="moon" 
            label={t('me.theme')} 
            onPress={toggleTheme}
            value={theme === 'dark' ? 'Dark' : 'Light'} 
          />
          <MenuItem 
            iconName="globe" 
            label={t('me.lang')} 
            onPress={() => setLanguage(language === 'en' ? 'zh' : 'en')}
            value={language === 'en' ? 'English' : 'Chinese'} 
          />
        </GlassCard>

        <GlassCard style={localStyles.settingsCard}>
          <MenuItem 
            iconName="info" 
            label={t('me.about')} 
            onPress={() => navigation.navigate('About')}
          />
        </GlassCard>

        <TouchableOpacity 
          onPress={logout}
          style={[localStyles.logoutButton, { backgroundColor: '#fef2f2' }]}
          activeOpacity={0.8}
        >
          <Icon name="log-out" size={18} color="#ef4444" />
          <Text style={localStyles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </MobileLayout>
  );
};

const localStyles = StyleSheet.create({
  profileBanner: {
    height: 160,
    width: '100%',
  },
  profileHeaderOverlay: {
    marginTop: -60,
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarOverlap: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 4,
    backgroundColor: 'white',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 12,
  },
  userPhone: {
    fontSize: 14,
    marginTop: 4,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    marginTop: -20,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionCard: {
    flex: 1,
  },
  actionCardInner: {
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  actionCardText: {
    fontSize: 12,
    fontWeight: '700',
  },
  settingsCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    padding: 8,
    borderRadius: 8,
  },
  menuItemLabel: {
    fontWeight: '500',
    fontSize: 14,
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuItemValue: {
    fontSize: 12,
  },
  logoutButton: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  logoutText: {
    color: '#ef4444',
    fontWeight: '700',
    fontSize: 14,
  },
});

export default Profile;

