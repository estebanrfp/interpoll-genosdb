<!--
  OnboardingModal.vue — the three-step welcome: network, spaces, identity.

  It follows InterPoll's own onboarding beat for beat, with one step that could
  not survive the move. Theirs opens by asking which relay to connect to, because
  a Gun client has to be pointed at one. GenosRTC discovers its peers over Nostr
  signalling and repairs its own relay set while it runs, so there is nothing to
  pick — the step stays, and shows what the network is actually doing instead of
  asking the person to configure it.

  Identity is last, as in theirs, so the first two steps happen before a key
  exists: the spaces chosen there are joined once the session opens, since a
  membership is a signed node and needs an author.
-->
<template>
  <ion-modal :is-open="!auth.isLoggedIn" :backdrop-dismiss="false" class="onboarding-modal">
    <div class="ob-shell">
      <div class="ob-pips" :aria-label="`Step ${step + 1} of 3`">
        <span
          v-for="n in 3"
          :key="n"
          class="ob-pip"
          :class="{ active: step >= n - 1, done: step > n - 1 }"
        ></span>
      </div>

      <transition name="ob-fade" mode="out-in">
        <!-- ── STEP 0: the network ──────────────────────────────────────── -->
        <div v-if="step === 0" key="network" class="ob-step">
          <div class="ob-hero-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48" fill="none" width="48" height="48">
              <circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="2" opacity="0.2" />
              <circle cx="24" cy="24" r="14" stroke="currentColor" stroke-width="2" opacity="0.4" />
              <circle cx="24" cy="24" r="6" fill="currentColor" />
              <path d="M24 2v44M2 24h44" stroke="currentColor" stroke-width="1.5" opacity="0.3" />
            </svg>
          </div>
          <h1 class="ob-heading">How do you want to connect?</h1>
          <p class="ob-sub">You don't. There is no relay to choose and none to keep running.</p>

          <div class="ob-option-list">
            <div class="ob-option active">
              <span class="ob-option-icon ob-option-icon--public">
                <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                  <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8" />
                  <path d="M12 2a10 10 0 100 20A10 10 0 0012 2z" stroke="currentColor" stroke-width="1.8" />
                  <path
                    d="M2 12h20M12 2c-3 3-4.5 6.5-4.5 10S9 19 12 22c3-3 4.5-6.5 4.5-10S15 5 12 2z"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
              <div class="ob-option-body">
                <strong>Peer to peer, automatically</strong>
                <span>Peers are found over Nostr signalling; the relay set heals itself as it runs.</span>
              </div>
              <span class="ob-option-check">✓</span>
            </div>

            <div class="ob-option ob-option--status">
              <span class="ob-option-icon ob-option-icon--live" :class="{ connected: isConnected }">
                <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                  <path d="M12 20h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                  <path d="M8.5 16.5a5 5 0 017 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                  <path d="M5 13a10 10 0 0114 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                </svg>
              </span>
              <div class="ob-option-body">
                <strong>{{ isConnected ? 'Connected' : 'Looking for peers…' }}</strong>
                <span>{{ peerCount }} peer{{ peerCount === 1 ? '' : 's' }} in this room right now</span>
              </div>
            </div>
          </div>

          <div class="ob-info-row">
            <svg viewBox="0 0 24 24" fill="none" width="16" height="16" class="ob-info-icon">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.8" />
              <path d="M12 8v4m0 4h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
            Your data is stored on this device first and replicated to peers. Nothing is waiting on a
            server, so the app keeps working while you are offline.
          </div>
        </div>

        <!-- ── STEP 1: the spaces ───────────────────────────────────────── -->
        <div v-else-if="step === 1" key="communities" class="ob-step">
          <div class="ob-hero-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48" fill="none" width="48" height="48">
              <circle cx="16" cy="18" r="7" stroke="currentColor" stroke-width="2" />
              <circle cx="32" cy="18" r="7" stroke="currentColor" stroke-width="2" opacity="0.6" />
              <path d="M4 40c0-7 5.4-12 12-12h8c6.6 0 12 5 12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              <path d="M32 28c4 0 8 3 8 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.5" />
            </svg>
          </div>
          <h1 class="ob-heading">Pick spaces to follow</h1>
          <p class="ob-sub">Your feed shows posts from the spaces you join. You can explore more anytime.</p>

          <div v-if="loadingCommunities" class="ob-loading">
            <div class="ob-spinner"></div>
            <span>Looking for spaces…</span>
          </div>

          <div v-else-if="previewCommunities.length === 0" class="ob-empty">
            <svg viewBox="0 0 48 48" fill="none" width="40" height="40">
              <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="1.5" opacity="0.3" />
              <path d="M16 24h16M24 16v16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.4" />
            </svg>
            <p>No spaces have reached this device yet.</p>
            <p class="ob-empty-sub">They arrive from peers — you can explore and join after setup.</p>
          </div>

          <div v-else class="ob-community-grid">
            <button
              v-for="community in previewCommunities"
              :key="community.id"
              class="ob-community-chip"
              :class="{ active: selectedCommunityIds.has(community.id) }"
              @click="toggleCommunity(community.id)"
            >
              <span class="ob-community-avatar">
                {{ (community.displayName || community.name || '?').charAt(0).toUpperCase() }}
              </span>
              <span class="ob-community-name">{{ community.displayName || community.name }}</span>
              <span v-if="selectedCommunityIds.has(community.id)" class="ob-chip-check">✓</span>
            </button>
          </div>

          <p v-if="selectedCommunityIds.size > 0" class="ob-selection-count">
            {{ selectedCommunityIds.size }} space{{ selectedCommunityIds.size !== 1 ? 's' : '' }} selected
          </p>
        </div>

        <!-- ── STEP 2: the identity ─────────────────────────────────────── -->
        <div v-else key="identity" class="ob-step">
          <div class="ob-hero-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48" fill="none" width="48" height="48">
              <circle cx="24" cy="18" r="9" stroke="currentColor" stroke-width="2" />
              <path d="M8 42c0-9 7.2-16 16-16s16 7 16 16" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </div>
          <h1 class="ob-heading">Your identity</h1>
          <p class="ob-sub">
            Interpoll uses cryptographic keys — no email, no password. The key is generated and kept on
            this device, and it signs everything you publish.
          </p>

          <div v-if="inRegistration" class="ob-identity-card">
            <div class="ob-identity-row">
              <div class="ob-identity-key-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                  <circle cx="8" cy="15" r="4" stroke="currentColor" stroke-width="1.8" />
                  <path d="M12 15h8M18 12v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                </svg>
              </div>
              <div class="ob-identity-info">
                <span class="ob-identity-label">Your keypair</span>
                <span class="ob-identity-value">Generated</span>
              </div>
              <span class="ob-identity-badge">Local only</span>
            </div>
          </div>

          <textarea
            class="ob-mnemonic"
            :readonly="inRegistration"
            v-model="phrase"
            :placeholder="inRegistration
              ? 'Your recovery phrase — save it before continuing.'
              : 'Enter your 12-word recovery phrase, or generate a new identity.'"
          ></textarea>

          <div v-if="inRegistration" class="ob-warning">
            <strong>Save this phrase.</strong> It is the only way back into this identity.
            Store it in a password manager.
          </div>

          <div class="ob-identity-actions">
            <button v-if="inRegistration" class="ob-btn-secondary" @click="copyPhrase">{{ copyLabel }}</button>
            <button v-if="!inRegistration" class="ob-btn-secondary" @click="generate">Generate new identity</button>
            <button v-if="inRegistration" class="ob-btn-secondary" @click="protect">Protect with passkey</button>
            <button v-if="!inRegistration && auth.hasWebAuthnHardware" class="ob-btn-secondary" @click="loginPasskey">
              Use passkey
            </button>
          </div>

          <p v-if="error" class="ob-error">{{ error }}</p>
        </div>
      </transition>

      <div class="ob-nav">
        <button v-if="step > 0" class="ob-btn-secondary" @click="step--">Back</button>
        <span v-else></span>

        <div class="ob-nav-right">
          <button v-if="step < 2" class="ob-btn-ghost" @click="step = 2">Skip</button>
          <button class="ob-btn-primary" :disabled="entering" @click="next">
            {{ step === 2 ? (entering ? 'Starting…' : 'Enter Interpoll') : 'Continue' }}
          </button>
        </div>
      </div>
    </div>
  </ion-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { IonModal } from '@ionic/vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/authStore'
import { db, getNetworkStats } from '@/services/gdbServices'
import { CommunityService } from '@/services/communityService'

interface PreviewCommunity {
  id: string
  name: string
  displayName: string
}

const auth = useAuthStore()
const { hasVolatileIdentity, mnemonic } = storeToRefs(auth)

const step = ref(0)
const phrase = ref('')
const error = ref('')
const entering = ref(false)
const copyLabel = ref('Copy phrase')

const isConnected = ref(false)
const peerCount = ref(0)
let networkTimer: ReturnType<typeof setInterval> | null = null

const loadingCommunities = ref(true)
const previewCommunities = ref<PreviewCommunity[]>([])
const selectedCommunityIds = ref(new Set<string>())

/** During registration the generated phrase is shown read-only for safe saving. */
const inRegistration = computed(() => hasVolatileIdentity.value)

// Surface a freshly generated phrase; clear the field once logged out and idle.
watch(mnemonic, m => { if (m) phrase.value = m })
watch(() => auth.isLoggedIn, loggedIn => { if (!loggedIn && !inRegistration.value) phrase.value = '' })

function refreshNetwork() {
  const stats = getNetworkStats()
  isConnected.value = stats.isConnected
  peerCount.value = stats.peerCount
}

/**
 * Read the spaces this device already holds.
 *
 * Reading needs no session — a guest may `read` and `sync` — so the picker works
 * before an identity exists, which is what keeps identity as the last step.
 */
async function loadCommunities() {
  loadingCommunities.value = true
  try {
    const { results } = await db.map({ query: { type: 'community' } })
    previewCommunities.value = (results ?? [])
      .filter((node: any) => node?.value?.type === 'community' && !node.value.isPrivate)
      .slice(0, 16)
      .map((node: any) => ({
        id: node.id,
        name: node.value.name ?? node.id,
        displayName: node.value.displayName ?? node.value.name ?? node.id,
      }))
  } catch {
    previewCommunities.value = []
  } finally {
    loadingCommunities.value = false
  }
}

function toggleCommunity(id: string) {
  const next = new Set(selectedCommunityIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedCommunityIds.value = next
}

async function generate() {
  error.value = ''
  try { await auth.generateNewIdentity() }
  catch (e: any) { error.value = `Could not generate identity: ${e?.message ?? e}` }
}

async function loginPasskey() {
  error.value = ''
  try { await auth.loginWithWebAuthn() }
  catch (e: any) { if (e?.name !== 'NotAllowedError') error.value = `Passkey login failed: ${e?.message ?? e}` }
}

async function protect() {
  error.value = ''
  try {
    const address = await auth.protectWithWebAuthn()
    if (!address) error.value = 'This authenticator cannot protect the key. Keep your phrase safe instead.'
  } catch (e: any) {
    if (e?.name !== 'NotAllowedError') error.value = `Could not protect with passkey: ${e?.message ?? e}`
  }
}

function copyPhrase() {
  navigator.clipboard.writeText(phrase.value)
    .then(() => {
      copyLabel.value = 'Copied'
      setTimeout(() => { copyLabel.value = 'Copy phrase' }, 2000)
    })
    .catch(() => { error.value = 'Could not copy. Select the phrase and copy it manually.' })
}

/** Join the spaces picked in step 1 — each membership is a node this identity signs. */
async function joinSelectedCommunities() {
  for (const id of selectedCommunityIds.value) {
    try { await CommunityService.joinCommunity(id) }
    catch { /* a space that did not sync yet can be joined later */ }
  }
}

async function next() {
  error.value = ''
  if (step.value < 2) {
    step.value++
    return
  }

  const words = phrase.value.trim()
  if (words.split(/\s+/).filter(Boolean).length !== 12) {
    error.value = 'Enter your 12-word recovery phrase, or generate a new identity.'
    return
  }

  entering.value = true
  try {
    await auth.loginWithMnemonic(words)
    await joinSelectedCommunities()
  } catch (e: any) {
    error.value = `Could not start the session: ${e?.message ?? e}`
  } finally {
    entering.value = false
  }
}

onMounted(() => {
  refreshNetwork()
  networkTimer = setInterval(refreshNetwork, 3000)
  void loadCommunities()
})

onUnmounted(() => {
  if (networkTimer) clearInterval(networkTimer)
})
</script>

<style scoped>
.onboarding-modal::part(content) {
  --width: min(92vw, 480px);
  --height: auto;
  --max-height: 92vh;
  --border-radius: var(--app-radius-lg);
  --background: var(--app-bg-elevated);
  --box-shadow: var(--app-shadow-lg);
}

.ob-shell {
  display: flex;
  flex-direction: column;
  padding: 28px 24px;
  overflow-y: auto;
}

/* Progress pips */
.ob-pips {
  display: flex;
  gap: 6px;
  margin-bottom: 28px;
  justify-content: center;
}

.ob-pip {
  width: 28px;
  height: 4px;
  border-radius: 2px;
  background: var(--app-border-strong);
  transition: background 0.25s;
}

.ob-pip.active { background: rgba(var(--app-accent-rgb), 0.6); }
.ob-pip.done { background: var(--app-accent-bright); }

/* Step */
.ob-step {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ob-hero-icon {
  color: var(--app-accent-bright);
  display: flex;
  justify-content: center;
  margin-bottom: 4px;
}

.ob-heading {
  margin: 0;
  font-size: 26px;
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: -0.03em;
  text-align: center;
  color: var(--app-text);
}

.ob-sub {
  margin: 0;
  font-size: 15px;
  line-height: 1.6;
  text-align: center;
  color: var(--app-text-muted);
}

/* Options */
.ob-option-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ob-option {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 14px;
  text-align: left;
  width: 100%;
}

.ob-option.active {
  border-color: rgba(var(--app-accent-rgb), 0.5);
  background: rgba(var(--app-accent-rgb), 0.08);
  box-shadow: 0 0 0 1px rgba(var(--app-accent-rgb), 0.18);
}

.ob-option-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.ob-option-icon--public {
  background: rgba(var(--app-accent-rgb), 0.15);
  color: var(--app-accent-bright);
}

.ob-option-icon--live {
  background: rgba(var(--app-warning-rgb), 0.15);
  color: var(--app-warning);
  transition: background var(--app-transition), color var(--app-transition);
}

.ob-option-icon--live.connected {
  background: rgba(var(--app-success-rgb), 0.15);
  color: var(--app-success);
}

.ob-option-body {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-width: 0;
}

.ob-option-body strong {
  font-size: 14px;
  font-weight: 700;
  color: var(--app-text);
}

.ob-option-body span {
  font-size: 12px;
  line-height: 1.5;
  color: var(--app-text-muted);
}

.ob-option-check {
  color: var(--app-accent-bright);
  font-size: 16px;
  font-weight: 800;
}

.ob-info-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--app-text-muted);
  padding: 12px 14px;
  background: var(--app-item-surface);
  border: 1px solid var(--app-border);
  border-radius: 12px;
}

.ob-info-icon { flex-shrink: 0; margin-top: 2px; }

/* Spaces */
.ob-loading {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: center;
  padding: 28px 20px;
  color: var(--app-text-muted);
  font-size: 14px;
}

.ob-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--app-border-strong);
  border-top-color: var(--app-accent-bright);
  border-radius: 50%;
  animation: ob-spin 0.8s linear infinite;
  flex-shrink: 0;
}

@keyframes ob-spin { to { transform: rotate(360deg); } }

.ob-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 24px 16px;
  text-align: center;
  color: var(--app-text-subtle);
}

.ob-empty p {
  margin: 0;
  font-size: 14px;
  color: var(--app-text-muted);
}

.ob-empty-sub {
  font-size: 12px !important;
  color: var(--app-text-subtle) !important;
}

.ob-community-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ob-community-chip {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 12px 7px 7px;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 999px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text);
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}

.ob-community-chip:hover { border-color: rgba(var(--app-accent-rgb), 0.3); }

.ob-community-chip.active {
  border-color: rgba(var(--app-accent-rgb), 0.5);
  background: rgba(var(--app-accent-rgb), 0.1);
  color: var(--app-accent-bright);
}

.ob-community-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
  flex-shrink: 0;
  background: rgba(var(--app-accent-rgb), 0.15);
  color: var(--app-accent-bright);
}

.ob-chip-check { font-size: 12px; font-weight: 800; }

.ob-selection-count {
  margin: 0;
  font-size: 13px;
  text-align: center;
  color: var(--app-text-muted);
}

/* Identity */
.ob-identity-card {
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 14px;
  padding: 16px;
}

.ob-identity-row { display: flex; align-items: center; gap: 12px; }

.ob-identity-key-icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: rgba(var(--app-accent-rgb), 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--app-accent-bright);
  flex-shrink: 0;
}

.ob-identity-info { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }

.ob-identity-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--app-text-subtle);
}

.ob-identity-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text);
  font-family: ui-monospace, monospace;
}

.ob-identity-badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 3px 7px;
  border-radius: 6px;
  background: rgba(var(--app-success-rgb), 0.13);
  color: var(--app-success);
}

.ob-mnemonic {
  width: 100%;
  min-height: 80px;
  resize: none;
  padding: 12px 14px;
  font-size: 14px;
  font-family: inherit;
  line-height: 1.5;
  color: var(--app-text);
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 12px;
  box-sizing: border-box;
  transition: border-color var(--app-transition);
}

.ob-mnemonic:focus {
  outline: none;
  border-color: rgba(var(--app-accent-rgb), 0.5);
}

.ob-mnemonic[readonly] {
  background: rgba(var(--app-accent-rgb), 0.06);
  border-color: rgba(var(--app-accent-rgb), 0.3);
}

.ob-warning {
  font-size: 13px;
  line-height: 1.45;
  color: var(--app-text);
  background: rgba(var(--app-warning-rgb), 0.12);
  border: 1px solid rgba(var(--app-warning-rgb), 0.35);
  border-radius: 12px;
  padding: 10px 12px;
}

.ob-identity-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ob-error {
  margin: 0;
  font-size: 13px;
  color: var(--app-danger);
}

/* Nav */
.ob-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--app-border);
  gap: 12px;
}

.ob-nav-right { display: flex; align-items: center; gap: 10px; }

.ob-btn-primary {
  padding: 12px 24px;
  background: linear-gradient(180deg, var(--app-accent-bright), var(--app-accent));
  color: #fff;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s;
  box-shadow: 0 8px 20px rgba(var(--app-accent-rgb), 0.28);
}

.ob-btn-primary:hover { opacity: 0.9; }
.ob-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

.ob-btn-secondary {
  padding: 10px 18px;
  background: var(--app-item-surface);
  border: 1px solid var(--app-border);
  color: var(--app-text);
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.ob-btn-secondary:hover { border-color: rgba(var(--app-accent-rgb), 0.3); }

.ob-btn-ghost {
  background: none;
  border: none;
  color: var(--app-text-muted);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  padding: 4px 8px;
}

.ob-btn-ghost:hover { color: var(--app-text); }

/* Transition */
.ob-fade-enter-active,
.ob-fade-leave-active { transition: opacity 180ms ease, transform 200ms ease; }
.ob-fade-enter-from { opacity: 0; transform: translateX(14px); }
.ob-fade-leave-to { opacity: 0; transform: translateX(-14px); }
</style>
