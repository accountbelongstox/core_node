import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { api } from '../../services/api';
import { StorageCenter, StorageKey } from '../../services/StorageCenter';

interface WordGroup {
  gid: string;
  gname: string;
  total_words: number;
  created_at: string;
  updated_at: string;
}

interface Library {
  id: number;
  name: string;
  language: string;
  total_words: number;
}

export default function AddToGroup() {
  const route = useRoute();
  const navigation = useNavigation();
  const { libraryId, libraryName } = route.params as {
    libraryId: number;
    libraryName: string;
  };

  const [groups, setGroups] = useState<WordGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [addingToGroup, setAddingToGroup] = useState<string | null>(null);

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
        setGroups(response.data.data.groups || []);
      }
    } catch (error) {
      console.error('Error loading groups:', error);
      Alert.alert('Error', 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const createNewGroup = async () => {
    if (!newGroupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    try {
      const response = await api.post('/app_qy_v1/create_group', {
        gname: newGroupName,
        gcontent: `Created for ${libraryName}`,
        gwords: '',
      });

      if (response.data.status === 'success') {
        Alert.alert('Success', 'Group created successfully');
        setNewGroupName('');
        setShowCreateModal(false);
        loadGroups();
      }
    } catch (error: any) {
      console.error('Error creating group:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to create group');
    }
  };

  const addLibraryToGroup = async (gid: string, gname: string) => {
    setAddingToGroup(gid);

    try {
      const response = await api.post('/app_qy_v1/group/add_library', {
        gid,
        library_id: libraryId,
      });

      if (response.data.status === 'success') {
        const wordsAdded = response.data.data.words_added;
        Alert.alert(
          'Success',
          `Added ${wordsAdded} words from "${libraryName}" to "${gname}"`,
          [
            {
              text: 'View Group',
              onPress: () => {
                navigation.navigate('GroupDetail', { gid });
              },
            },
            { text: 'OK', style: 'cancel' },
          ]
        );
      }
    } catch (error: any) {
      console.error('Error adding library to group:', error);
      const errorMessage = error.response?.data?.message || 'Failed to add library to group';
      Alert.alert('Error', errorMessage);
    } finally {
      setAddingToGroup(null);
    }
  };

  const getDefaultGroup = () => {
    return groups.find((g) => g.gname === 'default_group' || g.gname.toLowerCase().includes('default'));
  };

  const defaultGroup = getDefaultGroup();
  const otherGroups = groups.filter((g) => g.gid !== defaultGroup?.gid);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Add to Group</Text>
        <TouchableOpacity onPress={() => setShowCreateModal(true)}>
          <Text style={styles.createButton}>+ New</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.libraryInfo}>
        <Text style={styles.libraryName}>{libraryName}</Text>
        <Text style={styles.librarySubtext}>Select a group to add this library</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading groups...</Text>
          </View>
        ) : (
          <>
            {defaultGroup && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Default Group</Text>
                <TouchableOpacity
                  style={[
                    styles.groupCard,
                    addingToGroup === defaultGroup.gid && styles.groupCardDisabled,
                  ]}
                  onPress={() => addLibraryToGroup(defaultGroup.gid, defaultGroup.gname)}
                  disabled={addingToGroup !== null}
                >
                  <View style={styles.groupHeader}>
                    <Text style={styles.groupName}>{defaultGroup.gname}</Text>
                    <Text style={styles.groupWords}>{defaultGroup.total_words} words</Text>
                  </View>
                  <Text style={styles.groupDate}>
                    Updated: {new Date(defaultGroup.updated_at).toLocaleDateString()}
                  </Text>
                  {addingToGroup === defaultGroup.gid && (
                    <Text style={styles.addingText}>Adding...</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {otherGroups.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>My Groups</Text>
                {otherGroups.map((group) => (
                  <TouchableOpacity
                    key={group.gid}
                    style={[
                      styles.groupCard,
                      addingToGroup === group.gid && styles.groupCardDisabled,
                    ]}
                    onPress={() => addLibraryToGroup(group.gid, group.gname)}
                    disabled={addingToGroup !== null}
                  >
                    <View style={styles.groupHeader}>
                      <Text style={styles.groupName}>{group.gname}</Text>
                      <Text style={styles.groupWords}>{group.total_words} words</Text>
                    </View>
                    <Text style={styles.groupDate}>
                      Updated: {new Date(group.updated_at).toLocaleDateString()}
                    </Text>
                    {addingToGroup === group.gid && (
                      <Text style={styles.addingText}>Adding...</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {groups.length === 0 && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No groups yet</Text>
                <Text style={styles.emptySubtext}>Create your first group to get started</Text>
                <TouchableOpacity
                  style={styles.createFirstButton}
                  onPress={() => setShowCreateModal(true)}
                >
                  <Text style={styles.createFirstButtonText}>Create Group</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Group</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Group name..."
              value={newGroupName}
              onChangeText={setNewGroupName}
              placeholderTextColor="#9ca3af"
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setNewGroupName('');
                  setShowCreateModal(false);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.createButtonFull]}
                onPress={createNewGroup}
              >
                <Text style={styles.createButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
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
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  createButton: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: '600',
  },
  libraryInfo: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  libraryName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  librarySubtext: {
    fontSize: 14,
    color: '#6b7280',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  groupCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  groupCardDisabled: {
    opacity: 0.6,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  groupWords: {
    fontSize: 14,
    color: '#6b7280',
  },
  groupDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  addingText: {
    fontSize: 14,
    color: '#3b82f6',
    marginTop: 8,
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
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
    marginBottom: 16,
  },
  createFirstButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createFirstButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
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
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
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
  input: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    color: '#111827',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  createButtonFull: {
    backgroundColor: '#3b82f6',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
