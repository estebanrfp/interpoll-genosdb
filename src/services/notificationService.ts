/**
 * Local notifications — the device tells you, no server involved.
 *
 * InterPoll wakes a closed app through Firebase Cloud Messaging, with the relay
 * holding a token per user (and an email fallback their own code notes could
 * deanonymise whoever opts in). Nothing here leaves the device: the page is
 * already receiving the message over WebRTC, so it raises the system notice
 * itself through the Notification API.
 *
 * The honest limit: this only works while the app is running. A backgrounded
 * tab is fine; a closed browser is not, because no server exists to wake it.
 * An always-on native peer is what removes that limit, not a push provider.
 */

const PREFERENCE_KEY = 'interpoll_notifications'

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported'

export interface LocalNotification {
  title: string
  body: string
  /** Collapses repeats from the same conversation instead of stacking them. */
  tag?: string
  onClick?: () => void
}

/** Whether this browser can raise system notifications at all. */
function isSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

/** The browser's permission state, which the user controls and we only read. */
function permission(): NotificationPermissionState {
  if (!isSupported()) return 'unsupported'
  return Notification.permission as NotificationPermissionState
}

/** Whether the user has switched notifications on in Settings. */
function isEnabled(): boolean {
  try { return localStorage.getItem(PREFERENCE_KEY) === 'on' } catch { return false }
}

function setEnabled(enabled: boolean): void {
  try { localStorage.setItem(PREFERENCE_KEY, enabled ? 'on' : 'off') } catch { /* blocked storage */ }
}

/**
 * Ask for permission and switch the preference on if it is granted.
 *
 * Browsers only honour this from a user gesture, so it belongs to a button in
 * Settings and never to app startup.
 */
async function enable(): Promise<NotificationPermissionState> {
  if (!isSupported()) return 'unsupported'
  const result = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission()
  setEnabled(result === 'granted')
  return result as NotificationPermissionState
}

function disable(): void {
  setEnabled(false)
}

/**
 * Raise a notification, unless the person is already looking at the page.
 *
 * A visible tab shows an in-app toast instead — two alerts for one message is
 * worse than none.
 */
function notify({ title, body, tag, onClick }: LocalNotification): boolean {
  if (!isSupported() || !isEnabled() || Notification.permission !== 'granted') return false
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') return false

  try {
    const notification = new Notification(title, { body, tag, icon: '/vite.svg' })
    notification.onclick = () => {
      window.focus()
      notification.close()
      onClick?.()
    }
    return true
  } catch {
    // Some browsers refuse construction outside a service worker; a missed
    // notification is never worth breaking the message that triggered it.
    return false
  }
}

export const NotificationService = {
  isSupported,
  permission,
  isEnabled,
  enable,
  disable,
  notify,
}
