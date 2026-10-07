import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, AlertCircle, ArrowLeft, ShieldCheck } from 'lucide-react';
import { authApi } from '../api-integration/auth';

const Login = () => {
    const [view, setView] = useState('login'); // 'login', 'register', 'otp-verify', 'forgot-password', 'reset-password'
    const [formData, setFormData] = useState({ email: '', password: '', name: '', phone: '', otp: '', newPassword: '' });
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [loading, setLoading] = useState(false);

    const { login, register, verifyRegistration } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Check for errors from URL (e.g. from Google Auth redirect failure)
    React.useEffect(() => {
        const params = new URLSearchParams(location.search);
        const urlError = params.get('error');
        if (urlError) {
            setError(urlError === 'GoogleAuthFailed' ? 'Google Sign-In failed.' : urlError);
        }
    }, [location]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const fillDemo = async (role = 'demo') => {
        const email = role === 'admin' ? 'admin@sentinelpay.io' : 'demo@sentinelpay.io';
        const password = role === 'admin' ? 'Admin@123456' : 'Demo@123456';
        setFormData(prev => ({ ...prev, email, password }));
        setError('');
        setSuccessMsg('');
        setLoading(true);
        try {
            await login(email, password);
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.error || 'Authentication failed. Please check credentials.');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setLoading(true);

        try {
            if (view === 'login') {
                await login(formData.email, formData.password);
                navigate('/dashboard');
            } else if (view === 'register') {
                const res = await register(formData.email, formData.password, formData.name, formData.phone);
                setSuccessMsg(res.message || 'OTP sent to your email.');
                setView('otp-verify');
            } else if (view === 'otp-verify') {
                await verifyRegistration(formData.email, formData.otp);
                navigate('/dashboard');
            } else if (view === 'forgot-password') {
                const res = await authApi.forgotPassword(formData.email);
                setSuccessMsg(res.message || 'Reset code sent to your email.');
                setView('reset-password');
            } else if (view === 'reset-password') {
                const res = await authApi.resetPassword(formData.email, formData.otp, formData.newPassword);
                setSuccessMsg(res.message || 'Password reset successful. Please login.');
                setView('login');
                setFormData({ ...formData, password: '', newPassword: '', otp: '' });
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Authentication failed');
            if (err.response?.data?.unverified) {
                setSuccessMsg('Your email is unverified. Please sign up again to receive a new OTP.');
                setView('register');
            } else if (err.response?.data?.forceReset) {
                setSuccessMsg('Your password has been reset by an administrator. Please check your email for a reset code.');
                setView('reset-password');
                setFormData(prev => ({ ...prev, password: '' }));
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = () => {
        window.location.href = `${import.meta.env.VITE_API_URL_AUTH || 'http://localhost:3002'}/auth/google`;
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4 py-12">
            <div className="max-w-md w-full space-y-6 bg-card text-card-foreground p-8 rounded-2xl shadow-2xl border border-border">
                <div className="text-center">
                    <div className="inline-flex items-center gap-2.5 mb-2 cursor-pointer" onClick={() => navigate('/')}>
                        <img src="/sentinelpay-logo.svg" alt="SentinelPay" className="h-9 w-9" />
                        <h2 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500">SentinelPay</h2>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {view === 'login' && 'Sign in to access your risk & fraud dashboard'}
                        {view === 'register' && 'Create an account to get started'}
                        {view === 'otp-verify' && 'Check your email for the verification code'}
                        {view === 'forgot-password' && 'Enter your email to receive a reset code'}
                        {view === 'reset-password' && 'Enter the reset code and your new password'}
                    </p>
                </div>

                {view === 'login' && (
                    <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs">
                        <div className="font-semibold text-indigo-600 dark:text-indigo-400 mb-2 flex items-center justify-between">
                            <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> Quick Test Credentials</span>
                            <span className="text-[10px] opacity-75 font-mono">1-Click Sign-In</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => fillDemo('demo')}
                                disabled={loading}
                                className="py-2.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors flex flex-col items-center justify-center text-center shadow-md shadow-indigo-500/20"
                            >
                                <span className="font-bold">Demo Analyst</span>
                                <span className="text-[10px] opacity-80 font-mono">demo@sentinelpay.io</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => fillDemo('admin')}
                                disabled={loading}
                                className="py-2.5 px-3 rounded-lg bg-card hover:bg-muted text-foreground border border-border font-medium text-xs transition-colors flex flex-col items-center justify-center text-center shadow-sm"
                            >
                                <span className="font-bold">Admin Account</span>
                                <span className="text-[10px] text-muted-foreground font-mono">admin@sentinelpay.io</span>
                            </button>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm">{error}</span>
                    </div>
                )}

                {successMsg && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 px-4 py-3 rounded-xl text-sm">
                        {successMsg}
                    </div>
                )}

                <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        {(view === 'login' || view === 'register' || view === 'forgot-password') && (
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Email address</label>
                                <input
                                    name="email"
                                    type="email"
                                    required
                                    className="w-full px-3.5 py-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-foreground text-sm"
                                    value={formData.email}
                                    onChange={handleChange}
                                    disabled={view === 'otp-verify' || view === 'reset-password'}
                                    placeholder="name@company.com"
                                />
                            </div>
                        )}

                        {view === 'register' && (
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Full Name</label>
                                <input
                                    name="name"
                                    type="text"
                                    required
                                    className="w-full px-3.5 py-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-foreground text-sm"
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="Jane Doe"
                                />
                            </div>
                        )}

                        {view === 'register' && (
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Phone Number</label>
                                <input
                                    name="phone"
                                    type="tel"
                                    required
                                    placeholder="+91 98765 43210"
                                    className="w-full px-3.5 py-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-foreground text-sm"
                                    value={formData.phone}
                                    onChange={handleChange}
                                />
                            </div>
                        )}

                        {(view === 'login' || view === 'register') && (
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">Password</label>
                                    {view === 'login' && (
                                        <button
                                            type="button"
                                            onClick={() => { setView('forgot-password'); setError(''); setSuccessMsg(''); }}
                                            className="text-xs text-indigo-500 hover:text-indigo-400 font-medium"
                                        >
                                            Forgot password?
                                        </button>
                                    )}
                                </div>
                                <input
                                    name="password"
                                    type="password"
                                    required
                                    className="w-full px-3.5 py-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-foreground text-sm"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="••••••••"
                                />
                            </div>
                        )}

                        {(view === 'otp-verify' || view === 'reset-password') && (
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">6-Digit Code</label>
                                <input
                                    name="otp"
                                    type="text"
                                    required
                                    maxLength={6}
                                    placeholder="123456"
                                    className="w-full px-3.5 py-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-center tracking-widest text-xl font-mono text-foreground"
                                    value={formData.otp}
                                    onChange={handleChange}
                                />
                            </div>
                        )}

                        {view === 'reset-password' && (
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">New Password</label>
                                <input
                                    name="newPassword"
                                    type="password"
                                    required
                                    className="w-full px-3.5 py-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-foreground text-sm"
                                    value={formData.newPassword}
                                    onChange={handleChange}
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-3 pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl shadow-lg shadow-indigo-500/25 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                            {view === 'login' && 'Sign in'}
                            {view === 'register' && 'Create account'}
                            {view === 'otp-verify' && 'Verify Email'}
                            {view === 'forgot-password' && 'Send Reset Code'}
                            {view === 'reset-password' && 'Reset Password'}
                        </button>

                        {(view === 'login' || view === 'register') && (
                            <>
                                <div className="relative my-2">
                                    <div className="absolute inset-0 flex items-center">
                                        <span className="w-full border-t border-border" />
                                    </div>
                                    <div className="relative flex justify-center text-xs uppercase">
                                        <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleGoogleLogin}
                                    className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-border rounded-xl shadow-sm text-sm font-medium text-foreground bg-card hover:bg-muted focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-border transition-colors"
                                >
                                    <svg className="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 18 19">
                                        <path fillRule="evenodd" d="M8.842 18.083a8.8 8.8 0 0 1-8.65-8.948 8.841 8.841 0 0 1 8.8-8.652h.153a8.464 8.464 0 0 1 5.7 2.257l-2.193 2.038A5.27 5.27 0 0 0 9.09 3.4a5.882 5.882 0 0 0-.2 11.76h.124a5.091 5.091 0 0 0 5.248-4.057L14.3 11H9V8h8.34c.066.543.095 1.09.088 1.636-.086 5.053-3.463 8.449-8.4 8.449l-.186-.002Z" clipRule="evenodd" />
                                    </svg>
                                    Google
                                </button>
                            </>
                        )}

                        {(view !== 'login' && view !== 'register') && (
                            <button
                                type="button"
                                onClick={() => { setView('login'); setError(''); setSuccessMsg(''); }}
                                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-border rounded-xl shadow-sm text-sm font-medium text-foreground hover:bg-muted focus:outline-none transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" /> Back to Login
                            </button>
                        )}
                    </div>
                </form>

                {(view === 'login' || view === 'register') && (
                    <div className="text-center mt-4">
                        <button
                            onClick={() => { setView(view === 'login' ? 'register' : 'login'); setError(''); setSuccessMsg(''); }}
                            className="text-sm text-indigo-500 hover:text-indigo-400 font-medium transition-colors"
                        >
                            {view === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Login;
