import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'PoE-Optimizer/1.0 (contact: dev@poe-optimizer.local)',
      },
      // Ensure we get the raw text
      responseType: 'text',
    });
    
    return new NextResponse(response.data, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (error: any) {
    console.error('Error proxying PoB request:', error.message);
    return NextResponse.json({ error: 'Failed to fetch PoB data' }, { status: 500 });
  }
}
