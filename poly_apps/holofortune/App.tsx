import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StoreProvider, useStore } from './store';

// Pages
import Login from './pages/Login';
import MapHome from './pages/MapHome';
import FriendsList from './pages/FriendsList';
import FriendDetail from './pages/FriendDetail';
import History from './pages/History';
import AddFriend from './pages/AddFriend';
import SendRequest from './pages/SendRequest';
import Profile from './pages/Profile';
import EditProfile from './pages/EditProfile';
import About from './pages/About';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import Shop from './pages/Shop';
import AIAssistant from './pages/AIAssistant';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const MainTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' }, // Hide default tab bar, we use custom BottomNav
      }}
    >
      <Tab.Screen name="MapHome" component={MapHome} />
      <Tab.Screen name="AIAssistant" component={AIAssistant} />
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
      <Stack.Navigator screenOptions={{ headerShown: false }}>
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

const App: React.FC = () => {
  return (
    <StoreProvider>
      <AppRoutes />
    </StoreProvider>
  );
};

export default App;
