import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { api } from '../../services/api';

interface Word {
  word_id: number;
  word: string;
  proficiency?: number;
  read_count?: number;
  review_count?: number;
  last_read_at?: string;
  next_review_at?: string;
}

interface Library {
  id: number;
  name: string;
  language: string;
  total_words: number;
  added_at: string;
}

export default function GroupDetail() {
  const route = useRoute();
  const navigation = useNavigation();
  const { gid } = route.params as { gid: string };

  const [groupName, setGroupName] = useState('');
  const [words, setWords] = useState<Word[]>([]);
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [availableLibraries, setAvailableLibraries] = useState<Library[]>([]);

  useEffect(() => {
    loadGroupData();
    loadGroupLibraries();
  }, [gid]);

  const loadGroupData = async () => {
    try {
      setLoading(true);
      const response = await api.post('/app_qy_v1/group/get_words', {
        gid,
        page: 1,
        per_page: 100,
        with_progress: true,
      });

      if (response.data.status === 'success') {
        setGroupName(response.data.data.gname);
        setWords(response.data.data.words || []);
      }
    } catch (error) {
      console.error('Error loading group data:', error);
      Alert.alert('Error', 'Failed to load group data');
    } finally {
      setLoading(false);
    }
  };

  const loadGroupLibraries = async () => {
    try {
      const response = await api.post('/app_qy_v1/group/get_libraries', { gid });
      if (response.data.status === 'success') {
        setLibraries(response.data.data.libraries || []);
      }
    } catch (error) {
      console.error('Error loading group libraries:', error);
    }
  };

  const loadAvailableLibraries = async () => {
    try {
      const response = await api.get('/app_qy_v1/vocabulary/libraries');
      if (response.data.status === 'success') {
        setAvailableLibraries(response.data.data || []);
      }
    } catch (error) {
      console.error('Error loading available libraries:', error);
    }
  };

  const addLibraryToGroup = async (libraryId: number) => {
    try {
      const response = await api.post('/app_qy_v1/group/add_library', {
        gid,
        library_id: libraryId,
      });

      if (response.data.status === 'success') {
        Alert.alert('Success', `Added ${response.data.data.words_added} words to group`);
        loadGroupData();
        loadGroupLibraries();
        setShowLibraryModal(false);
      }
    } catch (error: any) {
      console.error('Error adding library:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to add library');
    }
  };

  const removeLibraryFromGroup = async (libraryId: number) => {
    Alert.alert(
      'Remove Library',
      'Are you sure you want to remove this library from the group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post('/app_qy_v1/group/remove_library', {
                gid,
                library_id: libraryId,
              });
              loadGroupLibraries();
              Alert.alert('Success', 'Library removed from group');
            } catch (error) {
              console.error('Error removing library:', error);
              Alert.alert('Error', 'Failed to remove library');
            }
          },
        },
      ]
    );
  };

  const getProficiencyColor = (proficiency: number) => {
    if (proficiency >= 90) return '#10b981';
    if (proficiency >= 75) return '#3b82f6';
    if (proficiency >= 60) return '#f59e0b';
    if (proficiency >= 40) return '#ef4444';
    return '#9ca3af';
  };

  const renderWord = ({ item }: { item: Word }) => {
    const proficiency = item.proficiency || 0;

    return (
      <View style={styles.wordCard}>
        <View style={styles.wordHeader}>
          <Text style={styles.wordText}>{item.word}</Text>
          <View
            style={[
              styles.proficiencyBadge,
              { backgroundColor: getProficiencyColor(proficiency) },
            ]}
          >
            <Text style={styles.proficiencyText}>{proficiency.toFixed(0)}%</Text>
          </View>
        </View>

        {item.read_count !== undefined && (
          <View style={styles.wordStats}>
            <Text style={styles.statText}>Reads: {item.read_count}</Text>
            <Text style={styles.statText}>Reviews: {item.review_count}</Text>
            {item.next_review_at && (
              <Text style={styles.nextReview}>
                Next: {new Date(item.next_review_at).toLocaleDateString()}
              </Text>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderLibrary = ({ item }: { item: Library }) => (
    <View style={styles.libraryCard}>
      <View style={styles.libraryInfo}>
        <Text style={styles.libraryName}>{item.name}</Text>
        <Text style={styles.libraryMeta}>
          {item.language} • {item.total_words} words
        </Text>
      </View>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => removeLibraryFromGroup(item.id)}
      >
        <Text style={styles.removeButtonText}>Remove</Text>
      </TouchableOpacity>
    </View>
  );

  const renderAvailableLibrary = ({ item }: { item: Library }) => (
    <TouchableOpacity
      style={styles.availableLibraryCard}
      onPress={() => addLibraryToGroup(item.id)}
    >
      <Text style={styles.libraryName}>{item.name}</Text>
      <Text style={styles.libraryMeta}>
        {item.language} • {item.total_words} words
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{groupName}</Text>
        <TouchableOpacity
          style={styles.studyButton}
          onPress={() => navigation.navigate('StudySession', { gid })}
        >
          <Text style={styles.studyButtonText}>Study</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Libraries ({libraries.length})</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => {
                loadAvailableLibraries();
                setShowLibraryModal(true);
              }}
            >
              <Text style={styles.addButtonText}>+ Add Library</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={libraries}
            renderItem={renderLibrary}
            keyExtractor={(item) => item.id.toString()}
            scrollEnabled={false}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No libraries added yet</Text>
            }
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Words ({words.length})</Text>
          <FlatList
            data={words}
            renderItem={renderWord}
            keyExtractor={(item) => item.word_id.toString()}
            scrollEnabled={false}
            ListEmptyComponent={<Text style={styles.emptyText}>No words yet</Text>}
          />
        </View>
      </ScrollView>

      <Modal
        visible={showLibraryModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowLibraryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Library</Text>
              <TouchableOpacity onPress={() => setShowLibraryModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={availableLibraries}
              renderItem={renderAvailableLibrary}
              keyExtractor={(item) => item.id.toString()}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No libraries available</Text>
              }
            />
          </View>
        </View>
      </Modal>
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
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    flex: 1,
    textAlign: 'center',
  },
  studyButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  studyButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
    backgroundColor: '#ffffff',
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  addButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  libraryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8,
  },
  libraryInfo: {
    flex: 1,
  },
  libraryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  libraryMeta: {
    fontSize: 14,
    color: '#6b7280',
  },
  removeButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  removeButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  wordCard: {
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8,
  },
  wordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  wordText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  proficiencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  proficiencyText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  wordStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statText: {
    fontSize: 12,
    color: '#6b7280',
  },
  nextReview: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  closeButton: {
    fontSize: 24,
    color: '#6b7280',
    padding: 4,
  },
  availableLibraryCard: {
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
});
