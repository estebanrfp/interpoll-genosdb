<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/home"></ion-back-button>
        </ion-buttons>
        <ion-title>Chain Explorer</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="page-shell">
        <ion-card>
          <ion-card-header>
            <ion-card-title>Signed operations</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <p class="ce-desc">
              Every record below was signed by its author and verified by this device
              before it was applied — that is what admitted it to your replica. There
              is no block chain to walk: authorship and order travel with each
              operation, as a signature and a hybrid logical clock.
            </p>

            <div class="ce-counts">
              <button
                class="ce-chip"
                :class="{ active: activeType === null }"
                @click="activeType = null"
              >All <span class="ce-chip-count">{{ nodes.length }}</span></button>
              <button
                v-for="[type, count] in typeCounts"
                :key="type"
                class="ce-chip"
                :class="{ active: activeType === type }"
                @click="activeType = type"
              >{{ type }} <span class="ce-chip-count">{{ count }}</span></button>
            </div>

            <p v-if="!nodes.length" class="ce-empty">
              Nothing replicated to this device yet. Content arrives from peers and can
              take a few seconds on a first visit.
            </p>

            <ol v-else class="ce-list">
              <li v-for="entry in visible" :key="entry.id" class="ce-entry">
                <div class="ce-entry-head">
                  <span class="ce-type">{{ entry.type }}</span>
                  <span class="ce-clock">{{ formatClock(entry.physical) }}</span>
                </div>
                <p class="ce-id">{{ entry.id }}</p>
                <div class="ce-meta">
                  <span class="ce-author" :title="entry.author || 'no owner'">
                    {{ entry.author ? formatAddress(entry.author) : 'unowned' }}
                  </span>
                  <span class="ce-hlc">hlc {{ entry.physical }}.{{ entry.logical }}</span>
                  <router-link v-if="entry.receiptCode" :to="`/receipt/${entry.receiptCode}`" class="ce-receipt">
                    receipt {{ entry.receiptCode }}
                  </router-link>
                </div>
              </li>
            </ol>

            <p v-if="filtered.length > visible.length" class="ce-more">
              Showing the {{ visible.length }} most recent of {{ filtered.length }}.
            </p>
          </ion-card-content>
        </ion-card>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, onIonViewWillEnter,
} from '@ionic/vue';
import { db } from '../services/gdbServices';
import { receiptCodeFor } from '../services/receiptService';
import { formatAddress } from '../utils/address';

/** One row of the explorer: what the graph itself proves about an operation. */
interface Entry {
  id: string
  type: string
  author: string
  physical: number
  logical: number
  receiptCode: string
}

const PAGE_SIZE = 150;

const nodes = ref<Entry[]>([]);
const activeType = ref<string | null>(null);
let unsubscribe: (() => void) | undefined;

/**
 * Who signed a record.
 *
 * An owned node's id is `${owner}:${uuid}`, so for most records authorship is
 * structural rather than a field a peer could claim. Votes are keyed
 * `${pollId}:${voter}` and name their voter in the value.
 */
function authorOf(node: any): string {
  const value = node?.value ?? {};
  const owner = value.owner ?? value._meta?.owner ?? value.voter ?? value.author;
  if (owner) return owner;
  // An owned id is `${owner}:…`; a profile is `user:${address}`.
  const address = String(node.id).split(':').find(part => /^0x[0-9a-fA-F]{40}$/.test(part));
  return address ?? '';
}

function formatClock(physical: number): string {
  if (!physical) return '—';
  return new Date(physical).toLocaleString();
}

const typeCounts = computed(() => {
  const counts = new Map<string, number>();
  for (const entry of nodes.value) counts.set(entry.type, (counts.get(entry.type) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
});

const filtered = computed(() =>
  activeType.value === null ? nodes.value : nodes.value.filter(e => e.type === activeType.value)
);

const visible = computed(() => filtered.value.slice(0, PAGE_SIZE));

/** Newest first, ties broken by the logical counter — the graph's own order. */
function sortNodes() {
  nodes.value.sort((a, b) => b.physical - a.physical || b.logical - a.logical);
}

async function toEntry(node: any): Promise<Entry> {
  const type = node?.value?.type ?? 'node';
  return {
    id: node.id,
    type,
    author: authorOf(node),
    physical: node.timestamp?.physical ?? 0,
    logical: node.timestamp?.logical ?? 0,
    receiptCode: type === 'vote' ? await receiptCodeFor(node.id) : '',
  };
}

/**
 * One subscription for the life of the view.
 *
 * The callback carries the whole story — `initial` once per node already held,
 * then `added` / `updated` / `removed` — so the list is built from events only.
 * Seeding it from the returned `results` as well would race with the `initial`
 * events and drop whatever arrived first.
 */
async function subscribe() {
  if (unsubscribe) return;
  const { unsubscribe: stop } = await db.map({}, async ({ id, value, timestamp, action }: any) => {
    if (action === 'removed') {
      nodes.value = nodes.value.filter(e => e.id !== id);
      return;
    }
    const entry = await toEntry({ id, value, timestamp });
    const index = nodes.value.findIndex(e => e.id === id);
    if (index === -1) nodes.value.push(entry);
    else nodes.value[index] = entry;
    sortNodes();
  });
  unsubscribe = stop;
}

// Mounting covers a direct URL load; the Ionic hook covers returning to a view
// Ionic kept alive. `subscribe` is idempotent, so whichever fires first wins.
onMounted(() => { void subscribe(); });
onIonViewWillEnter(() => { void subscribe(); });
onUnmounted(() => { unsubscribe?.(); unsubscribe = undefined; });
</script>

<style scoped>
.ce-desc {
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--app-text-muted);
  margin: 0 0 16px;
}

.ce-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.ce-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--app-border);
  border-radius: 999px;
  background: var(--app-surface);
  color: var(--app-text-muted);
  font-size: 0.78rem;
  cursor: pointer;
}

.ce-chip.active {
  border-color: var(--app-border-accent);
  color: var(--app-accent-bright);
}

.ce-chip-count {
  font-variant-numeric: tabular-nums;
  opacity: 0.7;
}

.ce-empty {
  font-size: 0.85rem;
  color: var(--app-text-subtle);
  margin: 0;
}

.ce-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.ce-entry {
  padding: 12px 0;
  border-top: 1px solid var(--app-border);
}

.ce-entry-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.ce-type {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--app-accent-bright);
}

.ce-clock {
  font-size: 0.75rem;
  color: var(--app-text-subtle);
}

.ce-id {
  margin: 6px 0 4px;
  font-family: ui-monospace, monospace;
  font-size: 0.78rem;
  color: var(--app-text);
  overflow-wrap: anywhere;
}

.ce-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 0.74rem;
  color: var(--app-text-subtle);
}

.ce-author {
  font-family: ui-monospace, monospace;
}

.ce-hlc {
  font-variant-numeric: tabular-nums;
}

.ce-receipt {
  font-family: ui-monospace, monospace;
  color: var(--app-accent-bright);
  text-decoration: none;
}

.ce-more {
  margin: 12px 0 0;
  font-size: 0.78rem;
  color: var(--app-text-subtle);
}
</style>
