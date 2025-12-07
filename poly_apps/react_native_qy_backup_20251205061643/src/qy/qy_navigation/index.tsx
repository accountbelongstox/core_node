/**
 * QY App Navigation
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { useStore } from '@/qy/qy_store';

// Pages
import HomePage from '@/qy/qy_pages/HomePage';
import LearnPage from '@/qy/qy_pages/LearnPage';
import ReviewPage from '@/qy/qy_pages/ReviewPage';
import StatisticsPage from '@/qy/qy_pages/StatisticsPage';
import SettingsPage from '@/qy/qy_pages/SettingsPage';
import WordGroupListPage from '@/qy/qy_pages/WordGroupListPage';
import WordGroupDetailPage from '@/qy/qy_pages/WordGroupDetailPage';
import WordDetailPage from '@/qy/qy_pages/WordDetailPage';
import ReadingModePage from '@/qy/qy_pages/ReadingModePage';
import MemoryLibraryPage from '@/qy/qy_pages/MemoryLibraryPage';
import DocumentUploadPage from '@/qy/qy_pages/DocumentUploadPage';
import LoginPage from '@/qy/qy_pages/LoginPage';
import RegisterPage from '@/qy/qy_pages/RegisterPage';
import ProfilePage from '@/qy/qy_pages/ProfilePage';
import LearningSettingsPage from '@/qy/qy_pages/LearningSettingsPage';
import PronunciationSettingsPage from '@/qy/qy_pages/PronunciationSettingsPage';
import ThemeSettingsPage from '@/qy/qy_pages/ThemeSettingsPage';
import NotificationSettingsPage from '@/qy/qy_pages/NotificationSettingsPage';
import DataSyncSettingsPage from '@/qy/qy_pages/DataSyncSettingsPage';
import AboutPage from '@/qy/qy_pages/AboutPage';
import HelpPage from '@/qy/qy_pages/HelpPage';
import AchievementPage from '@/qy/qy_pages/AchievementPage';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Main Tab Navigator
const MainTabs = () => {
  const { t } = useTranslation();
  const { themeData } = useStore();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          if (route.name === 'HomeTab') {
            iconName = 'home';
          } else if (route.name === 'LearnTab') {
            iconName = 'book-open';
          } else if (route.name === 'ReviewTab') {
            iconName = 'refresh-cw';
          } else if (route.name === 'StatisticsTab') {
            iconName = 'bar-chart-2';
          } else if (route.name === 'SettingsTab') {
            iconName = 'settings';
          } else {
            iconName = 'circle';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: themeData.colors.primary,
        tabBarInactiveTintColor: themeData.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: themeData.colors.surface,
          borderTopColor: themeData.colors.border,
        },
        headerStyle: {
          backgroundColor: themeData.colors.surface,
        },
        headerTintColor: themeData.colors.text,
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomePage}
        options={{ title: t('navigation.home') }}
      />
      <Tab.Screen
        name="LearnTab"
        component={LearnPage}
        options={{ title: t('navigation.learn') }}
      />
      <Tab.Screen
        name="ReviewTab"
        component={ReviewPage}
        options={{ title: t('navigation.review') }}
      />
      <Tab.Screen
        name="StatisticsTab"
        component={StatisticsPage}
        options={{ title: t('navigation.statistics') }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsPage}
        options={{ title: t('navigation.settings') }}
      />
    </Tab.Navigator>
  );
};

// Root Stack Navigator
const AppNavigator = () => {
  const { themeData } = useStore();

  return (
    <NavigationContainer
      theme={{
        dark: themeData.mode === 'dark',
        colors: {
          primary: themeData.colors.primary,
          background: themeData.colors.background,
          card: themeData.colors.card,
          text: themeData.colors.text,
          border: themeData.colors.border,
          notification: themeData.colors.primary,
        },
      }}
    >
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: themeData.colors.surface,
          },
          headerTintColor: themeData.colors.text,
          headerTitleStyle: {
            color: themeData.colors.text,
          },
        }}
      >
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="WordGroupList"
          component={WordGroupListPage}
          options={{ title: '单词组' }}
        />
        <Stack.Screen
          name="WordGroupDetail"
          component={WordGroupDetailPage}
          options={{ title: '单词组详情' }}
        />
        <Stack.Screen
          name="WordDetail"
          component={WordDetailPage}
          options={{ title: '单词详情' }}
        />
        <Stack.Screen
          name="ReadingMode"
          component={ReadingModePage}
          options={{ title: '阅读模式' }}
        />
        <Stack.Screen
          name="MemoryLibrary"
          component={MemoryLibraryPage}
          options={{ title: '记忆库' }}
        />
        <Stack.Screen
          name="DocumentUpload"
          component={DocumentUploadPage}
          options={{ title: '文档上传' }}
        />
        <Stack.Screen
          name="Login"
          component={LoginPage}
          options={{ title: '登录' }}
        />
        <Stack.Screen
          name="Register"
          component={RegisterPage}
          options={{ title: '注册' }}
        />
        <Stack.Screen
          name="Profile"
          component={ProfilePage}
          options={{ title: '个人中心' }}
        />
        <Stack.Screen
          name="LearningSettings"
          component={LearningSettingsPage}
          options={{ title: '学习设置' }}
        />
        <Stack.Screen
          name="PronunciationSettings"
          component={PronunciationSettingsPage}
          options={{ title: '发音设置' }}
        />
        <Stack.Screen
          name="ThemeSettings"
          component={ThemeSettingsPage}
          options={{ title: '主题设置' }}
        />
        <Stack.Screen
          name="NotificationSettings"
          component={NotificationSettingsPage}
          options={{ title: '通知设置' }}
        />
        <Stack.Screen
          name="DataSyncSettings"
          component={DataSyncSettingsPage}
          options={{ title: '数据同步' }}
        />
        <Stack.Screen
          name="About"
          component={AboutPage}
          options={{ title: '关于' }}
        />
        <Stack.Screen
          name="Help"
          component={HelpPage}
          options={{ title: '帮助' }}
        />
        <Stack.Screen
          name="Achievement"
          component={AchievementPage}
          options={{ title: '成就' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;

