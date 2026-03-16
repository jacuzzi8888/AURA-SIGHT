import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        // Progress state handled via loading state

        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                // Ensure this matches your Vercel deployment URL eventually
                emailRedirectTo: window.location.origin,
            },
        });

        if (error) {
            setMessage(`Error: ${error.message}`);
        } else {
            setMessage('Check your email for the login link!');
        }
        setLoading(false);
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        setMessage('');

        // Redirecting to Google OAuth

        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
            },
        });

        if (error) {
            setMessage(`Google login error: ${error.message}`);
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-aura-dark px-6 py-12">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center">
                    <h1 className="text-5xl font-extrabold text-white tracking-tight mb-4">Aura Sight</h1>
                    <p className="text-xl text-slate-400">Your AI visual companion</p>
                </div>

                <form onSubmit={handleLogin} className="mt-12 space-y-6">
                    <div>
                        <label htmlFor="email" className="sr-only">Email address</label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="appearance-none rounded-2xl relative block w-full px-6 py-6 border border-white/10 bg-white/5 placeholder-slate-500 text-white text-2xl focus:outline-none focus:ring-2 focus:ring-aura-cyan focus:border-transparent transition-all"
                            placeholder="Email address"
                            aria-label="Enter your email address to receive a login link"
                        />
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className={`group relative w-full flex justify-center py-6 px-4 border border-transparent text-2xl font-bold rounded-2xl text-aura-dark bg-white hover:bg-slate-200 focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-aura-cyan transition-all transform active:scale-95 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                            aria-label={loading ? "Sending link" : "Send magic link"}
                        >
                            {loading ? 'Sending...' : 'Send Magic Link'}
                        </button>
                    </div>
                </form>

                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-white/20"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-4 bg-aura-dark text-slate-400 font-bold tracking-widest uppercase">Or</span>
                    </div>
                </div>

                <div className="mt-6">
                    <button
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className={`w-full flex items-center justify-center py-6 px-4 border-2 border-white/20 text-2xl font-bold rounded-2xl text-white bg-transparent hover:bg-white/10 hover:border-white focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-aura-cyan transition-all transform active:scale-95 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                        aria-label="Contine with Google"
                    >
                        <svg className="w-8 h-8 mr-4" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            <path fill="none" d="M1 1h22v22H1z" />
                        </svg>
                        Continue with Google
                    </button>
                </div>

                {message && (
                    <div 
                        className="mt-6 text-center text-xl font-medium text-aura-cyan p-4 bg-white/5 rounded-xl border border-white/10"
                        role="alert"
                        aria-live="polite"
                    >
                        {message}
                    </div>
                )}
            </div>
        </div>
    );
};
