import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useStore } from '../store';
import { MobileLayout, GlassCard, Input, Button } from '../components/Shared';
import { Feather as Icon } from '@react-native-vector-icons/feather';
import { getTheme } from '../styles/theme';
import { createStyles } from '../styles';

const Login: React.FC = () => {
  const { login, t, theme } = useStore();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const colors = getTheme(theme);
  const styles = createStyles(colors);

  const handleLogin = () => {
    if (phone) login(phone);
  };

  return (
    <KeyboardAvoidingView 
      style={localStyles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <MobileLayout showNav={false} style={[localStyles.loginLayout, { backgroundColor: colors.primary }]}>
        <View style={localStyles.logoContainer}>
          <View style={localStyles.loginLogoContainer}>
            <Icon name="shield" size={40} color={colors.primary} />
          </View>
          <Text style={localStyles.gradientText}>
            {t('app.name')}
          </Text>
          <Text style={localStyles.subtitle}>
            {t('login.title')}
          </Text>
        </View>

        <GlassCard style={[localStyles.loginCard, { backgroundColor: 'rgba(255,255,255,0.7)' }]}>
          <Input 
            keyboardType="phone-pad"
            placeholder={t('login.phone')} 
            value={phone}
            onChangeText={setPhone}
            style={[localStyles.input, { backgroundColor: 'white' }]}
          />
          
          <View style={localStyles.codeRow}>
            <Input 
              keyboardType="number-pad"
              placeholder={t('login.code')} 
              value={code}
              onChangeText={setCode}
              style={[localStyles.input, localStyles.codeInput, { backgroundColor: 'white' }]}
            />
            <TouchableOpacity style={[localStyles.codeButton, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
              <Text style={[localStyles.codeButtonText, { color: colors.primary }]}>Get Code</Text>
            </TouchableOpacity>
          </View>
          
          <View style={localStyles.checkboxRow}>
            <TouchableOpacity style={[localStyles.checkbox, { borderColor: colors.primary }]}>
              <Icon name="check" size={16} color={colors.primary} />
            </TouchableOpacity>
            <Text style={[localStyles.checkboxText, { color: colors.textSecondary }]}>{t('login.agree')}</Text>
          </View>

          <Button onPress={handleLogin}>
            {t('login.btn')}
          </Button>
        </GlassCard>

        <View style={localStyles.socialContainer}>
          <TouchableOpacity style={localStyles.socialBtn}>
            <Icon name="message-circle" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={localStyles.socialBtn}>
            <Icon name="scan" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={localStyles.socialBtn}>
            <Icon name="credit-card" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </MobileLayout>
    </KeyboardAvoidingView>
  );
};

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loginLayout: {
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
    marginBottom: 24,
  },
  input: {
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
    justifyContent: 'center',
  },
  codeButtonText: {
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
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxText: {
    fontSize: 12,
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

