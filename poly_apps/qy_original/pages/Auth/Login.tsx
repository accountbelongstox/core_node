import React, { useState, useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
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
    <div className="aurora-login-container animate-fade-in">
      <div className="aurora-login-card">
          <div className="login-header">
              <div className="login-logo-wrapper">
                 W
              </div>
              <h1 className="login-title">WordFlow AI</h1>
              <p className="login-subtitle">Neural Memory Interface</p>
          </div>
          
          <div className="login-inputs">
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="demo" 
                className="glass-input login-input" 
              />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••" 
                className="glass-input login-input" 
              />
          </div>
          
          <button 
              onClick={handleLogin} 
              className="app-btn app-btn-primary login-button"
              disabled={loading}
          >
              {loading ? 'Initializing...' : 'Enter System'}
          </button>
          
          <div className="login-footer">
              SECURE CONNECTION // V2.5
          </div>
      </div>
    </div>
  );
};

export default LoginPage;