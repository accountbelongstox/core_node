/**
 * Help Page
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useStore } from '@/qy/qy_store';
import { createStyles } from '@/common/theme';

const HelpPage: React.FC = () => {
  const { themeData } = useStore();
  const styles = createStyles(themeData);

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.card, { marginTop: 16 }]}>
        <Text style={[styles.text, { fontSize: 18, fontWeight: '600', marginBottom: 16 }]}>
          帮助中心
        </Text>

        <Text style={[styles.text, { fontWeight: '600', marginTop: 16, marginBottom: 8 }]}>
          快速入门
        </Text>
        <Text style={styles.textSecondary}>
          1. 创建或选择单词组{'\n'}
          2. 开始学习单词{'\n'}
          3. 系统会自动安排复习{'\n'}
          4. 查看学习统计
        </Text>

        <Text style={[styles.text, { fontWeight: '600', marginTop: 16, marginBottom: 8 }]}>
          常见问题
        </Text>
        <Text style={styles.textSecondary}>
          Q: 如何添加单词组？{'\n'}
          A: 在单词组页面点击创建按钮，或上传文档自动生成。
        </Text>
      </View>
    </ScrollView>
  );
};

const localStyles = StyleSheet.create({});

export default HelpPage;

