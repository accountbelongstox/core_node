import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useRoute } from '@react-navigation/native';
import { MobileLayout, Header, Input } from '@/apps/awy/awy_components/Shared';
import { useStore } from '@/apps/awy/awy_store';
import { Feather as Icon } from '@react-native-vector-icons/feather';
import { getTheme } from '@/apps/awy/awy_theme/theme';

const Chat: React.FC = () => {
  const route = useRoute<any>();
  const { id } = route.params || {};
  const { friends, theme, t } = useStore();
  const colors = getTheme(theme);
  const friend = friends.find(f => f.id === id);
  const [message, setMessage] = useState('');

  if (!friend) {
    return (
      <MobileLayout showNav={false}>
        <Header title={t('friend.chat')} />
        <View style={localStyles.errorContainer}>
          <Text style={{ color: colors.textPrimary }}>{t('friend.notFound')}</Text>
        </View>
      </MobileLayout>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={localStyles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={[localStyles.chatContainer, { backgroundColor: colors.bg }]}>
        <Header title={friend.name} backTo="/friends" />
        
        <ScrollView 
          style={localStyles.chatMessages}
          contentContainerStyle={localStyles.chatMessagesContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[localStyles.dateLabel, { color: colors.textSecondary }]}>
            {t('chat.today')} 10:45 AM
          </Text>
          
          <View style={[localStyles.messageBubble, localStyles.messageTheirs]}>
            <Text style={[localStyles.messageText, { color: colors.textPrimary }]}>
              {t('chat.mockMessage1')}
            </Text>
          </View>
          
          <View style={[localStyles.messageBubble, localStyles.messageMine, { overflow: 'hidden' }]}>
            <LinearGradient
              colors={colors.primaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                StyleSheet.absoluteFill,
                { borderRadius: 16, borderBottomRightRadius: 4 }
              ]}
            />
            <Text style={[localStyles.messageText, localStyles.messageTextMine, { zIndex: 1 }]}>
              {t('chat.mockMessage2')}
            </Text>
          </View>
          
          <View style={[localStyles.messageBubble, localStyles.messageTheirs]}>
            <Text style={[localStyles.messageText, { color: colors.textPrimary }]}>
              {friend.chat?.lastMessage || t('chat.mockMessage3')}
            </Text>
          </View>
        </ScrollView>

        <View style={[localStyles.chatInputArea, { backgroundColor: colors.navBg, borderTopColor: colors.glassBorder }]}>
          <Input 
            placeholder={t('chat.typeMessage')} 
            value={message} 
            onChangeText={setMessage}
            style={localStyles.chatInput}
          />
          <TouchableOpacity style={[localStyles.sendButton, { backgroundColor: colors.primary }]}>
            <Icon name="send" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  chatContainer: {
    flex: 1,
    flexDirection: 'column',
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
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageTextMine: {
    color: 'white',
  },
  chatInputArea: {
    padding: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Chat;

