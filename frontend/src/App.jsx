import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { SpeedInsights } from '@vercel/speed-insights/react';
import Dashboard from './components/Dashboard';
import LoginPage from './components/LoginPage';
import { authApi } from './api';
import './i18n';

function App() {
  const { i18n } = useTranslation('common');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentLang, setCurrentLang] = useState('zh');

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      authApi.getMe(savedToken).then((response) => {
        if (response.data.success) {
          setIsLoggedIn(true);
          setCurrentUser(response.data.user);
        } else {
          localStorage.removeItem('token');
        }
      }).catch(() => {
        localStorage.removeItem('token');
      }).finally(() => {
        setIsLoading(false);
      });
    } else {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      if (token) {
        authApi.getMe(token).then((response) => {
          if (response.data.success) {
            localStorage.setItem('token', token);
            setIsLoggedIn(true);
            setCurrentUser(response.data.user);
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }).catch(() => {
          localStorage.removeItem('token');
        }).finally(() => {
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const savedLang = localStorage.getItem('i18nextLng') || 'zh';
    setCurrentLang(savedLang);
    i18n.changeLanguage(savedLang);
  }, [i18n]);

  const handleLogin = useCallback(async (email, password) => {
    const response = await authApi.login(email, password);
    if (response.data.success) {
      localStorage.setItem('token', response.data.token);
      setIsLoggedIn(true);
      setCurrentUser(response.data.user);
    } else {
      throw new Error(response.data.message);
    }
  }, []);

  const handleGuestLogin = useCallback(async () => {
    const response = await authApi.guestLogin();
    if (response.data.success) {
      localStorage.setItem('token', response.data.token);
      setIsLoggedIn(true);
      setCurrentUser(response.data.user);
    } else {
      throw new Error(response.data.message);
    }
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    setCurrentUser(null);
  }, []);

  const handleLanguageChange = useCallback((lang) => {
    setCurrentLang(lang);
    i18n.changeLanguage(lang);
  }, [i18n]);

  if (isLoading) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <SpeedInsights />
      </>
    );
  }

  if (!isLoggedIn) {
    return (
      <>
        <LoginPage
          onLogin={handleLogin}
          onGuestLogin={handleGuestLogin}
          onLanguageChange={handleLanguageChange}
          currentLang={currentLang}
        />
        <SpeedInsights />
      </>
    );
  }

  return (
    <>
      <Dashboard
        currentUser={currentUser}
        onLogout={handleLogout}
        onLanguageChange={handleLanguageChange}
        currentLang={currentLang}
      />
      <SpeedInsights />
    </>
  );
}

export default App;
