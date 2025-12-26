/**
 * Profile Page
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '@/qy/qy_store';
import { createStyles } from '@/common/theme';
import { userApi } from '@/qy/qy_services/api-service';
import { User } from '@/qy/qy_types';
import Icon from 'react-native-vector-icons/Feather';

const ProfilePage: React.FC = () => {
  const navigation = useNavigation();
  const { themeData } = useStore();
  const styles = createStyles(themeData);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const response = await userApi.getProfile();
      if (response.success && response.data) {
        setUser(response.data);
      }
    } catch (error) {
      console.error('Failed to load user:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={themeData.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.card, { marginTop: 16, alignItems: 'center' }]}>
        <View style={localStyles.avatar}>
          <Icon name="user" size={48} color={themeData.colors.primary} />
        </View>
        {user && (
          <>
            <Text style={[styles.text, { fontSize: 20, fontWeight: 'bold', marginTop: 16 }]}>
              {user.username}
            </Text>
            <Text style={styles.textSecondary}>{user.email}</Text>
          </>
        )}
      </View>

      <View style={styles.card}>
        <TouchableOpacity style={localStyles.menuItem}>
          <Icon name="edit" size={24} color={themeData.colors.primary} />
          <Text style={[styles.text, { marginLeft: 16, flex: 1 }]}>编辑资料</Text>
          <Icon name="chevron-right" size={24} color={themeData.colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={localStyles.menuItem}
          onPress={() => navigation.navigate('MemoryLibrary' as never)}
        >
          <Icon name="database" size={24} color={themeData.colors.primary} />
          <Text style={[styles.text, { marginLeft: 16, flex: 1 }]}>记忆库</Text>
          <Icon name="chevron-right" size={24} color={themeData.colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={localStyles.menuItem}
          onPress={() => navigation.navigate('Achievement' as never)}
        >
          <Icon name="award" size={24} color={themeData.colors.primary} />
          <Text style={[styles.text, { marginLeft: 16, flex: 1 }]}>成就</Text>
          <Icon name="chevron-right" size={24} color={themeData.colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const localStyles = StyleSheet.create({
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
});

export default ProfilePage;

