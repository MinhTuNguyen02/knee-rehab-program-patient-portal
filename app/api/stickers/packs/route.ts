import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function GET() {
    try {
        const response = await fetch(`${API_URL}/stickers/packs`);
        const data = await response.json();
        if (!response.ok) {
            return NextResponse.json(data, { status: response.status });
        }
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Fetch sticker packs route error in patient portal:', error);
        return NextResponse.json({ error: { message: 'Failed to load stickers' } }, { status: 500 });
    }
}
