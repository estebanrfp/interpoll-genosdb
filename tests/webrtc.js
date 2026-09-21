/**
 * Proof that data crossed WebRTC, not something cheaper.
 *
 * "It appeared in the other peer" does not prove peer-to-peer: two tabs of one
 * browser context share storage and a BroadcastChannel, so they would agree
 * without a network at all. These helpers wrap `RTCPeerConnection` before the
 * app loads and then read `getStats()`, where a candidate pair in state
 * `succeeded` with bytes on it is the actual evidence.
 *
 * Call `webrtcEvidence` only after the app-level assertion has passed — stats
 * are empty if read before ICE settles.
 */

/** Collect every RTCPeerConnection the page constructs. Run before `goto`. */
export async function trackPeerConnections(context) {
  await context.addInitScript(() => {
    window.__peerConnections = []
    const Native = window.RTCPeerConnection
    window.RTCPeerConnection = function (...args) {
      const connection = new Native(...args)
      window.__peerConnections.push(connection)
      return connection
    }
    window.RTCPeerConnection.prototype = Native.prototype
  })
}

/**
 * What the browser's own statistics say about this page's connections.
 *
 * GenosRTC keeps a pool of pre-created offers, so far more connections are
 * constructed than are ever connected: count succeeded candidate pairs, never
 * constructions.
 */
export async function webrtcEvidence(page) {
  return page.evaluate(async () => {
    let succeededPairs = 0
    let bytesSent = 0
    let bytesReceived = 0
    let dataChannelsOpened = 0

    for (const connection of window.__peerConnections ?? []) {
      let stats
      try { stats = await connection.getStats() } catch { continue }
      stats.forEach(report => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          succeededPairs++
          bytesSent += report.bytesSent ?? 0
          bytesReceived += report.bytesReceived ?? 0
        }
        if (report.type === 'peer-connection') {
          dataChannelsOpened += report.dataChannelsOpened ?? 0
        }
      })
    }

    return {
      constructed: (window.__peerConnections ?? []).length,
      succeededPairs,
      bytesSent,
      bytesReceived,
      dataChannelsOpened,
    }
  })
}
