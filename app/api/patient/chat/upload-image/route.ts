import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('jwt')?.value;

        const formData = await request.formData();

        const res = await fetch(`${API_URL}/chat/upload-image`, {
            method: 'POST',
            headers: {
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: formData,
        });

        const json = await res.json();

        if (!res.ok) {
            return NextResponse.json({ error: json }, { status: res.status });
        }

        return NextResponse.json(json, { status: 200 });
    } catch (err: any) {
        return NextResponse.json({ error: { message: err.message } }, { status: 500 });
    }
}
