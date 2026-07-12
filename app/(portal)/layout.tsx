import Link from 'next/link';
import { Bell } from 'lucide-react';
import UserMenu from '@/components/layout/UserMenu';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function getPatientProfile() {
    const cookieStore = await cookies();
    const token = cookieStore.get('jwt')?.value;
    if (!token) {
        redirect('/login');
    }

    const reqHeaders = new Headers();
    reqHeaders.set('Authorization', `Bearer ${token}`);

    try {
        const headerStore = await headers();
        const forwardedFor = headerStore.get('x-forwarded-for');
        const realIp = headerStore.get('x-real-ip');
        if (forwardedFor) reqHeaders.set('x-forwarded-for', forwardedFor);
        if (realIp) reqHeaders.set('x-real-ip', realIp);
    } catch (e) {}

    const res = await fetch(`${API_URL}/patient/me`, {
        headers: reqHeaders,
    });

    if (res.status === 401) {
        cookieStore.delete('jwt');
        redirect('/login?reason=expired');
    }

    if (!res.ok) {
        return null;
    }

    const data = await res.json();
    return data.data || data;
}

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
    const patient = await getPatientProfile();

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-400 ease-in-out var-zone-bg">
            <header className="sticky top-0 z-40 w-full border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/dashboard" className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center font-bold shadow-sm active:scale-95 transition-transform">
                                K
                            </div>
                            <span className="font-bold text-lg tracking-tight hidden sm:inline-block text-primary">KRPS</span>
                        </Link>
                        {patient && (
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 animate-fade-in">
                                Hi, {patient.firstName}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-4">
                        <Link href="/chat" className="relative p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">
                            <span className="sr-only">Notifications</span>
                            <Bell className="w-5.5 h-5.5" />
                            {/* Unread badge placeholder */}
                            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm">
                                99
                            </span>
                        </Link>

                        <div className="flex items-center gap-3 pl-4 border-l border-gray-200 dark:border-gray-800">
                            {patient ? (
                                <UserMenu firstName={patient.firstName} lastName={patient.lastName} email={patient.email} />
                            ) : (
                                <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8">
                {children}
            </main>

            {/* Simple Mobile Bottom Nav */}
            <div className="sm:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex justify-around items-center z-40 pb-safe">
                <Link href="/dashboard" className="p-2 text-sm font-medium flex flex-col items-center gap-1 text-gray-600 hover:text-primary">
                    Dashboard
                </Link>
                <Link href="/history" className="p-2 text-sm font-medium flex flex-col items-center gap-1 text-gray-600 hover:text-primary">
                    History
                </Link>
                <Link href="/chat" className="p-2 text-sm font-medium flex flex-col items-center gap-1 text-gray-600 hover:text-primary">
                    Chat
                </Link>
                <Link href="/profile" className="p-2 text-sm font-medium flex flex-col items-center gap-1 text-gray-600 hover:text-primary">
                    Profile
                </Link>
            </div>
        </div>
    );
}
