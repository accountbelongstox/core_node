import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView } from 'react-native';
import { MobileLayout, Header, GlassCard, Input, Button } from '../components/Shared';
import { useStore } from '../store';
import Icon from 'react-native-vector-icons/Feather';

const EditProfile: React.FC = () => {
  const { user, updateUser, t } = useStore();
  const [formData, setFormData] = useState(user || {});

  const handleChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSave = () => {
    updateUser(formData);
    // Navigation will be handled by back button
  };

  const fields = [
    { label: 'Name', name: 'name', type: 'text' },
    { label: 'Signature', name: 'signature', type: 'text' },
    { label: 'Phone', name: 'phone', type: 'tel', disabled: true },
    { label: 'Email', name: 'email', type: 'email' },
    { label: 'Address', name: 'address', type: 'text' },
    { label: 'ID Card (Real Name)', name: 'idCard', type: 'text', secure: true },
  ];

  return (
    <MobileLayout showNav={false}>
      <Header title="My Profile" backTo="/me" />
      
      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.avatarContainer}>
          <View style={styles.avatarWrapper}>
            <Image 
              source={{ uri: user?.avatar }} 
              style={styles.avatar}
            />
            <TouchableOpacity style={styles.cameraButton}>
              <Icon name="camera" size={12} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        <GlassCard style={styles.formCard}>
          {fields.map((field) => (
            <View key={field.name} style={styles.field}>
              <Text style={styles.label}>{field.label}</Text>
              <Input 
                value={(formData as any)[field.name] || ''}
                onChangeText={(text) => handleChange(field.name, text)}
                editable={!field.disabled}
                secureTextEntry={field.secure}
                keyboardType={field.type === 'email' ? 'email-address' : field.type === 'tel' ? 'phone-pad' : 'default'}
                style={field.disabled ? styles.inputDisabled : {}}
              />
            </View>
          ))}
          
          <View style={styles.buttonContainer}>
            <Button onPress={handleSave}>{t('common.save')}</Button>
          </View>
        </GlassCard>
      </ScrollView>
    </MobileLayout>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 24,
  },
  avatarContainer: {
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    borderColor: 'white',
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    padding: 6,
    backgroundColor: '#3b82f6',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'white',
  },
  formCard: {
    gap: 16,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginLeft: 4,
    marginBottom: 4,
  },
  inputDisabled: {
    opacity: 0.6,
    backgroundColor: '#f1f5f9',
  },
  buttonContainer: {
    paddingTop: 16,
  },
});

export default EditProfile;
