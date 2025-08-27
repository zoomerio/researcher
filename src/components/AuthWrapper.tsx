import React, { useState, useEffect } from 'react';
import { Login } from './Login';
import { Register } from './Register';

interface User {
  id: number;
  username: string;
  fullName: string;
  groupId: string;
}

interface AuthWrapperProps {
  children: (user: User, sessionToken: string, logout: () => void) => React.ReactNode;
}

type AuthView = 'login' | 'register';

export function AuthWrapper({ children }: AuthWrapperProps) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<AuthView>('login');
  const [isValidating, setIsValidating] = useState(true);

  // Always require login - no persistent sessions
  useEffect(() => {
    // Clear any existing session tokens to force login every time
    localStorage.removeItem('sessionToken');
    setIsValidating(false);
  }, []);

  const handleLogin = (userData: User, token: string) => {
    setUser(userData);
    setSessionToken(token);
    // Don't store session token in localStorage to force login every time
    console.log('User logged in:', userData.username);
  };

  const handleLogout = async () => {
    if (sessionToken) {
      try {
        await window.api.logout({ sessionToken });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
    
    setUser(null);
    setSessionToken(null);
    setCurrentView('login');
    console.log('User logged out');
  };

  const handleRegisterSuccess = () => {
    setCurrentView('login');
  };

  const handleSwitchToRegister = () => {
    setCurrentView('register');
  };

  const handleSwitchToLogin = () => {
    setCurrentView('login');
  };

  // Show loading while initializing
  if (isValidating) {
    return (
      <div className="auth-container">
        <div className="auth-loading">
          <h2>Инициализация...</h2>
        </div>
      </div>
    );
  }

  // Show authentication UI if not logged in
  if (!user || !sessionToken) {
    return (
      <>
        {currentView === 'login' && (
          <Login 
            onLogin={handleLogin}
            onSwitchToRegister={handleSwitchToRegister}
          />
        )}
        {currentView === 'register' && (
          <Register 
            onRegisterSuccess={handleRegisterSuccess}
            onSwitchToLogin={handleSwitchToLogin}
          />
        )}
      </>
    );
  }

  // User is authenticated, render the main application
  return <>{children(user, sessionToken, handleLogout)}</>;
}
