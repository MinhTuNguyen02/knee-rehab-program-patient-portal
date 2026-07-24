'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { usePatientProfile } from '@/hooks/usePatientProfile';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import 'react-phone-number-input/style.css';
import toast from 'react-hot-toast';
import { ArrowLeft, LogOut } from 'lucide-react';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
// import dynamic from 'next/dynamic';
// import { isValidPhoneNumber } from 'react-phone-number-input/min';

// const PhoneInput = dynamic(() => import('react-phone-number-input'), {
//     ssr: false,
//     loading: () => <div className="h-11 w-full bg-gray-100 dark:bg-gray-800 animate-pulse rounded-xl" />
// });

export default function ProfilePage() {
    const { profile, loading, error: profileError, mutate } = usePatientProfile();
    const [isPending, startTransition] = useTransition();
    const [isEdit, setIsEdit] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<{ firstName?: string; lastName?: string; mobile?: string }>({});
    const router = useRouter();
    const formRef = useRef<HTMLFormElement>(null);

    const { register, handleSubmit, control, reset, formState: { errors: hookErrors } } = useForm({
        defaultValues: {
            firstName: '',
            lastName: '',
            mobile: '',
        }
    });

    useEffect(() => {
        if (profile) {
            reset({
                firstName: profile.firstName || '',
                lastName: profile.lastName || '',
                mobile: profile.mobile || '',
            });
        }
    }, [profile, reset]);

    const getFieldError = (fieldName: 'firstName' | 'lastName' | 'mobile') => {
        return hookErrors[fieldName]?.message || fieldErrors[fieldName];
    };

    const getKneeSideLabel = (side?: string) => {
        if (!side) return '';
        const s = side.toUpperCase();
        if (s === 'R') return 'Right';
        if (s === 'L') return 'Left';
        if (s === 'B') return 'Both';
        return side;
    };

    const inputBaseClass = (fieldName: 'firstName' | 'lastName' | 'mobile') => {
        const hasError = !!getFieldError(fieldName);
        const errorClasses = hasError
            ? 'border-red-300 focus:ring-red-500 dark:border-red-900/50'
            : 'border-gray-300 dark:border-gray-600 focus:ring-primary focus:border-primary';
        const stateClasses = isEdit
            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
            : 'bg-gray-55 dark:bg-gray-800/60 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-800/80 cursor-not-allowed';
        return `w-full h-11 px-3 py-2 border rounded-xl shadow-sm focus:outline-none focus:ring-2 transition-all ${errorClasses} ${stateClasses}`;
    };

    async function handleProfileSubmit(data: { firstName: string; lastName: string; mobile: string }) {
        setFieldErrors({});

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
                        toast.error(genericError);
                    } else {
                        toast.error('Please correct the validation errors.');
                    }
                } else {
                    toast.success('Profile updated successfully');
                    mutate(data);
                    setIsEdit(false);
                }
            } catch (err: any) {
                toast.error('Failed to update profile');
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
                    toast.error(json.error?.message || json.message || 'Failed to update preferences');
                } else {
                    toast.success('Notification preference updated');
                    mutate({
                        notificationPrefs: {
                            ...(profile?.notificationPrefs || {}),
                            [key]: checked
                        }
                    });
                }
            } catch (err: any) {
                toast.error('Failed to update preferences');
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
            <div className="space-y-4">
                <Link
                    href="/dashboard"
                    className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Dashboard
                </Link>
                <h1 className="text-2xl font-bold tracking-tight mb-2">Your Profile</h1>
                <p className="text-muted-foreground">Manage your personal information and preferences.</p>
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Personal Information</h2>
                </div>

                <form ref={formRef} onSubmit={handleSubmit(handleProfileSubmit)} className="p-6 space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">First Name</label>
                            <input
                                {...register('firstName', { required: 'First name is required' })}
                                type="text"
                                disabled={!isEdit}
                                className={inputBaseClass('firstName')}
                            />
                            {getFieldError('firstName') && (
                                <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-semibold" role="alert">
                                    {getFieldError('firstName')}
                                </p>
                            )}
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Last Name</label>
                            <input
                                {...register('lastName', { required: 'Last name is required' })}
                                type="text"
                                disabled={!isEdit}
                                className={inputBaseClass('lastName')}
                            />
                            {getFieldError('lastName') && (
                                <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-semibold" role="alert">
                                    {getFieldError('lastName')}
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
                            className="w-full h-11 px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-800/60 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Mobile Number</label>
                        <Controller
                            name="mobile"
                            control={control}
                            rules={{
                                required: 'Please enter your mobile phone number',
                                validate: (value) =>
                                    !value || isValidPhoneNumber(value) || 'Please enter a valid phone number',
                            }}
                            render={({ field: { onChange, value } }) => (
                                <PhoneInput
                                    international
                                    defaultCountry="AU"
                                    placeholder="Enter phone number"
                                    disabled={!isEdit}
                                    value={value}
                                    onChange={(val) => onChange(val || '')}
                                    id="mobile"
                                    className={`${inputBaseClass('mobile')} phone-input-custom`}
                                />
                            )}
                        />
                        {getFieldError('mobile') && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-semibold" role="alert">
                                {getFieldError('mobile')}
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Age</label>
                            <input
                                type="number"
                                defaultValue={profile.age}
                                disabled
                                className="w-full h-11 px-3 py-2 border border-gray-250 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-800/60 text-gray-400 dark:text-gray-505 cursor-not-allowed"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Gender</label>
                            <input
                                type="text"
                                defaultValue={profile.gender}
                                disabled
                                className="w-full h-11 px-3 py-2 border border-gray-250 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-800/60 text-gray-400 dark:text-gray-550 cursor-not-allowed"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Knee Side</label>
                            <input
                                type="text"
                                defaultValue={getKneeSideLabel(profile.kneeSide)}
                                disabled
                                className="w-full h-11 px-3 py-2 border border-gray-250 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-800/60 text-gray-400 dark:text-gray-550 cursor-not-allowed"
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-4">
                        {!isEdit ? (
                            <button
                                key="edit-btn"
                                type="button"
                                onClick={() => {
                                    setIsEdit(true);
                                    setFieldErrors({});
                                }}
                                className="w-full sm:w-auto h-11 inline-flex justify-center items-center py-2 px-6 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary active:scale-[0.98] transition-all"
                            >
                                Edit Profile
                            </button>
                        ) : (
                            <>
                                <button
                                    key="save-btn"
                                    type="submit"
                                    disabled={isPending}
                                    className="w-full sm:w-auto h-11 inline-flex justify-center items-center py-2 px-6 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
                                >
                                    {isPending ? 'Saving...' : 'Save Changes'}
                                </button>
                                <button
                                    key="cancel-btn"
                                    type="button"
                                    onClick={() => {
                                        setIsEdit(false);
                                        setFieldErrors({});
                                        reset({
                                            firstName: profile.firstName || '',
                                            lastName: profile.lastName || '',
                                            mobile: profile.mobile || '',
                                        });
                                    }}
                                    className="w-full sm:w-auto h-11 inline-flex justify-center items-center py-2 px-6 border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm text-sm font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-55 dark:hover:bg-gray-750 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary active:scale-[0.98] transition-all"
                                >
                                    Cancel
                                </button>
                            </>
                        )}
                    </div>
                </form>
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Notification Preferences</h2>
                </div>

                <div className="p-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="mr-6">
                            <p className="font-medium text-gray-900 dark:text-white">Reassessment Reminders</p>
                            <p className="text-sm text-gray-550 dark:text-gray-400">Receive an email when it's time to check your knee (14 and 30 days).</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={profile.notificationPrefs?.reassessReminder !== false}
                                onChange={(e) => handleNotificationToggle('reassessReminder', e.target.checked)}
                                disabled={isPending}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 dark:peer-focus:ring-primary/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-6">
                        <div className="mr-6">
                            <p className="font-medium text-gray-900 dark:text-white">Educational Guidance</p>
                            <p className="text-sm text-gray-550 dark:text-gray-400">Receive helpful articles and exercises for your knee.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={profile.notificationPrefs?.kneeGuidance !== false}
                                onChange={(e) => handleNotificationToggle('kneeGuidance', e.target.checked)}
                                disabled={isPending}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 dark:peer-focus:ring-primary/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-6">
                        <div className="mr-6">
                            <p className="font-medium text-gray-900 dark:text-white">Follow-up Contact</p>
                            <p className="text-sm text-gray-550 dark:text-gray-400">Allow our clinic to contact you regarding your assessment.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={profile.notificationPrefs?.followUpKRP !== false}
                                onChange={(e) => handleNotificationToggle('followUpKRP', e.target.checked)}
                                disabled={isPending}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 dark:peer-focus:ring-primary/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
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
                        className="inline-flex w-full sm:w-auto justify-center items-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm text-sm font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-55 dark:hover:bg-gray-750 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
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
                            window.location.href = '/login';
                        }}
                        className="w-full sm:w-auto"
                    >
                        <button
                            type="submit"
                            disabled={isPending}
                            className="inline-flex gap-2 w-full sm:w-auto justify-center items-center py-2 px-4 border border-red-300 dark:border-red-800/50 rounded-md shadow-sm text-sm font-medium text-red-700 dark:text-red-400 bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            <span>Logout</span>

                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
