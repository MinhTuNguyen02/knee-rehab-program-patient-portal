import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function fetchFromBE(url: string, method: string, body?: any) {
    const cookieStore = await cookies();
    const token = cookieStore.get('jwt')?.value;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_URL}${url}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401) {
        cookieStore.delete('jwt');
        return { status: 401, error: { message: 'Session expired' } };
    }

    if (res.status === 204) {
        return { status: 204, data: {} };
    }

    try {
        const data = await res.json();
        return { status: res.status, data };
    } catch (e) {
        return { status: 500, error: { message: 'Invalid JSON response from server' } };
    }
}

export async function GET() {
    const { status, data, error } = await fetchFromBE('/patient/me', 'GET');
    if (error) {
        return NextResponse.json({ error }, { status });
    }
    return NextResponse.json(data, { status });
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { status, data, error } = await fetchFromBE('/patient/me', 'PATCH', body);
        if (error) {
            return NextResponse.json({ error }, { status });
        }
        return NextResponse.json(data, { status });
    } catch (err: any) {
        return NextResponse.json({ error: { message: 'Invalid JSON body' } }, { status: 400 });
    }
}
