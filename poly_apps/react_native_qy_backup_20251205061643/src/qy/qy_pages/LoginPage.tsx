/**
 * Login Page
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '@/qy/qy_store';
import { createStyles } from '@/common/theme';
import { userApi } from '@/qy/qy_services/api-service';

const LoginPage: React.FC = () => {
  const navigation = useNavigation();
  const { themeData } = useStore();
  const styles = createStyles(themeData);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('错误', '请输入用户名和密码');
      return;
    }

    try {
      // TODO: Implement actual login
      Alert.alert('成功', '登录成功');
      navigation.goBack();
    } catch (error) {
      Alert.alert('错误', '登录失败');
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.card, { marginTop: 32, marginHorizontal: 16 }]}>
        <Text style={[styles.text, { fontSize: 24, fontWeight: 'bold', marginBottom: 32, textAlign: 'center' }]}>
          登录
        </Text>

        <TextInput
          style={localStyles.input}
          placeholder="用户名"
          value={username}
          onChangeText={setUsername}
          placeholderTextColor={themeData.colors.textSecondary}
        />

        <TextInput
          style={localStyles.input}
          placeholder="密码"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholderTextColor={themeData.colors.textSecondary}
        />

        <TouchableOpacity
          style={[localStyles.loginButton, { backgroundColor: themeData.colors.primary }]}
          onPress={handleLogin}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
            登录
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={localStyles.registerLink}
          onPress={() => navigation.navigate('Register' as never)}
        >
          <Text style={{ color: themeData.colors.primary }}>
            还没有账号？立即注册
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const localStyles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  loginButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  registerLink: {
    marginTop: 16,
    alignItems: 'center',
  },
});

export default LoginPage;

