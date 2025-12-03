import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView } from 'react-native';
import { MobileLayout, GlassCard, Button } from '../components/Shared';
import { useStore } from '../store';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Feather';

const Profile: React.FC = () => {
  const { user, logout, theme, toggleTheme, language, setLanguage, t } = useStore();
  const navigation = useNavigation<any>();
  const isDark = theme === 'dark';

  if (!user) return null;

  const MenuItem = ({ iconName, label, onPress, value }: any) => (
    <TouchableOpacity 
      onPress={onPress}
      style={styles.menuItem}
      activeOpacity={0.7}
    >
      <View style={styles.menuItemLeft}>
        <View style={styles.iconBox}>
          <Icon name={iconName} size={18} color="#3b82f6" />
        </View>
        <Text style={styles.menuItemLabel}>{label}</Text>
      </View>
      <View style={styles.menuItemRight}>
        {value && <Text style={styles.menuItemValue}>{value}</Text>}
        {(onPress) && <Icon name="chevron-right" size={16} color="#cbd5e1" />}
      </View>
    </TouchableOpacity>
  );

  return (
    <MobileLayout>
      {/* Banner */}
      <View style={styles.profileBanner} />
      
      {/* Overlapping Header */}
      <View style={styles.profileHeaderOverlay}>
        <Image source={{ uri: user.avatar }} style={styles.avatarOverlap} />
        <Text style={styles.userName}>{user.name}</Text>
        <Text style={styles.userPhone}>{user.phone}</Text>
      </View>

      <View style={styles.content}>
        {/* Actions Row */}
        <View style={styles.actionsRow}>
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <GlassCard style={styles.actionCardInner}>
              <Icon name="qr-code" size={20} color="#3b82f6" />
              <Text style={styles.actionCardText}>My Code</Text>
            </GlassCard>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => navigation.navigate('Settings')}
          >
            <GlassCard style={styles.actionCardInner}>
              <Icon name="settings" size={20} color="#3b82f6" />
              <Text style={styles.actionCardText}>{t('me.settings')}</Text>
            </GlassCard>
          </TouchableOpacity>
        </View>

        {/* Settings Group */}
        <GlassCard style={styles.settingsCard}>
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
            value={language === 'en' ? 'English' : '中文'} 
          />
        </GlassCard>

        <GlassCard style={styles.settingsCard}>
          <MenuItem 
            iconName="info" 
            label={t('me.about')} 
            onPress={() => navigation.navigate('About')}
          />
        </GlassCard>

        <TouchableOpacity 
          onPress={logout}
          style={styles.logoutButton}
          activeOpacity={0.8}
        >
          <Icon name="log-out" size={18} color="#ef4444" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </MobileLayout>
  );
};

const styles = StyleSheet.create({
  profileBanner: {
    height: 160,
    width: '100%',
    backgroundColor: '#3b82f6',
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
    borderColor: '#f0f4f8',
    backgroundColor: 'white',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 12,
    color: '#1e293b',
  },
  userPhone: {
    fontSize: 14,
    color: '#64748b',
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
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  menuItemLabel: {
    fontWeight: '500',
    fontSize: 14,
    color: '#1e293b',
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuItemValue: {
    fontSize: 12,
    color: '#64748b',
  },
  logoutButton: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fef2f2',
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
