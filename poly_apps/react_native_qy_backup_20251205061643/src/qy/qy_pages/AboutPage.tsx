/**
 * About Page
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useStore } from '@/qy/qy_store';
import { createStyles } from '@/common/theme';

const AboutPage: React.FC = () => {
  const { themeData } = useStore();
  const styles = createStyles(themeData);

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.card, { marginTop: 16, alignItems: 'center' }]}>
        <Text style={[styles.text, { fontSize: 24, fontWeight: 'bold', marginBottom: 8 }]}>
          QY单词学习
        </Text>
        <Text style={styles.textSecondary}>版本 1.0.0</Text>
        <Text style={styles.textSecondary}>构建号 2025.12.01</Text>
      </View>

      <View style={styles.card}>
        <Text style={[styles.text, { fontSize: 18, fontWeight: '600', marginBottom: 16 }]}>
          关于
        </Text>
        <Text style={styles.text}>
          QY单词学习是一款功能强大的单词学习应用，支持多种学习模式、智能复习系统和完整的统计分析。
        </Text>
      </View>
    </ScrollView>
  );
};

const localStyles = StyleSheet.create({});

export default AboutPage;

