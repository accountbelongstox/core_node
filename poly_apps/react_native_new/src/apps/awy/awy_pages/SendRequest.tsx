import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView } from 'react-native';
import { MobileLayout, Header, GlassCard, Input, Button } from '@/apps/awy/awy_components/Shared';
import { Picker } from '@react-native-picker/picker';
import { getTheme } from '@/apps/awy/awy_theme/theme';
import { useStore } from '@/apps/awy/awy_store';
import { Avatar } from '@/common/components/Avatar';

const SendRequest: React.FC = () => {
  const [message, setMessage] = useState('');
  const [alias, setAlias] = useState('');
  const [relation, setRelation] = useState('Family');
  const { theme, t } = useStore();
  const colors = getTheme(theme);

  return (
    <MobileLayout showNav={false}>
      <Header title={t('friend.verifyRequest')} backTo="/friends/add" />
      
      <ScrollView style={localStyles.content} contentContainerStyle={localStyles.contentContainer}>
        <View style={localStyles.header}>
          <Avatar 
            uri="" 
            gender="male" 
            size={80}
            style={{ borderWidth: 4, borderColor: 'white' }}
          />
          <Text style={[localStyles.name, { color: colors.textPrimary }]}>
            {t('friend.mockUserName')}
          </Text>
          <Text style={[localStyles.location, { color: colors.textSecondary }]}>
            {t('friend.mockUserPhone')}
          </Text>
        </View>

        <GlassCard style={localStyles.formCard}>
          <View style={localStyles.field}>
            <Text style={[localStyles.label, { color: colors.textSecondary }]}>
              {t('friend.message')}
            </Text>
            <Input 
              value={message}
              onChangeText={setMessage}
              multiline
              style={localStyles.input}
              placeholder={t('friend.message')}
            />
          </View>
          
          <View style={localStyles.field}>
            <Text style={[localStyles.label, { color: colors.textSecondary }]}>
              {t('friend.alias')}
            </Text>
            <Input 
              value={alias}
              onChangeText={setAlias}
              style={localStyles.input}
              placeholder={t('friend.alias')}
            />
          </View>

          <View style={localStyles.field}>
            <Text style={[localStyles.label, { color: colors.textSecondary }]}>
              {t('friend.relation')}
            </Text>
            <View style={localStyles.pickerContainer}>
              <Picker
                selectedValue={relation}
                onValueChange={setRelation}
                style={localStyles.picker}
              >
                <Picker.Item label={t('friend.relationFamily')} value="Family" />
                <Picker.Item label={t('friend.relationPartner')} value="Partner" />
                <Picker.Item label={t('friend.relationFriend')} value="Friend" />
              </Picker>
            </View>
          </View>

          <View style={localStyles.buttonContainer}>
            <Button onPress={() => {}}>{t('friend.sendRequest')}</Button>
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
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: 'white',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 10,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
  },
  location: {
    fontSize: 14,
    marginTop: 4,
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
  input: {
    marginTop: 4,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginTop: 4,
  },
  picker: {
    height: 50,
  },
  buttonContainer: {
    paddingTop: 16,
  },
});

export default SendRequest;

