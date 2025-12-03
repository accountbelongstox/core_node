import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { MobileLayout, Header, Input, GlassCard } from '../components/Shared';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../store';
import { Feather as Icon } from '@react-native-vector-icons/feather';
import { getTheme } from '../styles/theme';

const AddFriend: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const navigation = useNavigation<any>();
  const { theme } = useStore();
  const colors = getTheme(theme);

  return (
    <MobileLayout showNav={false}>
      <Header title="Add Family" backTo="/friends" />
      
      <View style={localStyles.content}>
        {/* Search Box */}
        <View style={localStyles.searchContainer}>
          <Icon name="search" size={20} color={colors.textSecondary} style={localStyles.searchIcon} />
          <Input 
            placeholder="Search by Phone Number" 
            value={searchText}
            onChangeText={setSearchText}
            style={localStyles.searchInput}
          />
          <TouchableOpacity style={[localStyles.searchButton, { backgroundColor: colors.primary }]}>
            <Text style={localStyles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        </View>

        {/* Scan Card */}
        <GlassCard style={localStyles.scanCard}>
          <View style={localStyles.scanIconContainer}>
            <Icon name="grid" size={32} color={colors.primary} />
          </View>
          <View style={localStyles.scanTextContainer}>
            <Text style={[localStyles.scanTitle, { color: colors.textPrimary }]}>Scan QR Code</Text>
            <Text style={[localStyles.scanSubtitle, { color: colors.textSecondary }]}>Scan face-to-face to add quickly</Text>
          </View>
        </GlassCard>

        {/* Recent Search Mock */}
        <View>
          <Text style={[localStyles.sectionTitle, { color: colors.textSecondary }]}>Found User</Text>
          <TouchableOpacity onPress={() => navigation.navigate('SendRequest')}>
            <GlassCard style={localStyles.userCard}>
              <View style={localStyles.userCardLeft}>
                <Image 
                  source={{ uri: 'https://api.dicebear.com/7.x/avataaars/svg?seed=John' }} 
                  style={localStyles.userAvatar}
                />
                <View>
                  <Text style={[localStyles.userName, { color: colors.textPrimary }]}>John Doe</Text>
                  <Text style={[localStyles.userPhone, { color: colors.textSecondary }]}>138****8888</Text>
                </View>
              </View>
              <View style={[localStyles.userAddIcon, { backgroundColor: '#dbeafe' }]}>
                <Icon name="user-plus" size={18} color={colors.primary} />
              </View>
            </GlassCard>
          </TouchableOpacity>
        </View>
      </View>
    </MobileLayout>
  );
};

const localStyles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 24,
  },
  searchContainer: {
    position: 'relative',
  },
  searchIcon: {
    position: 'absolute',
    left: 16,
    top: 16,
    zIndex: 1,
  },
  searchInput: {
    paddingLeft: 48,
    paddingRight: 80,
  },
  searchButton: {
    position: 'absolute',
    right: 8,
    top: 8,
    bottom: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 12,
  },
  scanCard: {
    alignItems: 'center',
    padding: 40,
    gap: 16,
    borderWidth: 2,
    borderColor: '#bfdbfe',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(239, 246, 255, 0.5)',
  },
  scanIconContainer: {
    width: 64,
    height: 64,
    backgroundColor: 'white',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 10,
  },
  scanTextContainer: {
    alignItems: 'center',
  },
  scanTitle: {
    fontWeight: '700',
    fontSize: 16,
  },
  scanSubtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  userCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e2e8f0',
  },
  userName: {
    fontWeight: '700',
    fontSize: 14,
  },
  userPhone: {
    fontSize: 12,
  },
  userAddIcon: {
    padding: 8,
    borderRadius: 99,
  },
});

export default AddFriend;

