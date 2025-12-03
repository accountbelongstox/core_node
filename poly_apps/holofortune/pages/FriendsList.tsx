import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView } from 'react-native';
import { MobileLayout, Header, GlassCard, Input } from '../components/Shared';
import { useStore } from '../store';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Feather';
import { clsx } from 'clsx';

const FriendsList: React.FC = () => {
  const { friends, toggleMonitor, t, theme } = useStore();
  const [showFilter, setShowFilter] = useState(false);
  const [searchText, setSearchText] = useState('');
  const navigation = useNavigation<any>();
  const isDark = theme === 'dark';

  return (
    <MobileLayout showNav={false}>
      <Header 
        title={`${t('tab.friends')} (${friends.length})`} 
        action={
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => setShowFilter(!showFilter)}>
              <Icon name="filter" size={20} color="#3b82f6" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('AddFriend')}>
              <Icon name="plus" size={24} color="#3b82f6" />
            </TouchableOpacity>
          </View>
        } 
      />
      
      {/* Filter Dropdown */}
      {showFilter && (
        <View style={styles.filterContainer}>
          <GlassCard style={styles.filterCard}>
            <Text style={styles.filterTitle}>FILTER BY STATUS</Text>
            <View style={styles.filterButtons}>
              {['All', 'Online', 'Monitored', 'Alerts'].map(f => (
                <TouchableOpacity 
                  key={f} 
                  style={[
                    styles.filterButton,
                    f === 'All' && styles.filterButtonActive
                  ]}
                >
                  <Text style={[
                    styles.filterButtonText,
                    f === 'All' && styles.filterButtonTextActive
                  ]}>
                    {f}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </GlassCard>
        </View>
      )}

      <View style={styles.content}>
        {/* Search */}
        <View style={styles.searchContainer}>
          <Icon name="search" size={18} color="#94a3b8" style={styles.searchIcon} />
          <Input 
            placeholder={t('friend.search')} 
            value={searchText}
            onChangeText={setSearchText}
            style={styles.searchInput}
          />
        </View>

        {/* List */}
        <View style={styles.list}>
          {friends.map(friend => (
            <GlassCard key={friend.id} style={styles.friendCard}>
              <View style={styles.friendRow}>
                <TouchableOpacity onPress={() => navigation.navigate('FriendDetail', { id: friend.id })}>
                  <Image source={{ uri: friend.avatar }} style={styles.friendAvatar} />
                </TouchableOpacity>
                
                <View style={styles.friendContent}>
                  <View style={styles.friendHeader}>
                    <TouchableOpacity onPress={() => navigation.navigate('FriendDetail', { id: friend.id })}>
                      <View style={styles.nameRow}>
                        <Text style={styles.friendName}>{friend.name}</Text>
                        <View style={styles.relationBadge}>
                          <Text style={styles.relationText}>{friend.relation}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                    <View style={styles.monitorContainer}>
                      <Text style={styles.monitorLabel}>{t('friend.monitor')}</Text>
                      <TouchableOpacity 
                        onPress={() => toggleMonitor(friend.id)}
                        style={[
                          styles.monitorToggle,
                          friend.isMonitored ? styles.monitorToggleActive : styles.monitorToggleInactive
                        ]}
                      >
                        <View style={[
                          styles.toggleThumb,
                          friend.isMonitored && styles.toggleThumbActive
                        ]} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  <View style={styles.lastActiveRow}>
                    <Icon name="clock" size={10} color="#64748b" />
                    <Text style={styles.lastActiveText}>{friend.lastActive}</Text>
                  </View>

                  <TouchableOpacity 
                    style={styles.chatPreview}
                    onPress={() => navigation.navigate('Chat', { id: friend.id })}
                  >
                    <View style={styles.chatPreviewLeft}>
                      <Icon name="message-square" size={12} color="#94a3b8" />
                      <Text style={styles.chatPreviewText} numberOfLines={1}>
                        {friend.chat?.lastMessage || 'No recent messages'}
                      </Text>
                    </View>
                    {friend.chat?.unreadCount ? (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadText}>{friend.chat.unreadCount}</Text>
                      </View>
                    ) : (
                      <Icon name="chevron-right" size={14} color="#cbd5e1" />
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

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  filterContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
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
    gap: 4,
  },
  friendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    color: '#94a3b8',
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
