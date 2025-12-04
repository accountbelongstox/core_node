import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { MobileLayout, Header, GlassCard, Input, Button } from '@/apps/awy/awy_components/Shared';
import { useStore } from '@/apps/awy/awy_store';
import { Feather as Icon } from '@react-native-vector-icons/feather';
import { getTheme } from '@/apps/awy/awy_theme/theme';
import { Avatar } from '@/common/components/Avatar';

const EditProfile: React.FC = () => {
  const { user, updateUser, t, theme } = useStore();
  const colors = getTheme(theme);
  const [formData, setFormData] = useState(user || {});

  const handleChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSave = () => {
    updateUser(formData);
  };

  const fields = [
    { label: t('profile.name'), name: 'name', type: 'text' },
    { label: t('profile.signature'), name: 'signature', type: 'text' },
    { label: t('profile.phone'), name: 'phone', type: 'tel', disabled: true },
    { label: t('profile.email'), name: 'email', type: 'email' },
    { label: t('profile.address'), name: 'address', type: 'text' },
    { label: t('profile.idCard'), name: 'idCard', type: 'text', secure: true },
  ];

  return (
    <MobileLayout showNav={false}>
      <Header title={t('me.profile')} backTo="/me" />
      
      <ScrollView 
        style={localStyles.content}
        contentContainerStyle={localStyles.contentContainer}
      >
        <View style={localStyles.avatarContainer}>
          <View style={localStyles.avatarWrapper}>
            <Avatar 
              uri={user?.avatar} 
              gender={user?.gender}
              size={96}
              style={{ borderWidth: 4, borderColor: 'white' }}
            />
            <TouchableOpacity style={[localStyles.cameraButton, { backgroundColor: colors.primary }]}>
              <Icon name="camera" size={12} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        <GlassCard style={localStyles.formCard}>
          {fields.map((field) => (
            <View key={field.name} style={localStyles.field}>
              <Text style={[localStyles.label, { color: colors.textSecondary }]}>{field.label}</Text>
              <Input 
                value={(formData as any)[field.name] || ''}
                onChangeText={(text) => handleChange(field.name, text)}
                editable={!field.disabled}
                secureTextEntry={field.secure}
                keyboardType={field.type === 'email' ? 'email-address' : field.type === 'tel' ? 'phone-pad' : 'default'}
                style={field.disabled ? [localStyles.inputDisabled, { backgroundColor: '#f1f5f9', opacity: 0.6 }] : {}}
              />
            </View>
          ))}
          
          <View style={localStyles.buttonContainer}>
            <Button onPress={handleSave}>{t('common.save')}</Button>
          </View>
        </GlassCard>
      </ScrollView>
    </MobileLayout>
  );
};

const localStyles = StyleSheet.create({
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
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    padding: 6,
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
    textTransform: 'uppercase',
    marginLeft: 4,
    marginBottom: 4,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  buttonContainer: {
    paddingTop: 16,
  },
});

export default EditProfile;

