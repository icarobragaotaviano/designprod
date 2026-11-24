import {
  normalize,
  normalizeItems,
  normalizePrinterCatalog,
  normalizePrinterEntry,
  normalizePrinters,
  normalizeReminders,
  record,
  restorePlan,
  sanitizeHttpUrl,
  validate,
  normalizeCounterTicket,
  validateCounterTicket,
  recordCounterTicket,
  counterRestorePlan
} from './model.js';

const RESERVED_PRINTERS_TEMPLATE_NAME = '__osm_printers_v1__';
const RESERVED_SUITE_DATA_PREFIX = '__suite_data__:';
const COUNTER_SUITE_DATA_KEY = 'osm:counter_tickets';

const cloudConfigKey = 'os-maneger:cloud-config:v1';
const driveTokenKey = 'os-maneger:gdrive-token:v1';
const driveGrantedFlagKey = 'os-maneger:gdrive-granted:v1';
const maxAttachmentBytes = 25 * 1024 * 1024;
const maxBackupBytes = 5 * 1024 * 1024;
const maxSuitePayloadBytes = 512 * 1024;
const driveScope = 'https://www.googleapis.com/auth/drive.file';
const gisScriptUrl = 'https://accounts.google.com/gsi/client';
const ALLOWED_SUITE_APPS = new Set(['folha', 'numera-bloco', 'os-maneger', 'suite']);

let sdkPromise = null;
let gisPromise = null;
let client = null;
let clientKey = '';
let clientPromise = null;
let activeConfig = null;

function getGlobalStorage(name) {
  try {
    return typeof globalThis !== 'undefined' && globalThis[name] ? globalThis[name] : null;
  } catch {
    return null;
  }
}

function readStorageSafe(store, key) {
  if (!store || typeof store.getItem !== 'function') return null;
  try {
    const val = store.getItem(key);
    return typeof val === 'string' ? val : null;
  } catch {
    return null;
  }
}

function writeStorageSafe(store, key, value) {
  if (!store || typeof store.setItem !== 'function') return;
  try {
    store.setItem(key, value);
  } catch {}
}

function removeStorageSafe(store, key) {
  if (!store || typeof store.removeItem !== 'function') return;
  try {
    store.removeItem(key);
  } catch {}
}

/** Cria adapter de storage resiliente contra descarte silencioso de writes síncronos no localStorage. */
export function createResilientAuthStorage(overrides = {}) {
  const hasLs = Object.prototype.hasOwnProperty.call(overrides, 'localStorage');
  const hasSs = Object.prototype.hasOwnProperty.call(overrides, 'sessionStorage');
  const hasSchedule = typeof overrides.schedule === 'function';
  const hasCancelSchedule = typeof overrides.cancelSchedule === 'function';

  const getLs = () => (hasLs ? overrides.localStorage : getGlobalStorage('localStorage'));
  const getSs = () => (hasSs ? overrides.sessionStorage : getGlobalStorage('sessionStorage'));
  const schedule = (fn) => {
    if (hasSchedule) return overrides.schedule(fn);
    return typeof globalThis.setTimeout === 'function' ? globalThis.setTimeout(fn, 0) : null;
  };
  const cancelSchedule = (id) => {
    if (id === null || id === undefined) return;
    if (hasCancelSchedule) {
      overrides.cancelSchedule(id);
      return;
    }
    if (typeof globalThis.clearTimeout === 'function') globalThis.clearTimeout(id);
  };

  const mem = new Map();
  const dirtyValues = new Map();
  const pendingTimers = new Map();

  const clearTimer = (key) => {
    if (!pendingTimers.has(key)) return;
    cancelSchedule(pendingTimers.get(key));
    pendingTimers.delete(key);
  };

  const scanStoreKeys = (store) => {
    if (!store || typeof store.length !== 'number' || typeof store.key !== 'function') return [];
    const keys = [];
    try {
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k) keys.push(k);
      }
    } catch {}
    return keys;
  };

  const scheduleWriteRetry = (key, strVal) => {
    const ss = getSs();
    const ls = getLs();
    writeStorageSafe(ss, key, strVal);
    writeStorageSafe(ls, key, strVal);
    const ssOk = !ss || readStorageSafe(ss, key) === strVal;
    const lsOk = !ls || readStorageSafe(ls, key) === strVal;
    if (ssOk && lsOk) {
      dirtyValues.delete(key);
      return;
    }
    dirtyValues.set(key, strVal);
    clearTimer(key);
    let completed = false;
    const id = schedule(() => {
      completed = true;
      pendingTimers.delete(key);
      if (!mem.has(key) || mem.get(key) !== strVal) return;
      const nextSs = getSs();
      const nextLs = getLs();
      writeStorageSafe(nextSs, key, strVal);
      writeStorageSafe(nextLs, key, strVal);
      const nextSsOk = !nextSs || readStorageSafe(nextSs, key) === strVal;
      const nextLsOk = !nextLs || readStorageSafe(nextLs, key) === strVal;
      if (nextSsOk && nextLsOk) dirtyValues.delete(key);
    });
    if (!completed && id !== null && id !== undefined) pendingTimers.set(key, id);
  };

  const scheduleRemoveRetry = (key) => {
    const ss = getSs();
    const ls = getLs();
    removeStorageSafe(ss, key);
    removeStorageSafe(ls, key);
    const ssCleared = !ss || readStorageSafe(ss, key) === null;
    const lsCleared = !ls || readStorageSafe(ls, key) === null;
    if (ssCleared && lsCleared) return;
    clearTimer(key);
    let completed = false;
    const id = schedule(() => {
      completed = true;
      pendingTimers.delete(key);
      if (mem.has(key)) return;
      removeStorageSafe(getSs(), key);
      removeStorageSafe(getLs(), key);
    });
    if (!completed && id !== null && id !== undefined) pendingTimers.set(key, id);
  };

  /** Pre-carrega chaves existentes em stack 1st-party para evitar bloqueio 3rd-party no getSession(). */
  const warmFromStorage = (extraKeys = []) => {
    const ls = getLs();
    const ss = getSs();
    const keys = new Set([...scanStoreKeys(ls), ...scanStoreKeys(ss), ...extraKeys]);
    for (const key of keys) {
      if (dirtyValues.has(key) || pendingTimers.has(key)) continue;
      if (mem.has(key)) continue;
      const lsVal = readStorageSafe(ls, key);
      if (typeof lsVal === 'string') {
        mem.set(key, lsVal);
        writeStorageSafe(ss, key, lsVal);
        continue;
      }
      const ssVal = readStorageSafe(ss, key);
      if (typeof ssVal === 'string') {
        mem.set(key, ssVal);
        scheduleWriteRetry(key, ssVal);
      }
    }
  };

  if (!hasLs && !hasSchedule && typeof globalThis !== 'undefined' && typeof globalThis.addEventListener === 'function') {
    try {
      globalThis.addEventListener('storage', (event) => {
        if (!event || event.storageArea !== getLs()) return;
        if (event.key === null) {
          for (const key of pendingTimers.keys()) clearTimer(key);
          mem.clear();
          dirtyValues.clear();
          return;
        }
        clearTimer(event.key);
        dirtyValues.delete(event.key);
        if (typeof event.newValue === 'string') {
          mem.set(event.key, event.newValue);
          writeStorageSafe(getSs(), event.key, event.newValue);
        } else {
          mem.delete(event.key);
          removeStorageSafe(getSs(), event.key);
        }
      });
    } catch {}
  }

  warmFromStorage();

  return {
    warm: warmFromStorage,

    getItem(key) {
      if (mem.has(key)) return mem.get(key);

      const lsVal = readStorageSafe(getLs(), key);
      if (typeof lsVal === 'string') {
        mem.set(key, lsVal);
        writeStorageSafe(getSs(), key, lsVal);
        return lsVal;
      }

      const ssVal = readStorageSafe(getSs(), key);
      if (typeof ssVal === 'string') {
        mem.set(key, ssVal);
        scheduleWriteRetry(key, ssVal);
        return ssVal;
      }

      return null;
    },

    setItem(key, value) {
      const strVal = String(value);
      clearTimer(key);
      mem.set(key, strVal);
      scheduleWriteRetry(key, strVal);
    },

    removeItem(key) {
      clearTimer(key);
      dirtyValues.delete(key);
      mem.delete(key);
      scheduleRemoveRetry(key);
    }
  };
}

const authStorage = createResilientAuthStorage();
let currentSession = null;
let verifyingCredential = false;
let driveExpiryTimer = null;
let activeNoncePair = null;
let initializedGisClientId = '';
let gisInitPromise = null;
let gisCallbacks = {};
let driveFolderCache = new Map();
let supportsPausedFromColumn = true;
let supportsPrintersColumn = true;
let supportsItemsColumn = true;
let supportsRemindersColumn = true;
let supportsDatesColumns = true;
let supportsPrintLinkColumn = true;
let supportsTemplatesTable = true;
let supportsPrintersTable = true;
let supportsSuiteDataTable = true;
let supportsCounterTicketsTable = true;

export function resetCloudCompatibilityFlags() {
  supportsPausedFromColumn = true;
  supportsPrintersColumn = true;
  supportsItemsColumn = true;
  supportsRemindersColumn = true;
  supportsDatesColumns = true;
  supportsPrintLinkColumn = true;
  supportsTemplatesTable = true;
  supportsPrintersTable = true;
  supportsSuiteDataTable = true;
  supportsCounterTicketsTable = true;
  driveFolderCache.clear();
}
const driveListeners = new Set();
const authListeners = new Set();

function randomId(prefix = 'att') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().slice(0, 12)}`;
  }
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

async function createNoncePair() {
  let raw = '';
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    raw = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  } else {
    raw = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
  }
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    const hashed = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    return { raw, hashed };
  }
  return { raw, hashed: raw };
}

function notifyDriveListeners() {
  const active = hasActiveDriveToken();
  for (const listener of driveListeners) {
    try { listener(active); } catch {}
  }
}

export function onDriveTokenChange(callback) {
  if (typeof callback !== 'function') return () => {};
  driveListeners.add(callback);
  return () => driveListeners.delete(callback);
}

export function readManualCloudConfig() {
  try {
    const raw = localStorage.getItem(cloudConfigKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      supabaseUrl: String(parsed.supabaseUrl || '').trim().replace(/\/+$/, ''),
      supabaseAnonKey: String(parsed.supabaseAnonKey || '').trim(),
      googleClientId: String(parsed.googleClientId || '').trim(),
      driveFolderName: String(parsed.driveFolderName || 'OS Maneger - Anexos').trim() || 'OS Maneger - Anexos',
      driveBackupFolderName: String(parsed.driveBackupFolderName || 'IBD Suite - Backups').trim() || 'IBD Suite - Backups',
      storageBucket: String(parsed.storageBucket || 'os-attachments').trim() || 'os-attachments',
      requireGmailDomain: parsed.requireGmailDomain === undefined ? undefined : !!parsed.requireGmailDomain
    };
  } catch {
    return null;
  }
}

export function saveManualCloudConfig(input) {
  const clean = {
    supabaseUrl: String(input?.supabaseUrl || '').trim().replace(/\/+$/, ''),
    supabaseAnonKey: String(input?.supabaseAnonKey || '').trim(),
    googleClientId: String(input?.googleClientId || '').trim(),
    driveFolderName: String(input?.driveFolderName || 'OS Maneger - Anexos').trim() || 'OS Maneger - Anexos',
    driveBackupFolderName: String(input?.driveBackupFolderName || 'IBD Suite - Backups').trim() || 'IBD Suite - Backups',
    storageBucket: String(input?.storageBucket || 'os-attachments').trim() || 'os-attachments',
    ...(input?.requireGmailDomain === undefined ? {} : { requireGmailDomain: !!input.requireGmailDomain })
  };
  localStorage.setItem(cloudConfigKey, JSON.stringify(clean));
  client = null;
  clientKey = '';
  clientPromise = null;
  activeConfig = null;
  initializedGisClientId = '';
  activeNoncePair = null;
  return clean;
}

export function clearManualCloudConfig() {
  localStorage.removeItem(cloudConfigKey);
  clearDriveToken();
  client = null;
  clientKey = '';
  clientPromise = null;
  activeConfig = null;
  currentSession = null;
  activeNoncePair = null;
  initializedGisClientId = '';
}

async function fetchServerCloudConfig() {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch('/api/config', { cache: 'no-store' });
      if (res.ok) return await res.json();
      if (res.status < 500) return {};
    } catch {}
    if (attempt === 0) await new Promise(r => setTimeout(r, 250));
  }
  return {};
}

export async function resolveCloudConfig() {
  const server = await fetchServerCloudConfig();
  const manual = readManualCloudConfig();
  const hasServer = Boolean(server?.supabaseUrl && server?.supabaseAnonKey);
  const hasManual = Boolean(manual?.supabaseUrl && manual?.supabaseAnonKey);
  const supabaseUrl = hasServer
    ? String(server.supabaseUrl).trim().replace(/\/+$/, '')
    : (manual?.supabaseUrl || '');
  const supabaseAnonKey = hasServer
    ? String(server.supabaseAnonKey).trim()
    : (manual?.supabaseAnonKey || '');
  const googleClientId = String(server?.googleClientId || manual?.googleClientId || '').trim();

  activeConfig = {
    source: hasServer ? 'env' : hasManual ? 'manual' : 'none',
    supabaseConfigured: hasServer || hasManual,
    googleConfigured: Boolean(googleClientId),
    supabaseUrl,
    supabaseAnonKey,
    googleClientId,
    driveFolderName: manual?.driveFolderName || server?.driveFolderName || 'OS Maneger - Anexos',
    driveBackupFolderName: manual?.driveBackupFolderName || server?.driveBackupFolderName || 'IBD Suite - Backups',
    storageBucket: manual?.storageBucket || server?.storageBucket || 'os-attachments',
    requireGmailDomain: Boolean(server?.requireGmailDomain || manual?.requireGmailDomain)
  };
  return activeConfig;
}

export function getCloudConfig() {
  return activeConfig;
}

export function isPreconfiguredCloud() {
  return Boolean(activeConfig?.source === 'env' && activeConfig?.supabaseConfigured);
}

async function loadSupabaseSdk() {
  if (!sdkPromise) {
    sdkPromise = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm')
      .catch(() => import('https://esm.sh/@supabase/supabase-js@2.119.0'));
  }
  return sdkPromise;
}

async function loadGoogleIdentitySdk() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw Error('Login com Google requer ambiente de navegador.');
  }
  if (window.google?.accounts?.id && window.google?.accounts?.oauth2) {
    return window.google;
  }
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-google-gsi="1"]');
      if (existing) {
        if (window.google?.accounts?.id) return resolve(window.google);
        existing.addEventListener('load', () => resolve(window.google), { once: true });
        existing.addEventListener('error', () => reject(Error('Falha ao carregar SDK do Google Identity.')), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = gisScriptUrl;
      script.async = true;
      script.defer = true;
      script.dataset.googleGsi = '1';
      script.onload = () => {
        if (window.google?.accounts?.id) resolve(window.google);
        else reject(Error('SDK do Google carregado sem suporte a login.'));
      };
      script.onerror = () => {
        gisPromise = null;
        reject(Error('Não foi possível carregar o login do Google (verifique sua conexão ou bloqueador).'));
      };
      document.head.appendChild(script);
    });
  }
  return gisPromise;
}

function clearDriveExpiryTimer() {
  if (driveExpiryTimer !== null) {
    clearTimeout(driveExpiryTimer);
    driveExpiryTimer = null;
  }
}

function scheduleDriveExpiryTimer(expiresAt) {
  clearDriveExpiryTimer();
  const delayMs = Number(expiresAt || 0) - Date.now();
  if (delayMs <= 0 || delayMs > 24 * 60 * 60 * 1000) return;
  driveExpiryTimer = setTimeout(() => {
    driveExpiryTimer = null;
    if (!hasActiveDriveToken()) notifyDriveListeners();
  }, delayMs + 50);
  driveExpiryTimer?.unref?.();
}

function readStoredDriveRecord() {
  try {
    authStorage.warm?.([driveTokenKey]);
    const raw = authStorage.getItem(driveTokenKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed.expiresAt || parsed.expiresAt <= Date.now()) {
      clearDriveExpiryTimer();
      authStorage.removeItem(driveTokenKey);
      return null;
    }
    const activeEmail = (currentSession?.user?.email || '').trim().toLowerCase();
    const storedEmail = String(parsed.email || '').trim().toLowerCase();
    if (activeEmail && storedEmail && storedEmail !== activeEmail) return null;
    return parsed;
  } catch {
    return null;
  }
}

function storeDriveToken(token, email, expiresInSec = 3500) {
  if (!token) return;
  const ttlMs = Math.max(120, Number(expiresInSec || 3500) - 60) * 1000;
  const expiresAt = Date.now() + ttlMs;
  try {
    authStorage.setItem(driveTokenKey, JSON.stringify({
      token,
      email: String(email || '').trim().toLowerCase(),
      expiresAt
    }));
  } catch {}
  scheduleDriveExpiryTimer(expiresAt);
  notifyDriveListeners();
}

function clearDriveToken() {
  clearDriveExpiryTimer();
  try {
    authStorage.removeItem(driveTokenKey);
  } catch {}
  driveFolderCache.clear();
  notifyDriveListeners();
}

export function hasActiveDriveToken() {
  if (currentSession?.provider_token) return true;
  return Boolean(readStoredDriveRecord()?.token);
}

export function getDriveToken() {
  if (currentSession?.provider_token) return currentSession.provider_token;
  return readStoredDriveRecord()?.token || '';
}

export function getDriveConnectionInfo() {
  const rec = readStoredDriveRecord();
  const cfg = activeConfig || readManualCloudConfig();
  const hasProviderToken = Boolean(currentSession?.provider_token);
  const connected = hasProviderToken || Boolean(rec?.token);
  const expiresAt = rec?.expiresAt || (hasProviderToken ? Date.now() + 3000 * 1000 : 0);
  const remainingMinutes = connected && expiresAt > Date.now()
    ? Math.max(1, Math.round((expiresAt - Date.now()) / 60000))
    : 0;
  return {
    connected,
    email: rec?.email || currentSession?.user?.email || '',
    expiresAt,
    remainingMinutes,
    attachmentsFolder: cfg?.driveFolderName || 'OS Maneger - Anexos',
    backupsFolder: cfg?.driveBackupFolderName || 'IBD Suite - Backups'
  };
}

export function isGmailAddress(email) {
  const lower = String(email || '').trim().toLowerCase();
  return lower.endsWith('@gmail.com') || lower.endsWith('@googlemail.com');
}

export async function ensureCloudClient() {
  const cfg = activeConfig || await resolveCloudConfig();
  if (!cfg.supabaseConfigured) return null;
  const sig = `${cfg.supabaseUrl}::${cfg.supabaseAnonKey}`;
  if (client && clientKey === sig) return client;
  if (clientPromise) return clientPromise;

  clientPromise = (async () => {
    try {
      authStorage.warm?.();
      const sdk = await loadSupabaseSdk();
      authStorage.warm?.();
      if (client && clientKey === sig) return client;
      client = sdk.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: {
          storage: authStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false
        }
      });
      clientKey = sig;
      return client;
    } finally {
      clientPromise = null;
    }
  })();
  return clientPromise;
}

/** Verify whether an authenticated Supabase session satisfies Gmail domain and DB allowlist rules. */
export async function verifyCloudUserAllowed(sb, session = currentSession, cfgOverride = null) {
  if (!session?.user) return { allowed: false, reason: 'Sessão ausente.' };
  const cfg = cfgOverride || activeConfig || await resolveCloudConfig().catch(() => null);
  const email = session.user?.email || '';
  if (cfg?.requireGmailDomain && !isGmailAddress(email)) {
    return { allowed: false, reason: 'Acesso restrito a contas @gmail.com.' };
  }
  if (!sb || typeof sb.from !== 'function') return { allowed: true };
  try {
    const { data, error, status } = await sb.from('os_allowed_emails').select('email').limit(1);
    if (!error) {
      return Array.isArray(data) && data.length > 0
        ? { allowed: true }
        : { allowed: false, reason: 'Acesso exclusivo: este e-mail Google não está autorizado para usar o aplicativo.' };
    }
    if (status === 401 || status === 403 || error?.code === '42501') {
      return { allowed: false, reason: 'Acesso exclusivo: este e-mail Google não está autorizado para usar o aplicativo.' };
    }
    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

export async function getCloudSession() {
  authStorage.warm?.();
  const sb = await ensureCloudClient();
  if (!sb) return null;
  const { data, error } = await sb.auth.getSession();
  if (error) throw error;
  currentSession = data?.session || null;
  if (currentSession) {
    const verdict = await verifyCloudUserAllowed(sb, currentSession);
    if (!verdict.allowed) {
      await signOutCloud();
      return null;
    }
  }
  if (currentSession?.provider_token) {
    storeDriveToken(currentSession.provider_token, currentSession.user?.email);
  }
  return currentSession;
}

export function onCloudAuthChange(callback) {
  let subscription = null;
  let cancelled = false;
  if (typeof callback === 'function') authListeners.add(callback);
  ensureCloudClient().then(sb => {
    if (!sb || cancelled) return;
    const { data } = sb.auth.onAuthStateChange((event, session) => {
      if (verifyingCredential && session) return;
      currentSession = session || null;
      if (session && event !== 'SIGNED_OUT') {
        verifyCloudUserAllowed(sb, session).then(async verdict => {
          if (cancelled) return;
          if (!verdict.allowed) {
            await signOutCloud();
            callback?.('SIGNED_OUT', null);
            return;
          }
          if (session?.provider_token) {
            storeDriveToken(session.provider_token, session.user?.email);
          }
          callback?.(event, session);
        }).catch(() => {
          if (!cancelled) callback?.(event, session);
        });
        return;
      }
      if (event === 'SIGNED_OUT') {
        clearDriveToken();
      }
      callback?.(event, session);
    });
    subscription = data?.subscription || null;
  }).catch(() => {});
  return () => {
    cancelled = true;
    authListeners.delete(callback);
    subscription?.unsubscribe?.();
  };
}

const OFFICIAL_PRODUCTION_ORIGIN = 'https://folha-imposicao.vercel.app';
const AUTHORIZED_PROD_ORIGINS = new Set([
  'https://folha-imposicao.vercel.app',
  'https://os-maneger.vercel.app',
  'https://ibd-os-maneger.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
]);

export function getOAuthOriginStatus(loc = typeof globalThis !== 'undefined' ? globalThis.location : null) {
  const origin = String(loc?.origin || '');
  const hostname = String(loc?.hostname || '').toLowerCase();
  const pathname = String(loc?.pathname || '/');
  const search = String(loc?.search || '');
  const isVercelPreview = Boolean(origin && hostname.endsWith('.vercel.app') && !AUTHORIZED_PROD_ORIGINS.has(origin));
  const safePath = pathname.startsWith('/') ? pathname : '/';
  const canonicalUrl = sanitizeHttpUrl(`${OFFICIAL_PRODUCTION_ORIGIN}${safePath}${search}`, OFFICIAL_PRODUCTION_ORIGIN);
  return {
    isPreviewOrigin: isVercelPreview,
    currentOrigin: origin,
    canonicalOrigin: OFFICIAL_PRODUCTION_ORIGIN,
    canonicalUrl,
    reason: isVercelPreview
      ? `Esta é uma URL temporária de preview (${origin}). Pela política OAuth 2.0 do Google, o login Google só é autorizado no domínio oficial ${OFFICIAL_PRODUCTION_ORIGIN}.`
      : ''
  };
}

function mapAuthError(err) {
  const msg = String(err?.message || err || '');
  if (/origin_mismatch/i.test(msg)) {
    return `Origem não autorizada no Google OAuth (origin_mismatch). Acesse pelo domínio oficial ${OFFICIAL_PRODUCTION_ORIGIN} ou registre esta URL no Console do Google Cloud.`;
  }
  if (/unacceptable audience/i.test(msg)) {
    return 'O GOOGLE_CLIENT_ID do app não está listado no provedor Google do Supabase (Authentication → Providers → Google → Client IDs).';
  }
  if (/nonce/i.test(msg)) {
    return 'Falha na validação de nonce do token Google. Tente entrar novamente.';
  }
  if (/signups?\s+not\s+allowed/i.test(msg)) {
    return 'Acesso exclusivo: apenas o Gmail autorizado pelo proprietário pode entrar neste aplicativo.';
  }
  return msg || 'Não foi possível autenticar sua conta Google no app.';
}

async function exchangeGoogleCredential(credential, rawNonce) {
  const sb = await ensureCloudClient();
  if (!sb) throw Error('Integração com o Supabase não encontrada.');
  verifyingCredential = true;
  try {
    const { data, error } = await sb.auth.signInWithIdToken({
      provider: 'google',
      token: credential,
      ...(rawNonce ? { nonce: rawNonce } : {})
    });
    if (error) throw Error(mapAuthError(error));
    currentSession = data?.session || null;
    activeNoncePair = null;

    if (currentSession?.access_token && currentSession?.refresh_token) {
      const check = await sb.auth.getSession().catch(() => null);
      if (!check?.data?.session) {
        await sb.auth.setSession({
          access_token: currentSession.access_token,
          refresh_token: currentSession.refresh_token
        }).catch(() => {});
      }
    }

    const verdict = await verifyCloudUserAllowed(sb, currentSession);
    if (!verdict.allowed) {
      await signOutCloud();
      throw Error(verdict.reason);
    }
    return currentSession;
  } finally {
    verifyingCredential = false;
  }
}

async function initializeGoogleSignIn({ onSuccess, onError, onBusy } = {}) {
  gisCallbacks = { onSuccess, onError, onBusy };
  const cfg = activeConfig || await resolveCloudConfig();
  if (!cfg?.supabaseConfigured) {
    throw Error('Integração com o Supabase não localizada.');
  }
  if (!cfg.googleClientId) {
    throw Object.assign(
      Error('Configure GOOGLE_CLIENT_ID nas variáveis da Vercel (ou em Ajustes avançados) para autenticar com Google direto no app.'),
      { code: 'GOOGLE_CLIENT_ID_MISSING' }
    );
  }

  if (gisInitPromise) {
    return gisInitPromise;
  }

  if (initializedGisClientId === cfg.googleClientId && activeNoncePair && window.google?.accounts?.id) {
    return { google: window.google, cfg };
  }

  gisInitPromise = (async () => {
    const google = await loadGoogleIdentitySdk();
    if (initializedGisClientId === cfg.googleClientId && activeNoncePair) {
      return { google, cfg };
    }
    const noncePair = await createNoncePair();
    activeNoncePair = noncePair;

    google.accounts.id.initialize({
      client_id: cfg.googleClientId,
      nonce: noncePair.hashed,
      auto_select: false,
      cancel_on_tap_outside: true,
      use_fedcm_for_prompt: true,
      context: 'signin',
      callback: async (response) => {
        if (!response?.credential) {
          gisCallbacks.onError?.(Error('Nenhuma credencial retornada pelo Google.'));
          return;
        }
        try {
          gisCallbacks.onBusy?.(true);
          const usedRaw = activeNoncePair?.raw || noncePair.raw;
          const session = await exchangeGoogleCredential(response.credential, usedRaw);
          gisCallbacks.onSuccess?.(session);
        } catch (err) {
          gisCallbacks.onError?.(err);
        } finally {
          gisCallbacks.onBusy?.(false);
        }
      }
    });
    initializedGisClientId = cfg.googleClientId;

    return { google, cfg };
  })();

  try {
    return await gisInitPromise;
  } finally {
    gisInitPromise = null;
  }
}

/** Render Google's native Sign-In button inside the app modal/card (never leaving the app). */
export async function renderInAppGoogleButton(containerEl, { onSuccess, onError, onBusy } = {}) {
  if (!containerEl) return false;
  const { google, cfg } = await initializeGoogleSignIn({ onSuccess, onError, onBusy });
  const nonceHash = activeNoncePair?.hashed || '';
  if (
    containerEl.dataset.gisClientId === cfg.googleClientId &&
    containerEl.dataset.gisNonce === nonceHash &&
    containerEl.childElementCount > 0
  ) {
    return true;
  }
  containerEl.innerHTML = '';
  containerEl.dataset.gisClientId = cfg.googleClientId;
  containerEl.dataset.gisNonce = nonceHash;
  const width = Math.min(340, Math.max(240, Math.round(containerEl.clientWidth || 300)));
  google.accounts.id.renderButton(containerEl, {
    theme: 'filled_black',
    size: 'large',
    type: 'standard',
    text: 'continue_with',
    shape: 'rectangular',
    logo_alignment: 'left',
    locale: 'pt-BR',
    width
  });
  return true;
}

/** Prompt Google Sign-In directly inside the app via GIS One Tap / credential chooser + signInWithIdToken. */
export async function signInWithGmail(_unusedRedirectUrl, { onSuccess, onError, onBusy } = {}) {
  const { google } = await initializeGoogleSignIn({ onSuccess, onError, onBusy });
  return new Promise((resolve, reject) => {
    let settled = false;
    const finishError = err => {
      if (settled) return;
      settled = true;
      reject(err);
    };
    const finishOk = () => {
      if (settled) return;
      settled = true;
      resolve(true);
    };

    try {
      google.accounts.id.prompt(notification => {
        if (notification?.isDisplayed?.()) {
          finishOk();
          return;
        }
        if (notification?.isNotDisplayed?.() || notification?.isSkippedMoment?.()) {
          finishError(Error('Clique no botão "Continuar com o Google" acima para abrir a janela de conta Google no app.'));
        } else if (notification?.isDismissedMoment?.()) {
          finishOk();
        }
      });
    } catch (err) {
      finishError(Error(err?.message || 'Não foi possível abrir o login Google no app.'));
    }
  });
}

/** Request Google Drive file scope token directly in-app using GIS OAuth2 popup. */
export async function requestDriveAccessToken({ prompt = 'auto', loginHint = '' } = {}) {
  const cfg = activeConfig || await resolveCloudConfig();
  if (!cfg.googleClientId) {
    throw Object.assign(
      Error('Configure GOOGLE_CLIENT_ID na Vercel (ou em Ajustes avançados) para conectar o Google Drive direto no app.'),
      { code: 'GOOGLE_CLIENT_ID_MISSING' }
    );
  }
  const google = await loadGoogleIdentitySdk();
  const hint = (loginHint || currentSession?.user?.email || '').trim().toLowerCase();
  let previouslyGranted = false;
  try {
    const savedGranted = readStorageSafe(getGlobalStorage('localStorage'), driveGrantedFlagKey);
    previouslyGranted = Boolean(savedGranted && (!hint || savedGranted === hint));
  } catch {}
  const resolvedPrompt = prompt === 'auto' ? (previouslyGranted ? '' : 'consent') : prompt;

  return new Promise((resolve, reject) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(Error('Tempo esgotado aguardando autorização do Google Drive. Tente novamente e verifique se o pop-up não foi bloqueado.'));
    }, 90000);
    timeoutId?.unref?.();

    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      fn(arg);
    };

    try {
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: cfg.googleClientId,
        scope: driveScope,
        ...(hint ? { hint } : {}),
        callback: (resp) => {
          if (resp?.error) {
            if (resp.error === 'popup_closed_by_user' || resp.error === 'access_denied') {
              finish(reject, Error('Autorização do Google Drive cancelada.'));
              return;
            }
            if ((resp.error === 'consent_required' || resp.error === 'interaction_required') && resolvedPrompt === '') {
              try {
                tokenClient.requestAccessToken({ prompt: 'consent' });
                return;
              } catch {}
            }
            finish(reject, Error(resp.error_description || resp.error || 'Falha ao autorizar Google Drive.'));
            return;
          }
          if (!resp?.access_token) {
            finish(reject, Error('Google não retornou o token de acesso para o Drive.'));
            return;
          }
          const grantedScope = String(resp.scope || '');
          if (grantedScope && !grantedScope.split(/\s+/).includes(driveScope)) {
            finish(reject, Error('Permissão do Google Drive não foi concedida. Marque a caixa de acesso aos arquivos criados pelo app e tente novamente.'));
            return;
          }
          storeDriveToken(resp.access_token, hint, Number(resp.expires_in || 3500));
          writeStorageSafe(getGlobalStorage('localStorage'), driveGrantedFlagKey, hint || '1');
          driveFolderCache.clear();
          finish(resolve, resp.access_token);
        },
        error_callback: (err) => {
          finish(reject, Error(err?.message || 'Não foi possível abrir o pop-up do Google Drive (verifique o bloqueador de pop-ups).'));
        }
      });
      tokenClient.requestAccessToken({ prompt: resolvedPrompt });
    } catch (err) {
      finish(reject, Error(err?.message || 'Erro ao inicializar conexão com Google Drive.'));
    }
  });
}

export async function signOutCloud() {
  clearDriveToken();
  currentSession = null;
  activeNoncePair = null;
  initializedGisClientId = '';
  try {
    window.google?.accounts?.id?.disableAutoSelect?.();
  } catch {}
  const sb = await ensureCloudClient();
  if (sb) await sb.auth.signOut();
}

export function currentCloudUser() {
  const user = currentSession?.user;
  if (!user) return null;
  return {
    id: user.id,
    email: user.email || '',
    name: user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'Equipe',
    avatar: sanitizeHttpUrl(user.user_metadata?.avatar_url || user.user_metadata?.picture || '', '')
  };
}

function mapCloudError(error, fallback) {
  if (!error) return fallback;
  const code = error.code || '';
  const msg = String(error.message || '');
  if (code === '42501' || /row-level security/i.test(msg)) {
    return 'Sua conta Google não está autorizada nas políticas do Supabase (verifique os_allowed_emails / RLS).';
  }
  if (code === '42P01' || /does not exist/i.test(msg)) {
    return 'Tabela não encontrada no Supabase. Execute o script supabase/schema.sql.';
  }
  if (code === '23505') return 'Já existe uma OS com este número.';
  return msg || fallback;
}

function isMissingColumnError(error, colName) {
  const code = String(error?.code || '');
  const msg = String(error?.message || '');
  return (code === 'PGRST204' || code === '42703' || /schema cache/i.test(msg)) && msg.includes(colName);
}

function isMissingTableError(error, tableName) {
  const code = String(error?.code || '');
  const msg = String(error?.message || '');
  return code === '42P01' || code === 'PGRST205' || (tableName && msg.includes(tableName));
}

export function rowToOrder(row) {
  const rawWorkflow = row?.workflow && typeof row.workflow === 'object' && !Array.isArray(row.workflow)
    ? { ...row.workflow }
    : {};
  const fallbackPrinters = rawWorkflow._printers;
  const fallbackItems = rawWorkflow._items;
  const fallbackReminders = rawWorkflow._reminders;
  const fallbackPrintedAt = rawWorkflow._printedAt;
  const fallbackReceivedAt = rawWorkflow._receivedAt;
  const fallbackProductionDate = rawWorkflow._productionDate;
  const fallbackPrintLink = rawWorkflow._printLink;
  delete rawWorkflow._printers;
  delete rawWorkflow._items;
  delete rawWorkflow._reminders;
  delete rawWorkflow._printedAt;
  delete rawWorkflow._receivedAt;
  delete rawWorkflow._productionDate;
  delete rawWorkflow._printLink;
  const printers = Array.isArray(row?.printers)
    ? normalizePrinters(row.printers)
    : normalizePrinters(fallbackPrinters);
  const items = Array.isArray(row?.items)
    ? normalizeItems(row.items)
    : normalizeItems(fallbackItems);
  const reminders = Array.isArray(row?.reminders)
    ? normalizeReminders(row.reminders)
    : normalizeReminders(fallbackReminders);

  return normalize({
    number: row.number,
    title: row.title || '',
    status: row.status || 'Recebido',
    link: row.link || '',
    printLink: typeof row.print_link === 'string' && row.print_link ? row.print_link : (typeof fallbackPrintLink === 'string' ? fallbackPrintLink : ''),
    path: row.path || '',
    notes: row.notes || '',
    rank: row.rank || '',
    complexity: row.complexity || '',
    urgent: !!row.urgent,
    deadline: row.deadline || '',
    printedAt: typeof row.printed_at === 'string' && row.printed_at ? row.printed_at : (typeof fallbackPrintedAt === 'string' ? fallbackPrintedAt : ''),
    receivedAt: typeof row.received_at === 'string' && row.received_at ? row.received_at : (typeof fallbackReceivedAt === 'string' ? fallbackReceivedAt : ''),
    productionDate: typeof row.production_date === 'string' && row.production_date ? row.production_date : (typeof fallbackProductionDate === 'string' ? fallbackProductionDate : ''),
    owner: row.owner || '',
    pausedFrom: row.paused_from || '',
    elapsedMs: Number(row.elapsed_ms || 0),
    startedAt: Number(row.started_at || 0),
    workflow: rawWorkflow,
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    printers,
    items,
    reminders,
    version: Number(row.version || 0),
    updated: row.updated || new Date().toISOString()
  });
}

export function orderToRow(
  next,
  userEmail = '',
  includeCreatedBy = false,
  includePausedFrom = supportsPausedFromColumn,
  includePrinters = supportsPrintersColumn,
  includeItems = supportsItemsColumn,
  includeReminders = supportsRemindersColumn,
  includeDates = supportsDatesColumns,
  includePrintLink = supportsPrintLinkColumn
) {
  const cleanWorkflow = next?.workflow && typeof next.workflow === 'object' && !Array.isArray(next.workflow)
    ? { ...next.workflow }
    : {};
  delete cleanWorkflow._printers;
  delete cleanWorkflow._items;
  delete cleanWorkflow._reminders;
  delete cleanWorkflow._printedAt;
  delete cleanWorkflow._receivedAt;
  delete cleanWorkflow._productionDate;
  delete cleanWorkflow._printLink;
  const printers = normalizePrinters(next?.printers);
  const items = normalizeItems(next?.items);
  const reminders = normalizeReminders(next?.reminders);
  const printedAt = typeof next?.printedAt === 'string' ? next.printedAt : '';
  const receivedAt = typeof next?.receivedAt === 'string' ? next.receivedAt : '';
  const productionDate = typeof next?.productionDate === 'string' ? next.productionDate : '';
  const printLink = typeof next?.printLink === 'string' ? next.printLink : '';
  if (!includePrinters && printers.length) {
    cleanWorkflow._printers = printers;
  }
  if (!includeItems && items.length) {
    cleanWorkflow._items = items;
  }
  if (!includeReminders && reminders.length) {
    cleanWorkflow._reminders = reminders;
  }
  if (!includeDates) {
    if (printedAt) cleanWorkflow._printedAt = printedAt;
    if (receivedAt) cleanWorkflow._receivedAt = receivedAt;
    if (productionDate) cleanWorkflow._productionDate = productionDate;
  }
  if (!includePrintLink && printLink) {
    cleanWorkflow._printLink = printLink;
  }

  const row = {
    number: next.number,
    title: next.title,
    status: next.status,
    link: next.link,
    path: next.path,
    notes: next.notes,
    rank: next.rank,
    complexity: next.complexity,
    urgent: !!next.urgent,
    deadline: next.deadline,
    owner: next.owner,
    elapsed_ms: next.elapsedMs,
    started_at: next.startedAt,
    workflow: cleanWorkflow,
    attachments: next.attachments || [],
    version: next.version,
    updated: next.updated,
    updated_by: userEmail || ''
  };
  if (includePrinters) row.printers = printers;
  if (includeItems) row.items = items;
  if (includeReminders) row.reminders = reminders;
  if (includePausedFrom) row.paused_from = next.pausedFrom || '';
  if (includeDates) {
    row.printed_at = printedAt;
    row.received_at = receivedAt;
    row.production_date = productionDate;
  }
  if (includePrintLink) row.print_link = printLink;
  if (includeCreatedBy) row.created_by = userEmail || '';
  return row;
}

export async function cloudList() {
  const sb = await ensureCloudClient();
  if (!sb) throw Error('Supabase não configurado.');
  const { data, error } = await sb.from('os_orders').select('*');
  if (error) throw Error(mapCloudError(error, 'Não foi possível carregar as OS do Supabase.'));
  return (data || []).map(rowToOrder);
}

export async function cloudSave(input) {
  const sb = await ensureCloudClient();
  if (!sb) throw Error('Supabase não configurado.');
  const invalid = validate(input);
  if (invalid) throw Error(invalid);

  const next = record(input);
  const email = currentSession?.user?.email || '';
  const prevVersion = Number(input.version || 0);
  const originalNumber = input.originalNumber && input.originalNumber !== next.number ? input.originalNumber : '';

  const columnFlags = () => ({
    includePausedFrom: supportsPausedFromColumn,
    includePrinters: supportsPrintersColumn,
    includeItems: supportsItemsColumn,
    includeReminders: supportsRemindersColumn,
    includeDates: supportsDatesColumns,
    includePrintLink: supportsPrintLinkColumn
  });

  const disableMissingColumnFlag = (err) => {
    let retried = false;
    if (supportsPausedFromColumn && isMissingColumnError(err, 'paused_from')) {
      supportsPausedFromColumn = false;
      retried = true;
    }
    if (supportsPrintersColumn && isMissingColumnError(err, 'printers')) {
      supportsPrintersColumn = false;
      retried = true;
    }
    if (supportsItemsColumn && isMissingColumnError(err, 'items')) {
      supportsItemsColumn = false;
      retried = true;
    }
    if (supportsRemindersColumn && isMissingColumnError(err, 'reminders')) {
      supportsRemindersColumn = false;
      retried = true;
    }
    if (
      supportsDatesColumns &&
      (isMissingColumnError(err, 'printed_at') || isMissingColumnError(err, 'received_at') || isMissingColumnError(err, 'production_date'))
    ) {
      supportsDatesColumns = false;
      retried = true;
    }
    if (supportsPrintLinkColumn && isMissingColumnError(err, 'print_link')) {
      supportsPrintLinkColumn = false;
      retried = true;
    }
    return retried;
  };

  const runWithColumnFallback = async (execFn) => {
    let res = await execFn(columnFlags());
    for (let tries = 0; tries < 6 && res.error; tries++) {
      if (!disableMissingColumnFlag(res.error)) break;
      res = await execFn(columnFlags());
    }
    return { data: res.data, error: res.error };
  };

  if (prevVersion === 0 && !originalNumber) {
    const { data, error } = await runWithColumnFallback(flags =>
      sb.from('os_orders').insert(orderToRow(next, email, true, flags.includePausedFrom, flags.includePrinters, flags.includeItems, flags.includeReminders, flags.includeDates, flags.includePrintLink)).select('*').single()
    );
    if (error) throw Error(mapCloudError(error, 'Falha ao salvar nova OS no Supabase.'));
    return rowToOrder(data);
  }

  if (originalNumber) {
    const { data: conflict } = await sb.from('os_orders').select('number').eq('number', next.number).maybeSingle();
    if (conflict) throw Error('Já existe uma OS com este número.');

    const { data: existing, error: readErr } = await sb
      .from('os_orders')
      .select('version, created_by')
      .eq('number', originalNumber)
      .maybeSingle();
    if (readErr) throw Error(mapCloudError(readErr, 'Falha ao verificar OS original.'));
    if (!existing || Number(existing.version) !== prevVersion) {
      throw Error('Esta OS foi alterada em outro dispositivo. Atualize a fila.');
    }

    const { data: created, error: insErr } = await runWithColumnFallback(flags => {
      const insertRow = orderToRow(next, email, true, flags.includePausedFrom, flags.includePrinters, flags.includeItems, flags.includeReminders, flags.includeDates, flags.includePrintLink);
      insertRow.created_by = existing.created_by || email;
      return sb.from('os_orders').insert(insertRow).select('*').single();
    });
    if (insErr) throw Error(mapCloudError(insErr, 'Falha ao atualizar número da OS.'));

    const { error: delErr } = await sb.from('os_orders').delete().eq('number', originalNumber).eq('version', prevVersion);
    if (delErr) {
      await sb.from('os_orders').delete().eq('number', next.number);
      throw Error(mapCloudError(delErr, 'Falha ao substituir o registro anterior da OS.'));
    }
    return rowToOrder(created);
  }

  const { data, error } = await runWithColumnFallback(flags =>
    sb
      .from('os_orders')
      .update(orderToRow(next, email, false, flags.includePausedFrom, flags.includePrinters, flags.includeItems, flags.includeReminders, flags.includeDates, flags.includePrintLink))
      .eq('number', next.number)
      .eq('version', prevVersion)
      .select('*')
      .maybeSingle()
  );
  if (error) throw Error(mapCloudError(error, 'Falha ao atualizar OS no Supabase.'));
  if (!data) throw Error('Esta OS foi alterada em outro dispositivo. Atualize a fila.');
  return rowToOrder(data);
}

export async function cloudDelete(order) {
  const sb = await ensureCloudClient();
  if (!sb) throw Error('Supabase não configurado.');
  const { data, error } = await sb
    .from('os_orders')
    .delete()
    .eq('number', order.number)
    .eq('version', order.version)
    .select('number');
  if (error) throw Error(mapCloudError(error, 'Falha ao excluir OS no Supabase.'));
  if (!data || data.length === 0) {
    const { data: exists } = await sb.from('os_orders').select('number').eq('number', order.number).maybeSingle();
    throw Error(exists ? 'Esta OS foi alterada em outro dispositivo. Atualize a fila.' : 'OS não encontrada na fila.');
  }
  return { deleted: order.number };
}

export async function cloudRestore(incoming, overwrite, currentOrders = []) {
  const sb = await ensureCloudClient();
  if (!sb) throw Error('Supabase não configurado.');
  const email = currentSession?.user?.email || '';
  const plan = restorePlan(incoming, currentOrders, overwrite);
  if (!plan.length) return { count: 0 };

  const execRestore = async (flags) => {
    const rows = plan.map(order =>
      orderToRow(
        record({ ...order, version: order.version || 0 }),
        email,
        !order.version,
        flags.includePausedFrom,
        flags.includePrinters,
        flags.includeItems,
        flags.includeReminders,
        flags.includeDates,
        flags.includePrintLink
      )
    );
    return sb.from('os_orders').upsert(rows, { onConflict: 'number' });
  };
  let { error } = await execRestore({
    includePausedFrom: supportsPausedFromColumn,
    includePrinters: supportsPrintersColumn,
    includeItems: supportsItemsColumn,
    includeReminders: supportsRemindersColumn,
    includeDates: supportsDatesColumns,
    includePrintLink: supportsPrintLinkColumn
  });
  for (let tries = 0; tries < 6 && error; tries++) {
    let retried = false;
    if (supportsPausedFromColumn && isMissingColumnError(error, 'paused_from')) {
      supportsPausedFromColumn = false;
      retried = true;
    }
    if (supportsPrintersColumn && isMissingColumnError(error, 'printers')) {
      supportsPrintersColumn = false;
      retried = true;
    }
    if (supportsItemsColumn && isMissingColumnError(error, 'items')) {
      supportsItemsColumn = false;
      retried = true;
    }
    if (supportsRemindersColumn && isMissingColumnError(error, 'reminders')) {
      supportsRemindersColumn = false;
      retried = true;
    }
    if (
      supportsDatesColumns &&
      (isMissingColumnError(error, 'printed_at') || isMissingColumnError(error, 'received_at') || isMissingColumnError(error, 'production_date'))
    ) {
      supportsDatesColumns = false;
      retried = true;
    }
    if (supportsPrintLinkColumn && isMissingColumnError(error, 'print_link')) {
      supportsPrintLinkColumn = false;
      retried = true;
    }
    if (!retried) break;
    ({ error } = await execRestore({
      includePausedFrom: supportsPausedFromColumn,
      includePrinters: supportsPrintersColumn,
      includeItems: supportsItemsColumn,
      includeReminders: supportsRemindersColumn,
      includeDates: supportsDatesColumns,
      includePrintLink: supportsPrintLinkColumn
    }));
  }
  if (error) throw Error(mapCloudError(error, 'Falha ao restaurar backup no Supabase.'));
  return { count: plan.length };
}

export function subscribeCloudOrders(onChange, onStatus) {
  let channel = null;
  let timer = 0;
  let cancelled = false;
  ensureCloudClient().then(sb => {
    if (!sb || cancelled) return;
    channel = sb
      .channel('os_orders_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'os_orders' }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => onChange(), 250);
      })
      .subscribe((status) => {
        onStatus?.(status);
      });
  }).catch(() => onStatus?.('CHANNEL_ERROR'));

  return () => {
    cancelled = true;
    clearTimeout(timer);
    if (channel && client) client.removeChannel(channel);
  };
}

// ============================================================================
// Modelos salvos do módulo Folha (public.folha_templates)
// ============================================================================

export async function cloudListTemplates() {
  if (!supportsTemplatesTable || !currentSession) return null;
  const sb = await ensureCloudClient();
  if (!sb) return null;
  const { data, error } = await sb.from('folha_templates').select('name, state, updated').order('updated', { ascending: false });
  if (error) {
    if (isMissingTableError(error, 'folha_templates')) supportsTemplatesTable = false;
    return null;
  }
  return (data || []).map(row => ({
    name: String(row.name || ''),
    state: row.state && typeof row.state === 'object' ? row.state : {},
    updated: row.updated || ''
  })).filter(item => item.name && item.name !== RESERVED_PRINTERS_TEMPLATE_NAME && !item.name.startsWith(RESERVED_SUITE_DATA_PREFIX));
}

export async function cloudSaveTemplate(name, stateObj) {
  if (!supportsTemplatesTable || !currentSession || !name) return false;
  const sb = await ensureCloudClient();
  if (!sb) return false;
  const email = currentSession?.user?.email || '';
  const { error } = await sb.from('folha_templates').upsert({
    name: String(name).slice(0, 140),
    state: stateObj && typeof stateObj === 'object' ? stateObj : {},
    updated: new Date().toISOString(),
    created_by: email,
    updated_by: email
  }, { onConflict: 'name' });
  if (error) {
    if (isMissingTableError(error, 'folha_templates')) supportsTemplatesTable = false;
    return false;
  }
  return true;
}

export async function cloudDeleteTemplate(name) {
  if (!supportsTemplatesTable || !currentSession || !name) return false;
  const sb = await ensureCloudClient();
  if (!sb) return false;
  const { error } = await sb.from('folha_templates').delete().eq('name', String(name));
  if (error) {
    if (isMissingTableError(error, 'folha_templates')) supportsTemplatesTable = false;
    return false;
  }
  return true;
}

export function subscribeCloudTemplates(onChange) {
  let channel = null;
  let timer = 0;
  let cancelled = false;
  if (!supportsTemplatesTable) return () => {};
  ensureCloudClient().then(sb => {
    if (!sb || cancelled || !supportsTemplatesTable) return;
    channel = sb
      .channel('folha_templates_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'folha_templates' }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => onChange?.(), 300);
      })
      .subscribe();
  }).catch(() => {});

  return () => {
    cancelled = true;
    clearTimeout(timer);
    if (channel && client) client.removeChannel(channel);
  };
}

// ============================================================================
// Cadastro de Impressoras (public.os_printers com fallback em folha_templates)
// ============================================================================

async function readPrintersFromTemplateFallback(sb, email = '') {
  if (!supportsTemplatesTable) return [];
  const { data, error } = await sb
    .from('folha_templates')
    .select('state')
    .eq('name', RESERVED_PRINTERS_TEMPLATE_NAME)
    .maybeSingle();
  if (error) {
    if (isMissingTableError(error, 'folha_templates')) supportsTemplatesTable = false;
    return null;
  }
  return normalizePrinterCatalog(data?.state?.printers || []);
}

async function writePrintersToTemplateFallback(sb, list, email = '') {
  if (!supportsTemplatesTable) return false;
  const catalog = normalizePrinterCatalog(list);
  const { error } = await sb.from('folha_templates').upsert({
    name: RESERVED_PRINTERS_TEMPLATE_NAME,
    state: { printers: catalog },
    updated: new Date().toISOString(),
    created_by: email,
    updated_by: email
  }, { onConflict: 'name' });
  if (error) {
    if (isMissingTableError(error, 'folha_templates')) supportsTemplatesTable = false;
    return false;
  }
  return catalog;
}

export async function cloudListPrinters(overrides = {}) {
  const sb = overrides.sb || (currentSession ? await ensureCloudClient() : null);
  if (!sb) return null;
  if (supportsPrintersTable) {
    const { data, error } = await sb
      .from('os_printers')
      .select('id, name, category, notes, created_at')
      .order('name', { ascending: true });
    if (!error) return normalizePrinterCatalog(data || []);
    if (!isMissingTableError(error, 'os_printers')) return null;
    supportsPrintersTable = false;
  }
  return await readPrintersFromTemplateFallback(sb);
}

export async function cloudSavePrinter(printerInput, overrides = {}) {
  const entry = normalizePrinterEntry({
    ...printerInput,
    createdAt: printerInput?.createdAt || new Date().toISOString()
  });
  if (!entry) throw Error('Informe o nome da impressora.');
  const sb = overrides.sb || (currentSession ? await ensureCloudClient() : null);
  if (!sb) return entry;
  const email = overrides.email ?? currentSession?.user?.email ?? '';

  if (supportsPrintersTable) {
    const { data, error } = await sb
      .from('os_printers')
      .upsert({
        id: entry.id,
        name: entry.name,
        category: entry.category,
        notes: entry.notes,
        created_at: entry.createdAt || new Date().toISOString(),
        created_by: email
      }, { onConflict: 'id' })
      .select('id, name, category, notes, created_at')
      .single();
    if (!error) return normalizePrinterEntry(data) || entry;
    if (!isMissingTableError(error, 'os_printers')) {
      throw Error(mapCloudError(error, 'Falha ao salvar impressora no Supabase.'));
    }
    supportsPrintersTable = false;
  }

  const existing = (await readPrintersFromTemplateFallback(sb)) || [];
  const next = existing.filter(
    p => p.id !== entry.id && p.name.toLocaleLowerCase('pt-BR') !== entry.name.toLocaleLowerCase('pt-BR')
  );
  next.push(entry);
  const saved = await writePrintersToTemplateFallback(sb, next, email);
  if (saved === false) throw Error('Tabela os_printers ausente. Execute supabase/schema.sql ou verifique as permissões.');
  return entry;
}

export async function cloudDeletePrinter(idOrName, overrides = {}) {
  const target = String(idOrName || '').trim();
  if (!target) return false;
  const sb = overrides.sb || (currentSession ? await ensureCloudClient() : null);
  if (!sb) return false;
  const email = overrides.email ?? currentSession?.user?.email ?? '';

  if (supportsPrintersTable) {
    const { error } = await sb.from('os_printers').delete().eq('id', target);
    if (!error) return true;
    if (!isMissingTableError(error, 'os_printers')) {
      throw Error(mapCloudError(error, 'Falha ao excluir impressora no Supabase.'));
    }
    supportsPrintersTable = false;
  }

  const existing = (await readPrintersFromTemplateFallback(sb)) || [];
  const lower = target.toLocaleLowerCase('pt-BR');
  const next = existing.filter(p => p.id !== target && p.name.toLocaleLowerCase('pt-BR') !== lower);
  await writePrintersToTemplateFallback(sb, next, email);
  return true;
}

export async function cloudRestorePrinters(catalogList, overrides = {}) {
  const catalog = normalizePrinterCatalog(catalogList);
  if (!catalog.length) return [];
  const sb = overrides.sb || (currentSession ? await ensureCloudClient() : null);
  if (!sb) return catalog;
  const email = overrides.email ?? currentSession?.user?.email ?? '';

  if (supportsPrintersTable) {
    const rows = catalog.map(entry => ({
      id: entry.id,
      name: entry.name,
      category: entry.category,
      notes: entry.notes,
      created_at: entry.createdAt || new Date().toISOString(),
      created_by: email
    }));
    const { error } = await sb.from('os_printers').upsert(rows, { onConflict: 'id' });
    if (!error) return catalog;
    if (!isMissingTableError(error, 'os_printers')) return catalog;
    supportsPrintersTable = false;
  }

  const existing = (await readPrintersFromTemplateFallback(sb)) || [];
  const merged = normalizePrinterCatalog([...existing, ...catalog]);
  await writePrintersToTemplateFallback(sb, merged, email);
  return merged;
}

export function subscribeCloudPrinters(onChange) {
  let channel = null;
  let timer = 0;
  let cancelled = false;
  ensureCloudClient().then(sb => {
    if (!sb || cancelled) return;
    channel = sb
      .channel('os_printers_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'os_printers' }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => onChange?.(), 250);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'folha_templates' }, payload => {
        const name = payload?.new?.name || payload?.old?.name || '';
        if (!name || name === RESERVED_PRINTERS_TEMPLATE_NAME) {
          clearTimeout(timer);
          timer = setTimeout(() => onChange?.(), 250);
        }
      })
      .subscribe();
  }).catch(() => {});

  return () => {
    cancelled = true;
    clearTimeout(timer);
    if (channel && client) client.removeChannel(channel);
  };
}

// ============================================================================
// Dados sincronizados de toda a Suíte (public.suite_data com fallback seguro)
// Sincroniza: presets de papel/peça, estado do Folha, estado/projetos NBL e prefs OS
// ============================================================================

function isValidSuiteKey(key) {
  return typeof key === 'string' && /^[a-z0-9:_-]{1,120}$/i.test(key);
}

export async function cloudReadSuiteData(keys = null, overrides = {}) {
  const sb = overrides.sb || (currentSession ? await ensureCloudClient() : null);
  if (!sb) return null;
  const keyList = Array.isArray(keys) ? keys.filter(isValidSuiteKey) : null;

  if (supportsSuiteDataTable) {
    let query = sb.from('suite_data').select('key, app, payload, updated');
    if (keyList && keyList.length) query = query.in('key', keyList);
    const { data, error } = await query;
    if (!error) {
      const map = {};
      for (const row of (data || [])) {
        if (!row?.key) continue;
        map[row.key] = {
          key: String(row.key),
          app: String(row.app || 'suite'),
          payload: row.payload && typeof row.payload === 'object' ? row.payload : {},
          updated: String(row.updated || '')
        };
      }
      return map;
    }
    if (!isMissingTableError(error, 'suite_data')) return null;
    supportsSuiteDataTable = false;
  }

  if (!supportsTemplatesTable) return null;
  const { data, error } = await sb.from('folha_templates').select('name, state, updated');
  if (error) {
    if (isMissingTableError(error, 'folha_templates')) supportsTemplatesTable = false;
    return null;
  }
  const map = {};
  for (const row of (data || [])) {
    const name = String(row?.name || '');
    if (!name.startsWith(RESERVED_SUITE_DATA_PREFIX)) continue;
    const key = name.slice(RESERVED_SUITE_DATA_PREFIX.length);
    if (keyList && keyList.length && !keyList.includes(key)) continue;
    map[key] = {
      key,
      app: String(row.state?.app || 'suite'),
      payload: row.state?.payload && typeof row.state.payload === 'object' ? row.state.payload : {},
      updated: String(row.updated || '')
    };
  }
  return map;
}

export async function cloudWriteSuiteData(key, app, payload, overrides = {}) {
  if (!isValidSuiteKey(key)) throw Error('Chave de sincronização inválida.');
  const safeApp = ALLOWED_SUITE_APPS.has(app) ? app : 'suite';
  const safePayload = payload && typeof payload === 'object' ? payload : {};
  const serialized = JSON.stringify(safePayload);
  if (serialized.length > maxSuitePayloadBytes) {
    throw Error('Os dados de sincronização excedem o limite máximo permitido (512 KB).');
  }
  const sb = overrides.sb || (currentSession ? await ensureCloudClient() : null);
  if (!sb) return false;
  const email = overrides.email ?? currentSession?.user?.email ?? '';
  const updated = new Date().toISOString();

  if (supportsSuiteDataTable) {
    const { error } = await sb.from('suite_data').upsert({
      key,
      app: safeApp,
      payload: safePayload,
      updated,
      created_by: email,
      updated_by: email
    }, { onConflict: 'key' });
    if (!error) return true;
    if (!isMissingTableError(error, 'suite_data')) return false;
    supportsSuiteDataTable = false;
  }

  if (!supportsTemplatesTable) return false;
  const { error } = await sb.from('folha_templates').upsert({
    name: RESERVED_SUITE_DATA_PREFIX + key,
    state: { app: safeApp, payload: safePayload },
    updated,
    created_by: email,
    updated_by: email
  }, { onConflict: 'name' });
  if (error) {
    if (isMissingTableError(error, 'folha_templates')) supportsTemplatesTable = false;
    return false;
  }
  return true;
}

export async function cloudDeleteSuiteData(key, overrides = {}) {
  if (!isValidSuiteKey(key)) return false;
  const sb = overrides.sb || (currentSession ? await ensureCloudClient() : null);
  if (!sb) return false;

  if (supportsSuiteDataTable) {
    const { error } = await sb.from('suite_data').delete().eq('key', key);
    if (!error) return true;
    if (!isMissingTableError(error, 'suite_data')) return false;
    supportsSuiteDataTable = false;
  }
  if (!supportsTemplatesTable) return false;
  const { error } = await sb.from('folha_templates').delete().eq('name', RESERVED_SUITE_DATA_PREFIX + key);
  return !error;
}

export function subscribeCloudSuiteData(onChange) {
  let channel = null;
  let timer = 0;
  let cancelled = false;
  ensureCloudClient().then(sb => {
    if (!sb || cancelled) return;
    channel = sb
      .channel('suite_data_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suite_data' }, payload => {
        clearTimeout(timer);
        const key = payload?.new?.key || payload?.old?.key || '';
        timer = setTimeout(() => onChange?.(key), 300);
      })
      .subscribe();
  }).catch(() => {});

  return () => {
    cancelled = true;
    clearTimeout(timer);
    if (channel && client) client.removeChannel(channel);
  };
}

// ============================================================================
// Atendimento de Balcão (public.os_counter_tickets com fallback em suite_data)
// ============================================================================

export function rowToCounterTicket(row) {
  if (!row || typeof row !== 'object') return normalizeCounterTicket({});
  return normalizeCounterTicket({
    id: row.id,
    code: row.code,
    customerName: row.customer_name ?? row.customerName ?? '',
    customerContact: row.customer_contact ?? row.customerContact ?? '',
    clientNumber: row.client_number ?? row.clientNumber ?? '',
    orderNumber: row.order_number ?? row.orderNumber ?? '',
    linkedOsNumber: row.linked_os_number ?? row.linkedOsNumber ?? '',
    serviceType: row.service_type ?? row.serviceType ?? 'criacao',
    channel: row.channel ?? 'balcao',
    fileStatus: row.file_status ?? row.fileStatus ?? 'cliente_trouxe',
    title: row.title ?? '',
    briefing: row.briefing ?? '',
    status: row.status ?? 'Aguardando',
    attendant: row.attendant ?? '',
    urgent: !!row.urgent,
    estimatedMinutes: Number(row.estimated_minutes ?? row.estimatedMinutes ?? 0),
    revisionsCount: Number(row.revisions_count ?? row.revisionsCount ?? 0),
    elapsedMs: Number(row.elapsed_ms ?? row.elapsedMs ?? 0),
    startedAt: Number(row.started_at ?? row.startedAt ?? 0),
    sessions: Array.isArray(row.sessions) ? row.sessions : [],
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    version: Number(row.version || 0),
    createdAt: row.created_at ?? row.createdAt ?? '',
    updated: row.updated ?? new Date().toISOString()
  });
}

export function counterTicketToRow(ticket, userEmail = '', includeCreatedBy = false) {
  const t = normalizeCounterTicket(ticket);
  const row = {
    id: t.id,
    code: t.code,
    customer_name: t.customerName,
    customer_contact: t.customerContact,
    client_number: t.clientNumber,
    order_number: t.orderNumber,
    linked_os_number: t.linkedOsNumber,
    service_type: t.serviceType,
    channel: t.channel,
    file_status: t.fileStatus,
    title: t.title,
    briefing: t.briefing,
    status: t.status,
    attendant: t.attendant,
    urgent: !!t.urgent,
    estimated_minutes: t.estimatedMinutes,
    revisions_count: t.revisionsCount,
    elapsed_ms: t.elapsedMs,
    started_at: t.startedAt,
    sessions: t.sessions,
    attachments: t.attachments,
    version: t.version,
    created_at: t.createdAt || new Date().toISOString(),
    updated: t.updated || new Date().toISOString(),
    updated_by: userEmail || ''
  };
  if (includeCreatedBy) row.created_by = userEmail || '';
  return row;
}

async function readCounterTicketsFromSuiteFallback(overrides = {}) {
  const map = await cloudReadSuiteData([COUNTER_SUITE_DATA_KEY], overrides);
  const list = map?.[COUNTER_SUITE_DATA_KEY]?.payload?.tickets;
  if (!Array.isArray(list)) return [];
  return list.map(normalizeCounterTicket);
}

async function writeCounterTicketsToSuiteFallback(tickets, overrides = {}) {
  const clean = (tickets || []).map(normalizeCounterTicket).slice(0, 600);
  return cloudWriteSuiteData(COUNTER_SUITE_DATA_KEY, 'os-maneger', { tickets: clean }, overrides);
}

export async function cloudListCounterTickets(overrides = {}) {
  const sb = overrides.sb || (currentSession ? await ensureCloudClient() : null);
  if (!sb) return null;
  if (supportsCounterTicketsTable) {
    const { data, error } = await sb
      .from('os_counter_tickets')
      .select('*')
      .order('updated', { ascending: false });
    if (!error) return (data || []).map(rowToCounterTicket);
    if (!isMissingTableError(error, 'os_counter_tickets')) {
      throw Error(mapCloudError(error, 'Falha ao carregar atendimentos de balcão no Supabase.'));
    }
    supportsCounterTicketsTable = false;
  }
  return await readCounterTicketsFromSuiteFallback({ ...overrides, sb });
}

export async function cloudSaveCounterTicket(input, overrides = {}) {
  const err = validateCounterTicket(input);
  if (err) throw Error(err);
  const next = recordCounterTicket(input);
  const sb = overrides.sb || (currentSession ? await ensureCloudClient() : null);
  if (!sb) return next;
  const email = overrides.email ?? currentSession?.user?.email ?? '';

  if (supportsCounterTicketsTable) {
    const isNew = Number(input?.version || 0) === 0;
    const { data, error } = await sb
      .from('os_counter_tickets')
      .upsert(counterTicketToRow(next, email, isNew), { onConflict: 'id' })
      .select('*')
      .single();
    if (!error) return rowToCounterTicket(data);
    if (!isMissingTableError(error, 'os_counter_tickets')) {
      throw Error(mapCloudError(error, 'Falha ao salvar atendimento de balcão no Supabase.'));
    }
    supportsCounterTicketsTable = false;
  }

  const existing = (await readCounterTicketsFromSuiteFallback({ ...overrides, sb })) || [];
  const nextList = [next, ...existing.filter(item => item.id !== next.id)];
  const ok = await writeCounterTicketsToSuiteFallback(nextList, { ...overrides, sb, email });
  if (!ok) throw Error('Tabela os_counter_tickets ausente e fallback indisponível. Execute supabase/schema.sql.');
  return next;
}

export async function cloudDeleteCounterTicket(idOrTicket, overrides = {}) {
  const id = typeof idOrTicket === 'string' ? idOrTicket : String(idOrTicket?.id || '');
  if (!id) return false;
  const sb = overrides.sb || (currentSession ? await ensureCloudClient() : null);
  if (!sb) return false;
  const email = overrides.email ?? currentSession?.user?.email ?? '';

  if (supportsCounterTicketsTable) {
    const { error } = await sb.from('os_counter_tickets').delete().eq('id', id);
    if (!error) return true;
    if (!isMissingTableError(error, 'os_counter_tickets')) {
      throw Error(mapCloudError(error, 'Falha ao excluir atendimento de balcão no Supabase.'));
    }
    supportsCounterTicketsTable = false;
  }

  const existing = (await readCounterTicketsFromSuiteFallback({ ...overrides, sb })) || [];
  const nextList = existing.filter(item => item.id !== id);
  await writeCounterTicketsToSuiteFallback(nextList, { ...overrides, sb, email });
  return true;
}

export async function cloudRestoreCounterTickets(incoming, overwrite, currentTickets = [], overrides = {}) {
  const plan = counterRestorePlan(incoming, currentTickets, overwrite);
  if (!plan.length) return { count: 0 };
  const sb = overrides.sb || (currentSession ? await ensureCloudClient() : null);
  if (!sb) return { count: plan.length };
  const email = overrides.email ?? currentSession?.user?.email ?? '';

  if (supportsCounterTicketsTable) {
    const rows = plan.map(ticket => counterTicketToRow(recordCounterTicket(ticket), email, !ticket.version));
    const { error } = await sb.from('os_counter_tickets').upsert(rows, { onConflict: 'id' });
    if (!error) return { count: plan.length };
    if (!isMissingTableError(error, 'os_counter_tickets')) {
      throw Error(mapCloudError(error, 'Falha ao restaurar atendimentos de balcão no Supabase.'));
    }
    supportsCounterTicketsTable = false;
  }

  const existing = (await readCounterTicketsFromSuiteFallback({ ...overrides, sb })) || [];
  const map = new Map(existing.map(t => [t.id, t]));
  for (const item of plan) {
    const rec = recordCounterTicket(item);
    map.set(rec.id, rec);
  }
  await writeCounterTicketsToSuiteFallback(Array.from(map.values()), { ...overrides, sb, email });
  return { count: plan.length };
}

export function subscribeCloudCounterTickets(onChange) {
  let channel = null;
  let timer = 0;
  let cancelled = false;
  ensureCloudClient().then(sb => {
    if (!sb || cancelled) return;
    channel = sb
      .channel('os_counter_tickets_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'os_counter_tickets' }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => onChange?.(), 250);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suite_data' }, payload => {
        const key = payload?.new?.key || payload?.old?.key || '';
        if (!key || key === COUNTER_SUITE_DATA_KEY) {
          clearTimeout(timer);
          timer = setTimeout(() => onChange?.(), 250);
        }
      })
      .subscribe();
  }).catch(() => {});

  return () => {
    cancelled = true;
    clearTimeout(timer);
    if (channel && client) client.removeChannel(channel);
  };
}

// ============================================================================
// Anexos (PDFs e Imagens) e Backups Privados — Google Drive API v3 + Supabase Storage
// ============================================================================

export function detectAttachmentMime(file) {
  if (file?.type) return file.type;
  const lower = String(file?.name || '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return '';
}

export function isSupportedAttachment(file) {
  const mime = detectAttachmentMime(file).toLowerCase();
  if (mime === 'image/svg+xml' || /\.svg$/i.test(String(file?.name || ''))) return false;
  return mime === 'application/pdf' || mime.startsWith('image/');
}

async function driveFetch(url, token, options = {}, { maxRetries = 2 } = {}) {
  let lastErr = null;
  const method = String(options.method || 'GET').toUpperCase();
  const canRetry = method === 'GET' || method === 'PATCH' || maxRetries > 0;
  for (let attempt = 0; attempt <= (canRetry ? maxRetries : 0); attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          ...options.headers
        }
      });
      if (res.status === 401) {
        clearDriveToken();
        throw Object.assign(Error('Token do Google Drive expirado. Reconecte o Google Drive no app para continuar.'), { code: 'DRIVE_AUTH_REQUIRED' });
      }
      if (res.status === 403) {
        const clone = res.clone ? res.clone() : null;
        const bodyText = clone ? await clone.text().catch(() => '') : '';
        if (/insufficientPermissions|ACCESS_TOKEN_SCOPE_INSUFFICIENT|insufficient authentication scopes/i.test(bodyText)) {
          clearDriveToken();
          throw Object.assign(Error('Permissão do Google Drive insuficiente ou revogada. Clique em "Conectar Google Drive" para autorizar novamente.'), { code: 'DRIVE_AUTH_REQUIRED' });
        }
        if (/Drive API has not been used|disabled/i.test(bodyText)) {
          throw Error('Ative a Google Drive API no Google Cloud Console do seu projeto OAuth.');
        }
      }
      if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
        const delayMs = 300 * Math.pow(2, attempt) + Math.floor(Math.random() * 120);
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }
      return res;
    } catch (err) {
      if (err?.code === 'DRIVE_AUTH_REQUIRED') throw err;
      lastErr = err;
      if (attempt < maxRetries && method === 'GET') {
        await new Promise(r => setTimeout(r, 300 * Math.pow(2, attempt)));
        continue;
      }
      throw err;
    }
  }
  throw lastErr || Error('Falha de comunicação com o Google Drive.');
}

async function findDriveFolder(token, name, parentId = '') {
  const safeName = String(name || 'OS Maneger - Anexos').trim();
  const escaped = safeName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  let q = `name = '${escaped}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  if (parentId) q += ` and '${parentId}' in parents`;

  const searchRes = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&orderBy=createdTime%20asc&pageSize=5&fields=files(id,name)&spaces=drive`,
    token
  );
  if (!searchRes.ok) {
    const errText = await searchRes.text().catch(() => '');
    throw Error(`Erro ao consultar pasta no Google Drive (${searchRes.status}). ${errText}`);
  }
  const searchJson = await searchRes.json();
  return searchJson.files?.[0]?.id || '';
}

async function ensureDriveFolder(token, name, parentId = '', { bypassCache = false } = {}) {
  const safeName = String(name || 'OS Maneger - Anexos').trim();
  const cacheKey = `${parentId}::${safeName}`;
  if (!bypassCache && driveFolderCache.has(cacheKey)) return driveFolderCache.get(cacheKey);

  const existingId = await findDriveFolder(token, safeName, parentId);
  if (existingId) {
    driveFolderCache.set(cacheKey, existingId);
    return existingId;
  }

  const body = {
    name: safeName,
    mimeType: 'application/vnd.google-apps.folder',
    ...(parentId ? { parents: [parentId] } : {})
  };
  const createRes = await driveFetch('https://www.googleapis.com/drive/v3/files?fields=id', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!createRes.ok) {
    const errText = await createRes.text().catch(() => '');
    throw Error(`Erro ao criar pasta "${safeName}" no Google Drive (${createRes.status}). ${errText}`);
  }
  const created = await createRes.json();
  driveFolderCache.set(cacheKey, created.id);
  return created.id;
}

async function uploadToGoogleDrive(file, mimeType, orderNumber) {
  const token = getDriveToken();
  if (!token) {
    throw Object.assign(Error('Google Drive não autorizado neste aparelho ainda. Clique em "Conectar Google Drive" ou envie via Supabase Storage.'), { code: 'DRIVE_AUTH_REQUIRED' });
  }

  const cfg = activeConfig || await resolveCloudConfig();
  const cleanOrder = String(orderNumber || '').trim();

  const attemptUpload = async (bypassCache = false) => {
    const rootFolderId = await ensureDriveFolder(token, cfg.driveFolderName || 'OS Maneger - Anexos', '', { bypassCache });
    const targetFolderId = /^\d{4}-\d{6}$/.test(cleanOrder)
      ? await ensureDriveFolder(token, `OS ${cleanOrder}`, rootFolderId, { bypassCache })
      : /^BAL-[A-Z0-9-]+$/i.test(cleanOrder)
        ? await ensureDriveFolder(token, `Balcão ${cleanOrder}`, rootFolderId, { bypassCache })
        : rootFolderId;

    const metadata = {
      name: file.name || `anexo-${Date.now()}`,
      mimeType,
      parents: [targetFolderId],
      description: cleanOrder ? `Anexo da OS ${cleanOrder} · OS Maneger` : 'Anexo OS Maneger'
    };

    const boundary = `osmaneger_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
      `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
      file,
      `\r\n--${boundary}--`
    ]);

    return driveFetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,webContentLink,thumbnailLink',
      token,
      {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body
      },
      { maxRetries: 1 }
    );
  };

  let uploadRes = await attemptUpload(false);
  if (uploadRes.status === 404) {
    driveFolderCache.clear();
    uploadRes = await attemptUpload(true);
  }
  if (!uploadRes.ok) {
    const errData = await uploadRes.json().catch(() => ({}));
    const detail = errData?.error?.message || `HTTP ${uploadRes.status}`;
    if (uploadRes.status === 403 && /Drive API has not been used|disabled/i.test(detail)) {
      throw Error('Ative a Google Drive API no Google Cloud Console do seu projeto OAuth.');
    }
    throw Error(`Falha ao enviar "${file.name}" para o Google Drive: ${detail}`);
  }
  const uploaded = await uploadRes.json();

  // Mantém os anexos privados no Google Drive da conta autenticada (nunca abre link público "anyone").
  const isImage = mimeType.startsWith('image/');
  return {
    id: randomId('drv'),
    name: uploaded.name || file.name,
    mimeType: uploaded.mimeType || mimeType,
    size: Number(uploaded.size || file.size || 0),
    provider: 'gdrive',
    driveFileId: uploaded.id,
    storagePath: '',
    webViewLink: sanitizeHttpUrl(uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`, ''),
    previewUrl: sanitizeHttpUrl(
      isImage
        ? `https://drive.google.com/thumbnail?id=${uploaded.id}&sz=w1200`
        : `https://drive.google.com/file/d/${uploaded.id}/preview`,
      ''
    ),
    downloadUrl: sanitizeHttpUrl(uploaded.webContentLink || `https://drive.google.com/uc?export=download&id=${uploaded.id}`, ''),
    uploadedBy: currentSession?.user?.email || '',
    uploadedAt: new Date().toISOString()
  };
}

// ============================================================================
// Backups privados completos da Suíte no Google Drive (IBD Suite - Backups)
// ============================================================================

export async function uploadSuiteBackupToDrive(backupObj, overrides = {}) {
  const token = overrides.token || getDriveToken();
  if (!token) {
    throw Object.assign(Error('Google Drive não autorizado neste aparelho. Clique em "Conectar Google Drive" para salvar o backup privado.'), { code: 'DRIVE_AUTH_REQUIRED' });
  }
  if (!backupObj || typeof backupObj !== 'object') {
    throw Error('Dados de backup inválidos.');
  }
  const jsonText = JSON.stringify(backupObj, null, 2);
  const byteSize = typeof Blob !== 'undefined' ? new Blob([jsonText]).size : jsonText.length;
  if (byteSize > maxBackupBytes) {
    throw Error('O backup completo excede o limite de 5 MB.');
  }

  const cfg = overrides.cfg || activeConfig || await resolveCloudConfig().catch(() => ({}));
  const folderName = cfg?.driveBackupFolderName || 'IBD Suite - Backups';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName = overrides.fileName || `ibd-suite-backup-${stamp}.json`;

  const attemptUpload = async (bypassCache = false) => {
    const folderId = await ensureDriveFolder(token, folderName, '', { bypassCache });
    const metadata = {
      name: fileName,
      mimeType: 'application/json',
      parents: [folderId],
      description: 'Backup privado completo dos apps IBD Suite (Folha + Numera Bloco + OS Maneger).',
      appProperties: {
        ibdSuiteBackup: 'true',
        schema: String(backupObj.schema || 2)
      }
    };
    const boundary = `ibdbackup_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const multipartBody =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${jsonText}\r\n` +
      `--${boundary}--`;
    return driveFetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,createdTime,modifiedTime,webViewLink',
      token,
      {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body: multipartBody
      },
      { maxRetries: 1 }
    );
  };

  let res = await attemptUpload(false);
  if (res.status === 404) {
    driveFolderCache.clear();
    res = await attemptUpload(true);
  }
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw Error(`Falha ao salvar backup no Google Drive: ${errData?.error?.message || `HTTP ${res.status}`}`);
  }
  const uploaded = await res.json();
  return {
    id: String(uploaded.id || ''),
    name: String(uploaded.name || fileName),
    size: Number(uploaded.size || byteSize),
    createdTime: String(uploaded.createdTime || new Date().toISOString()),
    modifiedTime: String(uploaded.modifiedTime || uploaded.createdTime || new Date().toISOString()),
    webViewLink: sanitizeHttpUrl(uploaded.webViewLink || (uploaded.id ? `https://drive.google.com/file/d/${uploaded.id}/view` : ''), ''),
    folderName
  };
}

export async function listSuiteBackupsFromDrive({ limit = 20 } = {}, overrides = {}) {
  const token = overrides.token || getDriveToken();
  if (!token) {
    throw Object.assign(Error('Conecte o Google Drive para listar os backups salvos.'), { code: 'DRIVE_AUTH_REQUIRED' });
  }
  const cfg = overrides.cfg || activeConfig || await resolveCloudConfig().catch(() => ({}));
  const folderName = cfg?.driveBackupFolderName || 'IBD Suite - Backups';
  const folderId = await findDriveFolder(token, folderName);
  if (!folderId) return [];

  const safeLimit = Math.max(1, Math.min(50, Math.trunc(Number(limit) || 20)));
  const q = `'${folderId}' in parents and mimeType = 'application/json' and trashed = false`;
  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&orderBy=createdTime%20desc&pageSize=${safeLimit}&fields=files(id,name,size,createdTime,modifiedTime,webViewLink)&spaces=drive`,
    token
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw Error(`Falha ao listar backups no Google Drive (${res.status}). ${errText}`);
  }
  const json = await res.json();
  return (json.files || []).map(f => ({
    id: String(f.id || ''),
    name: String(f.name || 'backup.json'),
    size: Number(f.size || 0),
    createdTime: String(f.createdTime || ''),
    modifiedTime: String(f.modifiedTime || f.createdTime || ''),
    webViewLink: sanitizeHttpUrl(f.webViewLink || (f.id ? `https://drive.google.com/file/d/${f.id}/view` : ''), '')
  }));
}

export async function downloadSuiteBackupFromDrive(fileId, overrides = {}) {
  const cleanId = String(fileId || '').trim();
  if (!/^[\w-]{6,200}$/.test(cleanId)) throw Error('Identificador de backup inválido.');
  const token = overrides.token || getDriveToken();
  if (!token) {
    throw Object.assign(Error('Conecte o Google Drive para baixar este backup.'), { code: 'DRIVE_AUTH_REQUIRED' });
  }
  const metaRes = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(cleanId)}?fields=id,name,size,trashed`,
    token
  );
  if (!metaRes.ok) throw Error(`Não foi possível consultar o backup no Google Drive (${metaRes.status}).`);
  const meta = await metaRes.json();
  if (meta?.trashed) throw Error('Este backup está na lixeira do Google Drive.');
  if (Number(meta?.size || 0) > maxBackupBytes) throw Error('Este backup excede o limite de segurança (5 MB).');

  const dlRes = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(cleanId)}?alt=media`,
    token
  );
  if (!dlRes.ok) throw Error(`Não foi possível baixar o backup do Google Drive (${dlRes.status}).`);
  const text = await dlRes.text();
  if (text.length > maxBackupBytes) throw Error('Conteúdo do backup excede 5 MB.');
  try {
    return JSON.parse(text);
  } catch {
    throw Error('O arquivo de backup no Google Drive não é um JSON válido.');
  }
}

export async function deleteSuiteBackupFromDrive(fileId, overrides = {}) {
  const cleanId = String(fileId || '').trim();
  if (!/^[\w-]{6,200}$/.test(cleanId)) throw Error('Identificador de backup inválido.');
  const token = overrides.token || getDriveToken();
  if (!token) {
    throw Object.assign(Error('Conecte o Google Drive para mover este backup para a lixeira.'), { code: 'DRIVE_AUTH_REQUIRED' });
  }
  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(cleanId)}`,
    token,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashed: true })
    }
  );
  if (!res.ok) throw Error(`Falha ao mover backup para a lixeira (${res.status}).`);
  return true;
}

async function uploadToSupabaseStorage(file, mimeType, orderNumber) {
  const sb = await ensureCloudClient();
  if (!sb) throw Error('Supabase não configurado.');
  const cfg = activeConfig || await resolveCloudConfig();
  const bucket = cfg.storageBucket || 'os-attachments';
  const folder = String(orderNumber || 'rascunho').replace(/[^0-9A-Za-z_-]/g, '_');
  const safeFile = String(file.name || 'anexo').replace(/[^0-9A-Za-z._-]/g, '_');
  const storagePath = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${safeFile}`;

  const { error } = await sb.storage.from(bucket).upload(storagePath, file, {
    contentType: mimeType,
    upsert: false
  });
  if (error) throw Error(`Falha ao enviar "${file.name}" para o Supabase Storage: ${error.message}`);

  const { data: signed } = await sb.storage.from(bucket).createSignedUrl(storagePath, 3600);
  const signedUrl = sanitizeHttpUrl(signed?.signedUrl, '');
  return {
    id: randomId('sup'),
    name: file.name,
    mimeType,
    size: Number(file.size || 0),
    provider: 'supabase',
    driveFileId: '',
    storagePath,
    webViewLink: signedUrl,
    previewUrl: signedUrl,
    downloadUrl: signedUrl,
    uploadedBy: currentSession?.user?.email || '',
    uploadedAt: new Date().toISOString()
  };
}

export async function uploadCloudAttachment(file, { orderNumber = '', preferProvider = 'gdrive' } = {}) {
  if (!file) throw Error('Nenhum arquivo selecionado.');
  const mimeType = detectAttachmentMime(file);
  if (!isSupportedAttachment(file)) {
    throw Error(`Formato não suportado (${file.name}). Envie apenas PDF ou imagens (PNG, JPG, WebP, GIF).`);
  }
  if (file.size > maxAttachmentBytes) {
    throw Error(`"${file.name}" excede o limite de 25 MB por anexo.`);
  }
  if (preferProvider === 'supabase') {
    return uploadToSupabaseStorage(file, mimeType, orderNumber);
  }
  return uploadToGoogleDrive(file, mimeType, orderNumber);
}

export async function resolveAttachmentAccessUrl(attachment) {
  if (!attachment) return '';
  if (attachment.provider === 'supabase' && attachment.storagePath) {
    try {
      const sb = await ensureCloudClient();
      const cfg = activeConfig || await resolveCloudConfig();
      if (sb) {
        const { data } = await sb.storage.from(cfg.storageBucket || 'os-attachments').createSignedUrl(attachment.storagePath, 3600);
        const signedUrl = sanitizeHttpUrl(data?.signedUrl, '');
        if (signedUrl) {
          attachment.webViewLink = signedUrl;
          attachment.previewUrl = signedUrl;
          attachment.downloadUrl = signedUrl;
          return signedUrl;
        }
      }
    } catch {}
  }
  return sanitizeHttpUrl(attachment.webViewLink || attachment.previewUrl || attachment.downloadUrl || '', '');
}

export async function deleteCloudAttachment(attachment) {
  if (!attachment || typeof attachment !== 'object') return;
  try {
    if (attachment.provider === 'gdrive' && attachment.driveFileId) {
      const token = getDriveToken();
      if (token) {
        await driveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(attachment.driveFileId)}`, token, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trashed: true })
        });
      }
    } else if (attachment.provider === 'supabase' && attachment.storagePath) {
      const sb = await ensureCloudClient();
      const cfg = activeConfig || await resolveCloudConfig();
      if (sb) {
        await sb.storage.from(cfg.storageBucket || 'os-attachments').remove([attachment.storagePath]);
      }
    }
  } catch {
    // Remoção remota é best-effort para não bloquear a exclusão do vínculo na OS
  }
}
