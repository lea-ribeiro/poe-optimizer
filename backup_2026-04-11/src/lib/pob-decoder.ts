import pako from 'pako';
import { parseStringPromise } from 'xml2js';

/**
 * Resolves a PoB source which could be a raw code or a shareable link.
 */
export async function resolvePobSource(input: string): Promise<string> {
  const trimmed = input.trim();
  
  // 1. Detect source type
  let fetchUrl = '';
  
  if (trimmed.includes('pob.party/share/')) {
    const id = trimmed.split('/').pop();
    if (id) fetchUrl = `https://pob.party/pob/${id}/raw`;
  } else if (trimmed.includes('pobb.in/')) {
    const urlParts = trimmed.split('/');
    let id = urlParts.pop() || urlParts.pop() || '';
    // Sanitize ID: Remove PoB color codes (e.g., ^x7070FF) or trailing junk
    id = id.split('^')[0].replace(/[^a-zA-Z0-9_-]/g, '');
    if (id) fetchUrl = `https://pobb.in/${id}/raw`;
  } else if (trimmed.includes('pastebin.com/')) {
    let id = trimmed.split('/').pop() || '';
    id = id.split('^')[0].replace(/[^a-zA-Z0-9_-]/g, '');
    if (id) fetchUrl = `https://pastebin.com/raw/${id}`;
  }

  // 2. Fetch via our server-side proxy to bypass CORS
  if (fetchUrl) {
    try {
      const response = await fetch(`/api/pob-proxy?url=${encodeURIComponent(fetchUrl)}`);
      
      if (response.ok) {
        return await response.text();
      }
      
      throw new Error(`Failed to fetch PoB data from ${fetchUrl} (Status: ${response.status})`);
    } catch (e: any) {
      console.error(`Proxy fetch failed for ${fetchUrl}:`, e);
      throw new Error(`Unable to fetch build from link: ${e.message}`);
    }
  }

  return trimmed;
}

/**
 * Decodes a Path of Building (PoB) export string into an XML string.
 * PoB strings are Base64 encoded, then Zlib compressed.
 */
export async function decodePoBString(pobString: string): Promise<string> {
  try {
    // 1. Resolve source first (might be a link)
    const rawCode = await resolvePobSource(pobString);

    // 2. Clean the string (remove any potential whitespace or non-base64 characters)
    const cleanedString = rawCode.trim()
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .replace(/\s/g, '');

    // 2. Decode Base64 to binary data
    // Using a cross-platform way to convert base64 to Uint8Array
    const binaryString = atob(cleanedString);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // 3. Decompress with Pako (Zlib)
    // We use inflate because PoB uses zlib compression (RFC 1950)
    const decompressedData = pako.inflate(bytes);

    // 4. Convert back to string (UTF-8)
    const xmlString = new TextDecoder('utf-8').decode(decompressedData);

    return xmlString;
  } catch (error: any) {
    console.error('Error decoding PoB string:', error.message);
    throw new Error(`Invalid PoB string: ${error.message}. Please ensure you copied the full export string.`);
  }
}

/**
 * Parses the PoB XML string into a structured JavaScript object.
 */
export async function parsePoBXml(xmlString: string): Promise<any> {
  try {
    const result = await parseStringPromise(xmlString);
    return result;
  } catch (error: any) {
    console.error('Error parsing PoB XML:', error.message);
    throw new Error('Failed to parse the build data. The XML structure might be invalid.');
  }
}

/**
 * Comprehensive utility that decodes and parses a PoB string in one go.
 */
export async function processPoB(pobString: string): Promise<any> {
  const xml = await decodePoBString(pobString);
  return await parsePoBXml(xml);
}
