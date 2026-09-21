import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock localStorage
const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
});

// Import config after mocking
import config from '../src/config';

describe('config', () => {
  beforeEach(() => {
    storage.clear();
    config.resetEncryptionConfig();
  });

  describe('encryption config', () => {
    it('defaults encryptAll to false', () => {
      expect(config.encryption.encryptAll).toBe(false);
    });

    it('defaults requireInviteToJoin to false', () => {
      expect(config.encryption.requireInviteToJoin).toBe(false);
    });

    it('isServerEncrypted returns false by default', () => {
      expect(config.isServerEncrypted()).toBe(false);
    });

    it('setEncryptionConfig enables encryption', () => {
      config.setEncryptionConfig({ encryptAll: true, serverPassword: 'test' });
      expect(config.encryption.encryptAll).toBe(true);
      expect(config.encryption.serverPassword).toBe('test');
      expect(config.isServerEncrypted()).toBe(true);
    });

    it('resetEncryptionConfig clears settings', () => {
      config.setEncryptionConfig({ encryptAll: true });
      config.resetEncryptionConfig();
      expect(config.encryption.encryptAll).toBe(false);
    });

    it('getEncryptionConfig returns clone', () => {
      config.setEncryptionConfig({ encryptAll: true });
      const cfg = config.getEncryptionConfig();
      expect(cfg.encryptAll).toBe(true);
    });

    it('strips empty/undefined values', () => {
      config.setEncryptionConfig({ serverPassword: '' });
      const cfg = config.getEncryptionConfig();
      expect(cfg.serverPassword).toBeUndefined();
    });
  });
});
