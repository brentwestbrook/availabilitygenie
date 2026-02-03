// Token encryption utilities for OAuth tokens
// Uses AES-256-GCM for authenticated encryption

const ALGORITHM = 'AES-GCM';

// Get encryption key from environment or generate a deterministic one from service role key
async function getEncryptionKey(): Promise<CryptoKey> {
  const keyString = Deno.env.get('TOKEN_ENCRYPTION_KEY');
  
  if (keyString) {
    // If explicit key provided, use it
    const keyData = hexToBytes(keyString);
    return await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: ALGORITHM },
      false,
      ['encrypt', 'decrypt']
    );
  }
  
  // Derive key from service role key for consistency
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(serviceRoleKey),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('lovable-calendar-tokens'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

export interface EncryptedToken {
  encrypted: string;
  iv: string;
  tag: string;
}

export async function encryptToken(token: string): Promise<EncryptedToken> {
  const key = await getEncryptionKey();
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
  
  const encryptedData = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoder.encode(token)
  );
  
  // GCM includes the auth tag in the ciphertext (last 16 bytes)
  const encryptedBytes = new Uint8Array(encryptedData);
  const ciphertext = encryptedBytes.slice(0, -16);
  const tag = encryptedBytes.slice(-16);
  
  return {
    encrypted: bytesToHex(ciphertext),
    iv: bytesToHex(iv),
    tag: bytesToHex(tag),
  };
}

export async function decryptToken(encryptedToken: EncryptedToken): Promise<string> {
  const key = await getEncryptionKey();
  const decoder = new TextDecoder();
  
  const ciphertext = hexToBytes(encryptedToken.encrypted);
  const iv = hexToBytes(encryptedToken.iv);
  const tag = hexToBytes(encryptedToken.tag);
  
  // Reconstruct the full ciphertext with tag for GCM
  const fullCiphertext = new Uint8Array(ciphertext.length + tag.length);
  fullCiphertext.set(ciphertext);
  fullCiphertext.set(tag, ciphertext.length);
  
  const decryptedData = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    fullCiphertext
  );
  
  return decoder.decode(decryptedData);
}

// Helper to check if a token is encrypted (has the encrypted format)
export function isEncryptedFormat(accessToken: string, accessTokenIv: string | null): boolean {
  return accessTokenIv !== null && accessTokenIv.length > 0;
}
