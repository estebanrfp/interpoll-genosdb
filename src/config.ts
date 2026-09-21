/**
 * Centralised application configuration.
 *
 * There are no relay endpoints to configure: GenosDB reaches its peers over
 * GenosRTC (Nostr signalling + WebRTC), which discovers and heals its own relay
 * set at boot. What remains here is the server-wide encryption policy, which is
 * a product decision rather than a transport one.
 *
 * Usage:
 *   import config from '@/config';
 *   if (config.isServerEncrypted()) { ... }
 */

const ENCRYPTION_STORAGE_KEY = 'interpoll_encryption_config';

interface EncryptionConfig {
  encryptAll?: boolean;
  serverPassword?: string;
  requireInviteToJoin?: boolean;
}

function loadEncryptionConfig(): EncryptionConfig {
  try {
    const raw = localStorage.getItem(ENCRYPTION_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Corrupted data; ignore
  }
  return {};
}

let encryptionConfig = loadEncryptionConfig();

const config = {
  /** Server-wide encryption settings (mutable at runtime) */
  encryption: {
    /** Whether all content should be encrypted by default */
    get encryptAll() { return encryptionConfig.encryptAll ?? false; },
    /** Password for server-wide encryption (used to derive AES key) */
    get serverPassword() { return encryptionConfig.serverPassword; },
    /** Whether new users need an invite link to access the server */
    get requireInviteToJoin() { return encryptionConfig.requireInviteToJoin ?? false; },
  },

  /** Check if server-wide encryption is active */
  isServerEncrypted(): boolean {
    return this.encryption.encryptAll;
  },

  /** Update encryption settings */
  setEncryptionConfig(partial: EncryptionConfig) {
    encryptionConfig = { ...encryptionConfig, ...partial };
    for (const key of Object.keys(encryptionConfig) as (keyof EncryptionConfig)[]) {
      if (encryptionConfig[key] === undefined || encryptionConfig[key] === '') delete encryptionConfig[key];
    }
    localStorage.setItem(ENCRYPTION_STORAGE_KEY, JSON.stringify(encryptionConfig));
  },

  /** Clear encryption settings */
  resetEncryptionConfig() {
    encryptionConfig = {};
    localStorage.removeItem(ENCRYPTION_STORAGE_KEY);
  },

  /** Get current encryption config */
  getEncryptionConfig(): EncryptionConfig {
    return { ...encryptionConfig };
  },
};

export default config;
