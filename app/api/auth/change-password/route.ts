import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const cookieStore = await cookies();
        const token = cookieStore.get('jwt')?.value;

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_URL}/patient-auth/change-password`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error: any) {
        console.error('Patient change password route error:', error);
        return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 });
    }
}
