import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { MobileLayout, Header, Input, GlassCard } from '@/apps/awy/awy_components/Shared';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '@/apps/awy/awy_store';
import { Feather as Icon } from '@react-native-vector-icons/feather';
import { getTheme } from '@/apps/awy/awy_theme/theme';
import { Avatar } from '@/common/components/Avatar';

const AddFriend: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const navigation = useNavigation<any>();
  const { theme, t } = useStore();
  const colors = getTheme(theme);

  return (
    <MobileLayout showNav={false}>
      <Header title={t('friend.addFamily')} backTo="/friends" />
      
      <ScrollView style={localStyles.scrollView} contentContainerStyle={localStyles.content}>
        {/* Search Box */}
        <View style={localStyles.searchContainer}>
          <View style={localStyles.searchInputWrapper}>
            <Icon name="search" size={20} color={colors.textSecondary} style={localStyles.searchIcon} />
            <Input 
              placeholder={t('friend.searchByPhone')} 
              value={searchText}
              onChangeText={setSearchText}
              style={localStyles.searchInput}
            />
          </View>
          <TouchableOpacity 
            style={[localStyles.searchButton, { backgroundColor: colors.primary }]}
            onPress={() => {
              // TODO: Implement search
            }}
          >
            <Text style={localStyles.searchButtonText}>{t('common.search')}</Text>
          </TouchableOpacity>
        </View>

        {/* Scan QR Code Card */}
        <TouchableOpacity 
          activeOpacity={0.8}
          onPress={() => {
            // TODO: Implement QR scan
          }}
        >
          <GlassCard style={localStyles.scanCard}>
            <View style={localStyles.scanIconContainer}>
              <Icon name="grid" size={32} color={colors.primary} />
            </View>
            <Text style={[localStyles.scanTitle, { color: colors.textPrimary }]}>
              {t('friend.scanQR')}
            </Text>
            <Text style={[localStyles.scanSubtitle, { color: colors.textSecondary }]}>
              {t('friend.scanDescription')}
            </Text>
          </GlassCard>
        </TouchableOpacity>

        {/* Found User Section - Always show example */}
        <View style={localStyles.foundSection}>
          <Text style={[localStyles.sectionTitle, { color: colors.textSecondary }]}>
            {t('friend.foundUser')}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('SendRequest')}>
            <GlassCard style={localStyles.userCard}>
              <View style={localStyles.userRow}>
                <TouchableOpacity onPress={() => navigation.navigate('SendRequest')}>
                  <Avatar 
                    uri="" 
                    gender="male" 
                    size={48}
                    style={{ borderWidth: 2, borderColor: colors.bg }}
                  />
                </TouchableOpacity>
                
                <View style={localStyles.userContent}>
                  <View style={localStyles.userHeader}>
                    <TouchableOpacity onPress={() => navigation.navigate('SendRequest')}>
                      <View style={localStyles.nameRow}>
                        <Text style={[localStyles.userName, { color: colors.textPrimary }]}>
                          {t('friend.mockUserName')}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={localStyles.userPhoneRow}>
                    <Icon name="phone" size={12} color={colors.textSecondary} />
                    <Text style={[localStyles.userPhone, { color: colors.textSecondary }]}>
                      {t('friend.mockUserPhone')}
                    </Text>
                  </View>

                  <TouchableOpacity 
                    style={[localStyles.addButton, { borderTopColor: colors.glassBorder }]}
                    onPress={() => navigation.navigate('SendRequest')}
                  >
                    <View style={localStyles.addButtonLeft}>
                      <Icon name="user-plus" size={14} color={colors.primary} />
                      <Text style={[localStyles.addButtonText, { color: colors.primary }]}>
                        {t('friend.add')}
                      </Text>
                    </View>
                    <Icon name="chevron-right" size={14} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>
            </GlassCard>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </MobileLayout>
  );
};

const localStyles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 24,
  },
  searchContainer: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  searchInputWrapper: {
    flex: 1,
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
    paddingRight: 16,
  },
  searchButton: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  searchButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 14,
  },
  scanCard: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    borderWidth: 2,
    borderColor: '#bfdbfe',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(239, 246, 255, 0.5)',
    borderRadius: 16,
  },
  scanIconContainer: {
    width: 80,
    height: 80,
    backgroundColor: 'white',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  scanTitle: {
    fontWeight: '700',
    fontSize: 18,
    marginBottom: 8,
    textAlign: 'center',
  },
  scanSubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  foundSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  userCard: {
    gap: 0,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  userContent: {
    flex: 1,
    flexDirection: 'column',
    gap: 4,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userName: {
    fontWeight: '700',
    color: '#1e293b',
    fontSize: 16,
  },
  userPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  userPhone: {
    fontSize: 12,
    color: '#64748b',
  },
  addButton: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  addButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default AddFriend;

