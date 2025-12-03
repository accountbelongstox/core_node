import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, Animated, Image, Modal, Alert } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, TSpan, Text as SvgText } from 'react-native-svg';
import { useStore } from '../store';
import { MobileLayout, GlassCard, Input, Button } from '../components/Shared';
import { Feather as Icon } from '@react-native-vector-icons/feather';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import AntDesign from 'react-native-vector-icons/AntDesign';
import { getTheme } from '../styles/theme';
import { createStyles } from '../styles';

const Login: React.FC = () => {
  const { login, t, theme } = useStore();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [modalPhone, setModalPhone] = useState('');
  const [modalCode, setModalCode] = useState('');
  const [isLogin, setIsLogin] = useState(true); // true for login, false for register
  const colors = getTheme(theme);
  const styles = createStyles(colors);
  

  const handleSubmit = () => {
    // Open login modal instead of direct login
    setShowLoginModal(true);
  };

  const handleSocialLogin = () => {
    Alert.alert(
      t('login.apiTitle') || '提示',
      t('login.apiMessage') || 'API 接入中，推荐使用手机登陆',
      [{ text: t('common.ok') || '确定' }]
    );
  };

  const handleModalLogin = () => {
    // Accept any input for testing - just need phone number
    if (modalPhone) {
      // If no code provided, use phone as code for testing
      const codeToUse = modalCode || '123456';
      login(modalPhone);
      setShowLoginModal(false);
      // Navigation will happen automatically via isAuthenticated change
    } else {
      Alert.alert(
        t('login.error') || '提示',
        t('login.phoneRequired') || '请输入手机号',
        [{ text: t('common.ok') || '确定' }]
      );
    }
  };

  const handleSendCode = () => {
    // TODO: Implement verification code sending
    Alert.alert(
      t('login.codeSent') || '验证码已发送',
      t('login.codeSentMessage') || '验证码已发送到您的手机，请查收',
      [{ text: t('common.ok') || '确定' }]
    );
  };

  return (
    <KeyboardAvoidingView 
      style={localStyles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={localStyles.loginLayout}>
        {/* Holographic Gradient Background - White center with Blue, Purple/Red gradient around */}
        <LinearGradient
          colors={['#e0f2fe', '#3b82f6', '#ffffff', '#ffffff', '#8b5cf6', '#ec4899']}
          locations={[0, 0.2, 0.4, 0.6, 0.8, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        
        <MobileLayout showNav={false} style={localStyles.loginContent}>
          {/* Top Left Text - Two Lines with Gradient and White Shadow */}
          <View style={localStyles.topLeftText}>
            {/* Main Title with SVG Gradient (浅黑、黑、紫) and White Shadow */}
            <View style={localStyles.gradientTextContainer}>
              <Svg height="50" width="250">
                <Defs>
                  <SvgLinearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor="#94a3b8" stopOpacity="1" /> {/* 浅黑 */}
                    <Stop offset="50%" stopColor="#1e293b" stopOpacity="1" /> {/* 黑 */}
                    <Stop offset="100%" stopColor="#8b5cf6" stopOpacity="1" /> {/* 紫 */}
                  </SvgLinearGradient>
                </Defs>
                {/* White shadow projection - multiple layers */}
                <SvgText
                  x="2"
                  y="40"
                  fontSize="42"
                  fontWeight="700"
                  fill="rgba(255, 255, 255, 0.8)"
                >
                  <TSpan>{t('login.welcome')}</TSpan>
                </SvgText>
                <SvgText
                  x="1"
                  y="39"
                  fontSize="42"
                  fontWeight="700"
                  fill="rgba(255, 255, 255, 0.6)"
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
            {/* Subtitle - 全黑，加粗加大50% */}
            <View style={localStyles.gradientTextContainer}>
              <Svg height="30" width="200">
                <Defs>
                  <SvgLinearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0%" stopColor="#94a3b8" stopOpacity="1" /> {/* 浅黑 */}
                    <Stop offset="50%" stopColor="#1e293b" stopOpacity="1" /> {/* 黑 */}
                    <Stop offset="100%" stopColor="#8b5cf6" stopOpacity="1" /> {/* 紫 */}
                  </SvgLinearGradient>
                </Defs>
                {/* White shadow projection */}
                <SvgText
                  x="2"
                  y="24"
                  fontSize="27"
                  fontWeight="900"
                  fill="rgba(255, 255, 255, 0.8)"
                >
                  <TSpan>{t('login.subtitle')}</TSpan>
                </SvgText>
                <SvgText
                  x="1"
                  y="23"
                  fontSize="27"
                  fontWeight="900"
                  fill="rgba(255, 255, 255, 0.6)"
                >
                  <TSpan>{t('login.subtitle')}</TSpan>
                </SvgText>
                {/* Gradient text - 全黑渐变 */}
                <SvgText
                  x="0"
                  y="22"
                  fontSize="27"
                  fontWeight="900"
                  fill="url(#gradient2)"
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
                source={require('../../assets/images/logo.png')}
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
      </View>

      {/* Login/Register Modal */}
      <Modal
        visible={showLoginModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLoginModal(false)}
      >
        <View style={localStyles.modalOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={localStyles.modalContainer}
          >
            <GlassCard style={localStyles.modalCard}>
              {/* Modal Header */}
              <View style={localStyles.modalHeader}>
                <TouchableOpacity 
                  onPress={() => setShowLoginModal(false)}
                  style={localStyles.modalCloseBtn}
                >
                  <Icon name="x" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[localStyles.modalTitle, { color: colors.text }]}>
                  {isLogin ? t('login.login') : t('login.register')}
                </Text>
                <View style={{ width: 24 }} />
              </View>

              {/* Phone Input */}
              <View style={localStyles.modalInputContainer}>
                <Text style={[localStyles.modalLabel, { color: colors.text }]}>{t('login.phone')}</Text>
                <Input
                  placeholder={t('login.phone')}
                  value={modalPhone}
                  onChangeText={setModalPhone}
                  keyboardType="phone-pad"
                  style={localStyles.modalInput}
                />
              </View>

              {/* Code Input */}
              <View style={localStyles.modalInputContainer}>
                <Text style={[localStyles.modalLabel, { color: colors.text }]}>{t('login.code')}</Text>
                <View style={localStyles.codeInputRow}>
                  <Input
                    placeholder={t('login.code')}
                    value={modalCode}
                    onChangeText={setModalCode}
                    keyboardType="number-pad"
                    style={[localStyles.modalInput, { flex: 1, marginRight: 12 }]}
                  />
                  <TouchableOpacity 
                    style={localStyles.codeButton}
                    onPress={handleSendCode}
                  >
                    <Text style={localStyles.codeButtonText}>{t('login.sendCode')}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Login/Register Buttons */}
              <View style={localStyles.modalButtonRow}>
                <TouchableOpacity
                  style={[localStyles.modalButton, !isLogin && localStyles.modalButtonSecondary]}
                  onPress={() => {
                    setIsLogin(true);
                    handleModalLogin();
                  }}
                >
                  <LinearGradient
                    colors={isLogin ? ['#3b82f6', '#8b5cf6'] : ['#e2e8f0', '#cbd5e1']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={localStyles.modalButtonGradient}
                  >
                    <Text style={[localStyles.modalButtonText, !isLogin && { color: colors.text }]}>
                      {t('login.login')}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[localStyles.modalButton, isLogin && localStyles.modalButtonSecondary]}
                  onPress={() => {
                    setIsLogin(false);
                    handleModalLogin();
                  }}
                >
                  <LinearGradient
                    colors={!isLogin ? ['#3b82f6', '#8b5cf6'] : ['#e2e8f0', '#cbd5e1']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={localStyles.modalButtonGradient}
                  >
                    <Text style={[localStyles.modalButtonText, isLogin && { color: colors.text }]}>
                      {t('login.register')}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </GlassCard>
          </KeyboardAvoidingView>
        </View>
      </Modal>
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
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalInputContainer: {
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  modalInput: {
    width: '100%',
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
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalButtonSecondary: {
    opacity: 0.6,
  },
  modalButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default Login;

