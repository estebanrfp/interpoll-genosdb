/**
 * Sharing, with a path that always ends somewhere.
 *
 * `navigator.share` exists on phones and on very little else, and the call
 * throws when the browser refuses it. Calling it with optional chaining — as
 * this app did — means the button silently does nothing on a desktop, which
 * looks like a broken app rather than an unsupported feature.
 *
 * So: share sheet when there is one, clipboard when there is not, and the
 * caller is told which happened so it can say the right thing.
 */

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed'

export interface ShareRequest {
  title: string
  text?: string
  url: string
}

/** Whether the system share sheet is available for this payload. */
function canShareNatively(request: ShareRequest): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false
  // `canShare` is the only way to know before throwing; assume yes without it.
  return typeof navigator.canShare === 'function' ? navigator.canShare(request) : true
}

/**
 * Offer the system share sheet, falling back to the clipboard.
 *
 * A share the person dismisses reports `cancelled`, which is not a failure and
 * should not be followed by a toast claiming anything happened.
 */
export async function shareOrCopy(request: ShareRequest): Promise<ShareOutcome> {
  if (canShareNatively(request)) {
    try {
      await navigator.share(request)
      return 'shared'
    } catch (error: any) {
      // The person closed the sheet: that is an answer, not an error.
      if (error?.name === 'AbortError') return 'cancelled'
      // Anything else falls through to the clipboard rather than dead-ending.
    }
  }

  try {
    await navigator.clipboard.writeText(request.url)
    return 'copied'
  } catch {
    return 'failed'
  }
}

/** The message to show for an outcome, or `null` when nothing should be said. */
export function shareMessage(outcome: ShareOutcome, subject = 'Link'): string | null {
  switch (outcome) {
    case 'copied': return `${subject} copied to clipboard`
    case 'failed': return `Could not share or copy the ${subject.toLowerCase()}`
    case 'shared':
    case 'cancelled': return null
  }
}
