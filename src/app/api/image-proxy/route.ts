import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const ALLOWED_ORIGINS = ['https://web.poecdn.com/'];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl || !ALLOWED_ORIGINS.some(o => imageUrl.startsWith(o))) {
    return new NextResponse('Bad request', { status: 400 });
  }

  try {
    const response = await axios.get<ArrayBuffer>(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 10_000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://www.pathofexile.com/',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });

    const contentType = (response.headers['content-type'] as string) || 'image/png';
    return new NextResponse(response.data, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=604800, s-maxage=604800, immutable',
      },
    });
  } catch (error: any) {
    console.error('[ImageProxy] Failed to fetch', imageUrl, error.message);
    return new NextResponse('Error fetching image', { status: 502 });
  }
}
