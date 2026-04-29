import 'dotenv/config';
import { db } from './db';
import { wallets } from '@shared/schema';
import { eq, and, ne, isNotNull } from 'drizzle-orm';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function decryptWithKey(encryptedData: string, key: Buffer): string {
  const parts = encryptedData.split(':');
  if (parts.length !== 3) throw new Error('Invalid format');
  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[1], 'base64');
  const ciphertext = Buffer.from(parts[2], 'base64');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

function encryptWithKey(plain: string, key: Buffer): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':');
}

async function rotateKeys() {
  const oldKeyB64 = process.env.OLD_WALLET_ENCRYPTION_KEY;
  const newKeyB64 = process.env.WALLET_ENCRYPTION_KEY;

  if (!oldKeyB64 || !newKeyB64) {
    console.error('Both OLD_WALLET_ENCRYPTION_KEY and WALLET_ENCRYPTION_KEY must be set');
    process.exit(1);
  }

  const oldKey = Buffer.from(oldKeyB64, 'base64');
  const newKey = Buffer.from(newKeyB64, 'base64');

  if (oldKey.length !== 32 || newKey.length !== 32) {
    console.error('Both keys must be 32 bytes when decoded');
    process.exit(1);
  }

  console.log('[rotate] Starting key rotation...');

  const allWallets = await db
    .select()
    .from(wallets)
    .where(and(eq(wallets.encrypted, true), ne(wallets.privateKey, '')));

  console.log(`[rotate] Found ${allWallets.length} encrypted wallets to rotate`);

  let rotated = 0;
  let errored = 0;

  for (const wallet of allWallets) {
    try {
      const plain = decryptWithKey(wallet.privateKey, oldKey);
      const reEncrypted = encryptWithKey(plain, newKey);
      await db.update(wallets).set({ privateKey: reEncrypted }).where(eq(wallets.id, wallet.id));
      console.log(`[rotate] ✓ Rotated wallet ${wallet.id} (userId=${wallet.userId})`);
      rotated++;
    } catch (e) {
      console.error(`[rotate] ✗ Failed wallet ${wallet.id}:`, e);
      errored++;
    }
  }

  console.log(`[rotate] Done. Rotated: ${rotated}, Errors: ${errored}`);
  process.exit(errored > 0 ? 1 : 0);
}

rotateKeys().catch((e) => {
  console.error('[rotate] Fatal:', e);
  process.exit(1);
});
