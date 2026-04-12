import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy to the Python graph-chat backend (port 8001).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const res = await fetch('http://localhost:8001/api/graph-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json(
        { response: `Backend error: ${errorText}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Graph chat proxy error:', error);
    return NextResponse.json(
      { response: '⚠️ Graph AI service is offline. Make sure the backend is running on port 8001.' },
      { status: 502 }
    );
  }
}
