/**
 * Verifiable receipts — the GenosDB expression of "check that your vote is intact".
 *
 * The original stack built a hash-linked block chain on top of Gun because Gun
 * stores whatever a peer writes: without a chain there was nothing to check a
 * record against. GenosDB needs none of it. Every operation is signed by its
 * author and verified by every peer before it is applied, so a vote node that
 * sits in this replica is one whose signature this device already verified, and
 * altering it requires the voter's private key. The receipt therefore stores
 * nothing: it is DERIVED from the signed node itself.
 *
 * A code is the first 4 bytes of SHA-256 over the vote node's id, which is
 * deterministic (`${pollId}:${voter}`) — so the same vote always yields the same
 * code, on every device, with no registry to keep in sync.
 */
import { db } from './gdbServices'

/** A vote as the receipt view presents it. */
export interface Receipt {
  /** The signed vote node's id — `${pollId}:${voter}`. */
  nodeId: string
  code: string
  pollId: string
  /** The address that signed the vote; also the node's ACL owner. */
  voter: string
  optionIds: string[]
  /** Hybrid logical clock: `physical` is the wall time, `logical` breaks ties. */
  physical: number
  logical: number
  castAt: number
}

const encoder = new TextEncoder()

/** SHA-256 of `input` as a lowercase hex string. */
async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(input))
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}

/** The receipt code for a node id, formatted `XXXX-XXXX`. */
export async function receiptCodeFor(nodeId: string): Promise<string> {
  const hex = (await sha256Hex(nodeId)).slice(0, 8).toUpperCase()
  return `${hex.slice(0, 4)}-${hex.slice(4)}`
}

/** Strip formatting so `a1b2-c3d4`, `A1B2C3D4` and `a1b2 c3d4` are one code. */
export function normaliseCode(code: string): string {
  return code.replace(/[^0-9a-fA-F]/g, '').toUpperCase()
}

/** Build a Receipt from a vote node, or `null` if the node is not a vote. */
async function toReceipt(node: { id: string; value: any; timestamp?: any }): Promise<Receipt | null> {
  if (node?.value?.type !== 'vote') return null
  return {
    nodeId: node.id,
    code: await receiptCodeFor(node.id),
    pollId: node.value.pollId,
    voter: node.value.voter,
    optionIds: node.value.optionIds ?? [],
    physical: node.timestamp?.physical ?? 0,
    logical: node.timestamp?.logical ?? 0,
    castAt: node.value.createdAt ?? node.timestamp?.physical ?? 0,
  }
}

/** The receipt for the active identity's vote on a poll, or `null` if it has not voted. */
export async function receiptForMyVote(pollId: string): Promise<Receipt | null> {
  const voter = db.sm.getActiveEthAddress()
  if (!voter) return null
  const { result } = await db.get(`${pollId}:${voter}`)
  return result ? toReceipt(result) : null
}

/**
 * Resolve a receipt code against the vote nodes this peer holds.
 *
 * Codes are derived, not indexed, so this hashes the candidates — fine at the
 * scale a browser replica holds, and it keeps the graph free of receipt nodes
 * that would have to be signed, synced and trusted in their own right.
 */
export async function findReceiptByCode(code: string): Promise<Receipt | null> {
  const wanted = normaliseCode(code)
  if (wanted.length !== 8) return null
  const { results } = await db.map({ query: { type: 'vote' } })
  for (const node of results ?? []) {
    if (normaliseCode(await receiptCodeFor(node.id)) === wanted) return toReceipt(node)
  }
  return null
}
