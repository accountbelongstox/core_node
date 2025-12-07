import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, Image, Alert, ScrollView } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, TSpan, Text as SvgText } from 'react-native-svg';
import { useStore } from '@/apps/awy/awy_store';
import { MobileLayout, Input } from '@/apps/awy/awy_components/Shared';
import { Feather as Icon } from '@react-native-vector-icons/feather';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import AntDesign from '@react-native-vector-icons/ant-design';
import { getTheme } from '@/apps/awy/awy_theme/theme';
import { createStyles } from '@/apps/awy/awy_theme';
import { AwyAssets } from '@/apps/awy/awy_assets';

const Login: React.FC = () => {
  const { login, t, theme } = useStore();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const colors = getTheme(theme);
  const styles = createStyles(colors);

  const handleSubmit = () => {
    setShowForm(true);
  };

  const handleSocialLogin = () => {
    Alert.alert(
      t('login.apiTitle'),
      t('login.apiMessage'),
      [{ text: t('common.ok') }]
    );
  };

  const handleFormSubmit = () => {
    if (phone.trim().length === 0) {
      Alert.alert(
        t('login.error'),
        t('login.phoneRequired'),
        [{ text: t('common.ok') }]
      );
      return;
    }
    login(phone);
  };

  const handleSendCode = () => {
    Alert.alert(
      t('login.codeSent'),
      t('login.codeSentMessage'),
      [{ text: t('common.ok') }]
    );
  };

  const renderWelcomeScreen = () => (
    <MobileLayout showNav={false} style={localStyles.loginContent}>
          {/* Top Left Text - Two Lines with Gradient and White Shadow */}
          <View style={localStyles.topLeftText}>
            {/* Main Title with SVG Gradient */}
            <View style={localStyles.gradientTextContainer}>
              <Svg height="50" width="250">
                <Defs>
                  <SvgLinearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor="#1e293b" stopOpacity="1" />
                    <Stop offset="50%" stopColor="#1e293b" stopOpacity="1" />
                    <Stop offset="100%" stopColor="#8b5cf6" stopOpacity="1" />
                  </SvgLinearGradient>
                </Defs>
                {/* White shadow projection */}
                <SvgText
                  x="1"
                  y="39"
                  fontSize="42"
                  fontWeight="700"
                  fill="rgba(255, 255, 255, 0.5)"
                >
                  <TSpan>{t('login.welcome')}</TSpan>
                </SvgText>
                {/* Gradient text */}
                <SvgText
                  x="0"
                  y="38"
                  fontSize="42"
                  fontWeight="700"
                  fill="url(#gradient1)"
                >
                  <TSpan>{t('login.welcome')}</TSpan>
                </SvgText>
              </Svg>
            </View>
            {/* Subtitle */}
            <View style={localStyles.gradientTextContainer}>
              <Svg height="30" width="200">
                {/* White shadow projection */}
                <SvgText
                  x="1"
                  y="23"
                  fontSize="27"
                  fontWeight="900"
                  fill="rgba(255, 255, 255, 0.5)"
                >
                  <TSpan>{t('login.subtitle')}</TSpan>
                </SvgText>
                {/* Solid black text */}
                <SvgText
                  x="0"
                  y="22"
                  fontSize="27"
                  fontWeight="900"
                  fill="#1e293b"
                >
                  <TSpan>{t('login.subtitle')}</TSpan>
                </SvgText>
              </Svg>
            </View>
          </View>

          {/* Center Area with Logo - Gradient makes it white */}
          <View style={localStyles.centerArea}>
            <View style={localStyles.logoContainer}>
              <Image 
                source={AwyAssets.logo}
                style={localStyles.logoImage}
                resizeMode="contain"
              />
            </View>

            {/* Main Login/Register Button with Gradient */}
            <TouchableOpacity 
              style={localStyles.mainButtonContainer}
              onPress={handleSubmit}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#3b82f6', '#06b6d4', '#8b5cf6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={localStyles.mainButton}
              >
                <Icon name="smartphone" size={20} color="white" style={{ marginRight: 8 }} />
                <Text style={localStyles.mainButtonText}>{t('login.btn')}</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Agreement Text */}
            <Text style={localStyles.agreementText}>
              {t('login.agree')}
            </Text>
          </View>

          {/* Bottom - Other Login Methods */}
          <View style={localStyles.bottomSection}>
            <Text style={localStyles.otherLoginText}>{t('login.other')}</Text>
            <View style={localStyles.socialContainer}>
              {/* WeChat */}
              <TouchableOpacity 
                style={[localStyles.socialBtn, { backgroundColor: '#e8f5e9' }]}
                onPress={handleSocialLogin}
              >
                <MaterialIcons name="wechat" size={32} color="#4caf50" />
              </TouchableOpacity>
              {/* QQ */}
              <TouchableOpacity 
                style={[localStyles.socialBtn, { backgroundColor: '#e3f2fd' }]}
                onPress={handleSocialLogin}
              >
                <AntDesign name="QQ" size={32} color="#2196f3" />
              </TouchableOpacity>
              {/* Alipay */}
              <TouchableOpacity 
                style={[localStyles.socialBtn, { backgroundColor: '#fff3e0' }]}
                onPress={handleSocialLogin}
              >
                <AntDesign name="alipay-circle" size={32} color="#ff9800" />
              </TouchableOpacity>
            </View>
          </View>
        </MobileLayout>
  );

  const renderFormScreen = () => (
    <MobileLayout showNav={false} style={localStyles.loginContent}>
      <ScrollView 
        contentContainerStyle={localStyles.formContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back Button */}
        <TouchableOpacity 
          onPress={() => setShowForm(false)}
          style={localStyles.backButton}
        >
          <Icon name="arrow-left" size={24} color="#1e293b" />
        </TouchableOpacity>

        {/* Logo */}
        <View style={localStyles.formLogoContainer}>
          <Image 
            source={AwyAssets.logo}
            style={localStyles.formLogoImage}
            resizeMode="contain"
          />
        </View>

        {/* Form Title */}
        <View style={localStyles.formTitleContainer}>
          <Text style={localStyles.formTitle}>
            {isLogin ? t('login.login') : t('login.register')}
          </Text>
          <Text style={localStyles.formSubtitle}>
            {isLogin ? t('login.loginSubtitle') : t('login.registerSubtitle')}
          </Text>
        </View>

        {/* Phone Input */}
        <View style={localStyles.formInputContainer}>
          <Text style={localStyles.formLabel}>{t('login.phone')}</Text>
          <Input
            placeholder={t('login.phone')}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            style={localStyles.formInput}
          />
        </View>

        {/* Code Input */}
        <View style={localStyles.formInputContainer}>
          <Text style={localStyles.formLabel}>{t('login.code')}</Text>
          <View style={localStyles.codeInputRow}>
            <Input
              placeholder={t('login.code')}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              style={[localStyles.formInput, { flex: 1, marginRight: 12 }]}
            />
            <TouchableOpacity 
              style={localStyles.codeButton}
              onPress={handleSendCode}
            >
              <Text style={localStyles.codeButtonText}>{t('login.sendCode')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity 
          style={localStyles.submitButtonContainer}
          onPress={handleFormSubmit}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#3b82f6', '#8b5cf6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={localStyles.submitButton}
          >
            <Text style={localStyles.submitButtonText}>
              {isLogin ? t('login.login') : t('login.register')}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Toggle Login/Register */}
        <View style={localStyles.toggleContainer}>
          <Text style={localStyles.toggleText}>
            {isLogin ? t('login.noAccount') : t('login.hasAccount')}
          </Text>
          <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
            <Text style={localStyles.toggleLink}>
              {isLogin ? t('login.register') : t('login.login')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </MobileLayout>
  );

  return (
    <KeyboardAvoidingView 
      style={localStyles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={localStyles.loginLayout}>
        {/* Holographic Gradient Background */}
        <LinearGradient
          colors={['#e0f2fe', '#3b82f6', '#ffffff', '#ffffff', '#8b5cf6', '#ec4899']}
          locations={[0, 0.2, 0.4, 0.6, 0.8, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        
        {showForm ? renderFormScreen() : renderWelcomeScreen()}
      </View>
    </KeyboardAvoidingView>
  );
};

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loginLayout: {
    flex: 1,
    position: 'relative',
  },
  loginContent: {
    flex: 1,
    padding: 0,
    backgroundColor: 'transparent',
  },
  // Top Left Text - Two Lines with Effects
  topLeftText: {
    position: 'absolute',
    top: 60,
    left: 24,
    zIndex: 10,
  },
  gradientTextContainer: {
    marginBottom: 10,
  },
  // Center Area - White through gradient, moved down
  centerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 160,
    marginBottom: 60,
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  // Center Logo
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  logoImage: {
    width: 120,
    height: 120,
  },
  // Main Login/Register Button Container
  mainButtonContainer: {
    width: '100%',
    marginBottom: 16,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  // Main Login/Register Button with Gradient
  mainButton: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  mainButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  // Agreement Text
  agreementText: {
    fontSize: 12,
    color: '#3b82f6',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  // Bottom Section
  bottomSection: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  otherLoginText: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 24,
  },
  socialContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
  },
  socialBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  // Form Screen Styles
  formContainer: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 60,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  formTitleContainer: {
    marginBottom: 32,
  },
  formTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 16,
    color: '#64748b',
  },
  formInputContainer: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  formInput: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: 'rgba(30, 41, 59, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  formLogoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  formLogoImage: {
    width: 80,
    height: 80,
  },
  codeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  codeButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#3b82f6', // Use fixed color instead of colors.primary
  },
  codeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  submitButtonContainer: {
    width: '100%',
    marginTop: 8,
    marginBottom: 24,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButton: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  toggleText: {
    fontSize: 14,
    color: '#64748b',
    marginRight: 4,
  },
  toggleLink: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '600',
  },
});

export default Login;

