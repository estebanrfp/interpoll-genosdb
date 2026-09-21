<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/home"></ion-back-button>
        </ion-buttons>
        <ion-title>Verify a receipt</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="page-shell">
        <ion-card>
          <ion-card-header>
            <ion-card-title>Check your vote</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <p class="rc-desc">
              Enter the code you were given after voting. It resolves to the signed
              vote this device holds, so you can confirm it is the one you cast and
              that nothing has changed it.
            </p>

            <form class="rc-form" @submit.prevent="lookup">
              <input
                v-model="code"
                class="rc-input"
                type="text"
                inputmode="text"
                autocapitalize="characters"
                spellcheck="false"
                placeholder="XXXX-XXXX"
                aria-label="Receipt code"
              />
              <button class="rc-submit" type="submit" :disabled="searching">
                {{ searching ? 'Checking…' : 'Check' }}
              </button>
            </form>

            <p v-if="status === 'not-found'" class="rc-miss">
              No vote with that code has reached this device. Either the code is wrong,
              or the peer holding that vote has not synced with you yet.
            </p>

            <div v-if="receipt" class="rc-result">
              <p class="rc-verdict">Signature verified · vote intact</p>
              <dl class="rc-fields">
                <dt>Receipt</dt>
                <dd class="rc-mono">{{ receipt.code }}</dd>

                <dt>Poll</dt>
                <dd>{{ pollQuestion || receipt.pollId }}</dd>

                <dt>Choice</dt>
                <dd>{{ choiceText || receipt.optionIds.join(', ') }}</dd>

                <dt>Cast by</dt>
                <dd class="rc-mono" :title="receipt.voter">{{ formatAddress(receipt.voter) }}</dd>

                <dt>Recorded</dt>
                <dd>{{ formatClock(receipt.physical) }}</dd>

                <dt>Clock</dt>
                <dd class="rc-mono">{{ receipt.physical }}.{{ receipt.logical }}</dd>

                <dt>Node</dt>
                <dd class="rc-mono rc-node">{{ receipt.nodeId }}</dd>
              </dl>

              <p class="rc-explain">
                This record is owned by the address that cast it. Every peer refuses a
                write to it that the owner did not sign, so the only way to alter this
                vote is with that identity's private key — which never leaves its
                device.
              </p>
            </div>
          </ion-card-content>
        </ion-card>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent,
} from '@ionic/vue';
import { db } from '../services/gdbServices';
import { findReceiptByCode } from '../services/receiptService';
import type { Receipt } from '../services/receiptService';
import { formatAddress } from '../utils/address';

const route = useRoute();

const code = ref('');
const receipt = ref<Receipt | null>(null);
const pollQuestion = ref('');
const choiceText = ref('');
const searching = ref(false);
const status = ref<'idle' | 'found' | 'not-found'>('idle');

function formatClock(physical: number): string {
  return physical ? new Date(physical).toLocaleString() : '—';
}

/** Resolve the poll a receipt points at, to show the question and the chosen option. */
async function describePoll(found: Receipt) {
  pollQuestion.value = '';
  choiceText.value = '';
  const { result } = await db.get(found.pollId);
  const poll = result?.value;
  if (!poll) return;
  pollQuestion.value = poll.question ?? '';
  const options = Array.isArray(poll.options) ? poll.options : [];
  choiceText.value = found.optionIds
    .map(id => options.find((o: any) => o.id === id)?.text ?? id)
    .join(', ');
}

async function lookup() {
  if (searching.value) return;
  searching.value = true;
  receipt.value = null;
  status.value = 'idle';
  try {
    const found = await findReceiptByCode(code.value);
    receipt.value = found;
    status.value = found ? 'found' : 'not-found';
    if (found) await describePoll(found);
  } finally {
    searching.value = false;
  }
}

watch(
  () => route.params.code,
  value => {
    const incoming = (value as string) || '';
    if (!incoming) return;
    code.value = incoming;
    void lookup();
  },
  { immediate: true }
);
</script>

<style scoped>
.rc-desc {
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--app-text-muted);
  margin: 0 0 16px;
}

.rc-form {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}

.rc-input {
  flex: 1;
  min-width: 0;
  padding: 11px 14px;
  border: 1px solid var(--app-border-strong);
  border-radius: var(--app-radius-md);
  background: var(--app-surface);
  color: var(--app-text);
  font-family: ui-monospace, monospace;
  font-size: 0.95rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.rc-input:focus {
  outline: none;
  border-color: var(--app-border-accent);
}

.rc-submit {
  padding: 11px 20px;
  border: none;
  border-radius: var(--app-radius-md);
  background: var(--app-accent);
  color: #fff;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
}

.rc-submit:disabled {
  opacity: 0.55;
  cursor: default;
}

.rc-miss {
  margin: 0;
  font-size: 0.85rem;
  color: var(--app-text-subtle);
}

.rc-result {
  border-top: 1px solid var(--app-border);
  padding-top: 16px;
}

.rc-verdict {
  margin: 0 0 14px;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ion-color-success);
}

.rc-fields {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px 16px;
  margin: 0;
  font-size: 0.85rem;
}

.rc-fields dt {
  color: var(--app-text-subtle);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding-top: 2px;
}

.rc-fields dd {
  margin: 0;
  color: var(--app-text);
  overflow-wrap: anywhere;
}

.rc-mono {
  font-family: ui-monospace, monospace;
}

.rc-node {
  font-size: 0.76rem;
  color: var(--app-text-muted);
}

.rc-explain {
  margin: 16px 0 0;
  font-size: 0.82rem;
  line-height: 1.55;
  color: var(--app-text-subtle);
}
</style>
