import { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from '../api-integration/auth';
import { setTokenProvider } from '../api-integration/client';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [token, setToken] = useState(localStorage.getItem('sentinelpay_token'));

    useEffect(() => {
        if (token) {
            setLoading(true); // Ensure we wait for profile fetch
            setTokenProvider(async () => token);
            fetchProfile();
        } else {
            setTokenProvider(async () => null);
            setUser(null);
            setLoading(false);
        }
    }, [token]);

    const fetchProfile = async () => {
        try {
            const userData = await authApi.getProfile();
            setUser(userData);
        } catch (error) {
            console.error('Failed to fetch profile:', error);
            logout(); // Invalid token
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        const data = await authApi.login(email, password);
        localStorage.setItem('sentinelpay_token', data.token);
        setToken(data.token);
        setUser(data.user);
        return data.user;
    };

    const register = async (email, password, name, phone) => {
        const data = await authApi.register(email, password, name, phone);
        // Note: data will not contain a token yet. Returns { message, isVerified }
        return data;
    };

    const verifyRegistration = async (email, otp) => {
        const data = await authApi.verifyRegistration(email, otp);
        localStorage.setItem('sentinelpay_token', data.token);
        setToken(data.token);
        setUser(data.user);
        return data.user;
    };

    const loginWithToken = (newToken) => {
        localStorage.setItem('sentinelpay_token', newToken);
        setLoading(true);
        setToken(newToken);
    };

    const logout = () => {
        localStorage.removeItem('sentinelpay_token');
        setToken(null);
        setUser(null);
        setTokenProvider(async () => null);
    };

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated: !!user,
            loading,
            login,
            register,
            verifyRegistration,
            logout,
            loginWithToken,
            token
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
