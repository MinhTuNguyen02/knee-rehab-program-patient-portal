import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const response = await fetch(`${API_URL}/patient-auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(data, { status: response.status });
        }

        const token = data.data?.accessToken;
        if (!token) {
            return NextResponse.json({ error: { message: 'Token not found in response' } }, { status: 500 });
        }

        const cookieStore = await cookies();
        cookieStore.set('jwt', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60, // 7 days
            path: '/',
        });

        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Patient login route error:', error);
        return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 });
    }
}
