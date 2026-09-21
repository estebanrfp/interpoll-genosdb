import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock localStorage before the service reads it.
const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
});

/** Records every notification the service constructs. */
const raised: Array<{ title: string; body?: string; tag?: string }> = [];
let permission: NotificationPermission = 'granted';

class FakeNotification {
  onclick: (() => void) | null = null;
  constructor(title: string, options: { body?: string; tag?: string } = {}) {
    raised.push({ title, ...options });
  }
  close() {}
  static get permission() { return permission; }
  static async requestPermission(): Promise<NotificationPermission> { return permission; }
}

vi.stubGlobal('Notification', FakeNotification);
vi.stubGlobal('window', { Notification: FakeNotification, focus: () => {} });
let visibility: DocumentVisibilityState = 'visible';
vi.stubGlobal('document', { get visibilityState() { return visibility; } });

import { NotificationService } from '../src/services/notificationService';

describe('NotificationService', () => {
  beforeEach(() => {
    storage.clear();
    raised.length = 0;
    permission = 'granted';
    visibility = 'visible';
  });

  it('is off until the user opts in', () => {
    expect(NotificationService.isEnabled()).toBe(false);
    visibility = 'hidden';
    expect(NotificationService.notify({ title: 'hi', body: 'there' })).toBe(false);
    expect(raised).toHaveLength(0);
  });

  it('raises a notification once enabled and the page is hidden', async () => {
    await NotificationService.enable();
    visibility = 'hidden';

    expect(NotificationService.notify({ title: 'Message from alice', body: 'Encrypted', tag: 'dm:0xabc' })).toBe(true);
    expect(raised).toEqual([{ title: 'Message from alice', body: 'Encrypted', tag: 'dm:0xabc', icon: '/vite.svg' }]);
  });

  it('stays quiet while the person is looking at the page', async () => {
    await NotificationService.enable();
    visibility = 'visible';

    // The caller shows an in-app toast instead — two alerts for one message is
    // worse than none, so `notify` reporting false is what routes that choice.
    expect(NotificationService.notify({ title: 'hi', body: 'there' })).toBe(false);
    expect(raised).toHaveLength(0);
  });

  it('stops again when switched off', async () => {
    await NotificationService.enable();
    visibility = 'hidden';
    NotificationService.notify({ title: 'one', body: 'b' });

    NotificationService.disable();
    expect(NotificationService.isEnabled()).toBe(false);
    expect(NotificationService.notify({ title: 'two', body: 'b' })).toBe(false);
    expect(raised).toHaveLength(1);
  });

  it('does not enable itself when the browser refuses permission', async () => {
    permission = 'denied';
    const result = await NotificationService.enable();

    expect(result).toBe('denied');
    expect(NotificationService.isEnabled()).toBe(false);
    visibility = 'hidden';
    expect(NotificationService.notify({ title: 'hi', body: 'b' })).toBe(false);
  });

  it('reports the browser permission state without changing it', () => {
    permission = 'default';
    expect(NotificationService.permission()).toBe('default');
    expect(NotificationService.isSupported()).toBe(true);
  });
});
