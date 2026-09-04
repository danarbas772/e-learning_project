import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

// 2 jam dalam milidetik (2 * 60 * 60 * 1000)
export const SESSION_DURATION_MS = 2 * 60 * 60 * 1000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback((reason = '') => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('login_time');
    if (reason) {
      sessionStorage.setItem('session_message', reason);
    }
  }, []);

  // Cek apakah sesi login sudah lewat dari 2 jam
  const checkSessionValidity = useCallback(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    const savedLoginTime = localStorage.getItem('login_time');

    if (savedToken && savedUser) {
      const loginTime = savedLoginTime ? parseInt(savedLoginTime, 10) : null;
      const now = Date.now();

      if (!loginTime || now - loginTime > SESSION_DURATION_MS) {
        logout('Sesi login Anda telah berakhir (lebih dari 2 jam). Silakan login kembali.');
        return false;
      }
      return true;
    }
    return false;
  }, [logout]);

  // Load dari localStorage saat pertama kali & cek expired
  useEffect(() => {
    const isValid = checkSessionValidity();
    if (isValid) {
      setToken(localStorage.getItem('token'));
      try {
        setUser(JSON.parse(localStorage.getItem('user')));
      } catch (e) {
        logout();
      }
    }
    setLoading(false);
  }, [checkSessionValidity, logout]);

  // Interval check sesi setiap 30 detik untuk logout otomatis tepat setelah 2 jam
  useEffect(() => {
    if (!token) return;

    const interval = setInterval(() => {
      const savedLoginTime = localStorage.getItem('login_time');
      if (savedLoginTime) {
        const loginTime = parseInt(savedLoginTime, 10);
        if (Date.now() - loginTime > SESSION_DURATION_MS) {
          logout('Sesi login Anda telah berakhir (2 jam). Silakan login kembali.');
          window.location.href = '/login';
        }
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [token, logout]);

  const login = async (email, password) => {
    const res = await authAPI.login({ email, password });
    const { token: newToken, user: newUser } = res.data.data;
    const now = Date.now();

    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    localStorage.setItem('login_time', now.toString());
    sessionStorage.removeItem('session_message');
    return newUser;
  };

  const isAdmin = user?.role === 'admin';
  const isInstructor = user?.role === 'instructor';
  const isStudent = user?.role === 'student';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        checkSessionValidity,
        isAdmin,
        isInstructor,
        isStudent,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
