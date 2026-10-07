import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../api-integration/auth';
import { Loader2 } from 'lucide-react';

const AuthCallback = () => {
    const { loginWithToken, user, loading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [needsPhone, setNeedsPhone] = useState(false);
    const [phone, setPhone] = useState('');
    const [error, setError] = useState('');
    const [submitLoading, setSubmitLoading] = useState(false);
    const [tokenProcessed, setTokenProcessed] = useState(false);

    // Step 1: Process the token from URL
    useEffect(() => {
        if (tokenProcessed) return;

        const params = new URLSearchParams(location.search);
        const token = params.get('token');
        const err = params.get('error');

        if (token) {
            loginWithToken(token);
            setTokenProcessed(true);
        } else if (err) {
            navigate(`/login?error=${err}`, { replace: true });
        } else {
            navigate('/login', { replace: true });
        }
    }, [location, loginWithToken, navigate, tokenProcessed]);

    // Step 2: Once user is loaded, check if phone exists
    useEffect(() => {
        if (!tokenProcessed || loading) return;

        if (user && !user.phone) {
            setNeedsPhone(true);
        } else if (user && user.phone) {
            navigate('/dashboard', { replace: true });
        }
    }, [user, loading, tokenProcessed, navigate]);

    const handlePhoneSubmit = async (e) => {
        e.preventDefault();
        if (!phone) {
            setError('Please enter a phone number.');
            return;
        }
        setSubmitLoading(true);
        setError('');
        try {
            await authApi.updatePhone(phone);
            navigate('/dashboard', { replace: true });
        } catch (err) {
            console.error('Failed to update phone:', err);
            setError('Failed to update phone number. Please try again.');
            setSubmitLoading(false);
        }
    };

    // Show phone collection form
    if (needsPhone) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-gray-900 text-white">
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 max-w-md w-full mx-4">
                    <h2 className="text-2xl font-bold mb-2 text-center">Almost there!</h2>
                    <p className="text-gray-400 text-center mb-6">
                        Please provide your phone number to complete registration.
                    </p>
                    <form onSubmit={handlePhoneSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-1">
                                Phone Number
                            </label>
                            <input
                                type="tel"
                                id="phone"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="+1 (555) 000-0000"
                                className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                autoFocus
                            />
                        </div>
                        {error && (
                            <p className="text-red-400 text-sm">{error}</p>
                        )}
                        <button
                            type="submit"
                            disabled={submitLoading}
                            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            {submitLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                'Continue to Dashboard'
                            )}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // Loading state
    return (
        <div className="h-screen w-full flex items-center justify-center bg-gray-900 text-white">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <p>Authenticating...</p>
            </div>
        </div>
    );
};

export default AuthCallback;
