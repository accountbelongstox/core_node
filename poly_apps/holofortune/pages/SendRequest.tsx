import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView } from 'react-native';
import { MobileLayout, Header, GlassCard, Input, Button } from '../components/Shared';
import { Picker } from '@react-native-picker/picker';

const SendRequest: React.FC = () => {
  const [message, setMessage] = useState("Hi, I'm Alex. Please add me.");
  const [alias, setAlias] = useState('Uncle John');
  const [relation, setRelation] = useState('Family');

  return (
    <MobileLayout showNav={false}>
      <Header title="Verify Request" backTo="/friends/add" />
      
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.header}>
          <Image 
            source={{ uri: 'https://api.dicebear.com/7.x/avataaars/svg?seed=John' }} 
            style={styles.avatar}
          />
          <Text style={styles.name}>John Doe</Text>
          <Text style={styles.location}>Beijing, China</Text>
        </View>

        <GlassCard style={styles.formCard}>
          <View style={styles.field}>
            <Text style={styles.label}>Message</Text>
            <Input 
              value={message}
              onChangeText={setMessage}
              multiline
              style={styles.input}
            />
          </View>
          
          <View style={styles.field}>
            <Text style={styles.label}>Alias/Remark</Text>
            <Input 
              value={alias}
              onChangeText={setAlias}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Relation</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={relation}
                onValueChange={setRelation}
                style={styles.picker}
              >
                <Picker.Item label="Family" value="Family" />
                <Picker.Item label="Partner" value="Partner" />
                <Picker.Item label="Friend" value="Friend" />
              </Picker>
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <Button onPress={() => {}}>Send Request</Button>
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
    color: '#1e293b',
  },
  location: {
    color: '#94a3b8',
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
    color: '#64748b',
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
