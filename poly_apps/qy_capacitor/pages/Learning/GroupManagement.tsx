import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '../../services/api';
import { StorageCenter, StorageKey } from '../../services/StorageCenter';

interface WordGroup {
  gid: string;
  gname: string;
  total_words: number;
  created_at: string;
  updated_at: string;
}

interface ProgressStats {
  total_words: number;
  avg_proficiency: number;
  mastered_words: number;
  learning_words: number;
  struggling_words: number;
  due_for_review: number;
}

export default function GroupManagement() {
  const navigation = useNavigation();
  const [groups, setGroups] = useState<WordGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState<Record<string, ProgressStats>>({});

  useEffect(() => {
    const token = StorageCenter.get<string>(StorageKey.AUTH_TOKEN);
    if (!token) {
      Alert.alert('Error', 'Please login first', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
      return;
    }
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      setLoading(true);
      const response = await api.post('/app_qy_v1/query_all_groups', {
        start: 0,
        limit: 1000,
      });

      if (response.data.status === 'success') {
        const groupsData = response.data.data.groups || [];
        setGroups(groupsData);

        for (const group of groupsData) {
          loadGroupStats(group.gid);
        }
      }
    } catch (error) {
      console.error('Error loading groups:', error);
      Alert.alert('Error', 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const loadGroupStats = async (gid: string) => {
    try {
      const response = await api.post('/app_qy_v1/group/get_progress_stats', { gid });
      if (response.data.status === 'success') {
        setStats(prev => ({
          ...prev,
          [gid]: response.data.data.stats,
        }));
      }
    } catch (error) {
      console.error(`Error loading stats for group ${gid}:`, error);
    }
  };

  const filteredGroups = groups.filter(group =>
    group.gname.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getProficiencyColor = (proficiency: number) => {
    if (proficiency >= 90) return '#10b981';
    if (proficiency >= 75) return '#3b82f6';
    if (proficiency >= 60) return '#f59e0b';
    if (proficiency >= 40) return '#ef4444';
    return '#9ca3af';
  };

  const renderGroupCard = (group: WordGroup) => {
    const groupStats = stats[group.gid];

    return (
      <TouchableOpacity
        key={group.gid}
        style={styles.groupCard}
        onPress={() => navigation.navigate('GroupDetail', { gid: group.gid })}
      >
        <View style={styles.groupHeader}>
          <Text style={styles.groupName}>{group.gname}</Text>
          <Text style={styles.groupWords}>{group.total_words} words</Text>
        </View>

        {groupStats && (
          <View style={styles.statsContainer}>
            <View style={styles.proficiencyBar}>
              <View
                style={[
                  styles.proficiencyFill,
                  {
                    width: `${groupStats.avg_proficiency}%`,
                    backgroundColor: getProficiencyColor(groupStats.avg_proficiency),
                  },
                ]}
              />
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{groupStats.mastered_words}</Text>
                <Text style={styles.statLabel}>Mastered</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{groupStats.learning_words}</Text>
                <Text style={styles.statLabel}>Learning</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{groupStats.struggling_words}</Text>
                <Text style={styles.statLabel}>Struggling</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, styles.dueReview]}>
                  {groupStats.due_for_review}
                </Text>
                <Text style={styles.statLabel}>Due</Text>
              </View>
            </View>

            <View style={styles.statsInfo}>
              <Text style={styles.avgProficiency}>
                Avg: {groupStats.avg_proficiency.toFixed(1)}%
              </Text>
              <Text style={styles.totalReviews}>
                {groupStats.total_reviews} reviews
              </Text>
            </View>
          </View>
        )}

        <View style={styles.groupFooter}>
          <Text style={styles.timestamp}>
            Updated: {new Date(group.updated_at).toLocaleDateString()}
          </Text>
          <TouchableOpacity
            style={styles.studyButton}
            onPress={(e) => {
              e.stopPropagation();
              navigation.navigate('StudySession', { gid: group.gid });
            }}
          >
            <Text style={styles.studyButtonText}>Study Now</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Learning Groups</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => navigation.navigate('CreateGroup')}
        >
          <Text style={styles.createButtonText}>+ New Group</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search groups..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#9ca3af"
        />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading groups...</Text>
          </View>
        ) : filteredGroups.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No groups found</Text>
            <Text style={styles.emptySubtext}>
              Create your first learning group to get started
            </Text>
          </View>
        ) : (
          filteredGroups.map(renderGroupCard)
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  createButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchInput: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    color: '#111827',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  groupCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  groupWords: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  statsContainer: {
    marginTop: 8,
  },
  proficiencyBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  proficiencyFill: {
    height: '100%',
    borderRadius: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  dueReview: {
    color: '#ef4444',
  },
  statsInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  avgProficiency: {
    fontSize: 14,
    color: '#6b7280',
  },
  totalReviews: {
    fontSize: 14,
    color: '#6b7280',
  },
  groupFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  timestamp: {
    fontSize: 12,
    color: '#9ca3af',
  },
  studyButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  studyButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
});
