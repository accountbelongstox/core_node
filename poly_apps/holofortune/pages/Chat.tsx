import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { MobileLayout, Header, Input } from '../components/Shared';
import { useStore } from '../store';
import Icon from 'react-native-vector-icons/Feather';

const Chat: React.FC = () => {
  const route = useRoute<any>();
  const { id } = route.params || {};
  const { friends } = useStore();
  const friend = friends.find(f => f.id === id);
  const [message, setMessage] = useState('');

  if (!friend) {
    return (
      <MobileLayout showNav={false}>
        <Header title="Chat" />
        <View style={styles.errorContainer}>
          <Text>Friend not found</Text>
        </View>
      </MobileLayout>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <MobileLayout showNav={false} style={styles.chatLayout}>
        <Header title={friend.name} backTo="/friends" />
        
        <ScrollView 
          style={styles.chatMessages}
          contentContainerStyle={styles.chatMessagesContent}
        >
          <Text style={styles.dateLabel}>Today 10:45 AM</Text>
          
          <View style={[styles.messageBubble, styles.messageTheirs]}>
            <Text style={styles.messageText}>Hey, are you still at the gym?</Text>
          </View>
          
          <View style={[styles.messageBubble, styles.messageMine]}>
            <Text style={[styles.messageText, styles.messageTextMine]}>Just leaving now!</Text>
          </View>
          
          <View style={[styles.messageBubble, styles.messageTheirs]}>
            <Text style={styles.messageText}>
              {friend.chat?.lastMessage || "Okay, stay safe!"}
            </Text>
          </View>
        </ScrollView>

        <View style={styles.chatInputArea}>
          <Input 
            placeholder="Type a message..." 
            value={message} 
            onChangeText={setMessage}
            style={styles.chatInput}
          />
          <TouchableOpacity style={styles.sendButton}>
            <Icon name="send" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </MobileLayout>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  chatLayout: {
    backgroundColor: '#f8fafc',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatMessages: {
    flex: 1,
  },
  chatMessagesContent: {
    padding: 20,
    gap: 16,
  },
  dateLabel: {
    textAlign: 'center',
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 12,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  messageTheirs: {
    alignSelf: 'flex-start',
    backgroundColor: 'white',
    borderBottomLeftRadius: 4,
  },
  messageMine: {
    alignSelf: 'flex-end',
    backgroundColor: '#3b82f6',
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1e293b',
  },
  messageTextMine: {
    color: 'white',
  },
  chatInputArea: {
    backgroundColor: 'white',
    padding: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  chatInput: {
    flex: 1,
    borderRadius: 24,
    paddingLeft: 20,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Chat;
