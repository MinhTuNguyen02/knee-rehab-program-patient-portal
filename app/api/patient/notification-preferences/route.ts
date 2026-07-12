import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const cookieStore = await cookies();
        const token = cookieStore.get('jwt')?.value;

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(`${API_URL}/patient/notification-preferences`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(body),
        });

        if (res.status === 401) {
            cookieStore.delete('jwt');
            return NextResponse.json({ error: { message: 'Session expired' } }, { status: 401 });
        }

        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (error: any) {
        console.error('Patient notification preferences route error:', error);
        return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 });
    }
}
