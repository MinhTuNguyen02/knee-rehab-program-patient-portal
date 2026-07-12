'use client';

import { useState, useTransition, use } from 'react';
import { validatePassword } from '@/lib/utils';
import Link from 'next/link';
import { Lock, AlertCircle, ArrowLeft, Eye, EyeOff } from 'lucide-react';

export default function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
    const params = use(searchParams);
    const token = params.token;
    
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    
    const [status, setStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
    const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmPassword?: string }>({});
    const [isPending, startTransition] = useTransition();

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setStatus(null);
        setFieldErrors({});

        if (!token) {
            setStatus({ type: 'error', message: 'Missing reset token' });
            return;
        }

        let hasError = false;
        const newFieldErrors: typeof fieldErrors = {};

        const passwordVal = validatePassword(password);
        if (!passwordVal.isValid) {
            newFieldErrors.password = passwordVal.error;
            hasError = true;
        }

        if (password !== confirmPassword) {
            newFieldErrors.confirmPassword = 'Passwords do not match.';
            hasError = true;
        }

        if (hasError) {
            setFieldErrors(newFieldErrors);
            return;
        }

        startTransition(async () => {
            try {
                const res = await fetch('/api/auth/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, newPassword: password }),
                });
                const data = await res.json();
                if (!res.ok) {
                    const errorMsgs = Array.isArray(data.message)
                        ? data.message
                        : (data.error?.message ? [data.error.message] : [data.message || 'Failed to reset password']);
                    const backendFieldErrors: typeof fieldErrors = {};
                    let genericError: string | null = null;

                    errorMsgs.forEach((msg: string) => {
                        const lowercaseMsg = msg.toLowerCase();
                        if (lowercaseMsg.includes('password')) {
                            backendFieldErrors.password = msg;
                        } else {
                            genericError = msg;
                        }
                    });

                    if (Object.keys(backendFieldErrors).length > 0) {
                        setFieldErrors(backendFieldErrors);
                    }
                    if (genericError) {
                        setStatus({ type: 'error', message: genericError });
                    }
                } else {
                    const msg = data.data?.message || data.message || 'Password reset successfully';
                    setStatus({ type: 'success', message: msg });
                }
            } catch (err: any) {
                setStatus({ type: 'error', message: 'Failed to connect to the server' });
            }
        });
    }

    if (!token) {
        return (
            <div className="flex min-h-[100dvh] items-center justify-center p-4 bg-background">
                <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800 text-center">
                    <h1 className="text-2xl font-semibold tracking-tight text-red-600 dark:text-red-400">
                        Invalid Request
                    </h1>
                    <p className="text-sm text-slate-655 dark:text-slate-400">
                        The password reset link is invalid or has expired.
                    </p>
                    <div className="pt-2">
                        <Link
                            href="/forgot-password"
                            className="flex items-center justify-center gap-2 text-sm font-medium text-primary hover:text-primary-hover transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Request a new link
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-[100dvh] items-center justify-center p-4 bg-background">
            <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                <div className="text-center">
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                        Reset Password
                    </h1>
                    <p className="mt-2 text-sm text-slate-655 dark:text-slate-400">
                        Please enter your new password below.
                    </p>
                </div>

                {status?.type === 'success' ? (
                    <div className="flex flex-col items-center justify-center space-y-6 pt-4">
                        <div className="w-full p-4 text-sm text-green-755 bg-green-50 dark:bg-green-950/30 dark:text-green-400 rounded-xl border border-green-200 dark:border-green-900/50 text-center">
                            {status.message}
                        </div>
                        <Link 
                            href="/login" 
                            className="flex w-full justify-center rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors active:scale-[0.98]"
                        >
                            Sign In Now
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {status?.type === 'error' && (
                            <div className="p-3 text-sm text-red-655 bg-red-50 dark:bg-red-950/30 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900/50">
                                {status.message}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="newPassword">
                                    New Password
                                </label>
                                <div className="relative">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                                        <Lock className="w-4.5 h-4.5" />
                                    </div>
                                    <input 
                                        id="newPassword"
                                        name="newPassword" 
                                        type={showPassword ? 'text' : 'password'}
                                        required 
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className={`block w-full rounded-lg border-0 py-2.5 pl-10 pr-10 text-slate-900 ring-1 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-primary dark:bg-slate-800 dark:text-white sm:text-sm sm:leading-6 ${
                                            fieldErrors.password 
                                                ? 'ring-red-300 focus:ring-red-500 dark:ring-red-900/50' 
                                                : 'ring-slate-300 focus:ring-primary dark:ring-slate-700'
                                        }`}
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-655 dark:hover:text-slate-300"
                                        tabIndex={-1}
                                    >
                                        {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                                    </button>
                                </div>
                                {fieldErrors.password && (
                                    <p className="text-xs text-red-600 dark:text-red-450 mt-1" role="alert">
                                        {fieldErrors.password}
                                    </p>
                                )}
                                <p className="text-xs text-gray-405 dark:text-gray-500 mt-1.5 flex items-start gap-1">
                                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                    <span>Minimum 8 characters, at least 1 uppercase letter and 1 number.</span>
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="confirmPassword">
                                    Confirm New Password
                                </label>
                                <div className="relative">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                                        <Lock className="w-4.5 h-4.5" />
                                    </div>
                                    <input 
                                        id="confirmPassword"
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        required 
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className={`block w-full rounded-lg border-0 py-2.5 pl-10 pr-10 text-slate-900 ring-1 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-primary dark:bg-slate-800 dark:text-white sm:text-sm sm:leading-6 ${
                                            fieldErrors.confirmPassword 
                                                ? 'ring-red-300 focus:ring-red-500 dark:ring-red-900/50' 
                                                : 'ring-slate-300 focus:ring-primary dark:ring-slate-700'
                                        }`}
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-655 dark:hover:text-slate-300"
                                        tabIndex={-1}
                                    >
                                        {showConfirmPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                                    </button>
                                </div>
                                {fieldErrors.confirmPassword && (
                                    <p className="text-xs text-red-600 dark:text-red-450 mt-1" role="alert">
                                        {fieldErrors.confirmPassword}
                                    </p>
                                )}
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={isPending}
                            className="flex w-full justify-center rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-70 disabled:cursor-not-allowed transition-colors active:scale-[0.98]"
                        >
                            {isPending ? 'Resetting...' : 'Reset Password'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
