import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route path="/" element={<Navigate to="/map" replace />} />
      
      <Route path="/map" element={
        <ProtectedRoute><MapHome /></ProtectedRoute>
      } />
      
      <Route path="/friends" element={
        <ProtectedRoute><FriendsList /></ProtectedRoute>
      } />
      
      <Route path="/friends/add" element={
        <ProtectedRoute><AddFriend /></ProtectedRoute>
      } />

      <Route path="/friends/request" element={
        <ProtectedRoute><SendRequest /></ProtectedRoute>
      } />
      
      <Route path="/friends/:id" element={
        <ProtectedRoute><FriendDetail /></ProtectedRoute>
      } />
      
      <Route path="/history" element={
        <ProtectedRoute><History /></ProtectedRoute>
      } />
      
      <Route path="/me" element={
        <ProtectedRoute><Profile /></ProtectedRoute>
      } />
      
      <Route path="/me/edit" element={
        <ProtectedRoute><EditProfile /></ProtectedRoute>
      } />
      
      <Route path="/about" element={
        <ProtectedRoute><About /></ProtectedRoute>
      } />
      
      <Route path="*" element={<Navigate to="/map" />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <StoreProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </StoreProvider>
  );
};

export default App;