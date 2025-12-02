import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useStore } from '../store';
import { MobileLayout, GlassCard, Input, Button } from '../components/Shared';
import Icon from 'react-native-vector-icons/Feather';

const Login: React.FC = () => {
  const { login, t } = useStore();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');

  const handleLogin = () => {
    if (phone) login(phone);
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <MobileLayout showNav={false} style={styles.loginLayout}>
        <View style={styles.logoContainer}>
          <View style={styles.loginLogoContainer}>
            <Icon name="shield" size={40} color="#3b82f6" />
          </View>
          <Text style={styles.gradientText}>
            {t('app.name')}
          </Text>
          <Text style={styles.subtitle}>
            {t('login.title')}
          </Text>
        </View>

        <GlassCard style={styles.loginCard}>
          <Input 
            keyboardType="phone-pad"
            placeholder={t('login.phone')} 
            value={phone}
            onChangeText={setPhone}
            style={styles.input}
          />
          
          <View style={styles.codeRow}>
            <Input 
              keyboardType="number-pad"
              placeholder={t('login.code')} 
              value={code}
              onChangeText={setCode}
              style={[styles.input, styles.codeInput]}
            />
            <TouchableOpacity style={styles.codeButton}>
              <Text style={styles.codeButtonText}>Get Code</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.checkboxRow}>
            <TouchableOpacity style={styles.checkbox}>
              <Icon name="check" size={16} color="#3b82f6" />
            </TouchableOpacity>
            <Text style={styles.checkboxText}>{t('login.agree')}</Text>
          </View>

          <Button onPress={handleLogin}>
            {t('login.btn')}
          </Button>
        </GlassCard>

        <View style={styles.socialContainer}>
          <TouchableOpacity style={styles.socialBtn}>
            <Icon name="message-circle" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.socialBtn}>
            <Icon name="scan" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.socialBtn}>
            <Icon name="credit-card" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </MobileLayout>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loginLayout: {
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  loginLogoContainer: {
    width: 80,
    height: 80,
    backgroundColor: 'white',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    transform: [{ rotate: '12deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 25,
    elevation: 10,
  },
  gradientText: {
    color: 'white',
    fontSize: 30,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  loginCard: {
    width: '100%',
    gap: 16,
    backgroundColor: 'rgba(255,255,255,0.7)',
    marginBottom: 24,
  },
  input: {
    backgroundColor: 'white',
    marginBottom: 12,
  },
  codeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  codeInput: {
    flex: 1,
  },
  codeButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    justifyContent: 'center',
  },
  codeButtonText: {
    color: '#3b82f6',
    fontWeight: 'bold',
    fontSize: 14,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    marginBottom: 12,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxText: {
    fontSize: 12,
    color: '#64748b',
  },
  socialContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 24,
  },
  socialBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
});

export default Login;
