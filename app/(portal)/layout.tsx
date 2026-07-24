import Link from 'next/link';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Header from '@/components/layout/Header';
import MobileBottomNav from '@/components/layout/MobileBottomNav';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

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
    } catch (e) { }

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

            <Header initialPatient={patient} />

            <main className="container mx-auto px-4 py-8">
                {children}
            </main>

            <MobileBottomNav />
        </div>
    );
}