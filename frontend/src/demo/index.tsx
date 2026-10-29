import React, { useCallback, useEffect, useMemo, useState } from 'react';
const WeaveAiChat = React.lazy(() => import('../components/WeaveAiChat').then(module => ({ default: module.WeaveAiChat })));
import { Login } from '../components/Login';
import { HistoryItem } from '../models/startup';
import { API_BASE_URL } from '../constants/chatConstants';
import { isMofEmail, MOF_EMAIL_ERROR, normalizeMofEmail } from '../utils/mofEmail';
import {
  AUTH_SESSION_CHANGED_EVENT,
  configureAuthSession,
  getStoredSession,
  logoutAuthSession,
  refreshAuthSession,
  storeGoTrueSession,
} from '../services/authSession';
import '../styles/input.css';
import '../i18n';
import { ignoreResizeObserverLoopError } from '../utils/ignoreResizeObserverError';

ignoreResizeObserverLoopError();

const LOGIN_URL = `${API_BASE_URL}/auth/login`;
const SIGNUP_URL = `${API_BASE_URL}/auth/signup`;
const REFRESH_URL = `${API_BASE_URL}/user/refresh`;
const LOGOUT_URL = `${API_BASE_URL}/user/logout`;
const DARK_MODE_KEY = 'mof-temp-dark-mode';

configureAuthSession({ refreshUrl: REFRESH_URL, logoutUrl: LOGOUT_URL });

const THEME_COLORS = {
  primary: '#C6A75D',
  secondary: '#B8985A',
  accent: '#E5D4A6',
};

function readStoredAuth(): { token: string | null; user: any } {
  const session = getStoredSession();
  return { token: session?.accessToken || null, user: session?.user ?? null };
}

function readStoredDarkMode(): boolean {
  try {
    return window.localStorage.getItem(DARK_MODE_KEY) === '1';
  } catch {
    return false;
  }
}

const App = () => {
  const [isArabic, setIsArabic] = useState(false);
  const [darkMode] = useState(readStoredDarkMode);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [{ token: authToken, user: currentUser }, setAuth] = useState(readStoredAuth);
  const [restoringSession, setRestoringSession] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle('temp-dark', darkMode);
    try {
      window.localStorage.setItem(DARK_MODE_KEY, darkMode ? '1' : '0');
    } catch {
      // ignore storage failures
    }
  }, [darkMode]);

  useEffect(() => {
    const syncAuth = () => {
      const next = readStoredAuth();
      setAuth(previous => {
        const sameToken = previous.token === next.token;
        const sameUser = JSON.stringify(previous.user) === JSON.stringify(next.user);
        return sameToken && sameUser ? previous : next;
      });
    };
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, syncAuth);

    refreshAuthSession(false).finally(() => {
      syncAuth();
      setRestoringSession(false);
    });

    const refreshTimer = window.setInterval(() => {
      refreshAuthSession(false).then(syncAuth);
    }, 30_000);

    return () => {
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, syncAuth);
      window.clearInterval(refreshTimer);
    };
  }, []);

  const apiConfig = useMemo(() => ({
    baseUrl: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      Token: authToken || '',
    },
  }), [authToken]);

  const checkHistoryItemExists = useCallback((weaveChatid: number): boolean => {
    return historyItems.some(item => {
      const sessionId = typeof item.session === 'object' ? item.session.id : parseInt(item.id, 10);
      return sessionId === weaveChatid;
    });
  }, [historyItems]);

  const addHistoryItem = useCallback((item: HistoryItem) => {
    setHistoryItems(prev => {
      if (!prev.some(existing => existing.id === item.id)) {
        return [...prev, item];
      }
      return prev;
    });
  }, []);

  const handleLogout = async () => {
    await logoutAuthSession();
    setAuth({ token: null, user: null });
  };

  const handleLogin = async (username: string, password: string) => {
    const email = normalizeMofEmail(username);
    if (!isMofEmail(email)) throw new Error(MOF_EMAIL_ERROR);

    const response = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: email, password }),
    });

    if (!response.ok) {
      throw new Error('Invalid username or password');
    }

    const data = await response.json();
    const result = Array.isArray(data) ? data[0] : data;
    if (!result || result.status === 'invalid login' || !result.token) {
      throw new Error('Invalid username or password');
    }

    const session = storeGoTrueSession(result);
    setAuth({ token: session.accessToken, user: session.user });
  };

  const handleSignUp = async (username: string, password: string, fullName: string) => {
    const email = normalizeMofEmail(username);
    if (!isMofEmail(email)) throw new Error(MOF_EMAIL_ERROR);
    const name = fullName.trim().replace(/\s+/g, ' ');
    if (name.length < 2) throw new Error('Please enter your full name');

    const response = await fetch(SIGNUP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: email, password, fullName: name }),
    });
    const data = await response.json();
    const result = Array.isArray(data) ? data[0] : data;
    if (!response.ok || !result || result.status !== 'success' || !result.token) {
      throw new Error(result?.message || 'Unable to create account');
    }
    const session = storeGoTrueSession(result);
    setAuth({ token: session.accessToken, user: session.user });
  };

  if (restoringSession) return null;

  if (!authToken) {
    return (
      <Login onLogin={handleLogin} onSignUp={handleSignUp} themeColors={THEME_COLORS} />
    );
  }

  return (
    <React.Suspense fallback={<p role="status" className="p-6 text-center" dir={isArabic ? 'rtl' : 'ltr'}>{isArabic ? 'جاري تحميل المحادثة…' : 'Loading chat…'}</p>}>
    <div className="h-screen bg-gray-100">
      <WeaveAiChat
        apiConfig={apiConfig}
        placeholder="Ask a question or start a task"
        onViewAIServicesClose={() => {}}
        OnWebSocketEvent={() => {}}
        isAIServicesCloseButtonVisible={false}
        sideMenuCloseDefault={false}
        IsMobile={false}
        IsArabicLanguage={isArabic}
        onLanguageChange={setIsArabic}
        userEmail={currentUser?.email || currentUser?.username || ''}
        currentUser={{
          employee_name:
            currentUser?.employee_name ||
            currentUser?.full_name ||
            currentUser?.user_metadata?.employee_name ||
            currentUser?.user_metadata?.full_name ||
            currentUser?.username,
          job_title: currentUser?.job_title || currentUser?.department,
          department: currentUser?.department,
          email: currentUser?.email || currentUser?.username,
        }}
        checkHistoryItemExists={checkHistoryItemExists}
        addHistoryItem={addHistoryItem}
        userAvatarBase64=""
        userAvatarUrl=""
        themeColors={THEME_COLORS}
        onLogout={handleLogout}
      />
    </div>
    </React.Suspense>
  );
};

export default App;
