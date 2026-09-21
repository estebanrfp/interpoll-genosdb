import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { IonicVue } from '@ionic/vue';
import '@ionic/vue/css/core.css';
import '@ionic/vue/css/normalize.css';
import '@ionic/vue/css/structure.css';
import '@ionic/vue/css/typography.css';
import '@ionic/vue/css/padding.css';
import '@ionic/vue/css/float-elements.css';
import '@ionic/vue/css/text-alignment.css';
import '@ionic/vue/css/text-transformation.css';
import '@ionic/vue/css/flex-utils.css';
import '@ionic/vue/css/display.css';
import './style.css';
import App from './App.vue';
import router from './router';

/**
 * Drop the pre-0.36.0 passkey registration left on this device.
 *
 * GenosDB 0.36.0 wraps the private key under HKDF of the authenticator's PRF
 * secret and stores it under new keys; the engine neither reads nor clears what
 * the earlier layout wrote, so the app does it once at startup (MIGRATION.md).
 * Whoever protected an identity before 0.36.0 signs in with their phrase and
 * chooses `Protect with passkey` again.
 */
for (const key of ['gdb_ethereum_material_encrypted_webauthn_v2', 'gdb_webauthn_registration_details_v2']) {
  try { localStorage.removeItem(key) } catch { /* private mode or blocked storage */ }
}

// GenosDB initialises itself via the top-level await in services/gdbServices.ts —
// no manual relay probing, cache warming or RAM watchdog needed.
const app = createApp(App)
  .use(IonicVue)
  .use(createPinia())
  .use(router);

router.isReady().then(() => {
  app.mount('#app');
  // Image uploads use the GenosDB-backed image helper; initialise it lazily after paint.
  import('./services/imageService')
    .then(({ ImageService }) => ImageService.initialize?.())
    .catch(() => { /* image hosting optional */ });
});
