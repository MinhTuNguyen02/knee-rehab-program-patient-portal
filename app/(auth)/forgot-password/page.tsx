'use client';

import { useState, useTransition } from 'react';
import { validateEmail } from '@/lib/utils';
import Link from 'next/link';
import { Mail, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
    const [status, setStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
    const [emailError, setEmailError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setStatus(null);
        setEmailError(null);

        const formData = new FormData(e.currentTarget);
        const email = formData.get('email') as string;

        if (!email) {
            setEmailError('Email address is required.');
            return;
        } else if (!validateEmail(email)) {
            setEmailError('Please enter a valid email address.');
            return;
        }

        startTransition(async () => {
            try {
                const res = await fetch('/api/auth/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email }),
                });
                const data = await res.json();
                if (!res.ok) {
                    const errorMsgs = Array.isArray(data.message)
                        ? data.message
                        : (data.error?.message ? [data.error.message] : [data.message || 'Failed to process request']);
                    let fieldErr: string | null = null;
                    let genericErr: string | null = null;

                    errorMsgs.forEach((msg: string) => {
                        if (msg.toLowerCase().includes('email')) {
                            fieldErr = msg;
                        } else {
                            genericErr = msg;
                        }
                    });

                    if (fieldErr) {
                        setEmailError(fieldErr);
                    } else if (genericErr) {
                        setStatus({ type: 'error', message: genericErr });
                    }
                } else {
                    const msg = data.data?.message || data.message || 'Check your email for a reset link';
                    setStatus({ type: 'success', message: msg });
                }
            } catch (err: any) {
                setStatus({ type: 'error', message: 'Failed to connect to the server' });
            }
        });
    }

    return (
        <div className="flex min-h-[100dvh] items-center justify-center p-4 bg-background">
            <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                <div className="text-center">
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                        Forgot Password
                    </h1>
                    <p className="mt-2 text-sm text-slate-655 dark:text-slate-400">
                        {status?.type === 'success'
                            ? "We've sent a password reset link to your email."
                            : 'Enter your email address to receive a reset link.'}
                    </p>
                </div>

                {status?.type === 'success' ? (
                    <div className="flex flex-col items-center justify-center space-y-6 pt-4">
                        <div className="w-full p-4 text-sm text-green-755 bg-green-50 dark:bg-green-950/30 dark:text-green-400 rounded-xl border border-green-200 dark:border-green-900/50 text-center">
                            {status.message}
                        </div>
                        <Link
                            href="/login"
                            className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-hover dark:text-primary dark:hover:text-primary-hover transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Return to Login
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {status?.type === 'error' && (
                            <div className="p-3 text-sm text-red-655 bg-red-50 dark:bg-red-950/30 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900/50">
                                {status.message}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="email">
                                Email Address
                            </label>
                            <div className="relative">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                                    <Mail className="w-4.5 h-4.5" />
                                </div>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    className={`block w-full rounded-lg border-0 py-2.5 pl-10 pr-3 text-slate-900 ring-1 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-primary dark:bg-slate-800 dark:text-white sm:text-sm sm:leading-6 ${
                                        emailError 
                                            ? 'ring-red-300 focus:ring-red-500 dark:ring-red-900/50' 
                                            : 'ring-slate-300 focus:ring-primary dark:ring-slate-700'
                                    }`}
                                    placeholder="you@example.com"
                                />
                            </div>
                            {emailError && (
                                <p className="text-xs text-red-600 dark:text-red-450 mt-1" role="alert">
                                    {emailError}
                                </p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={isPending}
                            className="flex w-full justify-center rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-70 disabled:cursor-not-allowed transition-colors active:scale-[0.98]"
                        >
                            {isPending ? 'Sending...' : 'Send Reset Link'}
                        </button>

                        <div className="flex justify-center pt-2">
                            <Link
                                href="/login"
                                className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Back to login
                            </Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
