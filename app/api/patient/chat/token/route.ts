import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
    const cookieStore = await cookies();
    const token = cookieStore.get('jwt')?.value;

    if (!token) {
        return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }

    return NextResponse.json({ token });
}
