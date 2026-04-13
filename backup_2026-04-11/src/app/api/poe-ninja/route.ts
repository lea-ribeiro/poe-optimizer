import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const league = searchParams.get('league');
  const type = searchParams.get('type');

  if (!league || !type) {
    return NextResponse.json({ error: 'Missing league or type' }, { status: 400 });
  }

  try {
    // poe.ninja uses currencyoverview for some types and itemoverview for others.
    // BaseType, Fossil, Resonator, etc. are under itemoverview but they are technically 
    // in the "Items" section of the site.
    const isCurrency = ['Currency', 'Fragment'].includes(type);
    const endpoint = isCurrency ? 'currencyoverview' : 'itemoverview';
    
    const response = await axios.get(`https://poe.ninja/api/data/${endpoint}`, {
      params: { league, type },
    });
    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error(`Error proxying to poe.ninja (${type}):`, error.message);
    return NextResponse.json({ error: `Failed to fetch ${type} from poe.ninja` }, { status: 500 });
  }
}
