import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { MobileLayout, Header, GlassCard } from '../components/Shared';
import { useStore } from '../store';
import Icon from 'react-native-vector-icons/Feather';

const About: React.FC = () => {
  const { t } = useStore();
  
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
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.logoContainer}>
          <View style={styles.logo}>
            <Icon name="shield" size={48} color="white" />
          </View>
        </View>
        <Text style={styles.appName}>{t('app.name')}</Text>
        <Text style={styles.version}>Version 1.0.2 (Build 2024)</Text>
        
        <GlassCard style={styles.menuCard}>
          {menuItems.map((item, index) => (
            <TouchableOpacity 
              key={item}
              style={[
                styles.menuItem,
                index < menuItems.length - 1 && styles.menuItemBorder
              ]}
              activeOpacity={0.7}
            >
              <Text style={styles.menuItemText}>{item}</Text>
              <Icon name="chevron-right" size={16} color="#cbd5e1" />
            </TouchableOpacity>
          ))}
        </GlassCard>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Copyright © 2024 SafeGuardian Inc.{'\n'}All Rights Reserved.
          </Text>
        </View>
      </ScrollView>
    </MobileLayout>
  );
};

const styles = StyleSheet.create({
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
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  version: {
    color: '#94a3b8',
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
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
  },
  footer: {
    marginTop: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 10,
    color: '#94a3b8',
    lineHeight: 15,
    textAlign: 'center',
  },
});

export default About;
