/**
 * Document Upload Page
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useStore } from '@/qy/qy_store';
import { createStyles } from '@/common/theme';
import Icon from 'react-native-vector-icons/Feather';

const DocumentUploadPage: React.FC = () => {
  const { themeData } = useStore();
  const styles = createStyles(themeData);

  const handleUpload = () => {
    Alert.alert('提示', '文档上传功能开发中');
  };

  return (
    <View style={styles.container}>
      <View style={[styles.card, { marginTop: 16, alignItems: 'center' }]}>
        <Icon name="upload-cloud" size={64} color={themeData.colors.primary} />
        <Text style={[styles.text, { fontSize: 18, marginTop: 16, marginBottom: 8 }]}>
          上传文档
        </Text>
        <Text style={[styles.textSecondary, { textAlign: 'center', marginBottom: 24 }]}>
          支持 PDF、DOC、DOCX、TXT 格式
        </Text>
        <TouchableOpacity
          style={[localStyles.uploadButton, { backgroundColor: themeData.colors.primary }]}
          onPress={handleUpload}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
            选择文件
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const localStyles = StyleSheet.create({
  uploadButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
});

export default DocumentUploadPage;

