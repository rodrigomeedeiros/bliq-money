import { UserProfile, AuthSession } from './types';

const USERS_DB_KEY = 'bliq_users_db';
const getUsers = (): any[] => JSON.parse(localStorage.getItem(USERS_DB_KEY) || '[]');

export const authService = {
  signup: async (name: string, email: string, password: string, birthDate: string): Promise<AuthSession> => {
    await new Promise(r => setTimeout(r, 1200));
    
    const users = getUsers();
    if (users.find(u => u.email === email)) throw new Error("Este e-mail já está cadastrado.");

    const newUser: UserProfile = {
      id: Math.random().toString(36).substring(2, 15),
      name,
      email,
      birthDate,
      createdAt: new Date().toISOString()
    };

    users.push({ ...newUser, password });
    localStorage.setItem(USERS_DB_KEY, JSON.stringify(users));

    return { user: newUser, token: "jwt_token_simulated_" + newUser.id };
  },

  login: async (email: string, password: string, remember: boolean): Promise<AuthSession> => {
    await new Promise(r => setTimeout(r, 1000));
    
    const users = getUsers();
    const user = users.find(u => u.email === email && u.password === password);
    
    if (!user) throw new Error("E-mail ou senha inválidos.");

    const sessionUser: UserProfile = {
      id: user.id,
      name: user.name,
      email: user.email,
      birthDate: user.birthDate,
      createdAt: user.createdAt
    };

    return { user: sessionUser, token: "jwt_token_simulated_" + user.id };
  },

  resetPassword: async (email: string): Promise<void> => {
    await new Promise(r => setTimeout(r, 800));
    const users = getUsers();
    if (!users.find(u => u.email === email)) throw new Error("E-mail não encontrado.");
  }
};