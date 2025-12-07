import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { MobileLayout, Header, GlassCard, Input } from '@/apps/awy/awy_components/Shared';
import { useStore } from '@/apps/awy/awy_store';
import { Feather as Icon } from '@react-native-vector-icons/feather';

const AIAssistant: React.FC = () => {
  const { t } = useStore();
  const [message, setMessage] = useState('');

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <MobileLayout>
        <Header title={t('tab.ai')} />
        
        <View style={styles.content}>
          <GlassCard style={styles.aiCard}>
            <View style={styles.aiHeader}>
              <View style={styles.aiIconContainer}>
                <Icon name="zap" size={24} color="white" />
              </View>
              <View>
                <Text style={styles.aiTitle}>{t('ai.guardianAI')}</Text>
                <Text style={styles.aiSubtitle}>{t('ai.helpText')}</Text>
              </View>
            </View>
          </GlassCard>

          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{t('ai.emptyState')}</Text>
          </View>

          <View style={styles.chatInputArea}>
            <Input 
              placeholder={t('ai.askPlaceholder')} 
              value={message}
              onChangeText={setMessage}
              style={styles.chatInput}
            />
            <TouchableOpacity style={styles.sendButton}>
              <Icon name="send" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </MobileLayout>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  aiCard: {
    padding: 20,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  aiIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#a855f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiTitle: {
    fontWeight: '700',
    fontSize: 16,
    color: '#1e293b',
  },
  aiSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    opacity: 0.6,
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748b',
  },
  chatInputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 'auto',
    paddingTop: 20,
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

export default AIAssistant;

