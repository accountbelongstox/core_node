import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MobileLayout, Header, GlassCard, Button } from '../components/Shared';
import { useStore } from '../store';
import { Feather as Icon } from '@react-native-vector-icons/feather';
import { getTheme } from '../styles/theme';

const Settings: React.FC = () => {
  const { theme, toggleTheme, language, setLanguage, t } = useStore();
  const colors = getTheme(theme);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [permissions, setPermissions] = useState({
    location: false,
    camera: false,
    storage: false
  });
  const [isChecking, setIsChecking] = useState(false);

  const startAuthorization = async () => {
    setShowAuthModal(true);
    setIsChecking(true);
    
    // Simulate checking sequence
    setTimeout(() => setPermissions(p => ({ ...p, location: true })), 1000);
    setTimeout(() => setPermissions(p => ({ ...p, camera: true })), 2000);
    setTimeout(() => {
      setPermissions(p => ({ ...p, storage: true }));
      setIsChecking(false);
    }, 3000);
  };

  const OptionRow: React.FC<{ 
    iconName: string, 
    label: string, 
    value?: string, 
    onPress?: () => void, 
    toggle?: boolean 
  }> = ({ iconName, label, value, onPress, toggle }) => (
    <TouchableOpacity 
      onPress={onPress}
      style={[localStyles.optionRow, { borderBottomColor: 'rgba(0,0,0,0.05)' }]}
      activeOpacity={0.7}
    >
      <View style={localStyles.optionRowLeft}>
        <View style={[localStyles.optionIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
          <Icon name={iconName} size={18} color={colors.primary} />
        </View>
        <Text style={[localStyles.optionLabel, { color: colors.textPrimary }]}>{label}</Text>
      </View>
      <View style={localStyles.optionRowRight}>
        {value && <Text style={[localStyles.optionValue, { color: colors.textSecondary }]}>{value}</Text>}
        {toggle && (
          <View style={[
            localStyles.toggle,
            { backgroundColor: value === 'Dark' ? colors.primary : '#cbd5e1' }
          ]}>
            <View style={[
              localStyles.toggleThumb,
              value === 'Dark' && localStyles.toggleThumbActive
            ]} />
          </View>
        )}
        {!toggle && onPress && <Icon name="chevron-right" size={16} color={colors.textSecondary} />}
      </View>
    </TouchableOpacity>
  );

  return (
    <MobileLayout showNav={false}>
      <Header title={t('me.settings')} backTo="/me" />
      
      <View style={localStyles.content}>
        {/* Authorization Card */}
        <View style={localStyles.section}>
          <Text style={[localStyles.sectionTitle, { color: colors.textSecondary }]}>{t('settings.permissions')}</Text>
          <GlassCard style={[localStyles.authCard, { backgroundColor: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.3)' }]}>
            <View style={localStyles.authCardHeader}>
              <View style={[localStyles.authIconContainer, { backgroundColor: colors.primary }]}>
                <Icon name="shield" size={24} color="white" />
              </View>
              <View style={localStyles.authTextContainer}>
                <Text style={[localStyles.authTitle, { color: colors.textPrimary }]}>{t('settings.one_tap')}</Text>
                <Text style={[localStyles.authSubtitle, { color: colors.textSecondary }]}>{t('settings.auth_desc')}</Text>
              </View>
            </View>
            <TouchableOpacity 
              onPress={startAuthorization}
              style={[localStyles.authButton, { backgroundColor: colors.primary }]}
              activeOpacity={0.8}
            >
              <Text style={localStyles.authButtonText}>{t('settings.one_tap')}</Text>
            </TouchableOpacity>
          </GlassCard>
        </View>

        {/* General Settings */}
        <View style={localStyles.section}>
          <Text style={[localStyles.sectionTitle, { color: colors.textSecondary }]}>General</Text>
          <GlassCard style={localStyles.settingsCard}>
            <OptionRow 
              iconName="moon" 
              label={t('me.theme')} 
              value={theme === 'dark' ? 'Dark' : 'Light'} 
              toggle
              onPress={toggleTheme}
            />
            <OptionRow 
              iconName="globe" 
              label={t('me.lang')} 
              value={language === 'en' ? 'English' : 'Chinese'} 
              onPress={() => setLanguage(language === 'en' ? 'zh' : 'en')}
            />
          </GlassCard>
        </View>
      </View>

      {/* Permission Modal */}
      <Modal
        visible={showAuthModal}
        transparent
        animationType="fade"
        onRequestClose={() => !isChecking && setShowAuthModal(false)}
      >
        <View style={localStyles.modalOverlay}>
          <View style={[localStyles.modalContent, { backgroundColor: colors.bg }]}>
            <View style={localStyles.modalHeader}>
              <Text style={[localStyles.modalTitle, { color: colors.textPrimary }]}>{t('settings.permissions')}</Text>
              <Text style={[localStyles.modalSubtitle, { color: colors.textSecondary }]}>
                Please keep these permissions enabled for the app to function correctly.
              </Text>
            </View>
            
            <View style={localStyles.permissionsList}>
              {[
                { key: 'location', label: t('perm.location'), iconName: 'map-pin' },
                { key: 'camera', label: t('perm.camera'), iconName: 'camera' },
                { key: 'storage', label: t('perm.storage'), iconName: 'folder' },
              ].map((item, idx) => (
                <View key={item.key} style={[localStyles.permissionItem, { backgroundColor: 'rgba(0,0,0,0.03)' }]}>
                  <View style={localStyles.permissionItemLeft}>
                    <Icon name={item.iconName} size={20} color={colors.textSecondary} />
                    <Text style={[localStyles.permissionLabel, { color: colors.textPrimary }]}>{item.label}</Text>
                  </View>
                  {permissions[item.key as keyof typeof permissions] ? (
                    <Icon name="check-circle" size={20} color="#22c55e" />
                  ) : (
                    isChecking && idx === 0 ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <View style={[localStyles.permissionPending, { borderColor: colors.textSecondary }]} />
                    )
                  )}
                </View>
              ))}
            </View>

            <TouchableOpacity 
              onPress={() => !isChecking && setShowAuthModal(false)} 
              disabled={isChecking}
              style={[
                localStyles.modalButton,
                { 
                  backgroundColor: colors.primary,
                  opacity: isChecking ? 0.5 : 1,
                }
              ]}
              activeOpacity={0.8}
            >
              <Text style={localStyles.modalButtonText}>
                {isChecking ? t('perm.checking') : 'Done'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </MobileLayout>
  );
};

const localStyles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 12,
    marginLeft: 4,
  },
  authCard: {
    gap: 16,
    borderWidth: 1,
  },
  authCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  authIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  authTextContainer: {
    flex: 1,
    flexShrink: 1,
  },
  authTitle: {
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 4,
  },
  authSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  authButton: {
    borderRadius: 12,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  authButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  settingsCard: {
    paddingHorizontal: 16,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  optionRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionIconBox: {
    padding: 8,
    borderRadius: 8,
  },
  optionLabel: {
    fontWeight: '500',
    fontSize: 14,
  },
  optionRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionValue: {
    fontSize: 12,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'white',
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    width: '85%',
    maxWidth: 360,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 50,
    elevation: 20,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  permissionsList: {
    gap: 16,
    marginBottom: 24,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
  },
  permissionItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  permissionLabel: {
    fontWeight: '600',
    fontSize: 14,
  },
  permissionPending: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  modalButton: {
    borderRadius: 12,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: 'center',
    minWidth: 100,
    maxWidth: 200,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default Settings;

