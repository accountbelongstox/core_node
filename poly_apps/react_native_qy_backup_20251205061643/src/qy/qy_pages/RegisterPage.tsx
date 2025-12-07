/**
 * Register Page
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '@/qy/qy_store';
import { createStyles } from '@/common/theme';

const RegisterPage: React.FC = () => {
  const navigation = useNavigation();
  const { themeData } = useStore();
  const styles = createStyles(themeData);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleRegister = async () => {
    if (!username || !email || !password) {
      Alert.alert('错误', '请填写完整信息');
      return;
    }

    try {
      // TODO: Implement actual registration
      Alert.alert('成功', '注册成功');
      navigation.goBack();
    } catch (error) {
      Alert.alert('错误', '注册失败');
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.card, { marginTop: 32, marginHorizontal: 16 }]}>
        <Text style={[styles.text, { fontSize: 24, fontWeight: 'bold', marginBottom: 32, textAlign: 'center' }]}>
          注册
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
          placeholder="邮箱"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
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
          style={[localStyles.registerButton, { backgroundColor: themeData.colors.primary }]}
          onPress={handleRegister}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
            注册
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
  registerButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
});

export default RegisterPage;

