import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { MobileLayout, Header, GlassCard, Input } from '../components/Shared';
import { Avatar } from '../components/Avatar';
import { useStore } from '../store';
import { useNavigation } from '@react-navigation/native';
import { Feather as Icon } from '@react-native-vector-icons/feather';
import { getTheme } from '../styles/theme';

const FriendsList: React.FC = () => {
  const { friends, toggleMonitor, t, theme } = useStore();
  const [showFilter, setShowFilter] = useState(false);
  const [searchText, setSearchText] = useState('');
  const navigation = useNavigation<any>();
  const colors = getTheme(theme);

  return (
    <MobileLayout showNav={true}>
      <Header 
        title={`${t('tab.friends')} (${friends.length})`} 
        action={
          <View style={localStyles.headerActions}>
            <TouchableOpacity onPress={() => setShowFilter(!showFilter)}>
              <Icon name="filter" size={20} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('AddFriend')}>
              <Icon name="plus" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>
        } 
      />
      
      {/* Filter Dropdown - With Animation */}
      <View style={[localStyles.filterContainer, { maxHeight: showFilter ? 200 : 0, paddingBottom: showFilter ? 16 : 0 }]}>
        <GlassCard style={localStyles.filterCard}>
          <Text style={[localStyles.filterTitle, { color: colors.textSecondary }]}>FILTER BY STATUS</Text>
          <View style={localStyles.filterButtons}>
            {['All', 'Online', 'Monitored', 'Alerts'].map(f => (
              <TouchableOpacity 
                key={f} 
                style={[
                  localStyles.filterButton,
                  f === 'All' && localStyles.filterButtonActive,
                  { backgroundColor: f === 'All' ? colors.primary : colors.bg }
                ]}
              >
                <Text style={[
                  localStyles.filterButtonText,
                  { color: f === 'All' ? 'white' : colors.textSecondary }
                ]}>
                  {f}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </GlassCard>
      </View>

      <View style={localStyles.content}>
        {/* Search */}
        <View style={localStyles.searchContainer}>
          <Icon name="search" size={18} color={colors.textSecondary} style={localStyles.searchIcon} />
          <Input 
            placeholder={t('friend.search')} 
            value={searchText}
            onChangeText={setSearchText}
            style={localStyles.searchInput}
          />
        </View>

        {/* List */}
        <View style={localStyles.list}>
          {friends.map(friend => (
            <GlassCard key={friend.id} style={localStyles.friendCard}>
              <View style={localStyles.friendRow}>
                <TouchableOpacity onPress={() => navigation.navigate('FriendDetail', { id: friend.id })}>
                  <Avatar 
                    uri={friend.avatar} 
                    gender={friend.gender} 
                    size={56}
                    style={{ borderWidth: 2, borderColor: colors.bg }}
                  />
                </TouchableOpacity>
                
                <View style={localStyles.friendContent}>
                  <View style={localStyles.friendHeader}>
                    <TouchableOpacity onPress={() => navigation.navigate('FriendDetail', { id: friend.id })}>
                      <View style={localStyles.nameRow}>
                        <Text style={[localStyles.friendName, { color: colors.textPrimary }]}>{friend.name}</Text>
                        <View style={localStyles.relationBadge}>
                          <Text style={localStyles.relationText}>{friend.relation}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                    <View style={localStyles.monitorContainer}>
                      <Text style={[localStyles.monitorLabel, { color: colors.textSecondary }]}>{t('friend.monitor')}</Text>
                      <TouchableOpacity 
                        onPress={() => toggleMonitor(friend.id)}
                        style={[
                          localStyles.monitorToggle,
                          friend.isMonitored ? localStyles.monitorToggleActive : localStyles.monitorToggleInactive,
                          { backgroundColor: friend.isMonitored ? colors.primary : '#cbd5e1' }
                        ]}
                      >
                        <View style={[
                          localStyles.toggleThumb,
                          friend.isMonitored && localStyles.toggleThumbActive
                        ]} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  <View style={localStyles.lastActiveRow}>
                    <Icon name="clock" size={10} color={colors.textSecondary} />
                    <Text style={[localStyles.lastActiveText, { color: colors.textSecondary }]}>{friend.lastActive}</Text>
                  </View>

                  <TouchableOpacity 
                    style={[localStyles.chatPreview, { borderTopColor: colors.glassBorder }]}
                    onPress={() => navigation.navigate('Chat', { id: friend.id })}
                  >
                    <View style={localStyles.chatPreviewLeft}>
                      <Icon name="message-square" size={12} color={colors.textSecondary} />
                      <Text style={[localStyles.chatPreviewText, { color: colors.textSecondary }]} numberOfLines={1}>
                        {friend.chat?.lastMessage || 'No recent messages'}
                      </Text>
                    </View>
                    {friend.chat?.unreadCount ? (
                      <View style={[localStyles.unreadBadge, { backgroundColor: colors.danger }]}>
                        <Text style={localStyles.unreadText}>{friend.chat.unreadCount}</Text>
                      </View>
                    ) : (
                      <Icon name="chevron-right" size={14} color={colors.textSecondary} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </GlassCard>
          ))}
        </View>
      </View>
    </MobileLayout>
  );
};

const localStyles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  filterContainer: {
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  filterCard: {
    padding: 12,
  },
  filterTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 8,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
  },
  filterButtonActive: {
    backgroundColor: '#3b82f6',
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  filterButtonTextActive: {
    color: 'white',
  },
  content: {
    paddingHorizontal: 20,
    gap: 16,
  },
  searchContainer: {
    position: 'relative',
  },
  searchIcon: {
    position: 'absolute',
    left: 12,
    top: 14,
    zIndex: 1,
  },
  searchInput: {
    paddingLeft: 40,
  },
  list: {
    gap: 12,
  },
  friendCard: {
    gap: 0,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  friendAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e2e8f0',
    borderWidth: 2,
    borderColor: 'white',
  },
  friendContent: {
    flex: 1,
    flexDirection: 'column',
    gap: 4,
  },
  friendHeader: {
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
  friendName: {
    fontWeight: '700',
    color: '#1e293b',
    fontSize: 16,
  },
  relationBadge: {
    backgroundColor: '#f3e8ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
  },
  relationText: {
    fontSize: 10,
    color: '#9333ea',
    fontWeight: '700',
  },
  monitorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  monitorLabel: {
    fontSize: 9,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  monitorToggle: {
    width: 48,
    height: 24,
    borderRadius: 12,
    padding: 4,
    position: 'relative',
  },
  monitorToggleActive: {
    backgroundColor: '#3b82f6',
  },
  monitorToggleInactive: {
    backgroundColor: '#cbd5e1',
  },
  toggleThumb: {
    width: 16,
    height: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    position: 'absolute',
    top: 4,
    left: 4,
  },
  toggleThumbActive: {
    transform: [{ translateX: 24 }],
  },
  lastActiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  lastActiveText: {
    fontSize: 12,
    color: '#64748b',
  },
  chatPreview: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatPreviewLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  chatPreviewText: {
    fontSize: 12,
    color: '#64748b',
    maxWidth: 180,
  },
  unreadBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 99,
  },
  unreadText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
  },
});

export default FriendsList;

