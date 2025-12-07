import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useStore } from '@/apps/awy/awy_store';

// Pages
import Login from '@/apps/awy/awy_pages/Login';
import MapHome from '@/apps/awy/awy_pages/MapHome';
import AIAssistant from '@/apps/awy/awy_pages/AIAssistant';
import Shop from '@/apps/awy/awy_pages/Shop';
import Profile from '@/apps/awy/awy_pages/Profile';
import FriendsList from '@/apps/awy/awy_pages/FriendsList';
import FriendDetail from '@/apps/awy/awy_pages/FriendDetail';
import History from '@/apps/awy/awy_pages/History';
import AddFriend from '@/apps/awy/awy_pages/AddFriend';
import SendRequest from '@/apps/awy/awy_pages/SendRequest';
import Chat from '@/apps/awy/awy_pages/Chat';
import EditProfile from '@/apps/awy/awy_pages/EditProfile';
import Settings from '@/apps/awy/awy_pages/Settings';
import About from '@/apps/awy/awy_pages/About';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const MainTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' }, // Hide default tab bar, we use custom BottomNav
      }}
      initialRouteName="FriendsList" // Start at FriendsList (好友页) after login
    >
      <Tab.Screen name="MapHome" component={MapHome} />
      <Tab.Screen name="FriendsList" component={FriendsList} />
      <Tab.Screen name="Shop" component={Shop} />
      <Tab.Screen name="Profile" component={Profile} />
    </Tab.Navigator>
  );
};

const AppRoutes = () => {
  const { isAuthenticated } = useStore();

  if (!isAuthenticated) {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={Login} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator 
        screenOptions={{ headerShown: false }}
        initialRouteName="MainTabs"
      >
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen name="FriendsList" component={FriendsList} />
        <Stack.Screen name="FriendDetail" component={FriendDetail} />
        <Stack.Screen name="AddFriend" component={AddFriend} />
        <Stack.Screen name="SendRequest" component={SendRequest} />
        <Stack.Screen name="Chat" component={Chat} />
        <Stack.Screen name="History" component={History} />
        <Stack.Screen name="EditProfile" component={EditProfile} />
        <Stack.Screen name="Settings" component={Settings} />
        <Stack.Screen name="About" component={About} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppRoutes;

