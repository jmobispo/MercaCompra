import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { login as apiLogin, register as apiRegister, getMe, updateMe } from '../api/auth';
import type { User } from '../types';

export function useAuth() {
  const { token, user, isAuthenticated, setAuth, setUser, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const login = async (email: string, password: string) => {
    const response = await apiLogin(email, password);
    setAuth(response.access_token, response.user);
    navigate('/dashboard');
  };

  const register = async (
    email: string,
    username: string,
    password: string,
    postal_code: string
  ) => {
    const response = await apiRegister(email, username, password, postal_code);
    setAuth(response.access_token, response.user);
    navigate('/dashboard');
  };

  const logout = () => {
    clearAuth();
    navigate('/login');
  };

  const fetchMe = async (): Promise<User> => {
    const userData = await getMe();
    setUser(userData);
    return userData;
  };

  const update = async (data: Partial<Pick<User, 'username' | 'postal_code' | 'ui_mode'>>): Promise<User> => {
    const updated = await updateMe(data);
    setUser(updated);
    return updated;
  };

  return { token, user, isAuthenticated, login, register, logout, fetchMe, update };
}
