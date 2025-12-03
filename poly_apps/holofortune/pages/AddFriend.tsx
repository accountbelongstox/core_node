import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { MobileLayout, Header, Input, GlassCard, Button } from '../components/Shared';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Feather';

const AddFriend: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const navigation = useNavigation<any>();

  return (
    <MobileLayout showNav={false}>
      <Header title="Add Family" backTo="/friends" />
      
      <View style={styles.content}>
        {/* Search Box */}
        <View style={styles.searchContainer}>
          <Icon name="search" size={20} color="#94a3b8" style={styles.searchIcon} />
          <Input 
            placeholder="Search by Phone Number" 
            value={searchText}
            onChangeText={setSearchText}
            style={styles.searchInput}
          />
          <TouchableOpacity style={styles.searchButton}>
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        </View>

        {/* Scan Card */}
        <GlassCard style={styles.scanCard}>
          <View style={styles.scanIconContainer}>
            <Icon name="qr-code" size={32} color="#2563eb" />
          </View>
          <View style={styles.scanTextContainer}>
            <Text style={styles.scanTitle}>Scan QR Code</Text>
            <Text style={styles.scanSubtitle}>Scan face-to-face to add quickly</Text>
          </View>
        </GlassCard>

        {/* Recent Search Mock */}
        <View>
          <Text style={styles.sectionTitle}>Found User</Text>
          <TouchableOpacity onPress={() => navigation.navigate('SendRequest')}>
            <GlassCard style={styles.userCard}>
              <View style={styles.userCardLeft}>
                <Image 
                  source={{ uri: 'https://api.dicebear.com/7.x/avataaars/svg?seed=John' }} 
                  style={styles.userAvatar}
                />
                <View>
                  <Text style={styles.userName}>John Doe</Text>
                  <Text style={styles.userPhone}>138****8888</Text>
                </View>
              </View>
              <View style={styles.userAddIcon}>
                <Icon name="user-plus" size={18} color="#2563eb" />
              </View>
            </GlassCard>
          </TouchableOpacity>
        </View>
      </View>
    </MobileLayout>
  );
};

const styles = StyleSheet.create({
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
    backgroundColor: '#3b82f6',
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
    color: '#334155',
    fontSize: 16,
  },
  scanSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
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
    color: '#1e293b',
  },
  userPhone: {
    fontSize: 12,
    color: '#94a3b8',
  },
  userAddIcon: {
    padding: 8,
    backgroundColor: '#dbeafe',
    borderRadius: 99,
  },
});

export default AddFriend;
