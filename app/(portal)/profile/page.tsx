'use client';

import { useState, useTransition } from 'react';
import { usePatientProfile } from '@/hooks/usePatientProfile';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
    const { profile, loading, error: profileError, mutate } = usePatientProfile();
    const [isPending, startTransition] = useTransition();
    const [status, setStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
    const [fieldErrors, setFieldErrors] = useState<{ firstName?: string; lastName?: string; mobile?: string }>({});
    const router = useRouter();

    async function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setStatus(null);
        setFieldErrors({});

        const formData = new FormData(e.currentTarget);
        const data = {
            firstName: (formData.get('firstName') as string || '').trim(),
            lastName: (formData.get('lastName') as string || '').trim(),
            mobile: (formData.get('mobile') as string || '').trim(),
        };

        let hasError = false;
        const newFieldErrors: typeof fieldErrors = {};

        if (!data.firstName) {
            newFieldErrors.firstName = 'First name is required';
            hasError = true;
        }

        if (!data.lastName) {
            newFieldErrors.lastName = 'Last name is required';
            hasError = true;
        }

        if (!data.mobile) {
            newFieldErrors.mobile = 'Mobile number is required';
            hasError = true;
        }

        if (hasError) {
            setFieldErrors(newFieldErrors);
            return;
        }
        
        startTransition(async () => {
            try {
                const res = await fetch('/api/patient/me', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });
                const json = await res.json();
                if (!res.ok) {
                    const errorMsgs = Array.isArray(json.message)
                        ? json.message
                        : (json.error?.message
                            ? (Array.isArray(json.error.message) ? json.error.message : [json.error.message])
                            : [json.message || 'Failed to update profile']);
                    const backendFieldErrors: typeof fieldErrors = {};
                    let genericError: string | null = null;

                    errorMsgs.forEach((msg: string) => {
                        const lowercaseMsg = msg.toLowerCase();
                        if (lowercaseMsg.includes('first')) {
                            backendFieldErrors.firstName = msg;
                        } else if (lowercaseMsg.includes('last')) {
                            backendFieldErrors.lastName = msg;
                        } else if (lowercaseMsg.includes('mobile') || lowercaseMsg.includes('phone')) {
                            backendFieldErrors.mobile = msg;
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
                    setStatus({ type: 'success', message: 'Profile updated successfully' });
                    mutate(data);
                }
            } catch (err: any) {
                setStatus({ type: 'error', message: 'Failed to update profile' });
            }
        });
    }

    async function handleNotificationToggle(key: string, checked: boolean) {
        startTransition(async () => {
            try {
                const res = await fetch('/api/patient/notification-preferences', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ [key]: checked }),
                });
                const json = await res.json();
                if (!res.ok) {
                    setStatus({ type: 'error', message: json.error?.message || json.message || 'Failed to update preferences' });
                } else {
                    mutate({
                        notificationPrefs: {
                            ...(profile?.notificationPrefs || {}),
                            [key]: checked
                        }
                    });
                }
            } catch (err: any) {
                setStatus({ type: 'error', message: 'Failed to update preferences' });
            }
        });
    }

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Loading profile...</div>;
    }

    if (profileError || !profile) {
        return <div className="p-8 text-center text-red-500">{profileError || 'Failed to load profile data.'}</div>;
    }

    return (
        <div className="space-y-6 max-w-2xl mx-auto pb-20 sm:pb-0">
            <div>
                <h1 className="text-2xl font-bold tracking-tight mb-2">Your Profile</h1>
                <p className="text-muted-foreground">Manage your personal information and preferences.</p>
            </div>

            {status && (
                <div className={`p-4 rounded-md text-sm border ${
                    status.type === 'success' 
                    ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' 
                    : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
                }`}>
                    {status.message}
                </div>
            )}

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Personal Information</h2>
                </div>
                
                <form onSubmit={handleProfileSubmit} className="p-6 space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">First Name</label>
                            <input 
                                name="firstName" 
                                type="text" 
                                defaultValue={profile.firstName}
                                className={`w-full h-11 px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white ${
                                    fieldErrors.firstName 
                                        ? 'border-red-300 focus:ring-red-500' 
                                        : 'border-gray-300 dark:border-gray-600'
                                }`}
                            />
                            {fieldErrors.firstName && (
                                <p className="text-xs text-red-600 dark:text-red-450 mt-1" role="alert">
                                    {fieldErrors.firstName}
                                </p>
                            )}
                        </div>
                        
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Last Name</label>
                            <input 
                                name="lastName" 
                                type="text" 
                                defaultValue={profile.lastName}
                                className={`w-full h-11 px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white ${
                                    fieldErrors.lastName 
                                        ? 'border-red-300 focus:ring-red-500' 
                                        : 'border-gray-300 dark:border-gray-600'
                                }`}
                            />
                            {fieldErrors.lastName && (
                                <p className="text-xs text-red-600 dark:text-red-450 mt-1" role="alert">
                                    {fieldErrors.lastName}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Email Address (Cannot be changed)</label>
                        <input 
                            type="email" 
                            defaultValue={profile.email}
                            disabled
                            className="w-full h-11 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 cursor-not-allowed"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Mobile Number</label>
                        <input 
                            name="mobile" 
                            type="tel" 
                            defaultValue={profile.mobile || ''}
                            className={`w-full h-11 px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white ${
                                    fieldErrors.mobile 
                                        ? 'border-red-300 focus:ring-red-500' 
                                        : 'border-gray-300 dark:border-gray-600'
                                }`}
                        />
                        {fieldErrors.mobile && (
                            <p className="text-xs text-red-600 dark:text-red-450 mt-1" role="alert">
                                {fieldErrors.mobile}
                            </p>
                        )}
                    </div>

                    <div className="pt-4">
                        <button 
                            type="submit" 
                            disabled={isPending}
                            className="w-full sm:w-auto h-11 inline-flex justify-center items-center py-2 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                        >
                            {isPending ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Notification Preferences</h2>
                </div>
                
                <div className="p-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-gray-900 dark:text-white">Assessment Reminders</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Receive an email when it's time to check your knee.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="sr-only peer"
                                checked={profile.notificationPrefs?.assessmentReminders !== false}
                                onChange={(e) => handleNotificationToggle('assessmentReminders', e.target.checked)}
                                disabled={isPending}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                    
                    <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-6">
                        <div>
                            <p className="font-medium text-gray-900 dark:text-white">Email Notifications</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Receive general updates and clinic messages via email.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="sr-only peer"
                                checked={profile.notificationPrefs?.emailNotifications !== false}
                                onChange={(e) => handleNotificationToggle('emailNotifications', e.target.checked)}
                                disabled={isPending}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                    
                    <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-6">
                        <div>
                            <p className="font-medium text-gray-900 dark:text-white">SMS Notifications</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Receive text messages for urgent updates.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="sr-only peer"
                                checked={profile.notificationPrefs?.smsNotifications !== false}
                                onChange={(e) => handleNotificationToggle('smsNotifications', e.target.checked)}
                                disabled={isPending}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Account Management</h2>
                </div>
                <div className="p-6 flex flex-col sm:flex-row gap-4">
                    <Link 
                        href="/change-password"
                        className="inline-flex w-full sm:w-auto justify-center items-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                    >
                        Change Password
                    </Link>
                    
                    <form 
                        onSubmit={async (e) => {
                            e.preventDefault();
                            try {
                                await fetch('/api/auth/logout', { method: 'POST' });
                            } catch (err) {
                                // ignore
                            }
                            router.push('/login');
                        }} 
                        className="w-full sm:w-auto"
                    >
                        <button 
                            type="submit"
                            className="inline-flex w-full sm:w-auto justify-center items-center py-2 px-4 border border-red-300 dark:border-red-800/50 rounded-md shadow-sm text-sm font-medium text-red-700 dark:text-red-400 bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                        >
                            Sign Out
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
