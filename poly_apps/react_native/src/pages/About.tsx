import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { MobileLayout, Header, GlassCard } from '../components/Shared';
import { useStore } from '../store';
import { Feather as Icon } from '@react-native-vector-icons/feather';
import { getTheme } from '../styles/theme';

const About: React.FC = () => {
  const { t, theme } = useStore();
  const colors = getTheme(theme);
  
  const menuItems = [
    'Feature Introduction',
    'Privacy Policy',
    'Terms of Service',
    'Check Updates',
  ];

  return (
    <MobileLayout showNav={false}>
      <Header title={t('me.about')} backTo="/me" />
      
      <ScrollView 
        style={localStyles.content}
        contentContainerStyle={localStyles.contentContainer}
      >
        <View style={localStyles.logoContainer}>
          <View style={[localStyles.logo, { backgroundColor: colors.primary }]}>
            <Icon name="shield" size={48} color="white" />
          </View>
        </View>
        <Text style={[localStyles.appName, { color: colors.textPrimary }]}>{t('app.name')}</Text>
        <Text style={[localStyles.version, { color: colors.textSecondary }]}>Version 1.0.2 (Build 2024)</Text>
        
        <GlassCard style={localStyles.menuCard}>
          {menuItems.map((item, index) => (
            <TouchableOpacity 
              key={item}
              style={[
                localStyles.menuItem,
                index < menuItems.length - 1 && { borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' }
              ]}
              activeOpacity={0.7}
            >
              <Text style={[localStyles.menuItemText, { color: colors.textPrimary }]}>{item}</Text>
              <Icon name="chevron-right" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </GlassCard>

        <View style={localStyles.footer}>
          <Text style={[localStyles.footerText, { color: colors.textSecondary }]}>
            Copyright © 2024 SafeGuardian Inc.{'\n'}All Rights Reserved.
          </Text>
        </View>
      </ScrollView>
    </MobileLayout>
  );
};

const localStyles = StyleSheet.create({
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 24,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  version: {
    fontSize: 14,
    marginBottom: 40,
  },
  menuCard: {
    width: '100%',
    padding: 0,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '500',
  },
  footer: {
    marginTop: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
  },
});

export default About;

