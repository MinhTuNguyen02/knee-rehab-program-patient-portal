'use client';

import { useState, useTransition } from 'react';
import { validatePassword } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export default function ChangePasswordPage() {
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<{ currentPassword?: string; newPassword?: string; confirmPassword?: string }>({});
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);
        setFieldErrors({});

        const formData = new FormData(e.currentTarget);
        const currentPassword = formData.get('currentPassword') as string | null;
        const newPassword = formData.get('newPassword') as string;
        const confirmPassword = formData.get('confirmPassword') as string;
        
        let hasError = false;
        const newFieldErrors: typeof fieldErrors = {};

        const passwordVal = validatePassword(newPassword);
        if (!passwordVal.isValid) {
            newFieldErrors.newPassword = passwordVal.error;
            hasError = true;
        }

        if (newPassword !== confirmPassword) {
            newFieldErrors.confirmPassword = 'New passwords do not match';
            hasError = true;
        }

        if (hasError) {
            setFieldErrors(newFieldErrors);
            return;
        }

        const body: Record<string, string> = { newPassword };
        if (currentPassword) {
            body.currentPassword = currentPassword;
        }

        startTransition(async () => {
            try {
                const res = await fetch('/api/auth/change-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) {
                    const errorMsgs = Array.isArray(data.message)
                        ? data.message
                        : (data.error?.message ? [data.error.message] : [data.message || 'Failed to change password']);
                    const backendFieldErrors: typeof fieldErrors = {};
                    let genericError: string | null = null;

                    errorMsgs.forEach((msg: string) => {
                        const lowercaseMsg = msg.toLowerCase();
                        if (lowercaseMsg.includes('current password') || lowercaseMsg.includes('incorrect current')) {
                            backendFieldErrors.currentPassword = msg;
                        } else if (lowercaseMsg.includes('new password') || lowercaseMsg.includes('password')) {
                            backendFieldErrors.newPassword = msg;
                        } else {
                            genericError = msg;
                        }
                    });

                    if (Object.keys(backendFieldErrors).length > 0) {
                        setFieldErrors(backendFieldErrors);
                    }
                    if (genericError) {
                        setError(genericError);
                    }
                } else {
                    router.push('/dashboard');
                }
            } catch (err: any) {
                setError('Failed to connect to the server');
            }
        });
    }

    return (
        <div className="flex min-h-screen items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
            <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-8">
                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Change Password</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Please update your password to continue
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="p-3 text-sm text-red-655 bg-red-50 dark:bg-red-950/30 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900/50">
                                {error}
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Password (optional if resetting)</label>
                            <input 
                                name="currentPassword" 
                                type="password" 
                                className={`w-full h-11 px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white ${
                                    fieldErrors.currentPassword 
                                        ? 'border-red-300 focus:ring-red-500' 
                                        : 'border-gray-300 dark:border-gray-600'
                                }`}
                                placeholder="••••••••"
                            />
                            {fieldErrors.currentPassword && (
                                <p className="text-xs text-red-600 dark:text-red-450 mt-1" role="alert">
                                    {fieldErrors.currentPassword}
                                </p>
                            )}
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">New Password</label>
                            <input 
                                name="newPassword" 
                                type="password" 
                                className={`w-full h-11 px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white ${
                                    fieldErrors.newPassword 
                                        ? 'border-red-300 focus:ring-red-500' 
                                        : 'border-gray-300 dark:border-gray-600'
                                }`}
                                placeholder="••••••••"
                            />
                            {fieldErrors.newPassword && (
                                <p className="text-xs text-red-600 dark:text-red-450 mt-1" role="alert">
                                    {fieldErrors.newPassword}
                                </p>
                            )}
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Minimum 8 characters, at least 1 uppercase letter and 1 number.
                            </p>
                        </div>
                        
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Confirm New Password</label>
                            <input 
                                name="confirmPassword" 
                                type="password" 
                                className={`w-full h-11 px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white ${
                                    fieldErrors.confirmPassword 
                                        ? 'border-red-300 focus:ring-red-500' 
                                        : 'border-gray-300 dark:border-gray-600'
                                }`}
                                placeholder="••••••••"
                            />
                            {fieldErrors.confirmPassword && (
                                <p className="text-xs text-red-600 dark:text-red-450 mt-1" role="alert">
                                    {fieldErrors.confirmPassword}
                                </p>
                            )}
                        </div>

                        <button 
                            type="submit" 
                            disabled={isPending}
                            className="w-full h-11 flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isPending ? 'Updating...' : 'Update Password'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
