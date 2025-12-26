import React, { useState, useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Button } from '../../components/UI';
import { api } from '../../services/api';

const LoginPage = () => {
  const { login } = useContext(AppContext);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('demo');
  const [password, setPassword] = useState('demo');

  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await api.login(email, password);
      if (res.token) {
        api.setToken(res.token);
      }
      login(res.user);
    } catch(e) { 
      alert("Login failed. Try demo/demo"); 
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 animate-fade-in">
      <div className="w-24 h-24 bg-gradient-to-tr from-blue-400 to-purple-500 rounded-3xl shadow-2xl mb-8 flex items-center justify-center text-4xl text-white font-bold transform rotate-6 animate-blob">W</div>
      <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">WordFlow AI</h1>
      <p className="text-slate-500 dark:text-slate-300 mb-10 text-center">Master languages with holographic memory engines.</p>
      
      <div className="w-full max-w-sm space-y-4">
        <input 
          type="email" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email" 
          className="w-full p-4 rounded-xl glass-panel bg-white/40 dark:bg-black/20 outline-none focus:ring-2 ring-blue-400 dark:text-white transition-all" 
        />
        <input 
          type="password" 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password" 
          className="w-full p-4 rounded-xl glass-panel bg-white/40 dark:bg-black/20 outline-none focus:ring-2 ring-blue-400 dark:text-white transition-all" 
        />
        <Button onClick={handleLogin}>{loading ? 'Connecting...' : 'Login / Register'}</Button>
        <Button variant="ghost">Forgot Password?</Button>
      </div>
      <div className="mt-8 text-xs text-slate-400">Connected to Laravel API v1</div>
    </div>
  );
};

export default LoginPage;
