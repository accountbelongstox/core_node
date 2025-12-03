import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MobileLayout, Header, GlassCard, Button } from '../components/Shared';
import { useStore } from '../store';
import Icon from 'react-native-vector-icons/Feather';

const Settings: React.FC = () => {
  const { theme, toggleTheme, language, setLanguage, t } = useStore();
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
      style={styles.optionRow}
      activeOpacity={0.7}
    >
      <View style={styles.optionRowLeft}>
        <View style={styles.optionIconBox}>
          <Icon name={iconName} size={18} color="#3b82f6" />
        </View>
        <Text style={styles.optionLabel}>{label}</Text>
      </View>
      <View style={styles.optionRowRight}>
        {value && <Text style={styles.optionValue}>{value}</Text>}
        {toggle && (
          <View style={[
            styles.toggle,
            value === 'Dark' && styles.toggleActive
          ]}>
            <View style={[
              styles.toggleThumb,
              value === 'Dark' && styles.toggleThumbActive
            ]} />
          </View>
        )}
        {!toggle && onPress && <Icon name="chevron-right" size={16} color="#cbd5e1" />}
      </View>
    </TouchableOpacity>
  );

  return (
    <MobileLayout showNav={false}>
      <Header title={t('me.settings')} backTo="/me" />
      
      <View style={styles.content}>
        {/* Authorization Card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.permissions')}</Text>
          <GlassCard style={styles.authCard}>
            <View style={styles.authCardHeader}>
              <View style={styles.authIconContainer}>
                <Icon name="shield" size={24} color="white" />
              </View>
              <View>
                <Text style={styles.authTitle}>{t('settings.one_tap')}</Text>
                <Text style={styles.authSubtitle}>{t('settings.auth_desc')}</Text>
              </View>
            </View>
            <Button onPress={startAuthorization} style={styles.authButton}>
              {t('settings.one_tap')}
            </Button>
          </GlassCard>
        </View>

        {/* General Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General</Text>
          <GlassCard style={styles.settingsCard}>
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
              value={language === 'en' ? 'English' : '中文'} 
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
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('settings.permissions')}</Text>
              <Text style={styles.modalSubtitle}>
                Please keep these permissions enabled for the app to function correctly.
              </Text>
            </View>
            
            <View style={styles.permissionsList}>
              {[
                { key: 'location', label: t('perm.location'), iconName: 'map-pin' },
                { key: 'camera', label: t('perm.camera'), iconName: 'camera' },
                { key: 'storage', label: t('perm.storage'), iconName: 'folder' },
              ].map((item, idx) => (
                <View key={item.key} style={styles.permissionItem}>
                  <View style={styles.permissionItemLeft}>
                    <Icon name={item.iconName} size={20} color="#64748b" />
                    <Text style={styles.permissionLabel}>{item.label}</Text>
                  </View>
                  {permissions[item.key as keyof typeof permissions] ? (
                    <Icon name="check-circle" size={20} color="#22c55e" />
                  ) : (
                    isChecking && idx === 0 ? (
                      <ActivityIndicator size="small" color="#3b82f6" />
                    ) : (
                      <View style={styles.permissionPending} />
                    )
                  )}
                </View>
              ))}
            </View>

            <Button 
              onPress={() => !isChecking && setShowAuthModal(false)} 
              disabled={isChecking}
            >
              {isChecking ? t('perm.checking') : 'Done'}
            </Button>
          </View>
        </View>
      </Modal>
    </MobileLayout>
  );
};

const styles = StyleSheet.create({
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
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginBottom: 12,
    marginLeft: 4,
  },
  authCard: {
    gap: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  authCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  authIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authTitle: {
    fontWeight: '700',
    fontSize: 16,
    color: '#1e293b',
  },
  authSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  authButton: {
    borderRadius: 24,
    height: 44,
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
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  optionRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionIconBox: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  optionLabel: {
    fontWeight: '500',
    fontSize: 14,
    color: '#1e293b',
  },
  optionRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionValue: {
    fontSize: 12,
    color: '#64748b',
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
    backgroundColor: '#cbd5e1',
  },
  toggleActive: {
    backgroundColor: '#3b82f6',
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
    backgroundColor: '#f0f4f8',
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
    color: '#1e293b',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748b',
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
    backgroundColor: 'rgba(0,0,0,0.03)',
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
    color: '#1e293b',
  },
  permissionPending: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#cbd5e1',
  },
});

export default Settings;
