import {
  filterOrders,
  sortOrders,
  deadlineTime,
  effectiveDeadline,
  isOverdue,
  isArchived,
  isPaused,
  isProof,
  isEndOfQueue,
  getDynamicQueueInfo,
  workTimeZone,
  filterCounterTickets,
  sortCounterTickets,
  isCounterArchived,
  isCounterRunning
} from './filters.js';
import {
  workflowSteps,
  workflowProgress,
  stages,
  activeStages,
  archivedStages,
  boardActiveStages,
  isArchivedStatus,
  isPausedStatus,
  isProofStatus,
  isHoldStatus,
  inferResumeStatus,
  deriveStatusFromWorkflow,
  validate,
  complexities,
  compareQueue,
  rankBetween,
  rankOf,
  elapsed,
  stopTimerPatch,
  normalize,
  normalizeTitle,
  formatItemNumber,
  parseItemBatchInput,
  normalizeItems,
  normalizeReminders,
  formatCopyValue,
  normalizeAttachments,
  printerCategories,
  normalizePrinters,
  normalizePrinterCatalog,
  normalizePrinterEntry,
  readBackupPrinters,
  readSuiteBackup,
  computePrintDeadline,
  formatFortalezaDateTime,
  sanitizeHttpUrl,
  formatOrderNumber,
  buildDefaultOrderReferences,
  effectiveOrderLink,
  effectiveOrderPrintLink,
  effectiveOrderPath,
  readBackup,
  restorePlan,
  counterStages,
  counterActiveStages,
  counterArchivedStages,
  counterServiceLabel,
  counterChannelLabel,
  counterFileStatusLabel,
  isCounterArchivedStatus,
  isCounterHoldStatus,
  normalizeCounterTicket,
  validateCounterTicket,
  recordCounterTicket,
  counterElapsed,
  formatStopwatch,
  startCounterTimerPatch,
  stopCounterTimerPatch,
  counterRestorePlan
} from './model.js';
import {
  localList,
  localSave,
  localRestore,
  localDelete,
  localListPrinters,
  localSavePrinter,
  localDeletePrinter,
  localReplacePrinters,
  localListCounterTickets,
  localSaveCounterTicket,
  localDeleteCounterTicket,
  localRestoreCounterTickets
} from './storage.js';
import {
  resolveCloudConfig,
  getOAuthOriginStatus,
  saveManualCloudConfig,
  clearManualCloudConfig,
  readManualCloudConfig,
  getCloudConfig,
  isPreconfiguredCloud,
  getCloudSession,
  onCloudAuthChange,
  onDriveTokenChange,
  renderInAppGoogleButton,
  requestDriveAccessToken,
  getDriveConnectionInfo,
  signInWithGmail,
  signOutCloud,
  currentCloudUser,
  hasActiveDriveToken,
  isGmailAddress,
  cloudList,
  cloudSave,
  cloudDelete,
  cloudRestore,
  subscribeCloudOrders,
  cloudListPrinters,
  cloudSavePrinter,
  cloudDeletePrinter,
  cloudRestorePrinters,
  subscribeCloudPrinters,
  cloudListCounterTickets,
  cloudSaveCounterTicket,
  cloudDeleteCounterTicket,
  cloudRestoreCounterTickets,
  subscribeCloudCounterTickets,
  cloudReadSuiteData,
  cloudWriteSuiteData,
  uploadSuiteBackupToDrive,
  listSuiteBackupsFromDrive,
  downloadSuiteBackupFromDrive,
  deleteSuiteBackupFromDrive,
  uploadCloudAttachment,
  deleteCloudAttachment,
  resolveAttachmentAccessUrl,
  isSupportedAttachment
} from './cloud.js';

export function initOsManager(options = {}) {
  const prefix = options.prefix || '';
  const root = options.root || document;
  const isViewActive = typeof options.isViewActive === 'function' ? options.isViewActive : () => true;
  const onAuthChanged = typeof options.onAuthChanged === 'function' ? options.onAuthChanged : null;
  const getSuiteBackupExtras = typeof options.getSuiteBackupExtras === 'function' ? options.getSuiteBackupExtras : null;
  const applySuiteBackupExtras = typeof options.applySuiteBackupExtras === 'function' ? options.applySuiteBackupExtras : null;

  const byId = id => document.getElementById(prefix + id);
  const form = byId('form');
  if (!form) return null;
  const fields = form.elements;
  const editor = byId('editor');
  const detailDialog = byId('os-detail');
  const picker = byId('deadline-picker');
  const mainContainer = options.mainContainer || root.querySelector('main') || document.body;

  let orders = [], selected = '', shared, password = '', version = 0, generation = 0;
  let editing = null, dragging = '', writing = false, loaded = false;
  let view = 'simple'; // 'simple' | 'table' | 'board' | 'list'
  let queueMode = 'active'; // 'active' | 'archived'
  let detailNumber = '', dragEndedAt = 0;
  let storageMode = 'local'; // 'cloud' | 'upstash' | 'local'
  let forceLocalFallback = false;
  let cloudUser = null;
  let draftAttachments = [];
  let pendingDeleteAttachments = [];
  let pendingRetryFiles = [];
  let draftAttachBusy = false;
  let printersCatalog = localListPrinters();
  let draftPrinters = [];
  let draftItems = [];
  let draftReminders = [];
  let editingPrinterId = '';
  const copyModeStorageKey = 'os-maneger:copy-mode:v1';
  let copyMode = (() => {
    try {
      return localStorage.getItem(copyModeStorageKey) === 'complete' ? 'complete' : 'single';
    } catch {
      return 'single';
    }
  })();
  let unsubscribeAuth = null;
  let unsubscribeRealtime = null;
  let unsubscribePrintersRealtime = null;
  let unsubscribeCounterRealtime = null;
  let unsubscribeDrive = null;
  let activeArea = 'os'; // 'os' | 'counter'
  let counterTickets = [];
  let counterQueueMode = 'active'; // 'active' | 'archived'
  let editingCounter = null;
  let draftCounterAttachments = [];
  let pendingDeleteCounterAttachments = [];
  let draftCounterTimer = { elapsedMs: 0, startedAt: 0, sessions: [] };
  let draftCounterAttachBusy = false;
  let deletingCounter = null;
  let promotingCounterId = '';
  let counterWriting = false;
  let savingCloudLocally = false;
  let realtimeDirty = false;
  let realtimeStatus = 'idle'; // 'idle' | 'SUBSCRIBED' | 'RECONNECTING' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED'
  let googleButtonMounted = false;
  let googleButtonBusy = false;
  let lastAuthStateKey = '';
  let authTransitionPromise = null;
  const isEmbedded = Boolean(prefix);

  const deadlineFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: workTimeZone });
  const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  function node(tag, text, cls) {
    const el = document.createElement(tag);
    if (text !== undefined && text !== null && text !== '') el.textContent = text;
    if (cls) el.className = cls;
    return el;
  }

  const stageIndex = status => Math.max(0, stages.indexOf(status));
  const stageTag = status => node('span', status, 'stage s' + stageIndex(status));

  if (fields.status && fields.status.options.length === 0) {
    for (const stage of stages) {
      fields.status.add(new Option(stage, stage));
      byId('filter-status')?.add(new Option(stage, stage));
    }
    for (const level of complexities) byId('filter-complexity')?.add(new Option(level, level));
    for (const level of complexities) fields.complexity.add(new Option(level, level));
  }

  function icon(name) {
    const el = node('span', name, 'material-symbols-outlined');
    el.setAttribute('aria-hidden', 'true');
    return el;
  }

  const actionIcons = {
    'Editar OS': 'edit',
    'Excluir OS': 'delete',
    'Copiar cliente': 'content_copy',
    'Copiar pedido': 'content_copy',
    'Copiar OS': 'content_copy',
    'Copiar completo': 'content_copy',
    'Copiar caminho': 'folder_copy',
    'Retomar OS': 'play_arrow',
    'Pausar OS': 'pause',
    'Reabrir OS': 'refresh',
    'Abrir OS': 'open_in_new',
    'Editar conhecimento': 'edit'
  };

  function action(label, fn) {
    const button = node('button', label);
    button.type = 'button';
    if (actionIcons[label]) button.prepend(icon(actionIcons[label]));
    button.onclick = fn;
    return button;
  }

  async function save(input) {
    if (storageMode === 'cloud') {
      savingCloudLocally = true;
      try {
        return await cloudSave(input);
      } finally {
        savingCloudLocally = false;
        if (realtimeDirty) {
          realtimeDirty = false;
          setTimeout(() => refresh().catch(() => {}), 80);
        }
      }
    }
    if (shared) return api('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    return localSave(input);
  }

  async function deleteOrderRecord(order) {
    if (storageMode === 'cloud') {
      savingCloudLocally = true;
      try {
        return await cloudDelete(order);
      } finally {
        savingCloudLocally = false;
        if (realtimeDirty) {
          realtimeDirty = false;
          setTimeout(() => refresh().catch(() => {}), 80);
        }
      }
    }
    if (shared) {
      return api('/api/orders', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(order) });
    }
    return localDelete(order);
  }

  async function restoreBackupRecords(incomingList, overwriteFlag, snapshotOrders, precomputedInputs) {
    if (storageMode === 'cloud') {
      savingCloudLocally = true;
      try {
        return await cloudRestore(incomingList, overwriteFlag, snapshotOrders);
      } finally {
        savingCloudLocally = false;
        if (realtimeDirty) {
          realtimeDirty = false;
          setTimeout(() => refresh().catch(() => {}), 80);
        }
      }
    }
    if (shared) {
      return api('/api/orders?restore=1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(precomputedInputs) });
    }
    return localRestore(precomputedInputs);
  }

  const pausedMemoryKey = 'os-maneger:paused-from:v1';

  function readPausedMap() {
    try {
      const raw = localStorage.getItem(pausedMemoryKey);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function rememberPausedFrom(number, prevStatus) {
    if (!number || !prevStatus || isHoldStatus(prevStatus) || isArchivedStatus(prevStatus)) return;
    try {
      const map = readPausedMap();
      map[number] = prevStatus;
      localStorage.setItem(pausedMemoryKey, JSON.stringify(map));
    } catch {}
  }

  function consumePausedFrom(order) {
    if (order?.pausedFrom && activeStages.includes(order.pausedFrom) && !isHoldStatus(order.pausedFrom)) {
      forgetPausedFrom(order.number);
      return order.pausedFrom;
    }
    try {
      const map = readPausedMap();
      const prev = map[order.number];
      delete map[order.number];
      localStorage.setItem(pausedMemoryKey, JSON.stringify(map));
      if (prev && activeStages.includes(prev) && !isHoldStatus(prev)) return prev;
    } catch {}
    return inferResumeStatus(order);
  }

  function forgetPausedFrom(number) {
    try {
      const map = readPausedMap();
      if (number in map) {
        delete map[number];
        localStorage.setItem(pausedMemoryKey, JSON.stringify(map));
      }
    } catch {}
  }

  function tailRankFor(orderNumber) {
    const remaining = orders.filter(item => item.number !== orderNumber);
    if (!remaining.length) return undefined;
    const last = remaining[remaining.length - 1];
    return rankBetween(rankOf(last), null, orderNumber);
  }

  function statusTransitionPatch(order, nextStatus, now = Date.now()) {
    const patch = { status: nextStatus };
    if (nextStatus === 'Concluído') {
      patch.workflow = Object.fromEntries(workflowSteps.map(s => [s.id, true]));
      Object.assign(patch, stopTimerPatch(order, now));
      forgetPausedFrom(order.number);
    } else if (nextStatus === 'Repassado') {
      Object.assign(patch, stopTimerPatch(order, now));
      forgetPausedFrom(order.number);
    } else if (isHoldStatus(nextStatus)) {
      const prevStage = !isHoldStatus(order.status) && !isArchivedStatus(order.status)
        ? order.status
        : (order.pausedFrom || '');
      if (prevStage) patch.pausedFrom = prevStage;
      rememberPausedFrom(order.number, order.status);
      Object.assign(patch, stopTimerPatch(order, now));
      const tailRank = tailRankFor(order.number);
      if (tailRank) patch.rank = tailRank;
    } else {
      patch.pausedFrom = '';
      forgetPausedFrom(order.number);
      if (order.status === 'Concluído' && workflowProgress(order) === 100) {
        patch.workflow = Object.fromEntries(workflowSteps.map((s, i) => [s.id, i < workflowSteps.length - 1 ? !!order.workflow?.[s.id] : false]));
      }
    }
    return patch;
  }

  function pauseOrder(order) {
    return change(order, statusTransitionPatch(order, 'Pausado'));
  }

  function resumeOrder(order) {
    const nextStatus = consumePausedFrom(order);
    return change(order, statusTransitionPatch(order, nextStatus));
  }

  function reopenOrder(order) {
    const nextWf = order.status === 'Concluído'
      ? Object.fromEntries(workflowSteps.map((s, i) => [s.id, i < workflowSteps.length - 1 ? !!order.workflow?.[s.id] : false]))
      : order.workflow;
    const targetStatus = inferResumeStatus({ workflow: nextWf });
    return change(order, { ...statusTransitionPatch(order, targetStatus), workflow: nextWf });
  }

  function statusNotice(prevOrder, nextOrder) {
    const wasArchived = isArchived(prevOrder);
    const nowArchived = isArchivedStatus(nextOrder.status);
    const wasPaused = isPaused(prevOrder);
    const nowPaused = isPausedStatus(nextOrder.status);
    const wasProof = isProof(prevOrder);
    const nowProof = isProofStatus(nextOrder.status);
    const wasHold = wasPaused || wasProof;
    const nowHold = nowPaused || nowProof;
    if (!wasArchived && nowArchived) {
      return nextOrder.status === 'Repassado'
        ? `OS ${prevOrder.number} marcada como Repassado e movida automaticamente para Arquivados.`
        : `OS ${prevOrder.number} concluída e enviada automaticamente para Arquivados.`;
    }
    if (wasArchived && !nowArchived) {
      return `OS ${prevOrder.number} reaberta e devolvida para a fila ativa (${nextOrder.status}).`;
    }
    if (!wasHold && nowProof) {
      return `OS ${prevOrder.number} colocada em Prova e movida para o fim da fila ativa (sem esmaecer e não arquiva).`;
    }
    if (!wasHold && nowPaused) {
      return `OS ${prevOrder.number} pausada, esmaecida e movida para o fim da fila ativa (não arquiva).`;
    }
    if (wasProof && nowPaused) {
      return `OS ${prevOrder.number} alterada para Pausado (esmaecida no fim da fila).`;
    }
    if (wasPaused && nowProof) {
      return `OS ${prevOrder.number} alterada para Prova (mantida no fim da fila sem esmaecer).`;
    }
    if (wasHold && !nowHold && !nowArchived) {
      return `OS ${prevOrder.number} retomada na fila ativa (${nextOrder.status}).`;
    }
    return '';
  }

  async function change(order, patch, customNotice = '') {
    if (writing) return;
    const focusedWorkflow = document.activeElement?.dataset?.workflow;
    if (byId('detail-error')) byId('detail-error').textContent = '';
    writing = true;
    lockControls();
    try {
      const merged = { ...order, rank: rankOf(order), ...patch };
      await save(merged);
      await refresh();
      const notice = customNotice || statusNotice(order, merged);
      if (notice && byId('message')) {
        byId('message').textContent = notice;
      }
    } catch (err) {
      const message = err.message + ' Atualize a fila antes de tentar novamente.';
      if (byId('message')) byId('message').textContent = message;
      if (byId('detail-error')) byId('detail-error').textContent = message;
    } finally {
      writing = false;
      render();
      renderDetail();
      lockControls();
      if (focusedWorkflow) {
        Array.from((detailDialog?.open ? detailDialog : root).querySelectorAll('[data-workflow]')).find(el => el.dataset.workflow === focusedWorkflow)?.focus();
      }
    }
  }

  function move(order, position) {
    if (!Number.isInteger(position) || position < 1 || position > orders.length || orders[position - 1] === order) return;
    const rest = orders.filter(item => item.number !== order.number);
    const left = rest[position - 2], right = rest[position - 1];
    return change(order, { rank: rankBetween(left ? rankOf(left) : '', right ? rankOf(right) : null, order.number) });
  }

  function queuePoolFor(order) {
    const archivedFlag = isArchived(order);
    return orders.filter(item => isArchived(item) === archivedFlag);
  }

  function queuePositionOf(order) {
    const pool = queuePoolFor(order);
    const index = pool.findIndex(item => item.number === order.number);
    return {
      pool,
      index,
      position: index >= 0 ? index + 1 : 1,
      total: Math.max(1, pool.length)
    };
  }

  function moveStep(order, delta) {
    if (writing || !Number.isInteger(delta) || delta === 0) return;
    const { pool, index } = queuePositionOf(order);
    const targetIdx = index + delta;
    if (index < 0 || targetIdx < 0 || targetIdx >= pool.length) return;
    let switchedSort = false;
    const sortEl = byId('sort');
    if (sortEl && sortEl.value !== 'queue') {
      sortEl.value = 'queue';
      switchedSort = true;
    }
    const left = delta < 0 ? (pool[targetIdx - 1] || null) : pool[targetIdx];
    const right = delta < 0 ? pool[targetIdx] : (pool[targetIdx + 1] || null);
    const nextRank = rankBetween(left ? rankOf(left) : '', right ? rankOf(right) : null, order.number);
    const notice = `OS ${order.number} movida para a posição #${targetIdx + 1} de ${pool.length}` +
      (switchedSort ? ' (ordenação alterada para Ordem manual da fila).' : '.');
    return change(order, { rank: nextRank }, notice);
  }

  function buildPositionStepper(order, { compact = false } = {}) {
    const { position, total } = queuePositionOf(order);
    const paused = isPaused(order);
    const wrap = node('div', '', 'position-stepper' + (compact ? ' is-compact' : ''));

    const upBtn = node('button', '↑', 'pos-arrow-btn');
    upBtn.type = 'button';
    upBtn.dataset.edgeDisabled = position <= 1 ? '1' : '';
    upBtn.disabled = writing || position <= 1;
    upBtn.title = `Subir OS ${order.number} na fila (#${position} → #${Math.max(1, position - 1)})`;
    upBtn.setAttribute('aria-label', `Mover OS ${order.number} para cima`);
    upBtn.onclick = e => {
      e.stopPropagation();
      moveStep(order, -1);
    };

    const downBtn = node('button', '↓', 'pos-arrow-btn');
    downBtn.type = 'button';
    downBtn.dataset.edgeDisabled = position >= total ? '1' : '';
    downBtn.disabled = writing || position >= total;
    downBtn.title = `Descer OS ${order.number} na fila (#${position} → #${Math.min(total, position + 1)})`;
    downBtn.setAttribute('aria-label', `Mover OS ${order.number} para baixo`);
    downBtn.onclick = e => {
      e.stopPropagation();
      moveStep(order, 1);
    };

    const indicator = node('span', '', 'position-indicator' + (paused ? ' is-paused-pos' : ''));
    indicator.title = `Posição #${position} de ${total} na fila`;
    indicator.append(node('strong', (paused ? '⏸ ' : '') + '#' + position));
    if (!compact) {
      indicator.append(node('small', `/${total}`, 'position-total'));
    }

    wrap.append(upBtn, downBtn, indicator);
    return wrap;
  }

  function setCopyMode(nextMode, { syncCloud = true } = {}) {
    copyMode = nextMode === 'complete' ? 'complete' : 'single';
    try {
      localStorage.setItem(copyModeStorageKey, copyMode);
    } catch {}
    if (byId('copy-mode')) byId('copy-mode').value = copyMode;
    if (syncCloud && storageMode === 'cloud' && cloudUser) {
      cloudWriteSuiteData('osm:prefs', 'os-maneger', { copyMode }).catch(() => {});
    }
    render();
    renderDetail();
  }

  function applyCloudPrefs(prefs) {
    if (!prefs || typeof prefs !== 'object') return;
    if (prefs.copyMode === 'complete' || prefs.copyMode === 'single') {
      if (prefs.copyMode !== copyMode) setCopyMode(prefs.copyMode, { syncCloud: false });
    }
  }

  async function copyNumber(value, button) {
    if (!value) return;
    let copied = false;
    try {
      await navigator.clipboard.writeText(value);
      copied = true;
    } catch {
      try {
        const tmp = document.createElement('textarea');
        tmp.value = value;
        tmp.setAttribute('readonly', '');
        tmp.style.position = 'fixed';
        tmp.style.opacity = '0';
        document.body.appendChild(tmp);
        tmp.select();
        copied = document.execCommand('copy');
        tmp.remove();
      } catch {}
    }
    if (!copied) {
      window.prompt('Copie o código selecionado', value);
      return;
    }
    if (button) {
      if (!button._savedChildren) {
        button._savedChildren = Array.from(button.childNodes);
      }
      clearTimeout(button._copyResetTimer);
      button.classList.add('is-copied');
      button.textContent = '✓ ' + value;
      button._copyResetTimer = setTimeout(() => {
        if (!button.isConnected) return;
        button.classList.remove('is-copied');
        if (button._savedChildren) {
          button.replaceChildren(...button._savedChildren);
          delete button._savedChildren;
        }
      }, 1500);
    }
    if (byId('message') && (!detailDialog || !detailDialog.open)) {
      byId('message').textContent = 'Copiado: ' + value;
    }
  }

  function copyOrderToken(order, part, button, itemNumber = '') {
    const value = formatCopyValue(order, part, { mode: copyMode, itemNumber });
    return copyNumber(value, button);
  }

  function renderEditorItems() {
    const listEl = byId('editor-items-list');
    if (!listEl) return;
    listEl.replaceChildren();
    if (!draftItems.length) {
      listEl.append(node('span', 'Nenhum item adicionado ainda.', 'items-empty-note'));
      return;
    }
    for (const item of draftItems) {
      const chip = node('div', '', 'editor-item-chip');
      chip.append(node('strong', item.number, 'item-code-mono'));
      if (item.label) chip.append(node('span', item.label, 'editor-item-label'));
      const rmBtn = action('×', () => {
        draftItems = draftItems.filter(entry => entry.number !== item.number);
        renderEditorItems();
      });
      rmBtn.className = 'chip-remove-btn';
      rmBtn.setAttribute('aria-label', 'Remover item ' + item.number);
      chip.append(rmBtn);
      listEl.append(chip);
    }
  }

  function addDraftItemsFromInputs() {
    const numInput = byId('editor-item-number-input');
    const labelInput = byId('editor-item-label-input');
    const hintEl = byId('editor-items-hint');
    if (!numInput) return true;
    const rawNum = numInput.value.trim();
    if (!rawNum) return false;
    const { valid, invalid } = parseItemBatchInput(rawNum);
    if (invalid.length > 0 || !valid.length) {
      if (hintEl) {
        hintEl.textContent = `Item inválido (${invalid.join(', ')}). Informe somente dígitos (até 6 dígitos, ex.: 12 -> 000012).`;
        hintEl.classList.add('is-error');
      }
      numInput.focus();
      return false;
    }
    const cleanLabel = (labelInput?.value || '').trim().replace(/\s+/g, ' ').slice(0, 120);
    const existingMap = new Map(draftItems.map(item => [item.number, item]));
    for (const entry of valid) {
      const prev = existingMap.get(entry.number);
      const nextLabel = valid.length === 1 ? (cleanLabel || prev?.label || '') : (prev?.label || '');
      existingMap.set(entry.number, { number: entry.number, label: nextLabel });
    }
    draftItems = normalizeItems(Array.from(existingMap.values()));
    numInput.value = '';
    if (valid.length === 1 && labelInput) labelInput.value = '';
    if (hintEl) {
      hintEl.classList.remove('is-error');
      hintEl.textContent = `${draftItems.length} item(ns) no padrão 000000.`;
    }
    renderEditorItems();
    return true;
  }

  function renderEditorReminders() {
    const listEl = byId('editor-reminders-list');
    if (!listEl) return;
    listEl.replaceChildren();
    if (!draftReminders.length) {
      listEl.append(node('span', 'Nenhum lembrete rápido cadastrado.', 'items-empty-note'));
      return;
    }
    for (const rem of draftReminders) {
      const chip = node('div', '', 'editor-reminder-chip');
      chip.append(node('span', '📌 ' + rem.text, 'editor-reminder-text'));
      const rmBtn = action('×', () => {
        draftReminders = draftReminders.filter(entry => entry.id !== rem.id && entry.text !== rem.text);
        renderEditorReminders();
      });
      rmBtn.className = 'chip-remove-btn';
      rmBtn.setAttribute('aria-label', 'Remover lembrete');
      chip.append(rmBtn);
      listEl.append(chip);
    }
  }

  function addDraftReminderFromInput() {
    const inputEl = byId('editor-reminder-input');
    if (!inputEl) return false;
    const text = inputEl.value.trim().slice(0, 500);
    if (!text) return false;
    const id = 'rem_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    draftReminders = normalizeReminders([...draftReminders, { id, text, createdAt: new Date().toISOString() }]);
    inputEl.value = '';
    renderEditorReminders();
    return true;
  }

  function buildCardCopyAndItemsSection(order, detail = false) {
    const section = node('section', '', 'os-copy-items-box' + (detail ? ' is-detail' : ''));
    const [client = '', request = ''] = (order.number || '').split('-');
    const items = normalizeItems(order.items || []);

    const topRow = node('div', '', 'os-copy-bar');
    const tokens = node('div', '', 'os-copy-tokens');

    const makeTokenBtn = (labelText, codeText, part) => {
      const btn = node('button', '', 'copy-token-btn');
      btn.type = 'button';
      const expected = formatCopyValue(order, part, { mode: copyMode });
      btn.title = `Clique para copiar: ${expected}`;
      btn.append(node('small', labelText, 'token-lbl'), node('strong', codeText, 'item-code-mono'));
      btn.onclick = e => {
        e.stopPropagation();
        const latest = orders.find(o => o.number === order.number) || order;
        copyOrderToken(latest, part, btn);
      };
      return btn;
    };

    tokens.append(
      makeTokenBtn('Cliente', client, 'client'),
      makeTokenBtn('Pedido', request, 'request'),
      makeTokenBtn('OS', order.number, 'os')
    );
    topRow.append(tokens);

    const modeWrap = node('div', '', 'copy-mode-pills');
    modeWrap.setAttribute('role', 'group');
    modeWrap.setAttribute('aria-label', 'Formato ao clicar para copiar');
    const btnSingle = action('Individual', e => {
      e.stopPropagation();
      setCopyMode('single');
    });
    btnSingle.className = 'copy-mode-pill' + (copyMode === 'single' ? ' is-active' : '');
    btnSingle.setAttribute('aria-pressed', String(copyMode === 'single'));
    btnSingle.title = 'Copia apenas o número clicado (Cliente, Pedido, OS ou Item)';

    const btnFull = action('Completo', e => {
      e.stopPropagation();
      setCopyMode('complete');
    });
    btnFull.className = 'copy-mode-pill' + (copyMode === 'complete' ? ' is-active' : '');
    btnFull.setAttribute('aria-pressed', String(copyMode === 'complete'));
    btnFull.title = 'Copia completo: Cliente-Pedido-Item';

    modeWrap.append(node('span', 'Cópia:', 'copy-mode-lbl'), btnSingle, btnFull);
    topRow.append(modeWrap);
    section.append(topRow);

    if (items.length > 0 || detail) {
      const itemsWrap = node('div', '', 'os-items-strip');
      const itemsHead = node('div', '', 'os-items-head');
      itemsHead.append(
        node('strong', `Itens do pedido (${items.length})`, 'os-items-title'),
        node(
          'span',
          copyMode === 'complete'
            ? `Clique em um item para copiar completo (${client}-${request}-000000)`
            : 'Clique em um item para copiar o código de 6 dígitos',
          'os-items-hint'
        )
      );
      itemsWrap.append(itemsHead);

      if (items.length > 0) {
        const chipsRow = node('div', '', 'os-items-chips');
        for (const item of items) {
          const chip = node('div', '', 'os-item-pill-group');
          const copyBtn = node('button', '', 'copy-item-btn');
          copyBtn.type = 'button';
          const preview = formatCopyValue(order, 'item', { mode: copyMode, itemNumber: item.number });
          copyBtn.title = `Clique para copiar: ${preview}`;
          copyBtn.append(node('strong', item.number, 'item-code-mono'));
          if (item.label) copyBtn.append(node('span', item.label, 'item-label-txt'));
          copyBtn.onclick = e => {
            e.stopPropagation();
            const latest = orders.find(o => o.number === order.number) || order;
            copyOrderToken(latest, 'item', copyBtn, item.number);
          };
          chip.append(copyBtn);
          if (detail) {
            const delItem = action('×', e => {
              e.stopPropagation();
              const latest = orders.find(o => o.number === order.number) || order;
              const nextItems = normalizeItems((latest.items || []).filter(entry => entry.number !== item.number));
              change(latest, { items: nextItems }, `Item ${item.number} removido da OS ${latest.number}.`);
            });
            delItem.className = 'chip-remove-btn';
            delItem.title = `Remover item ${item.number}`;
            delItem.setAttribute('aria-label', `Remover item ${item.number}`);
            chip.append(delItem);
          }
          chipsRow.append(chip);
        }
        itemsWrap.append(chipsRow);
      } else if (detail) {
        itemsWrap.append(node('p', 'Nenhum item de 6 dígitos cadastrado ainda nesta OS.', 'items-empty-note'));
      }

      if (detail) {
        const inlineAdd = node('form', '', 'inline-item-add-form');
        const numIn = node('input', '');
        numIn.type = 'text';
        numIn.maxLength = 80;
        numIn.inputMode = 'numeric';
        numIn.placeholder = 'Adicionar item (ex.: 1, 12 ou 1, 2, 15)';
        numIn.setAttribute('aria-label', 'Adicionar item de 6 dígitos');
        const lblIn = node('input', '');
        lblIn.type = 'text';
        lblIn.maxLength = 120;
        lblIn.placeholder = 'Descrição opcional';
        lblIn.setAttribute('aria-label', 'Descrição opcional do item');
        const addBtn = node('button', '+ Item', 'inline-add-submit');
        addBtn.type = 'submit';
        const errSpan = node('span', '', 'inline-add-err');
        inlineAdd.onsubmit = e => {
          e.preventDefault();
          e.stopPropagation();
          errSpan.textContent = '';
          const raw = numIn.value.trim();
          if (!raw) return;
          const { valid, invalid } = parseItemBatchInput(raw);
          if (invalid.length || !valid.length) {
            errSpan.textContent = `Use até 6 dígitos numéricos (${invalid.join(', ') || raw}).`;
            numIn.focus();
            return;
          }
          const latest = orders.find(o => o.number === order.number) || order;
          const cleanLabel = lblIn.value.trim().replace(/\s+/g, ' ').slice(0, 120);
          const map = new Map(normalizeItems(latest.items).map(entry => [entry.number, entry]));
          for (const entry of valid) {
            const prev = map.get(entry.number);
            map.set(entry.number, { number: entry.number, label: valid.length === 1 ? (cleanLabel || prev?.label || '') : (prev?.label || '') });
          }
          change(latest, { items: normalizeItems(Array.from(map.values())) }, `${valid.length} item(ns) salvo(s) na OS ${latest.number}.`);
        };
        inlineAdd.append(numIn, lblIn, addBtn, errSpan);
        itemsWrap.append(inlineAdd);
      }
      section.append(itemsWrap);
    }

    return section;
  }

  function buildCardRemindersSection(order, detail = false) {
    const reminders = normalizeReminders(order.reminders || []);
    if (!detail && !reminders.length) return null;

    const section = node('section', '', 'reminders-callout' + (reminders.length ? ' has-reminders' : ' is-empty'));
    const head = node('div', '', 'reminders-callout-head');
    const titleWrap = node('div', '', 'reminders-callout-title');
    titleWrap.append(
      node('span', '📌', 'reminders-pin'),
      node('strong', 'LEMBRETES & COMENTÁRIOS RÁPIDOS'),
      node('span', reminders.length ? String(reminders.length) : '0', 'reminders-count-badge')
    );
    head.append(titleWrap, node('span', 'Transitórios · adicione ou remova livremente', 'reminders-sub'));
    section.append(head);

    if (reminders.length > 0) {
      const list = node('ul', '', 'reminders-list');
      for (const rem of reminders) {
        const li = node('li', '', 'reminder-item');
        const body = node('div', '', 'reminder-item-body');
        body.append(node('p', rem.text, 'reminder-item-text'));
        if (rem.createdAt) {
          const ts = Date.parse(rem.createdAt);
          if (Number.isFinite(ts)) {
            body.append(node('small', dateFormat.format(new Date(ts)), 'reminder-item-time'));
          }
        }
        const rmBtn = action('× Apagar', e => {
          e.stopPropagation();
          const latest = orders.find(o => o.number === order.number) || order;
          const next = normalizeReminders(latest.reminders).filter(entry => entry.id !== rem.id && entry.text !== rem.text);
          change(latest, { reminders: next }, 'Lembrete removido.');
        });
        rmBtn.className = 'reminder-remove-btn';
        rmBtn.title = 'Apagar lembrete transitório';
        li.append(body, rmBtn);
        list.append(li);
      }
      section.append(list);
    } else if (detail) {
      section.append(node('p', 'Sem lembretes ativos no momento. Adicione avisos passageiros abaixo (ex.: conferir amostra, ligar para cliente).', 'reminders-empty-hint'));
    }

    if (detail) {
      const quickForm = node('form', '', 'inline-reminder-form');
      const remInput = node('input', '');
      remInput.type = 'text';
      remInput.maxLength = 500;
      remInput.placeholder = 'Adicionar lembrete rápido e pressionar Enter…';
      remInput.setAttribute('aria-label', 'Adicionar lembrete rápido na OS ' + order.number);
      const addBtn = node('button', '+ Lembrete', 'inline-reminder-btn');
      addBtn.type = 'submit';
      quickForm.onsubmit = e => {
        e.preventDefault();
        e.stopPropagation();
        const text = remInput.value.trim().slice(0, 500);
        if (!text) return;
        const latest = orders.find(o => o.number === order.number) || order;
        const id = 'rem_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const next = normalizeReminders([...normalizeReminders(latest.reminders), { id, text, createdAt: new Date().toISOString() }]);
        change(latest, { reminders: next }, 'Lembrete adicionado.');
      };
      quickForm.append(remInput, addBtn);
      section.append(quickForm);
    }

    return section;
  }

  function buildDetailNotesSection(order) {
    const notesSec = node('section', '', 'detail-notes');
    const head = node('div', '', 'detail-notes-head');
    const titleBox = node('div', '', 'detail-notes-titlewrap');
    titleBox.append(
      node('h3', 'Observações · Base de Conhecimento'),
      node('span', 'Especificidades permanentes deste trabalho (papel, faca, acabamentos, perfil) para lembrar em futuros pedidos.', 'detail-notes-sub')
    );
    const bodyWrap = node('div', '', 'detail-notes-body');
    const p = node(
      'p',
      order.notes || 'Nenhuma especificidade registrada ainda na Base de Conhecimento.',
      order.notes ? 'knowledge-text' : 'knowledge-text is-empty'
    );
    bodyWrap.append(p);

    const editBtn = action('Editar conhecimento', e => {
      e.stopPropagation();
      editBtn.hidden = true;
      const editForm = node('form', '', 'inline-knowledge-form');
      const ta = node('textarea', '');
      ta.rows = 6;
      ta.maxLength = 20000;
      ta.value = order.notes || '';
      ta.placeholder = 'Registre aqui detalhes técnicos e especificidades permanentes deste trabalho…';
      const rowBtns = node('div', '', 'inline-knowledge-actions');
      const cancelBtn = action('Cancelar', ev => {
        ev.stopPropagation();
        bodyWrap.replaceChildren(p);
        editBtn.hidden = false;
      });
      const saveBtn = node('button', 'Salvar conhecimento', 'primary');
      saveBtn.type = 'submit';
      rowBtns.append(cancelBtn, saveBtn);
      editForm.append(ta, rowBtns);
      editForm.onsubmit = ev => {
        ev.preventDefault();
        ev.stopPropagation();
        const latest = orders.find(o => o.number === order.number) || order;
        change(latest, { notes: ta.value.trim().slice(0, 20000) }, 'Base de conhecimento atualizada.');
      };
      bodyWrap.replaceChildren(editForm);
      ta.focus();
    });
    editBtn.className = 'inline-knowledge-edit-btn';
    head.append(titleBox, editBtn);
    notesSec.append(head, bodyWrap);
    return notesSec;
  }

  function formatOrderDateShort(value) {
    if (!value) return '—';
    const ts = deadlineTime(value);
    return Number.isFinite(ts) ? deadlineFormat.format(new Date(ts)) : '—';
  }

  function buildDeadlineTooltip(order) {
    const calc = computePrintDeadline(order);
    const lines = [];
    if (calc.printedAt) lines.push(`Impressão da OS: ${formatOrderDateShort(calc.printedAt)}`);
    if (calc.receivedAt) lines.push(`Recebimento: ${formatOrderDateShort(calc.receivedAt)}`);
    if (calc.productionDate) lines.push(`Produção: ${formatOrderDateShort(calc.productionDate)}`);
    if (calc.printDeadline) lines.push(`Prazo de finalização (máx. 24h): ${formatOrderDateShort(calc.printDeadline)}`);
    if (calc.ruleSummary) lines.push(calc.ruleSummary);
    return lines.join('\n');
  }

  function updateDeadline(element, order) {
    const eff = effectiveDeadline(order);
    const overdue = isOverdue(order);
    const calc = computePrintDeadline(order);
    element.classList.toggle('overdue', overdue);
    element.classList.toggle('is-tight', !overdue && (calc.constrainedByProduction || calc.invalidSchedule));
    if (!eff) {
      element.textContent = 'Sem prazo definido';
    } else {
      const prefixLabel = overdue ? 'Atrasada · ' : (calc.receivedAt ? 'Finalização (máx. 24h) · ' : 'Prazo · ');
      element.textContent = prefixLabel + formatOrderDateShort(eff) + ' (Fortaleza)';
    }
    element.title = buildDeadlineTooltip(order);
    element.closest('.card')?.classList.toggle('is-overdue', overdue);
  }

  function buildOrderDatesSection(order, detail = false) {
    const calc = computePrintDeadline(order);
    const hasAnyDate = Boolean(calc.printedAt || calc.receivedAt || calc.productionDate || calc.printDeadline);
    if (!detail && !hasAnyDate) return null;

    const overdue = isOverdue(order);
    const box = node('section', '', 'os-dates-card' + (detail ? ' is-detail' : ''));
    const grid = node('div', '', 'os-dates-items');
    const addCell = (label, value, extraClass = '') => {
      const cell = node('div', '', 'os-date-cell' + (extraClass ? ' ' + extraClass : ''));
      cell.append(node('span', label, 'os-date-lbl'), node('strong', value || '—', 'os-date-val'));
      grid.append(cell);
    };

    addCell('Impressão da OS', formatOrderDateShort(calc.printedAt));
    addCell('Recebimento', formatOrderDateShort(calc.receivedAt));
    addCell('Produção', formatOrderDateShort(calc.productionDate));

    const slaTone = calc.invalidSchedule || overdue
      ? 'is-danger'
      : calc.constrainedByProduction
        ? 'is-warn'
        : calc.printDeadline
          ? 'is-ok'
          : '';
    const slaCell = node('div', '', 'os-date-cell is-sla ' + slaTone);
    slaCell.append(
      node('span', overdue ? '⚠ Finalização (atrasada)' : 'Prazo finalização (máx. 24h)', 'os-date-lbl'),
      node('strong', calc.printDeadline ? formatOrderDateShort(calc.printDeadline) : 'Não calculado', 'os-date-val')
    );
    grid.append(slaCell);
    box.append(grid);

    if (detail || calc.invalidSchedule || calc.constrainedByProduction) {
      const noteCls = 'os-dates-rule' + (calc.invalidSchedule || overdue ? ' is-danger' : calc.constrainedByProduction ? ' is-warn' : '');
      box.append(node('p', calc.ruleSummary, noteCls));
    }
    return box;
  }

  function setQueueMode(nextMode, { preserveStatus = false } = {}) {
    queueMode = nextMode === 'archived' ? 'archived' : 'active';
    if (!preserveStatus) {
      if (queueMode === 'archived' || isArchivedStatus(selected)) {
        selected = '';
        if (byId('filter-status')) byId('filter-status').value = '';
      }
    }
    byId('queue-active')?.setAttribute('aria-pressed', String(queueMode === 'active'));
    byId('queue-archived')?.setAttribute('aria-pressed', String(queueMode === 'archived'));
    render();
  }

  function priorityPill(order) {
    const info = getDynamicQueueInfo(order);
    if (!info || info.key === 'flow' || info.key === 'print') return null;
    return node('span', info.label, `notion-pill dynamic-pill tone-${info.tone}`);
  }

  function holdSectionBanner(proofCount, pausedCount) {
    const div = node('div', '', 'notion-paused-divider' + (proofCount > 0 && pausedCount === 0 ? ' is-proof-only' : ''));
    const total = proofCount + pausedCount;
    let heading = `Em pausa · fim da fila (${pausedCount})`;
    let noteText = 'Não arquivam e aguardam retomada sem bloquear a produção ativa';
    if (proofCount > 0 && pausedCount > 0) {
      heading = `Em Prova e Pausadas · fim da fila (${total})`;
      noteText = `${proofCount} em Prova (visível) e ${pausedCount} pausada(s) (esmaecida) — não arquivam`;
    } else if (proofCount > 0) {
      heading = `Em Prova · fim da fila (${proofCount})`;
      noteText = 'Aguardando aprovação (mantém destaque visual, não esmaece e não arquiva)';
    }
    div.append(
      node('span', proofCount > 0 && pausedCount === 0 ? '•' : '⏸', 'notion-paused-icon'),
      node('strong', heading),
      node('span', noteText, 'notion-paused-note')
    );
    return div;
  }

  function setViewMode(nextView) {
    view = ['simple', 'table', 'board', 'list'].includes(nextView) ? nextView : 'simple';
    for (const candidate of ['simple', 'table', 'board', 'list']) {
      byId('view-' + candidate)?.setAttribute('aria-pressed', String(view === candidate));
    }
    mainContainer.classList.toggle('board-mode', view === 'board');
    render();
  }

  function allKnownPrinterNames() {
    const map = new Map();
    for (const entry of printersCatalog) {
      const key = entry.name.toLocaleLowerCase('pt-BR');
      if (!map.has(key)) map.set(key, entry.name);
    }
    for (const order of orders) {
      for (const name of (order.printers || [])) {
        const clean = String(name || '').trim();
        if (!clean) continue;
        const key = clean.toLocaleLowerCase('pt-BR');
        if (!map.has(key)) map.set(key, clean);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  function populatePrinterFilterOptions() {
    const sel = byId('filter-printer');
    if (!sel) return;
    const current = sel.value || '';
    const names = allKnownPrinterNames();
    sel.innerHTML = '';
    sel.add(new Option('Todas', ''));
    sel.add(new Option('Sem impressora', 'none'));
    for (const name of names) {
      sel.add(new Option(name, name));
    }
    if (current === 'none' || names.includes(current)) {
      sel.value = current;
    } else {
      sel.value = '';
    }
  }

  async function refreshPrinters() {
    const cached = localListPrinters();
    if (storageMode !== 'cloud' || !cloudUser) {
      printersCatalog = cached;
      populatePrinterFilterOptions();
      if (byId('printers-dialog')?.open) renderPrintersDialog();
      if (editor?.open) renderEditorPrinters();
      return;
    }
    const cloudListRes = await cloudListPrinters();
    if (Array.isArray(cloudListRes)) {
      printersCatalog = cloudListRes.length || !cached.length
        ? localReplacePrinters(cloudListRes)
        : localReplacePrinters([...cloudListRes, ...cached]);
    } else {
      printersCatalog = cached;
    }
    populatePrinterFilterOptions();
    if (byId('printers-dialog')?.open) renderPrintersDialog();
    if (editor?.open) renderEditorPrinters();
    render();
    renderDetail();
  }

  async function savePrinterToCatalog({ id = '', name, category = '', notes = '' }) {
    const cleanName = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    if (!cleanName) throw Error('Informe o nome da impressora.');
    const existingByName = printersCatalog.find(p => p.name.toLocaleLowerCase('pt-BR') === cleanName.toLocaleLowerCase('pt-BR'));
    const entry = normalizePrinterEntry({
      id: id || existingByName?.id || '',
      name: cleanName,
      category: category || existingByName?.category || '',
      notes: notes || existingByName?.notes || '',
      createdAt: existingByName?.createdAt || new Date().toISOString()
    });
    if (storageMode === 'cloud' && cloudUser) {
      await cloudSavePrinter(entry);
    }
    const saved = localSavePrinter(entry);
    printersCatalog = localListPrinters();
    populatePrinterFilterOptions();
    if (editor?.open) renderEditorPrinters();
    if (byId('printers-dialog')?.open) renderPrintersDialog();
    render();
    renderDetail();
    return saved;
  }

  async function deletePrinterFromCatalog(entry) {
    if (storageMode === 'cloud' && cloudUser) {
      await cloudDeletePrinter(entry.id || entry.name);
    }
    printersCatalog = localDeletePrinter(entry.id || entry.name);
    populatePrinterFilterOptions();
    if (editor?.open) renderEditorPrinters();
    if (byId('printers-dialog')?.open) renderPrintersDialog();
    render();
    renderDetail();
  }

  function togglePrinterSelection(list, name) {
    const clean = String(name || '').trim();
    if (!clean) return normalizePrinters(list);
    const key = clean.toLocaleLowerCase('pt-BR');
    const exists = (list || []).some(item => item.toLocaleLowerCase('pt-BR') === key);
    if (exists) {
      return normalizePrinters((list || []).filter(item => item.toLocaleLowerCase('pt-BR') !== key));
    }
    return normalizePrinters([...(list || []), clean]);
  }

  function renderEditorPrinters() {
    const container = byId('editor-printers-list');
    const hint = byId('editor-printers-hint');
    if (!container) return;
    container.replaceChildren();
    const knownNames = Array.from(new Map([
      ...printersCatalog.map(p => [p.name.toLocaleLowerCase('pt-BR'), p.name]),
      ...draftPrinters.map(n => [n.toLocaleLowerCase('pt-BR'), n])
    ]).values()).sort((a, b) => a.localeCompare(b, 'pt-BR'));

    if (!knownNames.length) {
      container.append(node('span', 'Nenhuma impressora cadastrada ainda. Use o campo abaixo para cadastrar e selecionar.', 'printer-empty-note'));
    } else {
      for (const name of knownNames) {
        const selectedFlag = draftPrinters.some(p => p.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'));
        const cat = printersCatalog.find(p => p.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))?.category || '';
        const chip = action((selectedFlag ? '✓ ' : '') + name, () => {
          draftPrinters = togglePrinterSelection(draftPrinters, name);
          renderEditorPrinters();
        });
        chip.className = 'printer-chip-toggle' + (selectedFlag ? ' is-selected' : '');
        chip.setAttribute('aria-pressed', String(selectedFlag));
        if (cat) chip.title = `${name} · ${cat}`;
        container.append(chip);
      }
    }
    if (hint) {
      hint.textContent = draftPrinters.length
        ? `Selecionada(s) (${draftPrinters.length}): ${draftPrinters.join(', ')}`
        : 'Opcional: clique para marcar uma ou mais impressoras utilizadas nesta OS.';
    }
  }

  function buildCardPrintersSection(order, detail = false) {
    const current = normalizePrinters(order.printers || []);
    if (!detail) {
      if (!current.length) return null;
      const strip = node('div', '', 'card-printers-strip');
      strip.append(node('span', '🖨 Impressora(s):', 'card-printers-label'));
      for (const name of current) {
        strip.append(node('span', name, 'notion-pill printer-pill'));
      }
      return strip;
    }

    const box = node('section', '', 'detail-printers-section');
    const head = node('div', '', 'detail-printers-head');
    head.append(node('strong', `Impressoras utilizadas (${current.length})`));
    const mgrBtn = action('+ Cadastrar / gerenciar impressoras', () => openPrintersDialog());
    mgrBtn.className = 'notion-mini-btn';
    head.append(mgrBtn);
    box.append(head);

    const names = Array.from(new Map([
      ...printersCatalog.map(p => [p.name.toLocaleLowerCase('pt-BR'), p.name]),
      ...current.map(n => [n.toLocaleLowerCase('pt-BR'), n])
    ]).values()).sort((a, b) => a.localeCompare(b, 'pt-BR'));

    if (!names.length) {
      box.append(node('p', 'Nenhuma impressora cadastrada ainda. Clique em "+ Cadastrar / gerenciar impressoras" para adicionar.', 'attach-empty'));
      return box;
    }

    const chips = node('div', '', 'printer-chips-picker');
    for (const name of names) {
      const active = current.some(p => p.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'));
      const chip = action((active ? '✓ ' : '') + name, () => {
        const latest = orders.find(o => o.number === order.number) || order;
        const nextPrinters = togglePrinterSelection(latest.printers || [], name);
        change(latest, { printers: nextPrinters });
      });
      chip.className = 'printer-chip-toggle' + (active ? ' is-selected' : '');
      chip.setAttribute('aria-pressed', String(active));
      chips.append(chip);
    }
    box.append(chips);
    return box;
  }

  function renderPrintersDialog() {
    const listEl = byId('printers-list');
    if (!listEl) return;
    listEl.replaceChildren();
    if (!printersCatalog.length) {
      listEl.append(node('p', 'Nenhuma impressora cadastrada ainda. Cadastre acima (ex.: Konica C3070, Heidelberg GTO, Plotter Mimaki).', 'printer-empty-note'));
      return;
    }
    for (const entry of printersCatalog) {
      const row = node('div', '', 'printer-catalog-item');
      const info = node('div', '', 'printer-catalog-info');
      const top = node('div', '', 'printer-catalog-title');
      top.append(node('strong', entry.name));
      if (entry.category) top.append(node('span', entry.category, 'notion-pill'));
      const usageCount = orders.filter(o => (o.printers || []).some(p => p.toLocaleLowerCase('pt-BR') === entry.name.toLocaleLowerCase('pt-BR'))).length;
      top.append(node('span', `${usageCount} OS`, 'printer-usage-count'));
      info.append(top);
      if (entry.notes) info.append(node('small', entry.notes, 'printer-catalog-notes'));

      const btns = node('div', '', 'printer-catalog-actions');
      const editBtn = action('Editar', () => {
        editingPrinterId = entry.id;
        if (byId('printer-name')) byId('printer-name').value = entry.name;
        if (byId('printer-category')) byId('printer-category').value = entry.category || '';
        if (byId('printer-notes')) byId('printer-notes').value = entry.notes || '';
        if (byId('printer-save-btn')) byId('printer-save-btn').textContent = 'Salvar alterações';
        if (byId('printer-cancel-edit')) byId('printer-cancel-edit').hidden = false;
        byId('printer-name')?.focus();
      });
      editBtn.className = 'notion-mini-btn';
      const delBtn = action('Excluir', async () => {
        const errEl = byId('printer-form-error');
        if (errEl) errEl.textContent = '';
        try {
          await deletePrinterFromCatalog(entry);
          if (editingPrinterId === entry.id) {
            editingPrinterId = '';
            byId('printer-form')?.reset();
            if (byId('printer-save-btn')) byId('printer-save-btn').textContent = 'Cadastrar impressora';
            if (byId('printer-cancel-edit')) byId('printer-cancel-edit').hidden = true;
          }
        } catch (err) {
          if (errEl) errEl.textContent = err.message;
        }
      });
      delBtn.className = 'danger-text';
      btns.append(editBtn, delBtn);
      row.append(info, btns);
      listEl.append(row);
    }
  }

  function openPrintersDialog() {
    const dlg = byId('printers-dialog');
    if (!dlg) return;
    editingPrinterId = '';
    byId('printer-form')?.reset();
    if (byId('printer-save-btn')) byId('printer-save-btn').textContent = 'Cadastrar impressora';
    if (byId('printer-cancel-edit')) byId('printer-cancel-edit').hidden = true;
    if (byId('printer-form-error')) byId('printer-form-error').textContent = '';
    renderPrintersDialog();
    if (!dlg.open) dlg.showModal();
    byId('printer-name')?.focus();
  }

  // Notion-like Minimal Simple List Row (Lista Simples)
  function simpleRow(order, position) {
    const row = node('div', '', 'notion-simple-row');
    row.dataset.status = stageIndex(order.status);
    const overdue = isOverdue(order);
    const paused = isPaused(order);
    const proof = isProof(order);
    const inHold = paused || proof;
    row.classList.toggle('is-overdue', overdue && !inHold);
    row.classList.toggle('is-paused', paused);
    row.classList.toggle('is-proof', proof);

    const sortVal = byId('sort')?.value || 'dynamic';
    if (queueMode === 'active' && sortVal === 'queue') {
      const handle = node('span', '⠿', 'handle notion-handle');
      handle.draggable = !writing;
      handle.title = 'Arrastar para reordenar na fila';
      handle.onclick = e => e.stopPropagation();
      handle.ondragstart = e => { dragging = order.number; e.dataTransfer.setData('text/plain', dragging); };
      handle.ondragend = () => { dragging = ''; };
      row.ondragover = e => { if (dragging && !writing) e.preventDefault(); };
      row.ondrop = e => {
        if (writing) return;
        e.preventDefault();
        const source = orders.find(item => item.number === dragging);
        dragging = '';
        if (source) move(source, position);
      };
      row.classList.add('has-drag-handle');
      row.append(handle);
    }

    const posStepper = buildPositionStepper(order, { compact: true });
    const dot = node('span', '', 'notion-status-dot s' + stageIndex(order.status));
    dot.title = order.status;

    const osBtn = node('button', order.number, 'notion-os-btn copy-code-btn');
    osBtn.type = 'button';
    const expectedCopy = formatCopyValue(order, 'os', { mode: copyMode });
    osBtn.title = `Clique para copiar OS (${expectedCopy})`;
    osBtn.onclick = e => {
      e.stopPropagation();
      const latest = orders.find(o => o.number === order.number) || order;
      copyOrderToken(latest, 'os', osBtn);
    };

    const rowTitleText = normalizeTitle(order.title) || 'SEM DESCRIÇÃO CADASTRADA';
    const titleSpan = node('button', rowTitleText, 'notion-row-title notion-row-title-btn' + (order.title ? '' : ' is-empty'));
    titleSpan.type = 'button';
    titleSpan.dataset.openOrder = order.number;
    titleSpan.setAttribute('aria-haspopup', 'dialog');
    titleSpan.title = `Abrir janela centralizada da OS ${order.number}`;
    titleSpan.onclick = e => {
      e.stopPropagation();
      openDetail(order.number);
    };

    const rowItems = normalizeItems(order.items || []);
    const rowItemsWrap = node('div', '', 'notion-row-items');
    if (rowItems.length) {
      for (const item of rowItems.slice(0, 2)) {
        const itemBtn = node('button', item.number, 'notion-item-chip');
        itemBtn.type = 'button';
        const preview = formatCopyValue(order, 'item', { mode: copyMode, itemNumber: item.number });
        itemBtn.title = (item.label ? item.label + ' · ' : '') + `Clique para copiar: ${preview}`;
        itemBtn.onclick = e => {
          e.stopPropagation();
          const latest = orders.find(o => o.number === order.number) || order;
          copyOrderToken(latest, 'item', itemBtn, item.number);
        };
        rowItemsWrap.append(itemBtn);
      }
      if (rowItems.length > 2) {
        rowItemsWrap.append(node('span', `+${rowItems.length - 2}`, 'notion-pill item-more-pill'));
      }
    }

    const metaWrap = node('div', '', 'notion-row-meta');
    const rowReminders = normalizeReminders(order.reminders || []);
    if (rowReminders.length) {
      const remBadge = node('span', `📌 ${rowReminders.length}`, 'notion-pill reminder-pill');
      remBadge.title = rowReminders.map(r => '• ' + r.text).join('\n');
      metaWrap.append(remBadge);
    }
    if (order.notes) {
      const knowBadge = node('span', '📚', 'notion-pill knowledge-pill');
      knowBadge.title = 'Possui especificidades na Base de Conhecimento';
      metaWrap.append(knowBadge);
    }
    const dyn = priorityPill(order);
    if (dyn) metaWrap.append(dyn);
    if (order.urgent && dyn?.textContent !== 'Urgente' && !paused) {
      metaWrap.append(node('span', 'Urgente', 'notion-pill urgent'));
    }
    const rowDue = effectiveDeadline(order);
    if (rowDue) {
      const calc = computePrintDeadline(order);
      const due = node('span', '', 'notion-pill deadline-pill' + (overdue && !inHold ? ' overdue' : (calc.constrainedByProduction || calc.invalidSchedule ? ' is-tight' : '')));
      due.textContent = (calc.receivedAt ? '⏱ ' : '') + formatOrderDateShort(rowDue);
      due.title = buildDeadlineTooltip(order);
      metaWrap.append(due);
    }
    const simplePrinters = normalizePrinters(order.printers || []);
    for (const printerName of simplePrinters.slice(0, 2)) {
      metaWrap.append(node('span', '🖨 ' + printerName, 'notion-pill printer-pill'));
    }
    if (simplePrinters.length > 2) {
      metaWrap.append(node('span', `+${simplePrinters.length - 2}`, 'notion-pill printer-pill'));
    }
    const percent = workflowProgress(order);
    if (percent > 0 && !isArchived(order)) {
      metaWrap.append(node('span', percent + '%', 'notion-pill progress-pill'));
    }
    if (order.attachments?.length) {
      metaWrap.append(node('span', '📎 ' + order.attachments.length, 'notion-pill attach-pill'));
    }

    const statusSelect = node('select', '', 'notion-inline-status colored s' + stageIndex(order.status));
    statusSelect.setAttribute('aria-label', 'Alterar status da OS ' + order.number);
    for (const st of stages) statusSelect.add(new Option(st, st));
    statusSelect.value = order.status;
    statusSelect.onclick = e => e.stopPropagation();
    statusSelect.onchange = e => {
      e.stopPropagation();
      change(order, statusTransitionPatch(order, statusSelect.value));
    };
    metaWrap.append(statusSelect);

    if (isArchived(order)) {
      const reopenBtn = action('Reabrir OS', e => {
        e.stopPropagation();
        reopenOrder(order);
      });
      reopenBtn.className = 'notion-reopen-btn';
      metaWrap.append(reopenBtn);
    } else if (inHold) {
      const resumeBtn = action('Retomar OS', e => {
        e.stopPropagation();
        resumeOrder(order);
      });
      resumeBtn.className = 'notion-resume-btn';
      resumeBtn.title = proof
        ? 'Aprovar/retomar OS da Prova para a etapa anterior na fila ativa'
        : 'Retomar OS para a etapa anterior e devolver à fila ativa';
      metaWrap.append(resumeBtn);
    } else {
      const pauseBtn = action('Pausar OS', e => {
        e.stopPropagation();
        pauseOrder(order);
      });
      pauseBtn.className = 'notion-pause-btn';
      pauseBtn.title = 'Pausar OS (fica esmaecida no fim da fila e não arquiva)';
      metaWrap.append(pauseBtn);
    }

    if (rowItemsWrap.childNodes.length) metaWrap.prepend(rowItemsWrap);
    row.append(posStepper, dot, osBtn, titleSpan, metaWrap);
    row.onclick = () => {
      if (!writing && !dragging) openDetail(order.number);
    };
    return row;
  }

  // Notion-like Database Table View (Tabela)
  function tableView(visible) {
    const wrap = node('div', '', 'notion-table-wrap');
    const table = node('table', '', 'notion-table');
    const thead = node('thead', '');
    const headRow = node('tr', '');
    for (const col of ['#', 'OS', 'Serviço', 'Status', 'Prazo', 'Complexidade', 'Impressoras', 'Urgência', 'Progresso', 'Ações']) {
      headRow.append(node('th', col));
    }
    thead.append(headRow);
    table.append(thead);

    const tbody = node('tbody', '');
    const hasNonHold = visible.some(item => !isEndOfQueue(item));
    const proofCount = visible.filter(isProof).length;
    const pausedCount = visible.filter(isPaused).length;
    let holdDividerInserted = false;

    visible.forEach((order, idx) => {
      const position = idx + 1;
      const overdue = isOverdue(order);
      const paused = isPaused(order);
      const proof = isProof(order);
      const inHold = paused || proof;
      if (queueMode === 'active' && inHold && !holdDividerInserted && !isHoldStatus(selected) && (hasNonHold || proofCount + pausedCount > 0)) {
        holdDividerInserted = true;
        const divRow = node('tr', '', 'notion-table-divider');
        let dividerText = `⏸ Em pausa · fim da fila (${pausedCount}) — permanecem na fila ativa (não arquivam)`;
        if (proofCount > 0 && pausedCount > 0) {
          dividerText = `Prova (${proofCount}, visível) e Pausadas (${pausedCount}, esmaecidas) · fim da fila — não arquivam`;
        } else if (proofCount > 0) {
          dividerText = `Em Prova · fim da fila (${proofCount}) — aguardando aprovação (sem esmaecer e não arquivam)`;
        }
        const divCell = node('td', dividerText);
        divCell.colSpan = 10;
        divRow.append(divCell);
        tbody.append(divRow);
      }

      const tr = node('tr', '');
      tr.dataset.status = stageIndex(order.status);
      tr.classList.toggle('is-overdue', overdue && !inHold);
      tr.classList.toggle('is-paused', paused);
      tr.classList.toggle('is-proof', proof);

      const tdPos = node('td', '', 'notion-td-pos');
      tdPos.append(buildPositionStepper(order, { compact: true }));

      const tdOs = node('td', '', 'notion-td-os');
      const osCell = node('div', '', 'table-os-cell');
      const osBtn = node('button', order.number, 'notion-os-btn copy-code-btn');
      osBtn.type = 'button';
      osBtn.title = `Clique para copiar OS (${formatCopyValue(order, 'os', { mode: copyMode })})`;
      osBtn.onclick = () => {
        const latest = orders.find(o => o.number === order.number) || order;
        copyOrderToken(latest, 'os', osBtn);
      };
      osCell.append(osBtn);
      const tblItems = normalizeItems(order.items || []);
      if (tblItems.length) {
        const subItems = node('div', '', 'table-items-wrap');
        for (const item of tblItems.slice(0, 3)) {
          const itemBtn = node('button', item.number, 'notion-item-chip');
          itemBtn.type = 'button';
          itemBtn.title = (item.label ? item.label + ' · ' : '') + `Clique para copiar: ${formatCopyValue(order, 'item', { mode: copyMode, itemNumber: item.number })}`;
          itemBtn.onclick = () => {
            const latest = orders.find(o => o.number === order.number) || order;
            copyOrderToken(latest, 'item', itemBtn, item.number);
          };
          subItems.append(itemBtn);
        }
        if (tblItems.length > 3) subItems.append(node('span', `+${tblItems.length - 3}`, 'notion-pill item-more-pill'));
        osCell.append(subItems);
      }
      tdOs.append(osCell);

      const tdTitle = node('td', '', 'notion-td-title');
      const titleCell = node('div', '', 'table-title-cell');
      const titleBtn = node('button', normalizeTitle(order.title) || 'SEM DESCRIÇÃO', 'notion-title-link');
      titleBtn.type = 'button';
      titleBtn.dataset.openOrder = order.number;
      titleBtn.setAttribute('aria-haspopup', 'dialog');
      titleBtn.onclick = () => openDetail(order.number);
      titleCell.append(titleBtn);
      const tblReminders = normalizeReminders(order.reminders || []);
      if (tblReminders.length) {
        const remBadge = node('span', `📌 ${tblReminders.length}`, 'notion-pill reminder-pill');
        remBadge.title = tblReminders.map(r => '• ' + r.text).join('\n');
        titleCell.append(remBadge);
      }
      if (order.notes) {
        const knowBadge = node('span', '📚', 'notion-pill knowledge-pill');
        knowBadge.title = 'Possui especificidades na Base de Conhecimento';
        titleCell.append(knowBadge);
      }
      const dyn = priorityPill(order);
      if (dyn && dyn.textContent !== 'Urgente') {
        titleCell.append(dyn);
      }
      if (order.attachments?.length) {
        titleCell.append(node('span', '📎 ' + order.attachments.length, 'notion-pill attach-pill'));
      }
      tdTitle.append(titleCell);

      const tdStatus = node('td', '');
      const statusSelect = node('select', '', 'notion-inline-status colored s' + stageIndex(order.status));
      statusSelect.setAttribute('aria-label', 'Status da OS ' + order.number);
      for (const st of stages) statusSelect.add(new Option(st, st));
      statusSelect.value = order.status;
      statusSelect.onchange = () => {
        change(order, statusTransitionPatch(order, statusSelect.value));
      };
      tdStatus.append(statusSelect);

      const tdDeadline = node('td', '');
      const tblDue = effectiveDeadline(order);
      if (tblDue) {
        const calc = computePrintDeadline(order);
        const due = node('span', (calc.receivedAt ? '⏱ ' : '') + formatOrderDateShort(tblDue), 'notion-pill deadline-pill' + (overdue && !inHold ? ' overdue' : (calc.constrainedByProduction || calc.invalidSchedule ? ' is-tight' : '')));
        due.title = buildDeadlineTooltip(order);
        tdDeadline.append(due);
      } else {
        tdDeadline.append(node('span', '—', 'muted-cell'));
      }

      const tdComp = node('td', '');
      if (order.complexity) {
        tdComp.append(node('span', order.complexity, 'notion-pill colored c' + complexities.indexOf(order.complexity)));
      } else {
        tdComp.append(node('span', '—', 'muted-cell'));
      }

      const tdPrinters = node('td', '');
      const rowPrinters = normalizePrinters(order.printers || []);
      if (rowPrinters.length) {
        const wrapPills = node('div', '', 'table-printers-wrap');
        for (const printerName of rowPrinters.slice(0, 2)) {
          wrapPills.append(node('span', '🖨 ' + printerName, 'notion-pill printer-pill'));
        }
        if (rowPrinters.length > 2) wrapPills.append(node('span', `+${rowPrinters.length - 2}`, 'notion-pill printer-pill'));
        tdPrinters.append(wrapPills);
      } else {
        tdPrinters.append(node('span', '—', 'muted-cell'));
      }

      const tdUrg = node('td', '');
      const urgBtn = action(order.urgent ? 'Urgente' : 'Normal', () => change(order, { urgent: !order.urgent }));
      urgBtn.className = 'notion-urg-btn ' + (order.urgent ? 'urgent' : 'normal');
      tdUrg.append(urgBtn);

      const tdProg = node('td', '');
      const pct = workflowProgress(order);
      tdProg.append(node('span', pct + '%', 'notion-prog-text'));

      const tdAct = node('td', '', 'notion-td-actions');
      const openBtn = action('Abrir', () => openDetail(order.number));
      openBtn.className = 'notion-mini-btn';
      const editBtn = action('Editar', () => edit(order));
      editBtn.className = 'notion-mini-btn';
      tdAct.append(openBtn, editBtn);
      const tblPrintUrl = effectiveOrderPrintLink(order);
      if (tblPrintUrl) {
        const pdfLink = node('a', '🖨 PDF', 'notion-mini-btn print-pdf-mini');
        pdfLink.href = tblPrintUrl;
        pdfLink.target = '_blank';
        pdfLink.rel = 'noopener noreferrer';
        pdfLink.title = 'Abrir link de impressão da OS no site NBL para baixar em PDF (' + tblPrintUrl + ')';
        pdfLink.onclick = e => e.stopPropagation();
        tdAct.append(pdfLink);
      }
      if (isArchived(order)) {
        const reopenBtn = action('Reabrir OS', () => reopenOrder(order));
        reopenBtn.className = 'notion-mini-btn';
        tdAct.append(reopenBtn);
      } else if (inHold) {
        const resumeBtn = action('Retomar OS', () => resumeOrder(order));
        resumeBtn.className = 'notion-mini-btn resume';
        tdAct.append(resumeBtn);
      } else {
        const pauseBtn = action('Pausar OS', () => pauseOrder(order));
        pauseBtn.className = 'notion-mini-btn pause';
        tdAct.append(pauseBtn);
      }

      tr.append(tdPos, tdOs, tdTitle, tdStatus, tdDeadline, tdComp, tdPrinters, tdUrg, tdProg, tdAct);
      tbody.append(tr);
    });

    table.append(tbody);
    wrap.append(table);
    return wrap;
  }

  function queueCard(order, position, detail = false) {
    const paused = isPaused(order);
    const proof = isProof(order);
    const inHold = paused || proof;
    const overdue = isOverdue(order);
    const card = node('article', '', 'card');
    card.dataset.status = stageIndex(order.status);
    card.classList.toggle('is-paused', !detail && paused);
    card.classList.toggle('is-proof', !detail && proof);
    card.classList.toggle('is-paused-detail', detail && paused);
    const heading = node('div', '', 'cardhead');
    const handle = node('span', '⠿', 'handle');
    handle.draggable = !writing && (view === 'board' || byId('sort')?.value === 'queue');
    handle.title = view === 'board' ? 'Arrastar para outra coluna de status' : 'Arrastar na ordenação por fila';
    handle.ondragstart = e => { dragging = order.number; e.dataTransfer.setData('text/plain', dragging); };
    handle.ondragend = () => { dragging = ''; };
    card.ondragover = e => { if (dragging && view === 'list' && byId('sort')?.value === 'queue') e.preventDefault(); };
    card.ondrop = e => {
      if (view === 'board' || byId('sort')?.value !== 'queue' || writing) return;
      e.preventDefault();
      const source = orders.find(item => item.number === dragging);
      dragging = '';
      if (source) move(source, position);
    };
    if (!detail) heading.append(handle);

    const osNumberButton = node('button', order.number, 'notion-os-btn card-os-btn copy-code-btn');
    osNumberButton.type = 'button';
    osNumberButton.title = `Clique para copiar OS (${formatCopyValue(order, 'os', { mode: copyMode })})`;
    osNumberButton.onclick = e => {
      e.stopPropagation();
      const latest = orders.find(o => o.number === order.number) || order;
      copyOrderToken(latest, 'os', osNumberButton);
    };

    const posStepper = buildPositionStepper(order);
    heading.append(posStepper, osNumberButton, stageTag(order.status));
    const dyn = priorityPill(order);
    if (dyn && !isArchived(order)) {
      heading.append(dyn);
    } else if (isArchived(order)) {
      heading.append(node('span', order.status === 'Repassado' ? 'Arquivada · Repassada' : 'Arquivada', 'notion-pill archived-pill'));
    }

    const controls = node('div', '', 'inline-controls');
    for (const [key, label, values, cls] of [
      ['status', 'Status', stages, 's' + stageIndex(order.status)],
      ['complexity', 'Complexidade', ['', ...complexities], 'c' + complexities.indexOf(order.complexity)]
    ]) {
      const field = node('label', label);
      const select = node('select', '', 'colored ' + cls);
      select.setAttribute('aria-label', label + ' da OS ' + order.number);
      for (const value of values) select.add(new Option(value || 'Sem classificação', value));
      select.value = order[key] || '';
      select.onchange = () => {
        if (key === 'status') {
          change(order, statusTransitionPatch(order, select.value));
        } else {
          change(order, { [key]: select.value });
        }
      };
      field.append(select);
      controls.append(field);
    }
    const urgency = action(order.urgent ? 'Urgente' : 'Urgência normal', () => change(order, { urgent: !order.urgent }));
    urgency.className = order.urgent ? 'urgent' : 'normal';
    urgency.setAttribute('aria-pressed', String(!!order.urgent));
    urgency.setAttribute('aria-label', 'Urgência da OS ' + order.number);
    controls.append(urgency);

    if (isArchived(order)) {
      const reopen = action('Reabrir OS', () => reopenOrder(order));
      reopen.className = 'reopen-btn';
      controls.append(reopen);
    } else if (inHold) {
      const resumeBtn = action('Retomar OS', () => resumeOrder(order));
      resumeBtn.className = 'resume-queue-btn';
      controls.append(resumeBtn);
    } else {
      const pauseQueueBtn = action('Pausar OS', () => pauseOrder(order));
      pauseQueueBtn.className = 'pause-queue-btn';
      controls.append(pauseQueueBtn);
    }

    card.append(heading);
    if (detail && inHold) {
      const holdBanner = node('div', '', 'paused-detail-banner' + (proof ? ' is-proof-banner' : ''));
      holdBanner.append(
        node(
          'span',
          proof
            ? 'OS em Prova — posicionada no fim da fila ativa (mantém destaque visual sem esmaecer e não arquiva).'
            : '⏸ OS pausada — exibida esmaecida no fim da fila ativa (não vai para Arquivados).'
        ),
        action('Retomar OS', () => resumeOrder(order))
      );
      card.append(holdBanner);
    }
    const displayTitle = normalizeTitle(order.title) || 'SEM DESCRIÇÃO';
    if (!detail) {
      const titleBtn = node('button', displayTitle, 'card-title-open');
      titleBtn.type = 'button';
      titleBtn.dataset.openOrder = order.number;
      titleBtn.setAttribute('aria-haspopup', 'dialog');
      titleBtn.onclick = () => openDetail(order.number);
      const h3 = node('h3', '');
      h3.append(titleBtn);
      card.append(h3);
    } else {
      card.append(node('h3', displayTitle));
    }

    card.append(buildCardCopyAndItemsSection(order, detail));
    const remindersSection = buildCardRemindersSection(order, detail);
    if (remindersSection) card.append(remindersSection);

    card.append(controls);

    const datesSection = buildOrderDatesSection(order, detail);
    if (datesSection) card.append(datesSection);

    const meta = node('div', '', 'meta');
    if (order.owner) meta.append(node('span', 'Responsável pela nota · ' + order.owner));
    const cardDue = effectiveDeadline(order);
    if (cardDue && !detail) {
      const due = node('span', '', 'deadline-badge');
      due.dataset.deadlineNumber = order.number;
      updateDeadline(due, order);
      meta.append(due);
    }
    meta.append(node('span', 'Atualizada em ' + dateFormat.format(new Date(order.updated))));
    card.append(meta);
    card.classList.toggle('is-overdue', overdue && !inHold);

    const checklist = node('fieldset', '', 'workflow');
    checklist.append(node('legend', 'Workflow da OS'));
    const percent = workflowProgress(order);
    const summary = node('div', '', 'workflow-summary');
    summary.append(
      node('strong', percent + '% concluído'),
      node('span', workflowSteps.filter(step => order.workflow?.[step.id] === true).length + ' de ' + workflowSteps.length + ' etapas')
    );
    const progress = node('progress', '');
    progress.max = 100;
    progress.value = percent;
    progress.setAttribute('aria-label', 'Progresso da OS ' + order.number);
    const list = node('ol', '', 'workflow-steps');
    workflowSteps.forEach((step, index) => {
      const item = node('li', '');
      const label = node('label', '', 'workflow-step');
      const check = node('input', '');
      check.type = 'checkbox';
      check.checked = order.workflow?.[step.id] === true;
      check.dataset.workflow = order.number + ':' + step.id;
      check.setAttribute('aria-label', step.label + ' da OS ' + order.number);
      check.onchange = () => {
        const nextWorkflow = { ...order.workflow, [step.id]: check.checked };
        const nextStatus = deriveStatusFromWorkflow(nextWorkflow, order.status);
        const transition = nextStatus !== order.status ? statusTransitionPatch(order, nextStatus) : {};
        change(order, { ...transition, workflow: nextWorkflow, status: nextStatus });
      };
      label.append(check, node('span', String(index + 1).padStart(2, '0'), 'workflow-number'), node('span', step.label));
      item.append(label);
      list.append(item);
    });
    checklist.append(summary, progress, list, node('p', 'Marque conforme concluir. Ao completar 100% (5 etapas), o status muda para Concluído e arquiva; Repassado também arquiva imediatamente.', 'workflow-hint'));
    card.append(checklist);

    const printersSection = buildCardPrintersSection(order, detail);
    if (printersSection) card.append(printersSection);

    const attachmentsList = Array.isArray(order.attachments) ? order.attachments : [];
    if (detail) {
      card.append(buildDetailAttachmentsSection(order, attachmentsList));
    } else if (attachmentsList.length > 0) {
      const strip = node('div', '', 'card-attachments-summary');
      const countBadge = node('span', `📎 ${attachmentsList.length} ${attachmentsList.length === 1 ? 'anexo' : 'anexos'}`, 'attach-count-pill');
      strip.append(countBadge);
      for (const att of attachmentsList.slice(0, 3)) {
        const chip = node('a', (att.mimeType === 'application/pdf' ? 'PDF · ' : 'IMG · ') + att.name, 'attach-mini-link');
        bindAttachmentLink(chip, att);
        strip.append(chip);
      }
      if (attachmentsList.length > 3) {
        strip.append(node('span', `+${attachmentsList.length - 3}`, 'attach-more-count'));
      }
      card.append(strip);
    }

    const safeOrderLink = effectiveOrderLink(order);
    const safePrintLink = effectiveOrderPrintLink(order);
    const effectivePath = effectiveOrderPath(order);
    if (detail || safeOrderLink || safePrintLink) {
      const refsRow = node('div', '', 'os-refs-links');
      if (safeOrderLink) {
        const a = node('a', (order.link ? '' : '⚡ ') + 'Pedido no site ↗', 'reference-pill');
        a.href = safeOrderLink;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.title = safeOrderLink;
        refsRow.append(a);
      }
      if (safePrintLink) {
        const pLink = node('a', '🖨 Baixar / Imprimir OS (Site PDF) ↗', 'reference-pill is-print-pdf');
        pLink.href = safePrintLink;
        pLink.target = '_blank';
        pLink.rel = 'noopener noreferrer';
        pLink.title = 'Abre a página de impressão da OS no site NBL (' + safePrintLink + ') para imprimir ou salvar como PDF (Ctrl+P)';
        refsRow.append(pLink);
      }
      const fichaPdfBtn = action('↓ Ficha OS (PDF)', () => downloadOrderPdfSheet(order));
      fichaPdfBtn.className = 'reference-pill is-ficha-pdf';
      fichaPdfBtn.title = 'Gera a ficha técnica completa desta OS (com datas, SLA 24h, itens, impressoras e observações) pronta para salvar em PDF';
      refsRow.append(fichaPdfBtn);
      card.append(refsRow);
    }
    if (effectivePath) {
      const path = node('div', '', 'file-path');
      path.append(
        node('span', order.path ? 'Pasta / arquivo' : 'Pasta padrão da OS'),
        node('code', effectivePath),
        action('Copiar caminho', e => copyNumber(effectivePath, e.currentTarget))
      );
      card.append(path);
    }

    const bar = node('div', '', 'quick');
    if (!detail) {
      const openBtn = action('Abrir OS', () => openDetail(order.number));
      openBtn.className = 'open-detail-btn';
      bar.append(openBtn);
    }
    bar.append(action('Editar OS', () => edit(order)));

    const remove = action('Excluir OS', () => askDelete(order));
    remove.className = 'danger-text';
    bar.append(remove);
    card.append(bar);

    if (detail) {
      card.append(buildDetailNotesSection(order));
    } else if (order.notes) {
      const knowStrip = node('div', '', 'card-knowledge-hint');
      knowStrip.append(
        node('strong', '📚 Base de conhecimento:'),
        node('span', order.notes.length > 140 ? order.notes.slice(0, 140) + '…' : order.notes)
      );
      card.append(knowStrip);
    }
    return card;
  }

  function compactCard(order, position) {
    const paused = isPaused(order);
    const proof = isProof(order);
    const inHold = paused || proof;
    const overdue = isOverdue(order);
    const card = node('article', '', 'card compact-card');
    card.dataset.status = stageIndex(order.status);
    card.classList.toggle('is-overdue', overdue && !inHold);
    card.classList.toggle('is-paused', paused);
    card.classList.toggle('is-proof', proof);
    const handle = node('span', '⠿', 'handle compact-handle');
    handle.draggable = !writing;
    handle.title = 'Arrastar para outra coluna de status';
    handle.onclick = event => event.stopPropagation();
    handle.ondragstart = event => {
      if (writing) { event.preventDefault(); return; }
      dragging = order.number;
      event.dataTransfer.setData('text/plain', dragging);
      event.dataTransfer.effectAllowed = 'move';
    };
    handle.ondragend = () => { dragging = ''; dragEndedAt = Date.now(); };
    const open = action('', () => {
      if (!writing && !dragging && Date.now() - dragEndedAt > 250) openDetail(order.number);
    });
    open.className = 'compact-open';
    open.dataset.openOrder = order.number;
    open.setAttribute('aria-label', 'Abrir OS ' + order.number + ' · ' + (normalizeTitle(order.title) || 'SEM DESCRIÇÃO'));
    open.setAttribute('aria-haspopup', 'dialog');
    const top = node('div', '', 'compact-top');
    top.append(node('strong', order.number), node('span', paused ? '⏸ #' + position : '#' + position, 'position'));
    const badges = node('div', '', 'compact-badges');
    const dyn = priorityPill(order);
    if (dyn && dyn.textContent !== 'Urgente') badges.append(dyn);
    if (order.urgent && !paused) badges.append(node('span', 'Urgente', 'compact-badge urgent'));
    if (order.complexity) badges.append(node('span', order.complexity, 'compact-badge colored c' + complexities.indexOf(order.complexity)));
    const compactItems = normalizeItems(order.items || []);
    if (compactItems.length) {
      badges.append(node('span', `${compactItems.length} ${compactItems.length === 1 ? 'item' : 'itens'}`, 'compact-badge compact-items-badge'));
    }
    open.append(top, node('h3', normalizeTitle(order.title) || 'SEM DESCRIÇÃO'), badges);
    const compactReminders = normalizeReminders(order.reminders || []);
    if (compactReminders.length) {
      open.append(
        node(
          'span',
          `📌 ${compactReminders[0].text}${compactReminders.length > 1 ? ` (+${compactReminders.length - 1})` : ''}`,
          'compact-reminder-preview'
        )
      );
    }
    if (effectiveDeadline(order)) {
      const due = node('span', '', 'deadline-badge');
      due.dataset.deadlineNumber = order.number;
      updateDeadline(due, order);
      open.append(due);
    }
    const percent = workflowProgress(order);
    const summary = node('div', '', 'compact-progress');
    const attCount = Array.isArray(order.attachments) ? order.attachments.length : 0;
    summary.append(
      node('span', percent + '% concluído'),
      node('span', attCount > 0 ? `📎 ${attCount} · ${workflowSteps.filter(step => order.workflow?.[step.id] === true).length}/${workflowSteps.length}` : `${workflowSteps.filter(step => order.workflow?.[step.id] === true).length}/${workflowSteps.length} etapas`)
    );
    const progress = node('progress', '');
    progress.max = 100;
    progress.value = percent;
    progress.setAttribute('aria-label', 'Progresso da OS ' + order.number);
    open.append(summary, progress);
    const compactPrinters = normalizePrinters(order.printers || []);
    if (compactPrinters.length) {
      open.append(node('span', '🖨 ' + compactPrinters.join(' · '), 'compact-printers'));
    }
    if (order.owner) open.append(node('span', order.owner, 'compact-owner'));
    card.append(handle, open);
    return card;
  }

  function openDetail(number) {
    detailNumber = number;
    if (byId('detail-error')) byId('detail-error').textContent = '';
    renderDetail();
    if (!detailDialog.open) detailDialog.showModal();
    detailDialog.scrollTop = 0;
    document.body.classList.add('detail-open');
    byId('detail-close')?.focus();
  }

  function renderDetail() {
    if (!detailNumber || !detailDialog) return;
    const order = orders.find(item => item.number === detailNumber);
    if (!order) {
      if (detailDialog.open) detailDialog.close();
      return;
    }
    const scroll = detailDialog.scrollTop;
    const upperTitle = normalizeTitle(order.title);
    byId('detail-title').textContent = 'OS ' + order.number + (upperTitle ? ' · ' + upperTitle : '');
    byId('detail-content').replaceChildren(queueCard(order, queuePositionOf(order).position, true));
    detailDialog.scrollTop = scroll;
    lockControls();
  }

  if (byId('detail-close')) byId('detail-close').onclick = () => detailDialog.close();
  editor?.addEventListener('close', () => { if (detailDialog?.open) byId('detail-close')?.focus(); });
  detailDialog?.addEventListener('click', event => {
    if (event.target !== detailDialog) return;
    const rect = detailDialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) detailDialog.close();
  });
  detailDialog?.addEventListener('close', () => {
    const number = detailNumber;
    detailNumber = '';
    document.body.classList.remove('detail-open');
    byId('detail-content')?.replaceChildren();
    const trigger = Array.from(root.querySelectorAll('[data-open-order]')).find(el => el.dataset.openOrder === number);
    (trigger || byId('view-simple') || byId('view-list'))?.focus();
  });

  function renderDynamicBar(activeList, proofList, pausedList, sortMode) {
    const bar = byId('dynamic-queue-bar');
    if (!bar) return;
    if (queueMode !== 'active' || !activeList.length) {
      bar.hidden = true;
      bar.replaceChildren();
      return;
    }
    const now = Date.now();
    const ranked = sortOrders(activeList, 'dynamic', now);
    const nonHold = ranked.filter(o => !isEndOfQueue(o));
    const recommended = nonHold[0];
    const overdueCount = nonHold.filter(o => isOverdue(o, now)).length;
    const criticalCount = nonHold.filter(o => !isOverdue(o, now) && getDynamicQueueInfo(o, now).tier === 1).length;
    const isDueSoonOrOverdue = o => {
      const due = deadlineTime(effectiveDeadline(o));
      return Number.isFinite(due) && (due - now) <= 24 * 3600 * 1000;
    };
    const proofAtRisk = proofList.filter(isDueSoonOrOverdue).length;
    const pausedAtRisk = pausedList.filter(isDueSoonOrOverdue).length;

    bar.hidden = false;
    bar.replaceChildren();

    const nextWrap = node('div', '', 'dynamic-next-wrap');
    if (recommended) {
      const info = getDynamicQueueInfo(recommended, now);
      const nextBtn = action(
        `⚡ Próxima sugerida: ${recommended.number}${recommended.title ? ' · ' + recommended.title : ''}`,
        () => openDetail(recommended.number)
      );
      nextBtn.className = 'dynamic-next-btn';
      nextBtn.title = 'Primeira OS na fila dinâmica — clique para abrir os detalhes';
      nextWrap.append(nextBtn, node('span', info.label, `notion-pill dynamic-pill tone-${info.tone}`));
    } else {
      nextWrap.append(
        node(
          'span',
          `Todas as ${activeList.length} OS ativas estão em Prova ou Pausadas no fim da fila.`,
          'dynamic-empty-note'
        )
      );
    }

    const statsWrap = node('div', '', 'dynamic-stats-wrap');
    if (overdueCount > 0) {
      const overdueChip = action(`Atrasadas: ${overdueCount}`, () => {
        if (byId('filter-deadline')) {
          byId('filter-deadline').value = byId('filter-deadline').value === 'overdue' ? '' : 'overdue';
        }
        render();
      });
      overdueChip.className = 'dynamic-stat-chip is-danger';
      statsWrap.append(overdueChip);
    }
    if (criticalCount > 0) {
      const critChip = node('span', `Urgentes/Críticas: ${criticalCount}`, 'dynamic-stat-chip is-urgent');
      statsWrap.append(critChip);
    }
    if (proofList.length > 0) {
      const proofLabel = proofAtRisk > 0
        ? `Prova no fim: ${proofList.length} (${proofAtRisk} c/ prazo próximo/vencido)`
        : `Prova no fim: ${proofList.length}`;
      const proofChip = action(proofLabel, () => {
        selected = selected === 'Prova' ? '' : 'Prova';
        if (byId('filter-status')) byId('filter-status').value = selected;
        render();
      });
      proofChip.className = 'dynamic-stat-chip is-proof-chip' + (selected === 'Prova' ? ' is-active' : '');
      proofChip.title = 'Filtrar apenas as OS em Prova no fim da fila';
      statsWrap.append(proofChip);
    }
    if (pausedList.length > 0) {
      const pauseLabel = pausedAtRisk > 0
        ? `⏸ Pausadas no fim: ${pausedList.length} (${pausedAtRisk} c/ prazo próximo/vencido)`
        : `⏸ Pausadas no fim: ${pausedList.length}`;
      const pausedChip = action(pauseLabel, () => {
        selected = selected === 'Pausado' ? '' : 'Pausado';
        if (byId('filter-status')) byId('filter-status').value = selected;
        render();
      });
      pausedChip.className = 'dynamic-stat-chip is-paused-chip' + (selected === 'Pausado' ? ' is-active' : '');
      pausedChip.title = 'Filtrar apenas as OS pausadas no fim da fila';
      statsWrap.append(pausedChip);
    }
    if (!pausedList.length && !proofList.length && sortMode === 'dynamic') {
      statsWrap.append(node('span', 'Fila dinâmica ativa', 'dynamic-stat-chip'));
    }

    bar.append(nextWrap, statsWrap);
  }

  function render() {
    const metrics = byId('metrics');
    if (!metrics) return;
    metrics.replaceChildren();

    const activeList = orders.filter(o => !isArchived(o));
    const archivedList = orders.filter(o => isArchived(o));
    const proofList = activeList.filter(isProof);
    const pausedList = activeList.filter(isPaused);

    if (byId('queue-active')) {
      byId('queue-active').textContent = `Fila ativa (${activeList.length})`;
      byId('queue-active').setAttribute('aria-pressed', String(queueMode === 'active'));
    }
    if (byId('area-badge-os')) byId('area-badge-os').textContent = String(activeList.length);
    if (byId('queue-archived')) {
      byId('queue-archived').textContent = `Arquivados · Concluído e Repassado (${archivedList.length})`;
      byId('queue-archived').setAttribute('aria-pressed', String(queueMode === 'archived'));
    }

    for (const status of stages) {
      const isArchStage = isArchivedStatus(status);
      const count = isArchStage
        ? archivedList.filter(o => o.status === status).length
        : activeList.filter(o => o.status === status).length;
      const isPressed = isArchStage
        ? (queueMode === 'archived' && selected === status)
        : (queueMode === 'active' && selected === status);
      const button = node(
        'button',
        '',
        'metric' + (isArchStage ? ' metric-archived' : '') + (isPausedStatus(status) ? ' metric-paused' : '') + (isProofStatus(status) ? ' metric-proof' : '')
      );
      button.type = 'button';
      button.setAttribute('aria-pressed', String(isPressed));
      button.append(stageTag(status), node('b', String(count)));
      button.onclick = () => {
        if (isArchStage) {
          if (queueMode === 'archived' && selected === status) {
            selected = '';
            if (byId('filter-status')) byId('filter-status').value = '';
            render();
          } else {
            selected = status;
            if (byId('filter-status')) byId('filter-status').value = status;
            setQueueMode('archived', { preserveStatus: true });
          }
        } else {
          queueMode = 'active';
          byId('queue-active')?.setAttribute('aria-pressed', 'true');
          byId('queue-archived')?.setAttribute('aria-pressed', 'false');
          selected = selected === status ? '' : status;
          if (byId('filter-status')) byId('filter-status').value = selected;
          render();
        }
        metrics.children[stages.indexOf(status)]?.focus();
      };
      metrics.append(button);
    }

    populatePrinterFilterOptions();
    const filters = {
      search: byId('search')?.value || '',
      status: selected,
      complexity: byId('filter-complexity')?.value || '',
      printer: byId('filter-printer')?.value || '',
      urgency: byId('filter-urgency')?.value || '',
      deadline: byId('filter-deadline')?.value || '',
      archived: queueMode === 'archived'
    };

    const sortMode = byId('sort')?.value || 'dynamic';
    const poolCount = queueMode === 'archived' ? archivedList.length : activeList.length;
    const visible = sortOrders(filterOrders(orders, filters), sortMode);
    const filtered = [filters.search, filters.status, filters.complexity, filters.printer, filters.urgency, filters.deadline].some(value => (value || '').trim());

    renderDynamicBar(activeList, proofList, pausedList, sortMode);

    if (byId('count')) {
      const modeLabel = queueMode === 'archived' ? 'arquivadas (Concluído e Repassado)' : 'na fila ativa';
      const autoLabel = queueMode === 'active'
        ? (sortMode === 'dynamic' ? ' · fila dinâmica (Prova/Pausado no fim)' : sortMode === 'status' ? ' · fila automática por status' : '')
        : '';
      byId('count').textContent = `${visible.length} de ${poolCount} OS ${modeLabel}` + (filtered ? ' · filtros ativos' : autoLabel);
    }
    if (byId('clear')) byId('clear').hidden = !filtered;
    byId('all-orders')?.setAttribute('aria-pressed', String(!filtered && queueMode === 'active'));

    const rows = byId('rows');
    rows.classList.toggle('kanban', view === 'board');
    if (byId('board-help')) {
      byId('board-help').hidden = view !== 'board';
    }
    rows.replaceChildren();

    if (!visible.length && view !== 'board') {
      const empty = node('div', '', 'empty');
      if (queueMode === 'archived') {
        empty.append(
          node('strong', archivedList.length ? 'Nenhuma OS arquivada encontrada' : 'Nenhuma OS arquivada ainda'),
          node('p', archivedList.length ? 'Ajuste a busca ou limpe os filtros.' : 'Quando uma OS receber status "Concluído" (ou 100% do workflow) ou "Repassado", ela será movida automaticamente para cá.')
        );
      } else {
        empty.append(
          node('strong', activeList.length ? 'Nenhuma OS encontrada na fila ativa' : 'A fila ativa está vazia'),
          node('p', activeList.length ? 'Ajuste a busca ou limpe os filtros.' : 'Cadastre uma ordem em “Nova OS” ou consulte a aba “Arquivados · Concluído e Repassado”.')
        );
      }
      rows.append(empty);
    } else if (view === 'board') {
      const boardStages = queueMode === 'archived' ? archivedStages : boardActiveStages;
      for (const status of boardStages) {
        const pausedCol = isPausedStatus(status);
        const proofCol = isProofStatus(status);
        const column = node(
          'section',
          '',
          'kanban-column s' + stageIndex(status) + (pausedCol ? ' is-paused-col' : '') + (proofCol ? ' is-proof-col' : '')
        );
        column.setAttribute('aria-label', status);
        const items = visible.filter(order => order.status === status);
        const headingText = (pausedCol || proofCol) ? `${status} (fim da fila) · ${items.length}` : `${status} · ${items.length}`;
        column.append(node('h3', headingText, 'kanban-title'));
        column.ondragover = event => {
          if (dragging && !writing) {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
          }
        };
        column.ondrop = event => {
          event.preventDefault();
          const order = orders.find(item => item.number === dragging);
          dragging = '';
          if (order && order.status !== status && !writing) {
            change(order, statusTransitionPatch(order, status));
          }
        };
        items.forEach((order, idx) => column.append(compactCard(order, idx + 1)));
        if (!items.length) column.append(node('p', 'Nenhuma OS nesta coluna', 'column-empty'));
        rows.append(column);
      }
      if (queueMode === 'active') {
        const makeArchiveDrop = (targetStatus, titleText, descText) => {
          const zone = node('div', '', 'kanban-dropzone s' + stageIndex(targetStatus));
          zone.append(node('strong', titleText), node('span', descText));
          zone.ondragover = event => {
            if (dragging && !writing) {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              zone.classList.add('is-drag-over');
            }
          };
          zone.ondragleave = () => zone.classList.remove('is-drag-over');
          zone.ondrop = event => {
            event.preventDefault();
            zone.classList.remove('is-drag-over');
            const order = orders.find(item => item.number === dragging);
            dragging = '';
            if (order && !isArchived(order) && !writing) {
              change(order, statusTransitionPatch(order, targetStatus));
            }
          };
          return zone;
        };

        const archCol = node('section', '', 'kanban-column kanban-archive-drop s' + stageIndex('Concluído'));
        archCol.setAttribute('aria-label', 'Arquivar OS (Concluído ou Repassado)');
        archCol.append(
          node('h3', `Arquivar · ${archivedList.length}`, 'kanban-title'),
          makeArchiveDrop('Concluído', 'Concluído · Arquivar', 'Finaliza checklist 100% e move para Arquivados'),
          makeArchiveDrop('Repassado', 'Repassado · Arquivar', 'Move direto para Arquivados preservando checklist')
        );
        const openArchBtn = action(
          archivedList.length
            ? `Ver ${archivedList.length} OS arquivada(s) →`
            : 'Solte acima para Concluído ou Repassado',
          () => setQueueMode('archived')
        );
        openArchBtn.className = 'kanban-archive-btn';
        archCol.append(openArchBtn);
        rows.append(archCol);
      }
    } else if (view === 'simple') {
      const listWrap = node('div', '', 'notion-simple-list');
      const proofVisible = visible.filter(isProof).length;
      const pausedVisible = visible.filter(isPaused).length;
      let holdInserted = false;
      visible.forEach((order, idx) => {
        if (queueMode === 'active' && isEndOfQueue(order) && !holdInserted && !isHoldStatus(selected)) {
          holdInserted = true;
          listWrap.append(holdSectionBanner(proofVisible, pausedVisible));
        }
        listWrap.append(simpleRow(order, idx + 1));
      });
      rows.append(listWrap);
    } else if (view === 'table') {
      rows.append(tableView(visible));
    } else {
      const proofVisible = visible.filter(isProof).length;
      const pausedVisible = visible.filter(isPaused).length;
      let holdInserted = false;
      visible.forEach((order, idx) => {
        if (queueMode === 'active' && isEndOfQueue(order) && !holdInserted && !isHoldStatus(selected)) {
          holdInserted = true;
          rows.append(holdSectionBanner(proofVisible, pausedVisible));
        }
        rows.append(queueCard(order, idx + 1));
      });
    }

    if (queueMode === 'active' && archivedList.length > 0 && view !== 'board') {
      const archFooter = node('div', '', 'archived-Callout');
      const archSwitchBtn = action(
        `📦 ${archivedList.length} OS em Arquivados (Concluído / Repassado) — clique para consultar`,
        () => setQueueMode('archived')
      );
      archSwitchBtn.className = 'archived-footer-link';
      archFooter.append(archSwitchBtn);
      rows.append(archFooter);
    }

    lockControls();
  }

  function formatBytes(bytes) {
    const n = Number(bytes || 0);
    if (!n || n < 1024) return `${n || 0} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  }

  function showAttachmentStatus(statusEl, message, isError = false, retryFiles = null, onRetrySuccess = null) {
    if (!statusEl) return;
    statusEl.innerHTML = '';
    if (!message && !retryFiles?.length) {
      statusEl.hidden = true;
      return;
    }
    statusEl.hidden = false;
    statusEl.className = 'attach-status' + (isError ? ' is-error' : '');
    statusEl.append(node('span', message));
    if (storageMode !== 'cloud') {
      const cfgBtn = action('Ativar nuvem', () => openCloudConfigModal());
      cfgBtn.className = 'attach-status-btn';
      statusEl.append(cfgBtn);
      return;
    }
    if (retryFiles?.length) {
      const reconBtn = action('Conectar Google Drive e enviar', async () => {
        try {
          showAttachmentStatus(statusEl, 'Autorizando Google Drive no app…');
          await requestDriveAccessToken({ loginHint: cloudUser?.email || '' });
          updateCloudBarUI();
          await uploadFilesBatch(retryFiles, fields.number?.value || detailNumber || '', {
            preferProvider: 'gdrive',
            statusEl,
            onUploaded: onRetrySuccess
          });
        } catch (e) {
          showAttachmentStatus(statusEl, e.message, true, retryFiles, onRetrySuccess);
        }
      });
      reconBtn.className = 'attach-status-btn';
      const fallbackBtn = action('Enviar via Supabase Storage', async () => {
        await uploadFilesBatch(retryFiles, fields.number?.value || detailNumber || '', {
          preferProvider: 'supabase',
          statusEl,
          onUploaded: onRetrySuccess
        });
      });
      fallbackBtn.className = 'attach-status-btn';
      statusEl.append(reconBtn, fallbackBtn);
    }
  }

  function setAttachBusy(busy) {
    draftAttachBusy = busy;
    const saveBtn = byId('save');
    if (saveBtn) saveBtn.disabled = busy;
  }

  async function uploadFilesBatch(fileList, rawOrderNumber, { preferProvider = 'gdrive', statusEl, onUploaded } = {}) {
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) return;
    if (storageMode !== 'cloud' || !cloudUser) {
      showAttachmentStatus(
        statusEl,
        storageMode !== 'cloud'
          ? 'Conecte o Supabase e entre com seu Gmail para enviar PDFs e imagens para a nuvem.'
          : 'Entre com sua conta Gmail antes de enviar anexos.',
        true
      );
      return;
    }
    const orderNum = formatOrderNumber(rawOrderNumber || '') || String(rawOrderNumber || '').trim();
    setAttachBusy(true);
    let uploadedCount = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        showAttachmentStatus(statusEl, `Enviando ${i + 1}/${files.length}: ${file.name} (${preferProvider === 'supabase' ? 'Supabase' : 'Google Drive'})…`);
        const item = await uploadCloudAttachment(file, { orderNumber: orderNum, preferProvider });
        uploadedCount++;
        if (onUploaded) await onUploaded(item);
      }
      pendingRetryFiles = [];
      showAttachmentStatus(statusEl, `${uploadedCount} ${uploadedCount === 1 ? 'anexo enviado' : 'anexos enviados'} com sucesso.`);
      updateCloudBarUI();
      setTimeout(() => {
        if (statusEl && !statusEl.classList.contains('is-error') && statusEl.textContent.includes('com sucesso')) {
          statusEl.hidden = true;
        }
      }, 3200);
    } catch (err) {
      if (err?.code === 'DRIVE_AUTH_REQUIRED') {
        pendingRetryFiles = files.slice(uploadedCount);
        showAttachmentStatus(statusEl, err.message, true, pendingRetryFiles, onUploaded);
        updateCloudBarUI();
      } else {
        showAttachmentStatus(statusEl, err?.message || 'Falha ao enviar anexo.', true);
      }
    } finally {
      setAttachBusy(false);
    }
  }

  /** Bind external attachment navigation strictly to safe http(s) URLs or Supabase signed URLs. */
  function bindAttachmentLink(anchor, att) {
    const safeHref = sanitizeHttpUrl(att.webViewLink || att.previewUrl, '');
    anchor.href = safeHref || '#';
    anchor.rel = 'noopener noreferrer';
    if (att.provider === 'supabase' && att.storagePath) {
      anchor.target = '_blank';
      anchor.onclick = async e => {
        e.preventDefault();
        const fresh = sanitizeHttpUrl(await resolveAttachmentAccessUrl(att), '');
        if (fresh) window.open(fresh, '_blank', 'noopener,noreferrer');
      };
      return;
    }
    if (safeHref) {
      anchor.target = '_blank';
      return;
    }
    anchor.onclick = e => e.preventDefault();
  }

  function createAttachmentCard(att, { removable = false, onRemove } = {}) {
    const isPdf = att.mimeType === 'application/pdf' || /\.pdf$/i.test(att.name || '');
    const isImage = !isPdf && att.mimeType !== 'image/svg+xml' && (att.mimeType?.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(att.name || ''));
    const card = node('div', '', 'attach-item' + (isPdf ? ' is-pdf' : ' is-image'));

    const thumbWrap = node('a', '', 'attach-preview-link');
    bindAttachmentLink(thumbWrap, att);
    thumbWrap.title = `Abrir ${att.name}`;

    if (isImage) {
      const img = document.createElement('img');
      img.className = 'attach-thumb-img';
      img.alt = att.name;
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      const fallback = node('span', 'IMG', 'attach-type-badge is-img');
      fallback.hidden = true;
      img.onerror = () => {
        img.hidden = true;
        fallback.hidden = false;
      };
      const initialImgSrc = sanitizeHttpUrl(att.previewUrl || att.webViewLink, '');
      if (initialImgSrc) {
        img.src = initialImgSrc;
      } else {
        img.hidden = true;
        fallback.hidden = false;
      }
      if (att.provider === 'supabase' && att.storagePath) {
        resolveAttachmentAccessUrl(att).then(url => {
          const safeUrl = sanitizeHttpUrl(url, '');
          if (safeUrl) {
            img.src = safeUrl;
            img.hidden = false;
            fallback.hidden = true;
            thumbWrap.href = safeUrl;
          }
        }).catch(() => {});
      }
      thumbWrap.append(img, fallback);
    } else {
      thumbWrap.append(node('span', 'PDF', 'attach-type-badge is-pdf'));
    }

    const info = node('div', '', 'attach-meta');
    const nameEl = node('strong', att.name || 'Arquivo', 'attach-name');
    nameEl.title = att.name || '';
    const subParts = [formatBytes(att.size), att.provider === 'gdrive' ? 'Google Drive' : att.provider === 'supabase' ? 'Supabase' : 'Link'];
    const subEl = node('span', subParts.join(' · '), 'attach-sub');
    info.append(nameEl, subEl);

    const btns = node('div', '', 'attach-actions');
    const openBtn = node('a', 'Abrir ↗', 'attach-btn-open');
    bindAttachmentLink(openBtn, att);
    btns.append(openBtn);

    if (removable && onRemove) {
      const delBtn = action('×', () => onRemove());
      delBtn.className = 'attach-btn-remove';
      delBtn.title = 'Remover anexo da OS';
      delBtn.setAttribute('aria-label', 'Remover ' + att.name);
      btns.append(delBtn);
    }

    card.append(thumbWrap, info, btns);
    return card;
  }

  function renderEditorAttachments() {
    const listEl = byId('editor-attach-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    if (!draftAttachments.length) {
      listEl.append(node('p', 'Nenhum PDF ou imagem anexado nesta OS.', 'attach-empty'));
      return;
    }
    for (const att of draftAttachments) {
      listEl.append(createAttachmentCard(att, {
        removable: true,
        onRemove: () => {
          draftAttachments = draftAttachments.filter(item => item !== att);
          pendingDeleteAttachments.push(att);
          renderEditorAttachments();
        }
      }));
    }
  }

  function buildDetailAttachmentsSection(order, attachmentsList) {
    const box = node('section', '', 'detail-attachments-section');
    const head = node('div', '', 'detail-attachments-head');
    head.append(node('strong', `Anexos na nuvem (${attachmentsList.length})`));

    const statusEl = node('div', '', 'attach-status');
    statusEl.hidden = true;

    const pickerLabel = node('label', '', 'attach-picker-btn');
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/pdf,image/*';
    fileInput.multiple = true;
    fileInput.hidden = true;
    fileInput.onchange = async () => {
      if (!fileInput.files?.length) return;
      const incoming = [];
      await uploadFilesBatch(fileInput.files, order.number, {
        statusEl,
        onUploaded: async item => { incoming.push(item); }
      });
      fileInput.value = '';
      if (incoming.length) {
        const latest = orders.find(o => o.number === order.number) || order;
        const merged = [...(latest.attachments || []), ...incoming];
        await change(latest, { attachments: merged });
      }
    };
    pickerLabel.append(fileInput, node('span', '+ Anexar PDF / Imagem'));
    head.append(pickerLabel);
    box.append(head, statusEl);

    if (!attachmentsList.length) {
      box.append(node('p', 'Nenhum PDF ou imagem anexado ainda. Clique em "+ Anexar PDF / Imagem" para enviar para o Google Drive.', 'attach-empty'));
      return box;
    }

    const grid = node('div', '', 'detail-attach-grid');
    for (const att of attachmentsList) {
      grid.append(createAttachmentCard(att, {
        removable: !writing,
        onRemove: async () => {
          const latest = orders.find(o => o.number === order.number) || order;
          const next = (latest.attachments || []).filter(item => item.id ? item.id !== att.id : item !== att);
          await change(latest, { attachments: next });
          deleteCloudAttachment(att);
        }
      }));
    }
    box.append(grid);
    return box;
  }

  function ensureCloudStrip() {
    let strip = byId('cloud-status-strip');
    if (strip) return strip;
    const metricsEl = byId('metrics');
    if (!metricsEl?.parentElement) return null;
    strip = document.createElement('section');
    strip.id = prefix + 'cloud-status-strip';
    strip.className = 'cloud-status-strip';
    strip.setAttribute('aria-label', 'Conta Gmail, Supabase e Google Drive');
    metricsEl.parentElement.insertBefore(strip, metricsEl);
    return strip;
  }

  function emitAuthSnapshot() {
    const cfg = getCloudConfig();
    onAuthChanged?.({
      storageMode,
      preconfigured: isPreconfiguredCloud(),
      supabaseConfigured: !!cfg?.supabaseConfigured,
      googleConfigured: !!cfg?.googleConfigured,
      user: cloudUser,
      driveConnected: hasActiveDriveToken(),
      driveFolderName: cfg?.driveFolderName || 'OS Maneger - Anexos',
      realtimeStatus
    });
  }

  function openLoginDialog() {
    if (byId('cloud-login-error')) byId('cloud-login-error').textContent = '';
    updateLoginModalMode();
    const dlg = byId('login');
    if (dlg && !dlg.open) dlg.showModal();
    mountInAppGoogleButton();
  }

  async function mountInAppGoogleButton() {
    const cfg = getCloudConfig();
    const slot = byId('google-signin-slot');
    const customBtn = byId('gmail-signin');
    const dlg = byId('login');
    if (!slot || storageMode !== 'cloud' || !dlg?.open) return;
    const originStatus = getOAuthOriginStatus();
    if (originStatus.isPreviewOrigin) {
      slot.hidden = true;
      slot.innerHTML = '';
      if (customBtn) customBtn.hidden = true;
      return;
    }
    if (!cfg?.googleClientId) {
      slot.hidden = true;
      slot.innerHTML = '';
      if (customBtn) customBtn.hidden = false;
      return;
    }
    try {
      slot.hidden = false;
      const rendered = await renderInAppGoogleButton(slot, {
        onBusy: busy => {
          googleButtonBusy = busy;
          if (byId('cloud-login-hint') && busy) {
            byId('cloud-login-hint').textContent = 'Validando conta Google no app…';
          }
        },
        onSuccess: async session => {
          googleButtonBusy = false;
          if (byId('cloud-login-error')) byId('cloud-login-error').textContent = '';
          await handleCloudAuthState(session);
        },
        onError: err => {
          googleButtonBusy = false;
          if (byId('cloud-login-error')) byId('cloud-login-error').textContent = err?.message || 'Falha ao entrar com Google.';
        }
      });
      googleButtonMounted = !!rendered;
      slot.hidden = !rendered;
      if (customBtn) customBtn.hidden = !!rendered;
    } catch (err) {
      googleButtonMounted = false;
      slot.hidden = true;
      if (customBtn) customBtn.hidden = false;
      if (byId('cloud-login-error') && err?.code === 'GOOGLE_CLIENT_ID_MISSING') {
        byId('cloud-login-error').textContent = err.message;
      }
    }
  }

  function updateCloudBarUI() {
    const strip = ensureCloudStrip();
    const cfg = getCloudConfig();
    const preconfigured = isPreconfiguredCloud();
    if (byId('mode')) {
      if (storageMode === 'cloud') {
        byId('mode').textContent = cloudUser
          ? `Supabase ativo · ${cloudUser.email}`
          : 'Supabase ativo · aguardando login Google no app';
      } else {
        byId('mode').textContent = shared ? 'Fila compartilhada · equipe de design' : 'Fila local · salva neste navegador';
      }
    }
    emitAuthSnapshot();
    if (!strip) return;
    strip.innerHTML = '';

    const left = node('div', '', 'cloud-strip-info');
    if (storageMode === 'cloud' && cloudUser) {
      if (!isEmbedded && cloudUser.avatar) {
        const avatar = document.createElement('img');
        avatar.src = cloudUser.avatar;
        avatar.alt = '';
        avatar.className = 'cloud-avatar';
        avatar.referrerPolicy = 'no-referrer';
        left.append(avatar);
      }
      const rtLabel = realtimeStatus === 'SUBSCRIBED'
        ? 'Supabase Realtime ativo'
        : realtimeStatus === 'CHANNEL_ERROR' || realtimeStatus === 'TIMED_OUT'
          ? 'Realtime reconectando'
          : 'Supabase conectado';
      const rtClass = 'cloud-pill ' + (realtimeStatus === 'CHANNEL_ERROR' || realtimeStatus === 'TIMED_OUT' ? 'is-warn' : 'is-ok');
      if (!isEmbedded) {
        left.append(node('strong', cloudUser.email, 'cloud-email'));
      }
      const driveInfo = getDriveConnectionInfo();
      const drivePillText = driveInfo.connected
        ? `Drive ativo (${driveInfo.remainingMinutes} min) · ${driveInfo.attachmentsFolder}`
        : 'Drive: aguardando conexão';
      left.append(
        node('span', rtLabel, rtClass),
        node('span', drivePillText, 'cloud-pill ' + (driveInfo.connected ? 'is-ok' : 'is-warn'))
      );
    } else if (storageMode === 'cloud') {
      left.append(
        node('span', 'Supabase ativo', 'cloud-pill is-ok'),
        node('span', isEmbedded ? 'Autentique-se na barra superior para carregar a fila.' : 'Entre com sua conta Google aqui no app para carregar a fila e anexar no Google Drive.', 'cloud-hint-inline')
      );
    } else if (storageMode === 'upstash') {
      left.append(
        node('span', 'Modo Redis (Upstash)', 'cloud-pill'),
        node('span', 'Integração Supabase disponível nas variáveis da Vercel.', 'cloud-hint-inline')
      );
    } else {
      left.append(
        node('span', 'Modo offline local', 'cloud-pill is-warn'),
        node('span', 'Salvo só neste navegador.', 'cloud-hint-inline')
      );
    }

    const right = node('div', '', 'cloud-strip-actions');

    if (!isEmbedded && storageMode === 'cloud' && !cloudUser) {
      const originStatus = getOAuthOriginStatus();
      if (originStatus.isPreviewOrigin) {
        const officialLink = document.createElement('a');
        officialLink.href = originStatus.canonicalUrl;
        officialLink.textContent = 'Entrar no domínio oficial ↗';
        officialLink.className = 'primary cloud-btn-sm official-origin-link';
        right.append(officialLink);
      } else {
        const loginBtn = action('Entrar com Google', () => openLoginDialog());
        loginBtn.className = 'primary cloud-btn-sm';
        right.append(loginBtn);
      }
    }
    if (storageMode === 'cloud' && cloudUser) {
      const backupDriveBtn = action('☁ Backup Drive', () => openDriveBackupDialog());
      backupDriveBtn.className = 'cloud-btn-sm';
      backupDriveBtn.title = 'Gerenciar backups privados dos 3 apps no Google Drive';
      right.append(backupDriveBtn);
    }
    if (!isEmbedded && storageMode === 'cloud' && cloudUser && !hasActiveDriveToken()) {
      const reconBtn = action('Conectar Google Drive', async () => {
        try {
          await requestDriveAccessToken({ loginHint: cloudUser?.email || '' });
          updateCloudBarUI();
        } catch (err) {
          if (byId('message')) byId('message').textContent = err.message;
        }
      });
      reconBtn.className = 'cloud-btn-sm';
      right.append(reconBtn);
    }
    if (!preconfigured || !cfg?.googleConfigured) {
      const cfgBtn = action(preconfigured ? 'Ajustes nuvem' : 'Configurar Supabase', () => openCloudConfigModal());
      cfgBtn.className = 'cloud-btn-sm';
      right.append(cfgBtn);
    } else {
      const cfgBtn = action('Ajustes nuvem', () => openCloudConfigModal());
      cfgBtn.className = 'cloud-btn-sm';
      cfgBtn.title = 'Ajustes avançados de pasta do Google Drive e restrições';
      right.append(cfgBtn);
    }

    if (!isEmbedded && storageMode === 'cloud' && cloudUser) {
      const signOutBtn = action('Sair', async () => {
        await signOutCloud();
        await handleCloudAuthState(null);
      });
      signOutBtn.className = 'cloud-btn-sm danger-text';
      right.append(signOutBtn);
    } else if (forceLocalFallback) {
      const retryCloudBtn = action('Reativar Supabase', async () => {
        forceLocalFallback = false;
        await start();
      });
      retryCloudBtn.className = 'cloud-btn-sm';
      right.append(retryCloudBtn);
    }
    strip.append(left, right);
  }

  function updateLoginModalMode() {
    const cloudPanel = byId('cloud-login-panel');
    const authForm = byId('auth');
    if (!cloudPanel || !authForm) return;
    const isCloud = storageMode === 'cloud';
    const cfg = getCloudConfig();
    const preconfigured = isPreconfiguredCloud();
    cloudPanel.hidden = !isCloud;
    authForm.hidden = isCloud;

    const cfgBtn = byId('open-cloud-config-from-login');
    if (cfgBtn) {
      cfgBtn.hidden = preconfigured && !!cfg?.googleConfigured;
    }

    const hint = byId('cloud-login-hint');
    const errEl = byId('cloud-login-error');
    const officialBtn = byId('open-official-origin');
    const originStatus = getOAuthOriginStatus();
    if (officialBtn) {
      officialBtn.hidden = !(isCloud && originStatus.isPreviewOrigin);
      if (originStatus.isPreviewOrigin) {
        officialBtn.href = originStatus.canonicalUrl;
      }
    }
    if (isCloud && originStatus.isPreviewOrigin) {
      if (hint) {
        hint.textContent = 'URL temporária de preview da Vercel detectada — o login Google OAuth 2.0 é restrito ao domínio oficial de produção.';
      }
      if (errEl) {
        errEl.textContent = originStatus.reason;
      }
      return;
    }
    if (errEl && errEl.textContent && /preview temporária|origin_mismatch/i.test(errEl.textContent)) {
      errEl.textContent = '';
    }
    if (hint && isCloud) {
      if (!cfg?.googleConfigured) {
        hint.textContent = 'Defina GOOGLE_CLIENT_ID na Vercel (ou em Ajustes de nuvem) para habilitar o botão Google direto no app.';
      } else if (cfg?.requireGmailDomain) {
        hint.textContent = 'Restrição ativa: entre com uma conta @gmail.com autorizada diretamente no app.';
      } else {
        hint.textContent = 'Login Google integrado diretamente no app, sem redirecionamento para o Supabase.';
      }
    }
  }

  function openCloudConfigModal() {
    const dialog = byId('cloud-config');
    if (!dialog) return;
    const cfg = getCloudConfig();
    const manual = readManualCloudConfig();
    const clientInput = byId('cloud-google-client-id');
    const urlInput = byId('cloud-supabase-url');
    const keyInput = byId('cloud-supabase-key');
    const folderInput = byId('cloud-drive-folder');
    const backupFolderInput = byId('cloud-drive-backup-folder');
    const gmailCheck = byId('cloud-require-gmail');
    const sourceNote = byId('cloud-config-source-note');
    if (clientInput) clientInput.value = manual?.googleClientId || cfg?.googleClientId || '';
    if (urlInput) urlInput.value = manual?.supabaseUrl || cfg?.supabaseUrl || '';
    if (keyInput) keyInput.value = manual?.supabaseAnonKey || cfg?.supabaseAnonKey || '';
    if (folderInput) folderInput.value = manual?.driveFolderName || cfg?.driveFolderName || 'OS Maneger - Anexos';
    if (backupFolderInput) backupFolderInput.value = manual?.driveBackupFolderName || cfg?.driveBackupFolderName || 'IBD Suite - Backups';
    if (gmailCheck) gmailCheck.checked = manual && manual.requireGmailDomain !== undefined ? !!manual.requireGmailDomain : !!cfg?.requireGmailDomain;
    if (sourceNote) {
      sourceNote.textContent = cfg?.source === 'env'
        ? 'Integração com o Supabase já configurada no servidor. Ajuste aqui apenas o Google Client ID, a pasta do Drive ou sobrescrita local se necessário.'
        : 'Informe a Project URL e a Anon Key pública do Supabase e o Google OAuth Client ID (Web).';
    }
    if (byId('cloud-config-error')) byId('cloud-config-error').textContent = '';
    dialog.showModal();
  }

  let cloudBindingsReady = false;
  function setupCloudAndAttachmentBindings() {
    if (cloudBindingsReady) return;
    cloudBindingsReady = true;
    const attachInput = byId('editor-attach-input');
    const dropzone = byId('editor-attach-dropzone');
    const statusEl = byId('editor-attach-status');

    const handleEditorPickedFiles = async files => {
      await uploadFilesBatch(files, fields.number?.value || editing?.number || '', {
        statusEl,
        onUploaded: item => {
          draftAttachments.push(item);
          renderEditorAttachments();
        }
      });
    };

    if (attachInput) {
      attachInput.onchange = async () => {
        if (attachInput.files?.length) await handleEditorPickedFiles(attachInput.files);
        attachInput.value = '';
      };
    }

    if (dropzone) {
      dropzone.ondragover = e => { e.preventDefault(); dropzone.classList.add('is-drag-over'); };
      dropzone.ondragleave = () => dropzone.classList.remove('is-drag-over');
      dropzone.ondrop = async e => {
        e.preventDefault();
        dropzone.classList.remove('is-drag-over');
        if (e.dataTransfer?.files?.length) await handleEditorPickedFiles(e.dataTransfer.files);
      };
    }

    form.addEventListener('paste', async e => {
      const files = Array.from(e.clipboardData?.files || []).filter(isSupportedAttachment);
      if (!files.length) return;
      e.preventDefault();
      await handleEditorPickedFiles(files);
    });

    if (byId('gmail-signin')) {
      byId('gmail-signin').onclick = async () => {
        if (byId('cloud-login-error')) byId('cloud-login-error').textContent = '';
        try {
          await signInWithGmail(undefined, {
            onBusy: busy => {
              googleButtonBusy = busy;
              if (byId('cloud-login-hint') && busy) {
                byId('cloud-login-hint').textContent = 'Validando conta Google no app…';
              }
            },
            onSuccess: async session => {
              googleButtonBusy = false;
              await handleCloudAuthState(session);
            },
            onError: err => {
              googleButtonBusy = false;
              if (byId('cloud-login-error')) byId('cloud-login-error').textContent = err?.message || 'Falha no login Google.';
            }
          });
        } catch (err) {
          if (byId('cloud-login-error')) byId('cloud-login-error').textContent = err.message;
        }
      };
    }
    if (byId('open-cloud-config-from-login')) {
      byId('open-cloud-config-from-login').onclick = () => {
        byId('login')?.close();
        openCloudConfigModal();
      };
    }
    if (byId('use-local-fallback')) {
      byId('use-local-fallback').onclick = async () => {
        forceLocalFallback = true;
        byId('login')?.close();
        await start();
      };
    }

    const cfgDialog = byId('cloud-config');
    if (byId('cloud-config-close')) byId('cloud-config-close').onclick = () => cfgDialog?.close();
    if (byId('cloud-config-cancel')) byId('cloud-config-cancel').onclick = () => cfgDialog?.close();
    if (byId('cloud-config-clear')) {
      byId('cloud-config-clear').onclick = async () => {
        clearManualCloudConfig();
        forceLocalFallback = false;
        cfgDialog?.close();
        await start();
      };
    }
    if (byId('cloud-config-form')) {
      byId('cloud-config-form').onsubmit = async e => {
        e.preventDefault();
        const currentCfg = getCloudConfig();
        const serverProvided = currentCfg?.source === 'env';
        const googleClientId = (byId('cloud-google-client-id')?.value || '').trim();
        const url = (byId('cloud-supabase-url')?.value || '').trim();
        const key = (byId('cloud-supabase-key')?.value || '').trim();
        const folder = (byId('cloud-drive-folder')?.value || '').trim() || 'OS Maneger - Anexos';
        const backupFolder = (byId('cloud-drive-backup-folder')?.value || '').trim() || 'IBD Suite - Backups';
        const reqGmail = !!byId('cloud-require-gmail')?.checked;
        const errNode = byId('cloud-config-error');
        if (!serverProvided) {
          if (!url || !/^https:\/\/.+\.supabase\.co$/i.test(url.replace(/\/+$/, '')) && !/^https?:\/\//.test(url)) {
            if (errNode) errNode.textContent = 'Informe uma Supabase Project URL válida (https://...supabase.co).';
            return;
          }
          if (!key || key.length < 20) {
            if (errNode) errNode.textContent = 'Informe a Anon Key pública do Supabase.';
            return;
          }
        }
        if (googleClientId && !/\.apps\.googleusercontent\.com$/i.test(googleClientId)) {
          if (errNode) errNode.textContent = 'Informe um Google OAuth Client ID válido (terminado em .apps.googleusercontent.com).';
          return;
        }
        if (errNode) errNode.textContent = '';
        saveManualCloudConfig({
          supabaseUrl: serverProvided && url === currentCfg?.supabaseUrl ? '' : url,
          supabaseAnonKey: serverProvided && key === currentCfg?.supabaseAnonKey ? '' : key,
          googleClientId,
          driveFolderName: folder,
          driveBackupFolderName: backupFolder,
          requireGmailDomain: reqGmail
        });
        forceLocalFallback = false;
        cfgDialog?.close();
        await start();
      };
    }

    if (!unsubscribeDrive) {
      unsubscribeDrive = onDriveTokenChange(() => {
        updateCloudBarUI();
      });
    }

    const syncOnWake = () => {
      if (storageMode === 'cloud' && cloudUser && !savingCloudLocally) {
        refresh().catch(() => {});
      }
    };
    window.addEventListener('focus', syncOnWake);
    window.addEventListener('online', syncOnWake);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') syncOnWake();
    });
  }

  async function api(url, reqOptions = {}) {
    const result = await fetch(url, {
      ...reqOptions,
      cache: 'no-store',
      headers: { ...(password ? { Authorization: 'Bearer ' + password } : {}), ...reqOptions.headers }
    });
    const data = await result.json();
    if (!result.ok) {
      if (result.status === 401 && byId('login') && !byId('login').open) byId('login').showModal();
      throw Error(data.error || 'Falha na conexão.');
    }
    return data;
  }

  async function handleCloudAuthState(session) {
    if (!session) {
      if (lastAuthStateKey === 'signed_out' && !cloudUser && !loaded) return;
      lastAuthStateKey = 'signed_out';
      authTransitionPromise = null;
      cloudUser = null;
      loaded = false;
      orders = [];
      realtimeStatus = 'idle';
      unsubscribeRealtime?.();
      unsubscribeRealtime = null;
      unsubscribePrintersRealtime?.();
      unsubscribePrintersRealtime = null;
      unsubscribeCounterRealtime?.();
      unsubscribeCounterRealtime = null;
      counterTickets = [];
      printersCatalog = localListPrinters();
      render();
      renderCounter();
      lockControls();
      updateLoginModalMode();
      updateCloudBarUI();
      if (isViewActive()) {
        openLoginDialog();
      }
      return;
    }

    const cfg = getCloudConfig();
    if (cfg?.requireGmailDomain && !isGmailAddress(session.user?.email)) {
      if (byId('cloud-login-error')) byId('cloud-login-error').textContent = 'Acesso restrito a contas @gmail.com.';
      await signOutCloud();
      return;
    }

    const nextKey = `user:${session.user?.id || session.user?.email || ''}`;
    cloudUser = currentCloudUser();
    if (byId('cloud-login-error')) byId('cloud-login-error').textContent = '';
    if (byId('login')?.open) byId('login').close();
    updateLoginModalMode();
    updateCloudBarUI();

    if (!unsubscribeRealtime) {
      unsubscribeRealtime = subscribeCloudOrders(
        () => {
          if (storageMode !== 'cloud') return;
          if (savingCloudLocally) {
            realtimeDirty = true;
            return;
          }
          refresh().catch(() => {});
        },
        status => {
          realtimeStatus = status || 'idle';
          updateCloudBarUI();
        }
      );
    }
    if (!unsubscribePrintersRealtime) {
      unsubscribePrintersRealtime = subscribeCloudPrinters(() => {
        if (storageMode !== 'cloud') return;
        refreshPrinters().catch(() => {});
      });
    }
    if (!unsubscribeCounterRealtime) {
      unsubscribeCounterRealtime = subscribeCloudCounterTickets(() => {
        if (storageMode !== 'cloud' || savingCloudLocally) return;
        refreshCounterTickets().catch(() => {});
      });
    }

    if (lastAuthStateKey === nextKey) {
      if (authTransitionPromise) return authTransitionPromise;
      if (loaded) return;
    }
    lastAuthStateKey = nextKey;

    authTransitionPromise = (async () => {
      try {
        await refresh();
        if (!isEmbedded) {
          const prefsMap = await cloudReadSuiteData(['osm:prefs']).catch(() => null);
          if (prefsMap?.['osm:prefs']?.payload) applyCloudPrefs(prefsMap['osm:prefs'].payload);
        }
      } catch (e) {
        if (byId('message')) byId('message').textContent = 'Erro ao carregar fila do Supabase: ' + e.message;
      } finally {
        authTransitionPromise = null;
      }
    })();
    return authTransitionPromise;
  }

  async function refresh() {
    const ticket = ++generation;
    const [list] = await Promise.all([
      storageMode === 'cloud'
        ? cloudList()
        : shared ? api('/api/orders') : localList(),
      refreshPrinters().catch(() => {}),
      refreshCounterTickets().catch(() => {})
    ]);
    if (ticket !== generation) return;
    orders = list.map(normalize).sort(compareQueue);
    loaded = true;
    if (byId('new')) byId('new').disabled = false;
    if (byId('new-counter-top')) byId('new-counter-top').disabled = false;
    if (byId('message')) byId('message').textContent = '';
    render();
    renderDetail();
    updateAreaBadges();
    lockControls();
    updateCloudBarUI();
  }

  async function start() {
    lastAuthStateKey = '';
    authTransitionPromise = null;
    setupCloudAndAttachmentBindings();
    const cfg = forceLocalFallback ? { supabaseConfigured: false } : await resolveCloudConfig();
    if (cfg?.supabaseConfigured) {
      storageMode = 'cloud';
      shared = true;
      updateLoginModalMode();
      updateCloudBarUI();
      try {
        const session = await getCloudSession();
        if (!unsubscribeAuth) {
          unsubscribeAuth = onCloudAuthChange(async (_event, nextSession) => {
            if (storageMode !== 'cloud') return;
            await handleCloudAuthState(nextSession);
          });
        }
        await handleCloudAuthState(session);
        return;
      } catch (err) {
        if (byId('message')) byId('message').textContent = 'Não foi possível conectar ao Supabase: ' + err.message;
        return;
      }
    }

    storageMode = 'local';
    unsubscribeRealtime?.();
    unsubscribeRealtime = null;
    cloudUser = null;
    try {
      const config = await api('/api/orders?mode=1');
      shared = !!config.shared;
      if (shared) storageMode = 'upstash';
    } catch {
      shared = false;
    }
    updateLoginModalMode();
    updateCloudBarUI();
    try {
      if (shared && !password) {
        if (isViewActive() && byId('login') && !byId('login').open) byId('login').showModal();
        return;
      }
      await refresh();
    } catch (e) {
      if (byId('message')) byId('message').textContent = 'Não foi possível carregar a fila. ' + e.message;
    }
  }

  if (byId('auth')) {
    byId('auth').onsubmit = async e => {
      e.preventDefault();
      password = byId('password').value;
      const errNode = byId('auth').querySelector('.error');
      try {
        await refresh();
        byId('login').close();
        byId('password').value = '';
        if (errNode) errNode.textContent = '';
      } catch (err) {
        password = '';
        if (errNode) errNode.textContent = err.message;
      }
    };
  }

  function escapePdfHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function downloadOrderPdfSheet(order) {
    if (!order) return;
    const calc = computePrintDeadline(order);
    const items = normalizeItems(order.items || []);
    const printers = normalizePrinters(order.printers || []);
    const reminders = normalizeReminders(order.reminders || []);
    const orderLink = effectiveOrderLink(order);
    const printLink = effectiveOrderPrintLink(order);
    const orderPath = effectiveOrderPath(order);
    const docTitle = `OS-${order.number}`;
    const fmt = v => (v ? formatOrderDateFull(v) : 'Não informada');
    const itemsHtml = items.length
      ? items.map(it => `<span class="chip">${escapePdfHtml(it.number)}${it.label ? ' — ' + escapePdfHtml(it.label) : ''}</span>`).join(' ')
      : '<span class="muted">Nenhum item cadastrado</span>';
    const printersHtml = printers.length
      ? printers.map(p => `<span class="chip">${escapePdfHtml(p)}</span>`).join(' ')
      : '<span class="muted">Nenhuma impressora vinculada</span>';
    const remindersHtml = reminders.length
      ? `<ul>${reminders.map(r => `<li>${escapePdfHtml(r.text)}</li>`).join('')}</ul>`
      : '<p class="muted">Sem lembretes ativos.</p>';
    const stepsHtml = workflowSteps.map((s, idx) => {
      const done = order.workflow?.[s.id] === true;
      return `<li><strong>${done ? '☑' : '☐'} ${String(idx + 1).padStart(2, '0')}.</strong> ${escapePdfHtml(s.label)}</li>`;
    }).join('');

    const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${escapePdfHtml(docTitle)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #111827; margin: 0; font-size: 12px; line-height: 1.45; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111827; padding-bottom: 10px; margin-bottom: 14px; }
  .os-num { font-family: Consolas, monospace; font-size: 20px; font-weight: 700; margin: 0; }
  .title { font-size: 16px; font-weight: 700; margin: 4px 0 0; }
  .badge { display: inline-block; padding: 3px 8px; border: 1px solid #374151; border-radius: 5px; font-weight: 700; font-size: 11px; }
  .badge.urg { border-color: #b91c1c; color: #b91c1c; background: #fef2f2; }
  .grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
  .box { border: 1px solid #d1d5db; border-radius: 6px; padding: 8px 10px; margin-bottom: 10px; }
  .box h3 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #4b5563; }
  .date-lbl { font-size: 10px; text-transform: uppercase; color: #6b7280; display: block; }
  .date-val { font-family: Consolas, monospace; font-size: 11.5px; font-weight: 700; }
  .sla { border-color: #059669; background: #ecfdf5; }
  .chip { display: inline-block; padding: 2px 7px; border: 1px solid #9ca3af; border-radius: 4px; font-family: Consolas, monospace; font-size: 11px; margin: 2px 4px 2px 0; }
  .muted { color: #6b7280; }
  code { font-family: Consolas, monospace; font-size: 11px; word-break: break-all; }
  ul { margin: 0; padding-left: 18px; }
  .steps { list-style: none; padding-left: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; }
  .notes { white-space: pre-wrap; margin: 0; }
  .toolbar { display: flex; gap: 8px; margin-bottom: 14px; padding: 10px; background: #f3f4f6; border-radius: 6px; }
  .toolbar button, .toolbar a { font: inherit; font-weight: 700; padding: 6px 12px; border-radius: 5px; border: 1px solid #374151; background: #111827; color: #fff; text-decoration: none; cursor: pointer; }
  .toolbar a { background: #fff; color: #111827; }
  @media print { .toolbar { display: none; } }
</style>
</head>
<body>
  <div class="toolbar">
    <button type="button" onclick="window.print()">Salvar em PDF / Imprimir</button>
    ${printLink ? `<a href="${escapePdfHtml(printLink)}" target="_blank" rel="noopener noreferrer">Abrir impressão oficial do site NBL ↗</a>` : ''}
  </div>
  <div class="head">
    <div>
      <p class="os-num">OS ${escapePdfHtml(order.number)}</p>
      <p class="title">${escapePdfHtml(normalizeTitle(order.title) || 'SEM DESCRIÇÃO')}</p>
    </div>
    <div>
      <span class="badge">${escapePdfHtml(order.status || 'Recebido')}</span>
      ${order.urgent ? '<span class="badge urg">URGENTE</span>' : ''}
      ${order.complexity ? `<span class="badge">${escapePdfHtml(order.complexity)}</span>` : ''}
    </div>
  </div>
  <div class="grid4">
    <div class="box"><span class="date-lbl">Impressão da OS</span><span class="date-val">${escapePdfHtml(fmt(calc.printedAt))}</span></div>
    <div class="box"><span class="date-lbl">Recebimento</span><span class="date-val">${escapePdfHtml(fmt(calc.receivedAt))}</span></div>
    <div class="box"><span class="date-lbl">Produção</span><span class="date-val">${escapePdfHtml(fmt(calc.productionDate))}</span></div>
    <div class="box sla"><span class="date-lbl">Prazo Finalização (máx. 24h)</span><span class="date-val">${escapePdfHtml(fmt(calc.printDeadline))}</span></div>
  </div>
  ${calc.ruleSummary ? `<p class="muted" style="margin:-4px 0 10px;">${escapePdfHtml(calc.ruleSummary)}</p>` : ''}
  <div class="box">
    <h3>Referências &amp; Diretório</h3>
    ${order.owner ? `<p style="margin:0 0 4px;"><strong>Responsável:</strong> ${escapePdfHtml(order.owner)}</p>` : ''}
    ${orderPath ? `<p style="margin:0 0 4px;"><strong>Diretório:</strong> <code>${escapePdfHtml(orderPath)}</code></p>` : ''}
    ${orderLink ? `<p style="margin:0 0 4px;"><strong>Link do pedido:</strong> <code>${escapePdfHtml(orderLink)}</code></p>` : ''}
    ${printLink ? `<p style="margin:0;"><strong>Link de impressão:</strong> <code>${escapePdfHtml(printLink)}</code></p>` : ''}
  </div>
  <div class="box"><h3>Itens do pedido</h3><div>${itemsHtml}</div></div>
  <div class="box"><h3>Impressoras</h3><div>${printersHtml}</div></div>
  <div class="box"><h3>Workflow (${workflowProgress(order)}%)</h3><ul class="steps">${stepsHtml}</ul></div>
  <div class="box"><h3>Lembretes</h3>${remindersHtml}</div>
  <div class="box"><h3>Observações · Base de Conhecimento</h3><p class="notes">${escapePdfHtml(order.notes || 'Sem observações registradas.')}</p></div>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=900,height=780');
    if (!win) {
      if (byId('message')) byId('message').textContent = 'Permita pop-ups para gerar o PDF da OS ' + order.number + '.';
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { try { win.print(); } catch {} }, 180);
  }

  let linkManual = false;
  let printLinkManual = false;
  let pathManual = false;

  function updateReferenceAutoUi() {
    const defaults = buildDefaultOrderReferences(fields.number?.value || '');
    const linkVal = (fields.link?.value || '').trim();
    const printLinkVal = (fields.printLink?.value || '').trim();
    const pathVal = (fields.path?.value || '').trim();
    const linkBadge = byId('link-mode-badge');
    const linkReset = byId('link-reset-btn');
    const printLinkBadge = byId('print-link-mode-badge');
    const printLinkReset = byId('print-link-reset-btn');
    const pathBadge = byId('path-mode-badge');
    const pathReset = byId('path-reset-btn');

    const applyFieldBadge = (badgeEl, resetEl, defVal, curVal, isManual) => {
      if (badgeEl) {
        if (defVal && !isManual && curVal === defVal) {
          badgeEl.textContent = 'Auto';
          badgeEl.className = 'ref-mode-badge is-auto';
          badgeEl.hidden = false;
        } else if (isManual && (curVal || defVal)) {
          badgeEl.textContent = 'Manual';
          badgeEl.className = 'ref-mode-badge is-manual';
          badgeEl.hidden = false;
        } else {
          badgeEl.hidden = true;
        }
      }
      if (resetEl) {
        resetEl.hidden = !(defVal && curVal !== defVal);
      }
    };

    applyFieldBadge(linkBadge, linkReset, defaults.link, linkVal, linkManual);
    applyFieldBadge(printLinkBadge, printLinkReset, defaults.printLink, printLinkVal, printLinkManual);
    applyFieldBadge(pathBadge, pathReset, defaults.path, pathVal, pathManual);
  }

  function syncAutoReferencesFromNumber() {
    const defaults = buildDefaultOrderReferences(fields.number?.value || '');
    if (!linkManual && fields.link) {
      fields.link.value = defaults.link;
    }
    if (!printLinkManual && fields.printLink) {
      fields.printLink.value = defaults.printLink;
    }
    if (!pathManual && fields.path) {
      fields.path.value = defaults.path;
    }
    updateReferenceAutoUi();
    actions();
  }

  function actions() {
    let url;
    try { url = new URL(fields.link.value); } catch {}
    const usable = url && ['http:', 'https:'].includes(url.protocol);
    if (byId('openlink')) {
      byId('openlink').hidden = !usable;
      byId('openlink').href = usable ? url.href : '';
    }
    let printUrl;
    try { printUrl = new URL(fields.printLink?.value || ''); } catch {}
    const usablePrint = printUrl && ['http:', 'https:'].includes(printUrl.protocol);
    if (byId('openprintlink')) {
      byId('openprintlink').hidden = !usablePrint;
      byId('openprintlink').href = usablePrint ? printUrl.href : '';
    }
    if (byId('copy')) {
      byId('copy').hidden = !fields.path.value;
      byId('copy').textContent = 'Copiar caminho';
    }
  }

  function edit(order = {}) {
    form.reset();
    editing = order;
    fields.urgent.checked = !!order.urgent;
    for (const name of ['number', 'title', 'status', 'link', 'printLink', 'path', 'notes', 'owner', 'deadline', 'printedAt', 'receivedAt', 'productionDate', 'complexity']) {
      if (fields[name]) fields[name].value = order[name] ?? (name === 'status' ? stages[0] : '');
    }
    if (fields.title) fields.title.value = normalizeTitle(order.title || '');
    const initialDefaults = buildDefaultOrderReferences(fields.number?.value || '');
    const savedLink = (order.link || '').trim();
    const savedPrintLink = (order.printLink || '').trim();
    const savedPath = (order.path || '').trim();
    linkManual = Boolean(savedLink && savedLink !== initialDefaults.link);
    printLinkManual = Boolean(savedPrintLink && savedPrintLink !== initialDefaults.printLink);
    pathManual = Boolean(savedPath && savedPath !== initialDefaults.path);
    if (!linkManual && initialDefaults.link && fields.link) {
      fields.link.value = initialDefaults.link;
    }
    if (!printLinkManual && initialDefaults.printLink && fields.printLink) {
      fields.printLink.value = initialDefaults.printLink;
    }
    if (!pathManual && initialDefaults.path && fields.path) {
      fields.path.value = initialDefaults.path;
    }
    const expandDate = val => (val && val.length === 10 ? val + 'T23:59' : val || '');
    if (fields.printedAt) fields.printedAt.value = expandDate(order.printedAt);
    if (fields.receivedAt) {
      fields.receivedAt.value = order.version
        ? expandDate(order.receivedAt)
        : (expandDate(order.receivedAt) || formatFortalezaDateTime(Date.now()));
    }
    if (fields.productionDate) {
      const prodVal = order.productionDate || (!order.receivedAt && order.deadline ? order.deadline : '');
      fields.productionDate.value = expandDate(prodVal);
    }
    if (fields.deadline) {
      fields.deadline.value = expandDate(order.deadline);
    }
    version = order.version || 0;
    fields.number.readOnly = false;
    draftAttachments = normalizeAttachments(order.attachments || []);
    draftPrinters = normalizePrinters(order.printers || []);
    draftItems = normalizeItems(order.items || []);
    draftReminders = normalizeReminders(order.reminders || []);
    if (byId('editor-item-number-input')) byId('editor-item-number-input').value = '';
    if (byId('editor-item-label-input')) byId('editor-item-label-input').value = '';
    if (byId('editor-items-hint')) {
      byId('editor-items-hint').classList.remove('is-error');
      byId('editor-items-hint').textContent = 'Zeros à esquerda são preenchidos até 6 dígitos (ex.: 12 vira 000012). Uma OS pode ter vários itens.';
    }
    if (byId('editor-reminder-input')) byId('editor-reminder-input').value = '';
    pendingDeleteAttachments = [];
    pendingRetryFiles = [];
    setAttachBusy(false);
    const attStatus = byId('editor-attach-status');
    if (attStatus) {
      attStatus.hidden = true;
      attStatus.innerHTML = '';
    }
    renderEditorItems();
    renderEditorReminders();
    renderEditorAttachments();
    renderEditorPrinters();
    if (byId('delete-order')) byId('delete-order').hidden = !version;
    if (byId('caption')) byId('caption').textContent = version ? 'Editar OS ' + order.number : 'Nova OS';
    const formErr = form.querySelector('.error');
    if (formErr) formErr.textContent = '';
    updateReferenceAutoUi();
    actions();
    updateDeadlineButton();
    editor.showModal();
    const editorBody = editor.querySelector('.osm-dialog-body, .dialog-body');
    if (editorBody) editorBody.scrollTop = 0;
    (version ? fields.status : fields.number).focus();
  }

  if (fields.title) {
    fields.title.oninput = () => {
      const start = fields.title.selectionStart;
      const end = fields.title.selectionEnd;
      const upper = fields.title.value.toLocaleUpperCase('pt-BR');
      if (upper !== fields.title.value) {
        fields.title.value = upper;
        if (typeof start === 'number' && typeof end === 'number') {
          fields.title.setSelectionRange(start, end);
        }
      }
    };
    fields.title.onblur = () => {
      fields.title.value = normalizeTitle(fields.title.value);
    };
  }

  fields.number.oninput = e => {
    const raw = fields.number.value;
    const deletingChar = e?.inputType?.startsWith('delete');
    let next = '';
    if (/[-/.\s]/.test(raw)) {
      const [leftRaw = '', ...rest] = raw.replace(/[/. \s]+/g, '-').split('-');
      let left = leftRaw.replace(/\D/g, '');
      if (left.length > 4) left = left.startsWith('0') ? left.slice(-4) : left.slice(0, 4);
      let right = rest.join('').replace(/\D/g, '');
      if (right.length > 6) right = right.startsWith('0') ? right.slice(-6) : right.slice(0, 6);
      next = left + '-' + right;
    } else {
      const digits = raw.replace(/\D/g, '').slice(0, 10);
      next = !deletingChar && digits.length > 4 ? digits.slice(0, 4) + '-' + digits.slice(4) : digits;
    }
    if (next !== raw) {
      const pos = fields.number.selectionStart ?? raw.length;
      const atEnd = pos >= raw.length;
      fields.number.value = next;
      if (!atEnd) {
        const nextPos = Math.min(next.length, Math.max(0, pos + (next.length - raw.length)));
        fields.number.setSelectionRange(nextPos, nextPos);
      }
    }
    syncAutoReferencesFromNumber();
  };

  fields.number.onblur = () => {
    const formatted = formatOrderNumber(fields.number.value);
    if (/^\d{4}-\d{6}$/.test(formatted)) fields.number.value = formatted;
    syncAutoReferencesFromNumber();
  };

  fields.link.oninput = () => {
    const defaults = buildDefaultOrderReferences(fields.number?.value || '');
    const val = fields.link.value.trim();
    linkManual = defaults.link ? val !== defaults.link : Boolean(val);
    updateReferenceAutoUi();
    actions();
  };

  if (fields.printLink) {
    fields.printLink.oninput = () => {
      const defaults = buildDefaultOrderReferences(fields.number?.value || '');
      const val = fields.printLink.value.trim();
      printLinkManual = defaults.printLink ? val !== defaults.printLink : Boolean(val);
      updateReferenceAutoUi();
      actions();
    };
  }

  fields.path.oninput = () => {
    const defaults = buildDefaultOrderReferences(fields.number?.value || '');
    const val = fields.path.value.trim();
    pathManual = defaults.path ? val !== defaults.path : Boolean(val);
    updateReferenceAutoUi();
    actions();
  };

  if (byId('link-reset-btn')) {
    byId('link-reset-btn').onclick = () => {
      linkManual = false;
      syncAutoReferencesFromNumber();
      fields.link?.focus();
    };
  }
  if (byId('print-link-reset-btn')) {
    byId('print-link-reset-btn').onclick = () => {
      printLinkManual = false;
      syncAutoReferencesFromNumber();
      fields.printLink?.focus();
    };
  }
  if (byId('path-reset-btn')) {
    byId('path-reset-btn').onclick = () => {
      pathManual = false;
      syncAutoReferencesFromNumber();
      fields.path?.focus();
    };
  }
  if (byId('copy')) {
    byId('copy').onclick = async () => {
      try {
        await navigator.clipboard.writeText(fields.path.value);
        byId('copy').textContent = 'Copiado';
      } catch {
        fields.path.select();
        const formErr = form.querySelector('.error');
        if (formErr) formErr.textContent = 'Caminho selecionado. Use o comando de copiar do dispositivo.';
      }
    };
  }

  form.onsubmit = async e => {
    e.preventDefault();
    if (draftAttachBusy) return;
    if (byId('editor-item-number-input')?.value.trim()) {
      if (!addDraftItemsFromInputs()) return;
    }
    if (byId('editor-reminder-input')?.value.trim()) {
      addDraftReminderFromInput();
    }
    const formattedNumber = formatOrderNumber(fields.number.value);
    if (/^\d{4}-\d{6}$/.test(formattedNumber)) fields.number.value = formattedNumber;
    syncAutoReferencesFromNumber();
    const input = { ...editing, version };
    if (version) input.originalNumber = editing.number;
    if (version) input.rank = rankOf(editing);
    else if (orders.length) {
      const tail = rankOf(orders[orders.length - 1]);
      const candidate = 'N' + Date.now() + fields.number.value + 'M';
      input.rank = candidate > tail ? candidate : rankBetween(tail, null, fields.number.value);
    }
    for (const [key, value] of new FormData(form)) input[key] = value.trim();
    const calcDates = computePrintDeadline({
      printedAt: input.printedAt || '',
      receivedAt: input.receivedAt || '',
      productionDate: input.productionDate || '',
      deadline: input.deadline || ''
    });
    input.printedAt = calcDates.printedAt;
    input.receivedAt = calcDates.receivedAt;
    input.productionDate = calcDates.productionDate;
    input.deadline = (input.receivedAt || input.productionDate) ? calcDates.printDeadline : '';
    input.number = formatOrderNumber(input.number);
    input.title = normalizeTitle(input.title || '');
    input.urgent = fields.urgent.checked;
    input.attachments = normalizeAttachments(draftAttachments);
    input.printers = normalizePrinters(draftPrinters);
    input.items = normalizeItems(draftItems);
    input.reminders = normalizeReminders(draftReminders);
    if (input.status === 'Concluído') {
      input.workflow = Object.fromEntries(workflowSteps.map(s => [s.id, true]));
    }
    if (isHoldStatus(input.status) || isArchivedStatus(input.status)) {
      Object.assign(input, stopTimerPatch(editing));
    }
    if (isHoldStatus(input.status)) {
      const prevStage = editing?.status && !isHoldStatus(editing.status) && !isArchivedStatus(editing.status)
        ? editing.status
        : (editing?.pausedFrom || '');
      if (prevStage) input.pausedFrom = prevStage;
      if (editing?.status) rememberPausedFrom(input.number, editing.status);
      const tailRank = tailRankFor(input.number);
      if (tailRank) input.rank = tailRank;
    } else if (editing?.status !== input.status) {
      input.pausedFrom = '';
      forgetPausedFrom(input.number);
    }
    const error = validate(input);
    const formErr = form.querySelector('.error');
    if (error) {
      if (formErr) formErr.textContent = error;
      return;
    }
    byId('save').disabled = true;
    try {
      await save(input);
      if (promotingCounterId) {
        const srcTicket = counterTickets.find(t => t.id === promotingCounterId);
        const promoId = promotingCounterId;
        promotingCounterId = '';
        if (srcTicket) {
          const [cNum = '', oNum = ''] = input.number.split('-');
          const stopPatch = stopCounterTimerPatch(srcTicket, Date.now(), `Convertido em OS ${input.number}`);
          await saveCounterTicketRecord({
            ...srcTicket,
            ...stopPatch,
            status: 'Convertido em OS',
            linkedOsNumber: input.number,
            clientNumber: srcTicket.clientNumber || cNum,
            orderNumber: srcTicket.orderNumber || oNum
          }).catch(() => {});
        } else if (promoId) {
          await refreshCounterTickets().catch(() => {});
        }
      }
      if (pendingDeleteAttachments.length) {
        const toClean = [...pendingDeleteAttachments];
        pendingDeleteAttachments = [];
        Promise.allSettled(toClean.map(deleteCloudAttachment));
      }
      if (detailNumber === editing.number) detailNumber = input.number;
      editor.close();
      try {
        await refresh();
        if (byId('message')) {
          if (input.status === 'Repassado') {
            byId('message').textContent = `OS ${input.number} salva como Repassado e movida para Arquivados.`;
          } else if (isArchivedStatus(input.status)) {
            byId('message').textContent = `OS ${input.number} salva como Concluído e enviada para Arquivados.`;
          } else if (isProofStatus(input.status)) {
            byId('message').textContent = `OS ${input.number} salva em Prova e movida para o fim da fila ativa (sem esmaecer).`;
          } else if (isPausedStatus(input.status)) {
            byId('message').textContent = `OS ${input.number} pausada, esmaecida e movida para o fim da fila ativa.`;
          }
        }
      } catch {
        if (byId('message')) byId('message').textContent = 'OS salva. Atualize a fila para consultar.';
      }
    } catch (err) {
      if (formErr) formErr.textContent = err.message;
    } finally {
      byId('save').disabled = false;
    }
  };

  for (const button of editor.querySelectorAll('.close')) button.onclick = () => {
    promotingCounterId = '';
    editor.close();
  };
  editor?.addEventListener('close', () => {
    promotingCounterId = '';
  });

  let deleting = null;
  function askDelete(order) {
    if (writing) return;
    deleting = { number: order.number, version: order.version, attachments: order.attachments };
    byId('delete-description').textContent = 'Excluir a OS ' + order.number + (order.title ? ' — ' + order.title : '') + '?';
    byId('delete-error').textContent = '';
    byId('delete-dialog').showModal();
    byId('delete-cancel').focus();
  }
  if (byId('delete-order')) byId('delete-order').onclick = () => askDelete(editing);
  if (byId('delete-cancel')) byId('delete-cancel').onclick = () => byId('delete-dialog').close();
  byId('delete-dialog')?.addEventListener('cancel', event => { if (writing) event.preventDefault(); });
  if (byId('delete-form')) {
    byId('delete-form').onsubmit = async event => {
      event.preventDefault();
      if (writing || !deleting) return;
      const input = { ...deleting };
      writing = true;
      lockControls();
      byId('delete-confirm').disabled = byId('delete-cancel').disabled = true;
      try {
        await deleteOrderRecord(input);
        if (input.attachments?.length) {
          Promise.allSettled(input.attachments.map(deleteCloudAttachment));
        }
        byId('delete-dialog').close();
        if (editor.open && editing?.number === input.number) editor.close();
        if (detailDialog.open && detailNumber === input.number) detailDialog.close();
        orders = orders.filter(order => order.number !== input.number);
        render();
        try {
          await refresh();
          byId('message').textContent = 'OS ' + input.number + ' excluída.';
        } catch {
          byId('message').textContent = 'OS excluída. Atualize a fila para consultar.';
        }
      } catch (error) {
        byId('delete-error').textContent = error.message;
      } finally {
        writing = false;
        lockControls();
        byId('delete-confirm').disabled = byId('delete-cancel').disabled = false;
      }
    };
  }

  function clearFilters() {
    selected = '';
    if (byId('search')) byId('search').value = '';
    for (const id of ['filter-status', 'filter-complexity', 'filter-printer', 'filter-urgency', 'filter-deadline']) {
      if (byId(id)) byId(id).value = '';
    }
    setQueueMode('active');
  }
  if (byId('clear')) byId('clear').onclick = clearFilters;
  if (byId('all-orders')) byId('all-orders').onclick = clearFilters;

  if (byId('queue-active')) byId('queue-active').onclick = () => setQueueMode('active');
  if (byId('queue-archived')) byId('queue-archived').onclick = () => setQueueMode('archived');

  for (const id of ['filter-status', 'filter-complexity', 'filter-printer', 'filter-urgency', 'filter-deadline', 'sort']) {
    const el = byId(id);
    if (el) {
      el.onchange = () => {
        if (id === 'filter-status') {
          const val = byId('filter-status').value;
          if (isArchivedStatus(val)) {
            selected = val;
            setQueueMode('archived', { preserveStatus: true });
            return;
          }
          selected = val;
          if (queueMode === 'archived' && val) {
            setQueueMode('active', { preserveStatus: true });
            return;
          }
        }
        render();
      };
    }
  }

  for (const mode of ['simple', 'table', 'board', 'list']) {
    const btn = byId('view-' + mode);
    if (btn) {
      btn.onclick = () => setViewMode(mode);
    }
  }

  setInterval(() => {
    if (!loaded || writing) return;
    if (byId('filter-deadline')?.value && !detailDialog?.open && !byId('rows')?.querySelector(':focus')) render();
    else {
      for (const badge of root.querySelectorAll('[data-deadline-number]')) {
        const order = orders.find(item => item.number === badge.dataset.deadlineNumber);
        if (order) updateDeadline(badge, order);
      }
    }
  }, 30000);

  if (byId('search')) byId('search').oninput = render;
  if (byId('new')) byId('new').onclick = () => edit();
  if (byId('refresh')) byId('refresh').onclick = start;

  window.addEventListener('focus', () => {
    if (!writing && !byId('restore-dialog')?.open && shared !== undefined && !byId('new')?.disabled && !editor?.open && !byId('delete-dialog')?.open && !detailDialog?.open && (!byId('login') || !byId('login').open)) {
      refresh().catch(e => { if (byId('message')) byId('message').textContent = e.message; });
    }
  });

  let incoming = [], incomingPrinters = [], incomingCounterTickets = [], incomingSuiteBackup = null, restoreSnapshot = [], restoreCounterSnapshot = [];
  function lockControls() {
    const rowsEl = byId('rows');
    const detailContentEl = byId('detail-content');
    const controls = [
      ...(rowsEl ? rowsEl.querySelectorAll('button,select,input,textarea') : []),
      ...(detailContentEl ? detailContentEl.querySelectorAll('button,select,input,textarea') : []),
      byId('new'),
      byId('new-counter-top'),
      byId('backup'),
      byId('restore'),
      byId('refresh')
    ].filter(Boolean);
    for (const control of controls) {
      control.disabled = writing || !loaded || control.dataset.edgeDisabled === '1';
    }
  }

  function readFallbackSuiteExtrasFromLocalStorage() {
    const readJson = (k, fallback) => {
      try {
        const raw = localStorage.getItem(k);
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        return fallback;
      }
    };
    return {
      folha: {
        templates: readJson('folha-models', []),
        customPresets: readJson('folha-custom-presets-v1', { papers: [], pieces: [] }),
        workspace: readJson('folha-v5', null)
      },
      numeraBloco: {
        workspace: readJson('nbl-preparation-v1', null),
        projects: readJson('nbl-projects-v1', [])
      }
    };
  }

  async function applyFallbackSuiteExtrasToStorageAndCloud(parsedSuite) {
    try {
      if (Array.isArray(parsedSuite.folhaTemplates) && parsedSuite.folhaTemplates.length) {
        const existing = (() => { try { return JSON.parse(localStorage.getItem('folha-models') || '[]'); } catch { return []; } })();
        const map = new Map((Array.isArray(existing) ? existing : []).map(t => [t.name, t]));
        for (const t of parsedSuite.folhaTemplates) map.set(t.name, t);
        localStorage.setItem('folha-models', JSON.stringify(Array.from(map.values())));
      }
      if (parsedSuite.folhaCustomPresets) {
        localStorage.setItem('folha-custom-presets-v1', JSON.stringify(parsedSuite.folhaCustomPresets));
        if (storageMode === 'cloud' && cloudUser) {
          await cloudWriteSuiteData('folha:custom_presets', 'folha', parsedSuite.folhaCustomPresets).catch(() => {});
        }
      }
      if (parsedSuite.folhaWorkspace) {
        localStorage.setItem('folha-v5', JSON.stringify(parsedSuite.folhaWorkspace));
        if (storageMode === 'cloud' && cloudUser) {
          await cloudWriteSuiteData('folha:workspace', 'folha', { state: parsedSuite.folhaWorkspace }).catch(() => {});
        }
      }
      if (parsedSuite.nblWorkspace) {
        localStorage.setItem('nbl-preparation-v1', JSON.stringify(parsedSuite.nblWorkspace));
        if (storageMode === 'cloud' && cloudUser) {
          await cloudWriteSuiteData('nbl:workspace', 'numera-bloco', { state: parsedSuite.nblWorkspace }).catch(() => {});
        }
      }
      if (Array.isArray(parsedSuite.nblProjects) && parsedSuite.nblProjects.length) {
        localStorage.setItem('nbl-projects-v1', JSON.stringify(parsedSuite.nblProjects));
        if (storageMode === 'cloud' && cloudUser) {
          await cloudWriteSuiteData('nbl:projects', 'numera-bloco', { projects: parsedSuite.nblProjects }).catch(() => {});
        }
      }
    } catch {}
  }

  function buildFullSuiteBackupSnapshot(now = Date.now()) {
    const extras = getSuiteBackupExtras ? getSuiteBackupExtras() : readFallbackSuiteExtrasFromLocalStorage();
    return {
      app: 'ibd-suite',
      schema: 2,
      exportedAt: new Date(now).toISOString(),
      exportedBy: cloudUser?.email || '',
      osManeger: {
        orders: orders.map(order => ({ ...order, rank: rankOf(order), elapsedMs: elapsed(order, now), startedAt: 0 })),
        counterTickets: counterTickets.map(ticket => ({
          ...ticket,
          elapsedMs: counterElapsed(ticket, now),
          startedAt: 0
        })),
        printersCatalog,
        prefs: { copyMode }
      },
      folha: {
        templates: Array.isArray(extras?.folha?.templates) ? extras.folha.templates : [],
        customPresets: extras?.folha?.customPresets || { papers: [], pieces: [] },
        workspace: extras?.folha?.workspace || null
      },
      numeraBloco: {
        workspace: extras?.numeraBloco?.workspace || null,
        projects: Array.isArray(extras?.numeraBloco?.projects) ? extras.numeraBloco.projects : []
      }
    };
  }

  async function downloadLocalSuiteBackup() {
    if (loaded) await refresh().catch(() => {});
    const now = Date.now();
    const data = buildFullSuiteBackupSnapshot(now);
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = node('a', '');
    link.href = url;
    link.download = 'ibd-suite-backup-' + new Date(now).toISOString().replace(/[:.]/g, '-').slice(0, 19) + '.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return data;
  }

  async function prepareRestoreFromParsedJson(parsedBackup) {
    const parsedSuite = readSuiteBackup(parsedBackup);
    incoming = parsedSuite.orders;
    incomingPrinters = parsedSuite.printersCatalog;
    incomingCounterTickets = parsedSuite.counterTickets || [];
    incomingSuiteBackup = parsedSuite;
    if (loaded) await refresh().catch(() => {});
    restoreSnapshot = orders.slice();
    restoreCounterSnapshot = counterTickets.slice();
    const duplicates = incoming.filter(item => orders.some(o => o.number === item.number)).length;
    const parts = [
      `${incoming.length} OS (${incoming.length - duplicates} novas, ${duplicates} já cadastradas)`
    ];
    if (incomingCounterTickets.length) parts.push(`${incomingCounterTickets.length} atendimento(s) de balcão`);
    if (incomingPrinters.length) parts.push(`${incomingPrinters.length} impressora(s)`);
    const customCount = (parsedSuite.folhaCustomPresets?.papers?.length || 0) + (parsedSuite.folhaCustomPresets?.pieces?.length || 0);
    if (parsedSuite.folhaTemplates.length) parts.push(`${parsedSuite.folhaTemplates.length} modelo(s) Folha`);
    if (customCount) parts.push(`${customCount} preset(s) Folha`);
    if (parsedSuite.nblProjects.length) parts.push(`${parsedSuite.nblProjects.length} preset(s) Numera Bloco`);
    byId('restore-summary').textContent = parts.join(' · ') + '.';
    byId('overwrite').checked = false;
    const errEl = byId('restore-form').querySelector('.error');
    if (errEl) errEl.textContent = '';
    byId('restore-dialog').showModal();
  }

  if (byId('backup')) {
    byId('backup').onclick = async () => {
      try {
        await downloadLocalSuiteBackup();
        if (byId('message')) byId('message').textContent = 'Backup completo dos 3 apps baixado. No outro dispositivo, use Restaurar backup.';
      } catch (err) {
        if (byId('message')) byId('message').textContent = err.message;
      }
    };
  }

  if (byId('restore')) byId('restore').onclick = () => byId('backupfile').click();
  if (byId('backupfile')) {
    byId('backupfile').onchange = async () => {
      const file = byId('backupfile').files[0];
      byId('backupfile').value = '';
      if (!file) return;
      try {
        if (file.size > 5 * 1024 * 1024) throw Error('O backup deve ter até 5 MB.');
        const parsedBackup = JSON.parse(await file.text());
        await prepareRestoreFromParsedJson(parsedBackup);
      } catch (err) {
        if (byId('message')) byId('message').textContent = 'Não foi possível abrir o backup. ' + err.message;
      }
    };
  }

  if (byId('restore-cancel')) byId('restore-cancel').onclick = () => byId('restore-dialog').close();
  if (byId('restore-form')) {
    byId('restore-form').onsubmit = async event => {
      event.preventDefault();
      const inputs = restorePlan(incoming, restoreSnapshot, byId('overwrite').checked);
      writing = true;
      lockControls();
      byId('restore-confirm').disabled = true;
      byId('restore-cancel').disabled = true;
      const errEl = byId('restore-form').querySelector('.error');
      try {
        await restoreBackupRecords(incoming, byId('overwrite').checked, restoreSnapshot, inputs);
        let restoredCounterCount = 0;
        if (incomingCounterTickets.length) {
          const counterRes = await restoreCounterBackupRecords(incomingCounterTickets, byId('overwrite').checked, restoreCounterSnapshot);
          restoredCounterCount = counterRes?.count || 0;
        }
        if (incomingPrinters.length) {
          if (storageMode === 'cloud' && cloudUser) {
            await cloudRestorePrinters(incomingPrinters);
          }
          printersCatalog = localReplacePrinters([...printersCatalog, ...incomingPrinters]);
        }
        if (incomingSuiteBackup) {
          if (incomingSuiteBackup.osmPrefs) {
            applyCloudPrefs(incomingSuiteBackup.osmPrefs);
            if (storageMode === 'cloud' && cloudUser) {
              await cloudWriteSuiteData('osm:prefs', 'os-maneger', { copyMode }).catch(() => {});
            }
          }
          if (applySuiteBackupExtras) {
            await applySuiteBackupExtras(incomingSuiteBackup);
          } else {
            await applyFallbackSuiteExtrasToStorageAndCloud(incomingSuiteBackup);
          }
        }
        byId('restore-dialog').close();
        await refresh();
        if (byId('message')) {
          byId('message').textContent = `Backup restaurado: ${inputs.length} OS${restoredCounterCount ? ` + ${restoredCounterCount} balcão` : ''} atualizados e sincronizados.`;
        }
      } catch (err) {
        if (errEl) errEl.textContent = err.message;
      } finally {
        writing = false;
        lockControls();
        byId('restore-confirm').disabled = false;
        byId('restore-cancel').disabled = false;
      }
    };
  }

  // =========================================================================
  // Janela de Backups Privados no Google Drive (3 apps)
  // =========================================================================
  let driveBackupBusy = false;

  function setDriveBackupStatus(text, isError = false) {
    const el = byId('drive-backup-status');
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('is-error', !!isError);
  }

  function renderDriveBackupHeaderAndSummary() {
    const connEl = byId('drive-backup-conn');
    const snapEl = byId('drive-backup-snapshot');
    const info = getDriveConnectionInfo();
    const snap = buildFullSuiteBackupSnapshot();
    const customPapers = snap.folha.customPresets?.papers?.length || 0;
    const customPieces = snap.folha.customPresets?.pieces?.length || 0;

    if (connEl) {
      connEl.replaceChildren();
      const left = node('div', '', 'drive-conn-info');
      left.append(
        node('span', info.connected ? `✓ Drive conectado (${info.remainingMinutes} min restantes)` : '⚠ Google Drive não conectado', 'cloud-pill ' + (info.connected ? 'is-ok' : 'is-warn')),
        node('span', `Pasta privada: ${info.backupsFolder}`, 'note')
      );
      const btn = action(info.connected ? 'Renovar conexão Drive' : 'Conectar Google Drive', async () => {
        try {
          setDriveBackupStatus('Abrindo autorização privada do Google Drive…');
          await requestDriveAccessToken({ prompt: info.connected ? 'consent' : 'auto', loginHint: cloudUser?.email || '' });
          updateCloudBarUI();
          renderDriveBackupHeaderAndSummary();
          setDriveBackupStatus('Google Drive conectado com sucesso.');
          await loadDriveBackupsList();
        } catch (err) {
          setDriveBackupStatus(err.message, true);
        }
      });
      btn.className = 'cloud-btn-sm' + (info.connected ? '' : ' primary');
      connEl.append(left, btn);
    }

    if (snapEl) {
      snapEl.replaceChildren();
      const items = [
        ['OS Maneger', `${snap.osManeger.orders.length} OS · ${snap.osManeger.counterTickets.length} balcão · ${snap.osManeger.printersCatalog.length} impressoras`],
        ['Folha Imposição', `${snap.folha.templates.length} modelos · ${customPapers} folhas / ${customPieces} peças`],
        ['Numera Bloco', `${snap.numeraBloco.projects.length} presets · estado atual salvo`]
      ];
      for (const [label, val] of items) {
        const card = node('div', '', 'drive-snap-item');
        card.append(node('span', label), node('strong', val));
        snapEl.append(card);
      }
    }
  }

  async function loadDriveBackupsList() {
    const listEl = byId('drive-backup-list');
    if (!listEl) return;
    if (!hasActiveDriveToken()) {
      listEl.replaceChildren(node('p', 'Conecte o Google Drive acima para listar ou criar backups privados na nuvem.', 'attach-empty'));
      return;
    }
    listEl.replaceChildren(node('p', 'Consultando backups privados no Google Drive…', 'attach-empty'));
    try {
      const files = await listSuiteBackupsFromDrive({ limit: 20 });
      listEl.replaceChildren();
      if (!files.length) {
        listEl.append(node('p', 'Nenhum backup encontrado na pasta ainda. Clique em "Criar backup agora no Drive".', 'attach-empty'));
        return;
      }
      for (const file of files) {
        const row = node('div', '', 'drive-backup-item');
        const meta = node('div', '', 'drive-backup-meta');
        meta.append(node('strong', file.name));
        const createdLabel = file.createdTime && Number.isFinite(Date.parse(file.createdTime))
          ? dateFormat.format(new Date(Date.parse(file.createdTime)))
          : '';
        meta.append(node('small', [createdLabel, formatBytes(file.size)].filter(Boolean).join(' · ')));

        const acts = node('div', '', 'drive-backup-actions');
        const restoreBtn = action('Restaurar', async () => {
          if (driveBackupBusy) return;
          driveBackupBusy = true;
          try {
            setDriveBackupStatus(`Baixando "${file.name}" do Google Drive…`);
            const parsed = await downloadSuiteBackupFromDrive(file.id);
            byId('drive-backup-dialog')?.close();
            await prepareRestoreFromParsedJson(parsed);
            setDriveBackupStatus('');
          } catch (err) {
            setDriveBackupStatus(err.message, true);
          } finally {
            driveBackupBusy = false;
          }
        });
        restoreBtn.className = 'notion-mini-btn primary';

        const openLink = node('a', 'Abrir ↗', 'attach-btn-open');
        openLink.href = sanitizeHttpUrl(file.webViewLink, '#');
        openLink.target = '_blank';
        openLink.rel = 'noopener noreferrer';

        const trashBtn = action('×', async () => {
          if (driveBackupBusy) return;
          driveBackupBusy = true;
          try {
            setDriveBackupStatus(`Movendo "${file.name}" para a lixeira do Drive…`);
            await deleteSuiteBackupFromDrive(file.id);
            setDriveBackupStatus('Backup movido para a lixeira do Google Drive.');
            await loadDriveBackupsList();
          } catch (err) {
            setDriveBackupStatus(err.message, true);
          } finally {
            driveBackupBusy = false;
          }
        });
        trashBtn.className = 'attach-btn-remove';
        trashBtn.title = 'Mover backup para a lixeira do Google Drive';
        trashBtn.setAttribute('aria-label', 'Mover backup ' + file.name + ' para a lixeira');

        acts.append(restoreBtn, openLink, trashBtn);
        row.append(meta, acts);
        listEl.append(row);
      }
    } catch (err) {
      listEl.replaceChildren(node('p', err.message, 'is-error'));
      if (err?.code === 'DRIVE_AUTH_REQUIRED') renderDriveBackupHeaderAndSummary();
    }
  }

  async function openDriveBackupDialog() {
    const dlg = byId('drive-backup-dialog');
    if (!dlg) return;
    setDriveBackupStatus('');
    renderDriveBackupHeaderAndSummary();
    if (!dlg.open) dlg.showModal();
    await loadDriveBackupsList();
  }

  if (byId('drive-backup')) byId('drive-backup').onclick = () => openDriveBackupDialog();
  if (byId('drive-backup-close')) byId('drive-backup-close').onclick = () => byId('drive-backup-dialog')?.close();
  if (byId('drive-backup-done')) byId('drive-backup-done').onclick = () => byId('drive-backup-dialog')?.close();
  byId('drive-backup-dialog')?.addEventListener('click', event => {
    const dlg = byId('drive-backup-dialog');
    if (event.target !== dlg) return;
    const rect = dlg.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
      dlg.close();
    }
  });
  if (byId('drive-backup-refresh')) byId('drive-backup-refresh').onclick = () => loadDriveBackupsList();
  if (byId('drive-backup-download')) {
    byId('drive-backup-download').onclick = async () => {
      try {
        await downloadLocalSuiteBackup();
        setDriveBackupStatus('✓ Cópia local completa (.json) baixada com sucesso.');
      } catch (err) {
        setDriveBackupStatus(err.message, true);
      }
    };
  }
  if (byId('drive-backup-create')) {
    byId('drive-backup-create').onclick = async () => {
      if (driveBackupBusy) return;
      driveBackupBusy = true;
      const btn = byId('drive-backup-create');
      if (btn) btn.disabled = true;
      try {
        if (!hasActiveDriveToken()) {
          setDriveBackupStatus('Autorizando Google Drive para criar o backup privado…');
          await requestDriveAccessToken({ prompt: 'auto', loginHint: cloudUser?.email || '' });
          updateCloudBarUI();
          renderDriveBackupHeaderAndSummary();
        }
        if (loaded) await refresh().catch(() => {});
        const snap = buildFullSuiteBackupSnapshot();
        setDriveBackupStatus('Enviando backup privado dos 3 apps para o Google Drive…');
        const created = await uploadSuiteBackupToDrive(snap);
        if (storageMode === 'cloud' && cloudUser) {
          cloudWriteSuiteData('osm:prefs', 'os-maneger', {
            copyMode,
            lastDriveBackupAt: created.createdTime,
            lastDriveBackupName: created.name
          }).catch(() => {});
        }
        setDriveBackupStatus(`✓ Backup salvo com segurança em "${created.folderName}": ${created.name}`);
        renderDriveBackupHeaderAndSummary();
        await loadDriveBackupsList();
      } catch (err) {
        setDriveBackupStatus(err.message, true);
        renderDriveBackupHeaderAndSummary();
      } finally {
        driveBackupBusy = false;
        if (btn) btn.disabled = false;
      }
    };
  }

  let pickedDay = '', calendarMonth, activeDateField = 'productionDate';
  const dayString = date => date.toISOString().slice(0, 10);
  const fortalezaToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: workTimeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const dateFieldMeta = {
    printedAt: { title: 'Data de impressão da OS', buttonId: 'choose-printed-at', valueId: 'printed-at-value', defaultHour: '09', defaultMin: '00' },
    receivedAt: { title: 'Data de recebimento', buttonId: 'choose-received-at', valueId: 'received-at-value', defaultHour: '09', defaultMin: '00' },
    productionDate: { title: 'Data de produção', buttonId: 'choose-production-date', valueId: 'production-date-value', defaultHour: '18', defaultMin: '00' }
  };

  function updateDeadlineButton() {
    for (const [fieldName, meta] of Object.entries(dateFieldMeta)) {
      const val = fields[fieldName]?.value || '';
      const span = byId(meta.valueId);
      if (span) {
        span.textContent = val ? formatOrderDateShort(val) : 'Selecionar data e hora';
      }
      const btn = byId(meta.buttonId);
      if (btn) btn.classList.toggle('has-value', Boolean(val));
    }
    const calc = computePrintDeadline({
      printedAt: fields.printedAt?.value || '',
      receivedAt: fields.receivedAt?.value || '',
      productionDate: fields.productionDate?.value || '',
      deadline: ''
    });
    if (fields.deadline) fields.deadline.value = calc.printDeadline;
    if (byId('deadline-value')) {
      byId('deadline-value').textContent = calc.printDeadline
        ? formatOrderDateShort(calc.printDeadline) + ' (Fortaleza)'
        : 'Aguardando datas';
    }
    if (byId('deadline-hint')) {
      byId('deadline-hint').textContent = calc.ruleSummary;
    }
    const banner = byId('print-deadline-preview');
    if (banner) {
      const isLateNow = calc.printDeadline && Number.isFinite(calc.printDeadlineMs) && calc.printDeadlineMs < Date.now();
      banner.classList.toggle('is-danger', calc.invalidSchedule || isLateNow);
      banner.classList.toggle('is-warn', !calc.invalidSchedule && !isLateNow && calc.constrainedByProduction);
      banner.classList.toggle('is-ok', !calc.invalidSchedule && !isLateNow && !calc.constrainedByProduction && Boolean(calc.printDeadline));
    }
  }

  function openDatePickerFor(fieldName) {
    activeDateField = dateFieldMeta[fieldName] ? fieldName : 'productionDate';
    const meta = dateFieldMeta[activeDateField];
    const currentVal = fields[activeDateField]?.value || '';
    if (byId('picker-title')) byId('picker-title').textContent = meta.title;
    if (byId('calendar-clear')) byId('calendar-clear').textContent = 'Limpar data';
    pickedDay = currentVal.slice(0, 10) || fortalezaToday();
    calendarMonth = new Date(pickedDay.slice(0, 7) + '-01T12:00:00Z');
    const nowStr = formatFortalezaDateTime(Date.now());
    byId('deadline-hour').value = currentVal.slice(11, 13) || (activeDateField === 'receivedAt' ? nowStr.slice(11, 13) : meta.defaultHour);
    byId('deadline-minute').value = currentVal.slice(14, 16) || (activeDateField === 'receivedAt' ? nowStr.slice(14, 16) : meta.defaultMin);
    renderCalendar();
    picker.showModal();
  }

  function renderCalendar() {
    const year = calendarMonth.getUTCFullYear(), month = calendarMonth.getUTCMonth();
    byId('calendar-title').textContent = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(calendarMonth);
    const days = byId('calendar-days');
    days.replaceChildren();
    const offset = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
    for (let i = 0; i < offset; i++) days.append(node('span', ''));
    const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    for (let day = 1; day <= count; day++) {
      const value = dayString(new Date(Date.UTC(year, month, day)));
      const button = action(String(day), () => {
        pickedDay = value;
        renderCalendar();
        Array.from(days.querySelectorAll('button')).find(el => el.dataset.date === value)?.focus();
      });
      button.dataset.date = value;
      button.setAttribute('aria-label', new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(value + 'T12:00:00Z')));
      button.setAttribute('aria-pressed', String(pickedDay === value));
      if (value === fortalezaToday()) button.setAttribute('aria-current', 'date');
      days.append(button);
    }
    byId('calendar-selection').textContent = pickedDay
      ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(pickedDay + 'T12:00:00Z'))
      : 'Selecione uma data';
  }

  if (byId('deadline-hour') && byId('deadline-hour').options.length === 0) {
    for (let hour = 0; hour < 24; hour++) byId('deadline-hour').add(new Option(String(hour).padStart(2, '0'), String(hour).padStart(2, '0')));
    for (let minute = 0; minute < 60; minute++) byId('deadline-minute').add(new Option(String(minute).padStart(2, '0'), String(minute).padStart(2, '0')));
  }

  for (const [fieldName, meta] of Object.entries(dateFieldMeta)) {
    const btn = byId(meta.buttonId);
    if (btn) btn.onclick = () => openDatePickerFor(fieldName);
  }
  if (byId('received-now-btn')) {
    byId('received-now-btn').onclick = () => {
      if (fields.receivedAt) fields.receivedAt.value = formatFortalezaDateTime(Date.now());
      updateDeadlineButton();
    };
  }
  if (byId('calendar-now')) {
    byId('calendar-now').onclick = () => {
      const nowStr = formatFortalezaDateTime(Date.now());
      pickedDay = nowStr.slice(0, 10);
      calendarMonth = new Date(pickedDay.slice(0, 7) + '-01T12:00:00Z');
      byId('deadline-hour').value = nowStr.slice(11, 13);
      byId('deadline-minute').value = nowStr.slice(14, 16);
      renderCalendar();
    };
  }
  if (byId('calendar-prev')) byId('calendar-prev').onclick = () => { calendarMonth.setUTCMonth(calendarMonth.getUTCMonth() - 1); renderCalendar(); };
  if (byId('calendar-next')) byId('calendar-next').onclick = () => { calendarMonth.setUTCMonth(calendarMonth.getUTCMonth() + 1); renderCalendar(); };
  for (const [id, offset] of [['calendar-today', 0], ['calendar-tomorrow', 1]]) {
    const btn = byId(id);
    if (btn) {
      btn.onclick = () => {
        const date = new Date(fortalezaToday() + 'T12:00:00Z');
        date.setUTCDate(date.getUTCDate() + offset);
        pickedDay = dayString(date);
        calendarMonth = new Date(pickedDay.slice(0, 7) + '-01T12:00:00Z');
        renderCalendar();
      };
    }
  }
  if (byId('calendar-cancel')) byId('calendar-cancel').onclick = () => picker.close();
  if (byId('calendar-clear')) {
    byId('calendar-clear').onclick = () => {
      if (fields[activeDateField]) fields[activeDateField].value = '';
      updateDeadlineButton();
      picker.close();
    };
  }
  if (byId('calendar-apply')) {
    byId('calendar-apply').onclick = () => {
      if (fields[activeDateField]) {
        fields[activeDateField].value = pickedDay + 'T' + byId('deadline-hour').value + ':' + byId('deadline-minute').value;
      }
      updateDeadlineButton();
      picker.close();
    };
  }
  picker?.addEventListener('close', () => {
    const btnId = dateFieldMeta[activeDateField]?.buttonId;
    if (btnId) byId(btnId)?.focus();
  });

  if (byId('printer-category') && byId('printer-category').options.length <= 1) {
    for (const cat of printerCategories) byId('printer-category').add(new Option(cat, cat));
  }
  if (byId('manage-printers')) byId('manage-printers').onclick = () => openPrintersDialog();
  if (byId('editor-printer-manage-btn')) byId('editor-printer-manage-btn').onclick = () => openPrintersDialog();
  if (byId('printers-dialog-close')) byId('printers-dialog-close').onclick = () => byId('printers-dialog').close();
  if (byId('printers-done-btn')) byId('printers-done-btn').onclick = () => byId('printers-dialog').close();
  byId('printers-dialog')?.addEventListener('click', event => {
    if (event.target !== byId('printers-dialog')) return;
    const rect = byId('printers-dialog').getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
      byId('printers-dialog').close();
    }
  });
  if (byId('printer-cancel-edit')) {
    byId('printer-cancel-edit').onclick = () => {
      editingPrinterId = '';
      byId('printer-form')?.reset();
      if (byId('printer-save-btn')) byId('printer-save-btn').textContent = 'Cadastrar impressora';
      byId('printer-cancel-edit').hidden = true;
      if (byId('printer-form-error')) byId('printer-form-error').textContent = '';
    };
  }
  if (byId('printer-form')) {
    byId('printer-form').onsubmit = async e => {
      e.preventDefault();
      const errEl = byId('printer-form-error');
      if (errEl) errEl.textContent = '';
      const name = byId('printer-name')?.value || '';
      const category = byId('printer-category')?.value || '';
      const notes = byId('printer-notes')?.value || '';
      const saveBtn = byId('printer-save-btn');
      if (saveBtn) saveBtn.disabled = true;
      try {
        await savePrinterToCatalog({ id: editingPrinterId, name, category, notes });
        editingPrinterId = '';
        byId('printer-form').reset();
        if (saveBtn) saveBtn.textContent = 'Cadastrar impressora';
        if (byId('printer-cancel-edit')) byId('printer-cancel-edit').hidden = true;
      } catch (err) {
        if (errEl) errEl.textContent = err.message;
      } finally {
        if (saveBtn) saveBtn.disabled = false;
      }
    };
  }
  const quickAddPrinter = async () => {
    const inp = byId('editor-printer-add-input');
    const name = String(inp?.value || '').trim();
    if (!name) return;
    const btn = byId('editor-printer-add-btn');
    if (btn) btn.disabled = true;
    try {
      const saved = await savePrinterToCatalog({ name });
      draftPrinters = normalizePrinters([...draftPrinters, saved.name]);
      if (inp) inp.value = '';
      renderEditorPrinters();
    } catch (err) {
      const formErr = form.querySelector('.error');
      if (formErr) formErr.textContent = err.message;
    } finally {
      if (btn) btn.disabled = false;
    }
  };
  if (byId('editor-printer-add-btn')) byId('editor-printer-add-btn').onclick = quickAddPrinter;
  if (byId('editor-printer-add-input')) {
    byId('editor-printer-add-input').onkeydown = e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        quickAddPrinter();
      }
    };
  }
  if (byId('editor-item-add-btn')) byId('editor-item-add-btn').onclick = () => addDraftItemsFromInputs();
  if (byId('editor-item-number-input')) {
    byId('editor-item-number-input').onkeydown = e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addDraftItemsFromInputs();
      }
    };
    byId('editor-item-number-input').onblur = () => {
      const el = byId('editor-item-number-input');
      if (!el) return;
      const single = formatItemNumber(el.value);
      if (/^\d{6}$/.test(single)) el.value = single;
    };
  }
  if (byId('editor-item-label-input')) {
    byId('editor-item-label-input').onkeydown = e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addDraftItemsFromInputs();
      }
    };
  }
  if (byId('editor-reminder-add-btn')) byId('editor-reminder-add-btn').onclick = () => addDraftReminderFromInput();
  if (byId('editor-reminder-input')) {
    byId('editor-reminder-input').onkeydown = e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addDraftReminderFromInput();
      }
    };
  }
  if (byId('copy-mode')) {
    byId('copy-mode').value = copyMode;
    byId('copy-mode').onchange = () => setCopyMode(byId('copy-mode').value);
  }

  for (const [id, name] of Object.entries({
    new: 'add',
    'manage-printers': 'print',
    backup: 'download',
    restore: 'upload',
    refresh: 'refresh',
    'view-simple': 'view_list',
    'view-table': 'table_chart',
    'view-board': 'view_kanban',
    'view-list': 'view_agenda',
    'all-orders': 'filter_alt_off',
    'delete-order': 'delete',
    'choose-printed-at': 'calendar_month',
    'choose-received-at': 'calendar_month',
    'choose-production-date': 'calendar_month',
    'new-counter-top': 'add'
  })) {
    const targetEl = byId(id);
    if (targetEl && !targetEl.querySelector('.material-symbols-outlined')) {
      targetEl.prepend(icon(name));
    }
  }
  document.fonts?.load('24px "Material Symbols Outlined"').then(fonts => {
    if (fonts.length) document.body.classList.add('icons-ready');
  }).catch(() => {});

  // =========================================================================
  // ATENDIMENTO DE BALCÃO (Criação, Ajuste & Cronômetro — Sync + Backup)
  // =========================================================================

  const counterForm = byId('counter-form');
  const counterFields = counterForm ? counterForm.elements : null;
  const counterEditor = byId('counter-editor');
  const counterDeleteDialog = byId('counter-delete-dialog');

  if (counterFields?.status && counterFields.status.options.length === 0) {
    for (const st of counterStages) {
      counterFields.status.add(new Option(st, st));
      byId('counter-filter-status')?.add(new Option(st, st));
    }
  }

  function updateAreaBadges() {
    const activeOsCount = orders.filter(o => !isArchived(o)).length;
    const activeCounterCount = counterTickets.filter(t => !isCounterArchived(t)).length;
    const runningCount = counterTickets.filter(t => isCounterRunning(t)).length;
    if (byId('area-badge-os')) byId('area-badge-os').textContent = String(activeOsCount);
    if (byId('area-badge-counter')) byId('area-badge-counter').textContent = String(activeCounterCount);
    const runBadge = byId('area-badge-running');
    if (runBadge) {
      runBadge.hidden = runningCount === 0;
      runBadge.textContent = `● ${runningCount}`;
      runBadge.title = `${runningCount} cronômetro(s) rodando no balcão`;
    }
  }

  function setActiveArea(area) {
    activeArea = area === 'counter' ? 'counter' : 'os';
    const isCounter = activeArea === 'counter';
    byId('area-tab-os')?.classList.toggle('active', !isCounter);
    byId('area-tab-os')?.setAttribute('aria-selected', String(!isCounter));
    byId('area-tab-counter')?.classList.toggle('active', isCounter);
    byId('area-tab-counter')?.setAttribute('aria-selected', String(isCounter));
    if (byId('os-section')) byId('os-section').hidden = isCounter;
    if (byId('counter-section')) byId('counter-section').hidden = !isCounter;
    if (byId('new')) byId('new').hidden = isCounter;
    if (byId('new-counter-top')) byId('new-counter-top').hidden = !isCounter;
    if (byId('heading-eyebrow')) {
      byId('heading-eyebrow').textContent = isCounter
        ? '02 · BALCÃO · CRIAÇÃO, AJUSTE & CRONÔMETRO'
        : '01 · GESTÃO DE DESIGN & PRODUÇÃO';
    }
    if (byId('heading-title')) {
      byId('heading-title').innerHTML = isCounter
        ? 'Atendimento de balcão<span class="brand-dot">.</span>'
        : 'Ordens de serviço<span class="brand-dot">.</span>';
    }
    if (isCounter) renderCounter();
    else render();
  }

  async function refreshCounterTickets() {
    let list = [];
    if (storageMode === 'cloud' && cloudUser) {
      const remote = await cloudListCounterTickets();
      if (Array.isArray(remote)) {
        list = remote.map(normalizeCounterTicket);
      } else {
        list = await localListCounterTickets();
      }
    } else {
      list = await localListCounterTickets();
    }
    counterTickets = list;
    updateAreaBadges();
    renderCounter();
    return counterTickets;
  }

  async function saveCounterTicketRecord(input) {
    const err = validateCounterTicket(input);
    if (err) throw Error(err);
    let saved;
    if (storageMode === 'cloud' && cloudUser) {
      savingCloudLocally = true;
      try {
        saved = await cloudSaveCounterTicket(input);
      } finally {
        savingCloudLocally = false;
      }
      await localSaveCounterTicket({ ...saved, version: Math.max(0, (saved.version || 1) - 1) }).catch(() => {});
    } else {
      saved = await localSaveCounterTicket(input);
    }
    counterTickets = [saved, ...counterTickets.filter(t => t.id !== saved.id)];
    updateAreaBadges();
    renderCounter();
    return saved;
  }

  async function deleteCounterTicketRecord(ticket) {
    if (!ticket?.id) return;
    if (storageMode === 'cloud' && cloudUser) {
      savingCloudLocally = true;
      try {
        await cloudDeleteCounterTicket(ticket.id);
      } finally {
        savingCloudLocally = false;
      }
    }
    await localDeleteCounterTicket(ticket.id).catch(() => {});
    counterTickets = counterTickets.filter(t => t.id !== ticket.id);
    updateAreaBadges();
    renderCounter();
  }

  async function restoreCounterBackupRecords(incomingList, overwriteFlag, snapshot) {
    const plan = counterRestorePlan(incomingList, snapshot, overwriteFlag);
    if (!plan.length) return { count: 0 };
    if (storageMode === 'cloud' && cloudUser) {
      savingCloudLocally = true;
      try {
        await cloudRestoreCounterTickets(incomingList, overwriteFlag, snapshot);
      } finally {
        savingCloudLocally = false;
      }
    }
    await localRestoreCounterTickets(plan).catch(() => {});
    return { count: plan.length };
  }

  function counterFilters() {
    return {
      archived: counterQueueMode === 'archived',
      search: byId('counter-search')?.value || '',
      serviceType: byId('counter-filter-service')?.value || '',
      status: byId('counter-filter-status')?.value || '',
      channel: byId('counter-filter-channel')?.value || '',
      urgent: byId('counter-filter-urgent')?.value || ''
    };
  }

  function formatDurationShort(ms) {
    const totalMin = Math.floor(Math.max(0, Number(ms) || 0) / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
    return `${m} min`;
  }

  function computeTodayTrackedMs(now = Date.now()) {
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: workTimeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    let total = 0;
    for (const t of counterTickets) {
      const updatedDay = t.updated && Number.isFinite(Date.parse(t.updated))
        ? new Intl.DateTimeFormat('en-CA', { timeZone: workTimeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(Date.parse(t.updated))
        : '';
      if (isCounterRunning(t) || updatedDay === todayStr) {
        total += counterElapsed(t, now);
      }
    }
    return total;
  }

  function renderCounterMetrics() {
    const box = byId('counter-metrics');
    if (!box) return;
    const now = Date.now();
    const activeList = counterTickets.filter(t => !isCounterArchived(t));
    const runningCount = activeList.filter(isCounterRunning).length;
    const waitingCount = activeList.filter(t => t.status === 'Aguardando').length;
    const inProgressCount = activeList.filter(t => t.status === 'Em criação' || t.status === 'Em ajuste').length;
    const approvalCount = activeList.filter(t => t.status === 'Aguardando aprovação').length;
    const convertedCount = counterTickets.filter(t => t.status === 'Convertido em OS').length;
    const todayMs = computeTodayTrackedMs(now);

    box.replaceChildren();
    const cards = [
      { label: 'Em criação / ajuste', val: String(inProgressCount), tone: 'active', click: () => { setCounterQueueMode('active'); if (byId('counter-filter-status')) byId('counter-filter-status').value = ''; renderCounter(); } },
      { label: 'Aguardando', val: String(waitingCount), tone: '', click: () => { setCounterQueueMode('active'); if (byId('counter-filter-status')) byId('counter-filter-status').value = 'Aguardando'; renderCounter(); } },
      { label: 'Aguardando aprovação', val: String(approvalCount), tone: 'proof', click: () => { setCounterQueueMode('active'); if (byId('counter-filter-status')) byId('counter-filter-status').value = 'Aguardando aprovação'; renderCounter(); } },
      { label: 'Cronômetro rodando', val: String(runningCount), tone: runningCount > 0 ? 'running' : '', click: () => { setCounterQueueMode('active'); if (byId('counter-filter-urgent')) byId('counter-filter-urgent').value = runningCount > 0 ? 'running' : ''; renderCounter(); } },
      { label: 'Tempo registrado hoje', val: formatStopwatch(todayMs), tone: 'mono', id: 'counter-kpi-today-time', click: null },
      { label: 'Convertidos em OS', val: String(convertedCount), tone: 'ok', click: () => { setCounterQueueMode('archived'); if (byId('counter-filter-status')) byId('counter-filter-status').value = 'Convertido em OS'; renderCounter(); } }
    ];

    for (const c of cards) {
      const el = c.click ? document.createElement('button') : document.createElement('div');
      if (c.click) {
        el.type = 'button';
        el.onclick = c.click;
      }
      el.className = 'counter-kpi-card' + (c.tone ? ' is-' + c.tone : '');
      const valNode = node('strong', c.val, c.tone === 'mono' ? 'counter-timer-digits' : '');
      if (c.id) valNode.id = c.id;
      el.append(valNode, node('span', c.label));
      box.append(el);
    }
  }

  function setCounterQueueMode(nextMode) {
    counterQueueMode = nextMode === 'archived' ? 'archived' : 'active';
    byId('counter-tab-active')?.setAttribute('aria-pressed', String(counterQueueMode === 'active'));
    byId('counter-tab-archived')?.setAttribute('aria-pressed', String(counterQueueMode === 'archived'));
    const statusSel = byId('counter-filter-status');
    if (statusSel && statusSel.value) {
      if (counterQueueMode === 'active' && isCounterArchivedStatus(statusSel.value)) statusSel.value = '';
      if (counterQueueMode === 'archived' && !isCounterArchivedStatus(statusSel.value)) statusSel.value = '';
    }
    renderCounter();
  }

  async function mutateCounterTicket(ticket, patch, successMsg = '') {
    if (counterWriting || !ticket) return;
    counterWriting = true;
    try {
      const latest = counterTickets.find(t => t.id === ticket.id) || ticket;
      await saveCounterTicketRecord({ ...latest, ...patch });
      if (successMsg && byId('message')) byId('message').textContent = successMsg;
    } catch (err) {
      if (byId('message')) byId('message').textContent = err.message;
    } finally {
      counterWriting = false;
    }
  }

  function toggleCounterTimerOnCard(ticket) {
    if (!ticket) return;
    const now = Date.now();
    if (isCounterRunning(ticket)) {
      const patch = stopCounterTimerPatch(ticket, now, counterServiceLabel(ticket.serviceType));
      mutateCounterTicket(ticket, patch, `Cronômetro pausado (${formatStopwatch(patch.elapsedMs)}).`);
    } else {
      const patch = startCounterTimerPatch(ticket, now);
      mutateCounterTicket(ticket, patch, `Cronômetro iniciado em ${ticket.code}.`);
    }
  }

  function promoteCounterToFormalOs(ticket) {
    if (!ticket) return;
    const now = Date.now();
    const totalMs = counterElapsed(ticket, now);
    const numPrefill = ticket.clientNumber && ticket.orderNumber
      ? formatOrderNumber(`${ticket.clientNumber}-${ticket.orderNumber}`)
      : ticket.clientNumber
        ? `${ticket.clientNumber}-`
        : '';

    const noteLines = [
      `[Origem: Atendimento de Balcão ${ticket.code}]`,
      ticket.customerName ? `Cliente/Solicitante: ${ticket.customerName}${ticket.customerContact ? ' (' + ticket.customerContact + ')' : ''}` : '',
      `Serviço: ${counterServiceLabel(ticket.serviceType)} · Canal: ${counterChannelLabel(ticket.channel)} · Arquivo: ${counterFileStatusLabel(ticket.fileStatus)}`,
      `Tempo cronometrado no balcão: ${formatStopwatch(totalMs)} (${ticket.revisionsCount || 0} ajuste(s))`,
      ticket.briefing ? '\nBriefing do balcão:\n' + ticket.briefing : ''
    ].filter(Boolean);

    promotingCounterId = ticket.id;
    if (counterEditor?.open) counterEditor.close();
    edit({
      number: numPrefill,
      title: ticket.title || normalizeTitle(ticket.customerName || counterServiceLabel(ticket.serviceType)),
      status: 'Processando',
      urgent: !!ticket.urgent,
      owner: ticket.attendant || '',
      notes: noteLines.join('\n'),
      attachments: normalizeAttachments(ticket.attachments || []),
      elapsedMs: totalMs
    });
    if (byId('caption')) {
      byId('caption').textContent = `Converter ${ticket.code} em OS Formal`;
    }
  }

  function renderCounter() {
    updateAreaBadges();
    renderCounterMetrics();
    const rowsEl = byId('counter-rows');
    const countEl = byId('counter-count');
    const clearBtn = byId('counter-clear');
    if (!rowsEl) return;

    const f = counterFilters();
    const sortBy = byId('counter-sort')?.value || 'smart';
    const visible = sortCounterTickets(filterCounterTickets(counterTickets, f), sortBy);
    const hasFilter = Boolean(f.search || f.serviceType || f.status || f.channel || f.urgent);
    if (clearBtn) clearBtn.hidden = !hasFilter;
    if (countEl) {
      const label = counterQueueMode === 'archived' ? 'finalizado(s) / convertido(s)' : 'ativo(s) no balcão';
      countEl.textContent = `${visible.length} atendimento(s) ${label}` + (hasFilter ? ' (filtrado)' : '');
    }

    rowsEl.replaceChildren();
    if (!visible.length) {
      const empty = node('div', '', 'counter-empty-state');
      empty.append(
        node('strong', counterQueueMode === 'archived' ? 'Nenhum atendimento finalizado ou convertido ainda.' : 'Nenhum atendimento de balcão ativo no momento.'),
        node('p', 'Registre criações de arte, ajustes de arquivo e atendimentos rápidos mesmo sem número de cliente ou pedido — e cronometre o trabalho em tempo real.')
      );
      if (counterQueueMode === 'active') {
        const cta = action('+ Novo atendimento de balcão', () => openCounterEditor());
        cta.className = 'primary';
        empty.append(cta);
      }
      rowsEl.append(empty);
      return;
    }

    const now = Date.now();
    for (const ticket of visible) {
      const running = isCounterRunning(ticket);
      const archived = isCounterArchived(ticket);
      const elapsedVal = counterElapsed(ticket, now);
      const card = node(
        'article',
        '',
        'counter-card' +
          (running ? ' is-running' : '') +
          (ticket.urgent && !archived ? ' is-urgent' : '') +
          (ticket.status === 'Pausado' ? ' is-paused' : '') +
          (archived ? ' is-archived' : '')
      );

      // Header: code + badges + urgent
      const top = node('div', '', 'counter-card-top');
      const idGroup = node('div', '', 'counter-card-idgroup');
      idGroup.append(node('span', ticket.code || 'BAL', 'counter-code-pill'));
      idGroup.append(node('span', counterServiceLabel(ticket.serviceType), 'counter-service-pill type-' + ticket.serviceType));
      if (ticket.urgent && !archived) {
        idGroup.append(node('span', 'Balcão urgente', 'notion-pill urgent-pill'));
      }
      if (ticket.linkedOsNumber) {
        const osBtn = action(`OS ${ticket.linkedOsNumber} ↗`, () => {
          setActiveArea('os');
          openDetail(ticket.linkedOsNumber);
        });
        osBtn.className = 'counter-linked-os-btn';
        osBtn.title = 'Abrir Ordem de Serviço formal vinculada';
        idGroup.append(osBtn);
      }
      top.append(idGroup);

      // Inline Status select
      const statusSel = node('select', '', 'counter-status-select');
      statusSel.setAttribute('aria-label', 'Status de ' + ticket.code);
      for (const st of counterStages) statusSel.add(new Option(st, st));
      statusSel.value = ticket.status;
      statusSel.onchange = () => {
        const nextStatus = statusSel.value;
        const patch = { status: nextStatus };
        if (isCounterRunning(ticket) && (isCounterHoldStatus(nextStatus) || isCounterArchivedStatus(nextStatus))) {
          Object.assign(patch, stopCounterTimerPatch(ticket, Date.now(), `Status → ${nextStatus}`));
        }
        mutateCounterTicket(ticket, patch, `${ticket.code}: status alterado para ${nextStatus}.`);
      };
      top.append(statusSel);
      card.append(top);

      // Title + customer/optional IDs
      const body = node('div', '', 'counter-card-body');
      const titleBtn = node('button', ticket.title || (ticket.customerName ? normalizeTitle(ticket.customerName) : 'ATENDIMENTO SEM TÍTULO'), 'counter-card-title');
      titleBtn.type = 'button';
      titleBtn.onclick = () => openCounterEditor(ticket);
      body.append(titleBtn);

      const metaRow = node('div', '', 'counter-card-meta');
      if (ticket.customerName) {
        metaRow.append(node('span', '👤 ' + ticket.customerName + (ticket.customerContact ? ` · ${ticket.customerContact}` : ''), 'counter-meta-chip'));
      } else if (ticket.customerContact) {
        metaRow.append(node('span', '☎ ' + ticket.customerContact, 'counter-meta-chip'));
      } else {
        metaRow.append(node('span', '👤 Cliente avulso (balcão)', 'counter-meta-chip is-muted'));
      }
      metaRow.append(node('span', counterChannelLabel(ticket.channel), 'counter-meta-chip'));
      metaRow.append(node('span', counterFileStatusLabel(ticket.fileStatus), 'counter-meta-chip'));
      if (ticket.clientNumber || ticket.orderNumber) {
        const idTxt = [
          ticket.clientNumber ? `Cli ${ticket.clientNumber}` : '',
          ticket.orderNumber ? `Ped ${ticket.orderNumber}` : ''
        ].filter(Boolean).join(' · ');
        metaRow.append(node('span', idTxt, 'counter-meta-chip is-id'));
      } else {
        metaRow.append(node('span', 'Sem nº cliente/pedido', 'counter-meta-chip is-muted'));
      }
      if (ticket.attendant) {
        metaRow.append(node('span', '🎨 ' + ticket.attendant, 'counter-meta-chip'));
      }
      if (ticket.attachments?.length) {
        metaRow.append(node('span', `📎 ${ticket.attachments.length} anexo(s)`, 'counter-meta-chip'));
      }
      body.append(metaRow);

      if (ticket.briefing) {
        const brief = node('p', ticket.briefing.length > 220 ? ticket.briefing.slice(0, 218) + '…' : ticket.briefing, 'counter-card-briefing');
        body.append(brief);
      }
      card.append(body);

      // Stopwatch Strip
      const timerBar = node('div', '', 'counter-stopwatch-bar' + (running ? ' is-running' : ''));
      const timerLeft = node('div', '', 'counter-stopwatch-readout');
      const digits = node('strong', formatStopwatch(elapsedVal), 'counter-timer-digits');
      digits.dataset.counterTimerId = ticket.id;
      const timerMeta = node(
        'small',
        [
          running ? 'Rodando agora' : (elapsedVal > 0 ? 'Pausado' : 'Não iniciado'),
          ticket.estimatedMinutes > 0 ? `Est. ${ticket.estimatedMinutes} min` : '',
          `${ticket.revisionsCount || 0} ajuste(s)`
        ].filter(Boolean).join(' · ')
      );
      timerLeft.append(digits, timerMeta);

      const timerControls = node('div', '', 'counter-stopwatch-controls');
      if (!archived) {
        const playBtn = action(running ? '⏸ Pausar' : '▶ Iniciar', () => toggleCounterTimerOnCard(ticket));
        playBtn.className = 'counter-timer-btn' + (running ? ' is-stop' : ' primary');
        timerControls.append(playBtn);

        const revBtn = action('+1 Ajuste', () => {
          mutateCounterTicket(ticket, {
            revisionsCount: Math.min(99, (ticket.revisionsCount || 0) + 1),
            status: ticket.status === 'Aguardando' || ticket.status === 'Aguardando aprovação' ? 'Em ajuste' : ticket.status
          }, `${ticket.code}: ${(ticket.revisionsCount || 0) + 1} ajuste(s) registrado(s).`);
        });
        revBtn.className = 'counter-rev-btn';
        revBtn.title = 'Registrar nova rodada de ajuste solicitada pelo cliente';
        timerControls.append(revBtn);
      }
      timerBar.append(timerLeft, timerControls);

      if (ticket.estimatedMinutes > 0) {
        const pct = Math.min(100, Math.round((elapsedVal / (ticket.estimatedMinutes * 60000)) * 100));
        const over = elapsedVal > ticket.estimatedMinutes * 60000;
        const progWrap = node('div', '', 'counter-est-progress');
        const fill = node('div', '', 'counter-est-fill' + (over ? ' is-over' : ''));
        fill.style.width = `${pct}%`;
        progWrap.append(fill);
        timerBar.append(progWrap);
      }
      card.append(timerBar);

      // Footer actions
      const foot = node('div', '', 'counter-card-actions');
      if (!ticket.linkedOsNumber && ticket.status !== 'Cancelado') {
        const promoteBtn = action('↗ Gerar OS Formal', () => promoteCounterToFormalOs(ticket));
        promoteBtn.className = 'counter-promote-btn';
        foot.append(promoteBtn);
      }
      if (!archived) {
        const finishBtn = action('✓ Finalizar', () => {
          const patch = {
            ...stopCounterTimerPatch(ticket, Date.now(), 'Finalizado no balcão'),
            status: 'Finalizado'
          };
          mutateCounterTicket(ticket, patch, `${ticket.code} finalizado no balcão.`);
        });
        foot.append(finishBtn);
      }
      const editBtn = action('Editar', () => openCounterEditor(ticket));
      const delBtn = action('Excluir', () => askDeleteCounter(ticket));
      delBtn.className = 'danger-text';
      foot.append(editBtn, delBtn);
      card.append(foot);

      rowsEl.append(card);
    }
  }

  function updateCounterModalTimerUi() {
    const readout = byId('counter-modal-timer-readout');
    const toggleBtn = byId('counter-modal-timer-toggle');
    const sub = byId('counter-modal-timer-sub');
    const box = byId('counter-modal-timer-box');
    const running = draftCounterTimer.startedAt > 0;
    const ms = counterElapsed(draftCounterTimer, Date.now());
    if (readout) readout.textContent = formatStopwatch(ms);
    if (toggleBtn) {
      toggleBtn.textContent = running ? '⏸ Pausar' : '▶ Iniciar';
      toggleBtn.classList.toggle('primary', !running);
      toggleBtn.classList.toggle('is-stop', running);
    }
    if (box) box.classList.toggle('is-running', running);
    if (sub) {
      sub.textContent = running
        ? 'Cronômetro em andamento — o tempo será salvo junto com o atendimento.'
        : ms > 0
          ? `Tempo acumulado: ${formatDurationShort(ms)} (${draftCounterTimer.sessions.length} sessão(ões)).`
          : 'Inicie para medir o tempo de criação ou ajuste em tempo real.';
    }
    const sessBox = byId('counter-sessions-box');
    const sessList = byId('counter-sessions-list');
    if (sessBox && sessList) {
      const sessions = draftCounterTimer.sessions || [];
      sessBox.hidden = sessions.length === 0;
      sessList.replaceChildren();
      for (const s of [...sessions].reverse().slice(0, 8)) {
        const li = node('li', '');
        const when = s.startedAt ? dateFormat.format(new Date(s.startedAt)) : '';
        li.append(
          node('strong', formatStopwatch(s.durationMs), 'counter-timer-digits'),
          node('span', [s.note, when].filter(Boolean).join(' · '))
        );
        sessList.append(li);
      }
    }
  }

  function renderCounterEditorAttachments() {
    const listEl = byId('counter-attach-list');
    if (!listEl) return;
    listEl.replaceChildren();
    if (!draftCounterAttachments.length) {
      listEl.append(node('p', 'Nenhum arquivo ou referência anexado neste atendimento.', 'attach-empty'));
      return;
    }
    for (const att of draftCounterAttachments) {
      listEl.append(createAttachmentCard(att, {
        removable: true,
        onRemove: () => {
          draftCounterAttachments = draftCounterAttachments.filter(item => item !== att);
          pendingDeleteCounterAttachments.push(att);
          renderCounterEditorAttachments();
        }
      }));
    }
  }

  function openCounterEditor(ticket = null) {
    if (!counterForm || !counterEditor || !counterFields) return;
    counterForm.reset();
    editingCounter = ticket ? normalizeCounterTicket(ticket) : null;
    const isEdit = Boolean(editingCounter?.id);

    counterFields.title.value = editingCounter?.title || '';
    counterFields.serviceType.value = editingCounter?.serviceType || 'criacao';
    counterFields.customerName.value = editingCounter?.customerName || '';
    counterFields.customerContact.value = editingCounter?.customerContact || '';
    counterFields.status.value = editingCounter?.status || 'Aguardando';
    counterFields.channel.value = editingCounter?.channel || 'balcao';
    counterFields.fileStatus.value = editingCounter?.fileStatus || 'cliente_trouxe';
    counterFields.attendant.value = editingCounter?.attendant || '';
    counterFields.clientNumber.value = editingCounter?.clientNumber || '';
    counterFields.orderNumber.value = editingCounter?.orderNumber || '';
    counterFields.estimatedMinutes.value = editingCounter?.estimatedMinutes ? String(editingCounter.estimatedMinutes) : '';
    counterFields.revisionsCount.value = String(editingCounter?.revisionsCount || 0);
    counterFields.urgent.checked = Boolean(editingCounter?.urgent);
    counterFields.briefing.value = editingCounter?.briefing || '';

    draftCounterTimer = {
      elapsedMs: editingCounter?.elapsedMs || 0,
      startedAt: editingCounter?.startedAt || 0,
      sessions: [...(editingCounter?.sessions || [])]
    };
    draftCounterAttachments = normalizeAttachments(editingCounter?.attachments || []);
    pendingDeleteCounterAttachments = [];
    draftCounterAttachBusy = false;

    const statusEl = byId('counter-attach-status');
    if (statusEl) {
      statusEl.hidden = true;
      statusEl.innerHTML = '';
    }
    if (byId('counter-form-error')) byId('counter-form-error').textContent = '';
    if (byId('counter-caption')) {
      byId('counter-caption').textContent = isEdit ? `Editar ${editingCounter.code}` : 'Novo atendimento de balcão';
    }
    if (byId('counter-delete-btn')) byId('counter-delete-btn').hidden = !isEdit;
    if (byId('counter-promote-btn')) byId('counter-promote-btn').hidden = !isEdit || Boolean(editingCounter?.linkedOsNumber);

    updateCounterModalTimerUi();
    renderCounterEditorAttachments();
    counterEditor.showModal();
    const bodyEl = counterEditor.querySelector('.dialog-body');
    if (bodyEl) bodyEl.scrollTop = 0;
    counterFields.title.focus();
  }

  function askDeleteCounter(ticket) {
    if (!ticket || !counterDeleteDialog) return;
    deletingCounter = ticket;
    if (byId('counter-delete-description')) {
      byId('counter-delete-description').textContent = `Excluir ${ticket.code}${ticket.title ? ' — ' + ticket.title : ''}${ticket.customerName ? ' (' + ticket.customerName + ')' : ''}?`;
    }
    if (byId('counter-delete-error')) byId('counter-delete-error').textContent = '';
    counterDeleteDialog.showModal();
    byId('counter-delete-cancel')?.focus();
  }

  // Bindings — Area switcher & Counter filters
  if (byId('area-tab-os')) byId('area-tab-os').onclick = () => setActiveArea('os');
  if (byId('area-tab-counter')) byId('area-tab-counter').onclick = () => setActiveArea('counter');
  if (byId('new-counter-top')) byId('new-counter-top').onclick = () => openCounterEditor();
  if (byId('counter-tab-active')) byId('counter-tab-active').onclick = () => setCounterQueueMode('active');
  if (byId('counter-tab-archived')) byId('counter-tab-archived').onclick = () => setCounterQueueMode('archived');
  if (byId('counter-search')) byId('counter-search').oninput = () => renderCounter();
  for (const id of ['counter-filter-service', 'counter-filter-status', 'counter-filter-channel', 'counter-filter-urgent', 'counter-sort']) {
    if (byId(id)) {
      byId(id).onchange = () => {
        if (id === 'counter-filter-status') {
          const val = byId(id).value;
          if (val && isCounterArchivedStatus(val) && counterQueueMode !== 'archived') {
            setCounterQueueMode('archived');
            byId(id).value = val;
          } else if (val && !isCounterArchivedStatus(val) && counterQueueMode === 'archived') {
            setCounterQueueMode('active');
            byId(id).value = val;
          }
        }
        renderCounter();
      };
    }
  }
  if (byId('counter-clear')) {
    byId('counter-clear').onclick = () => {
      if (byId('counter-search')) byId('counter-search').value = '';
      for (const id of ['counter-filter-service', 'counter-filter-status', 'counter-filter-channel', 'counter-filter-urgent']) {
        if (byId(id)) byId(id).value = '';
      }
      renderCounter();
    };
  }

  // Bindings — Counter modal timer controls
  if (byId('counter-modal-timer-toggle')) {
    byId('counter-modal-timer-toggle').onclick = () => {
      const now = Date.now();
      if (draftCounterTimer.startedAt > 0) {
        const stopPatch = stopCounterTimerPatch(
          { ...draftCounterTimer, serviceType: counterFields?.serviceType?.value || 'criacao' },
          now,
          counterServiceLabel(counterFields?.serviceType?.value || 'criacao')
        );
        draftCounterTimer = { ...draftCounterTimer, ...stopPatch };
      } else {
        const startPatch = startCounterTimerPatch(
          { ...draftCounterTimer, status: counterFields?.status?.value || 'Aguardando', serviceType: counterFields?.serviceType?.value || 'criacao' },
          now
        );
        draftCounterTimer.startedAt = startPatch.startedAt || now;
        if (counterFields?.status && startPatch.status) counterFields.status.value = startPatch.status;
      }
      updateCounterModalTimerUi();
    };
  }
  if (byId('counter-modal-timer-add5')) {
    byId('counter-modal-timer-add5').onclick = () => {
      draftCounterTimer.elapsedMs += 5 * 60 * 1000;
      updateCounterModalTimerUi();
    };
  }
  if (byId('counter-modal-timer-add15')) {
    byId('counter-modal-timer-add15').onclick = () => {
      draftCounterTimer.elapsedMs += 15 * 60 * 1000;
      updateCounterModalTimerUi();
    };
  }
  if (byId('counter-modal-timer-reset')) {
    byId('counter-modal-timer-reset').onclick = () => {
      draftCounterTimer = { elapsedMs: 0, startedAt: 0, sessions: [] };
      updateCounterModalTimerUi();
    };
  }

  // Uppercase auto on counter title + digits-only on optional client/order
  if (counterFields?.title) {
    counterFields.title.oninput = () => {
      const s = counterFields.title.selectionStart;
      const e = counterFields.title.selectionEnd;
      const upper = counterFields.title.value.toLocaleUpperCase('pt-BR');
      if (upper !== counterFields.title.value) {
        counterFields.title.value = upper;
        if (typeof s === 'number' && typeof e === 'number') counterFields.title.setSelectionRange(s, e);
      }
    };
  }
  if (counterFields?.clientNumber) {
    counterFields.clientNumber.oninput = () => {
      counterFields.clientNumber.value = counterFields.clientNumber.value.replace(/\D/g, '').slice(0, 4);
    };
  }
  if (counterFields?.orderNumber) {
    counterFields.orderNumber.oninput = () => {
      counterFields.orderNumber.value = counterFields.orderNumber.value.replace(/\D/g, '').slice(0, 6);
    };
  }

  // Bindings — Counter modal attachments (Drive / Supabase Storage)
  const handleCounterPickedFiles = async files => {
    const statusEl = byId('counter-attach-status');
    draftCounterAttachBusy = true;
    if (byId('counter-save-btn')) byId('counter-save-btn').disabled = true;
    try {
      await uploadFilesBatch(files, editingCounter?.code || 'BAL-RASCUNHO', {
        statusEl,
        onUploaded: item => {
          draftCounterAttachments.push(item);
          renderCounterEditorAttachments();
        }
      });
    } finally {
      draftCounterAttachBusy = false;
      if (byId('counter-save-btn')) byId('counter-save-btn').disabled = false;
    }
  };

  if (byId('counter-attach-input')) {
    byId('counter-attach-input').onchange = async () => {
      const inp = byId('counter-attach-input');
      if (inp.files?.length) await handleCounterPickedFiles(inp.files);
      inp.value = '';
    };
  }
  if (byId('counter-attach-dropzone')) {
    const dz = byId('counter-attach-dropzone');
    dz.ondragover = e => { e.preventDefault(); dz.classList.add('is-drag-over'); };
    dz.ondragleave = () => dz.classList.remove('is-drag-over');
    dz.ondrop = async e => {
      e.preventDefault();
      dz.classList.remove('is-drag-over');
      if (e.dataTransfer?.files?.length) await handleCounterPickedFiles(e.dataTransfer.files);
    };
  }
  counterForm?.addEventListener('paste', async e => {
    const files = Array.from(e.clipboardData?.files || []).filter(isSupportedAttachment);
    if (!files.length) return;
    e.preventDefault();
    await handleCounterPickedFiles(files);
  });

  // Bindings — Counter editor close / delete / promote / submit
  if (counterEditor) {
    for (const btn of counterEditor.querySelectorAll('.counter-close')) {
      btn.onclick = () => counterEditor.close();
    }
  }
  if (byId('counter-delete-btn')) {
    byId('counter-delete-btn').onclick = () => {
      if (editingCounter) askDeleteCounter(editingCounter);
    };
  }
  if (byId('counter-promote-btn')) {
    byId('counter-promote-btn').onclick = () => {
      if (!editingCounter) return;
      const merged = normalizeCounterTicket({
        ...editingCounter,
        title: counterFields.title.value,
        serviceType: counterFields.serviceType.value,
        customerName: counterFields.customerName.value,
        customerContact: counterFields.customerContact.value,
        channel: counterFields.channel.value,
        fileStatus: counterFields.fileStatus.value,
        attendant: counterFields.attendant.value,
        clientNumber: counterFields.clientNumber.value,
        orderNumber: counterFields.orderNumber.value,
        urgent: counterFields.urgent.checked,
        briefing: counterFields.briefing.value,
        revisionsCount: Number(counterFields.revisionsCount.value || 0),
        elapsedMs: draftCounterTimer.elapsedMs,
        startedAt: draftCounterTimer.startedAt,
        sessions: draftCounterTimer.sessions,
        attachments: draftCounterAttachments
      });
      promoteCounterToFormalOs(merged);
    };
  }

  if (counterForm) {
    counterForm.onsubmit = async e => {
      e.preventDefault();
      if (draftCounterAttachBusy) return;
      const errEl = byId('counter-form-error');
      if (errEl) errEl.textContent = '';

      const nextStatus = counterFields.status.value;
      let timerPatch = {
        elapsedMs: draftCounterTimer.elapsedMs,
        startedAt: draftCounterTimer.startedAt,
        sessions: draftCounterTimer.sessions
      };
      if (timerPatch.startedAt > 0 && (isCounterHoldStatus(nextStatus) || isCounterArchivedStatus(nextStatus))) {
        timerPatch = stopCounterTimerPatch(
          { ...timerPatch, serviceType: counterFields.serviceType.value },
          Date.now(),
          `Status → ${nextStatus}`
        );
      }

      const payload = {
        ...(editingCounter || {}),
        version: editingCounter?.version || 0,
        title: normalizeTitle(counterFields.title.value || ''),
        serviceType: counterFields.serviceType.value,
        customerName: counterFields.customerName.value.trim(),
        customerContact: counterFields.customerContact.value.trim(),
        status: nextStatus,
        channel: counterFields.channel.value,
        fileStatus: counterFields.fileStatus.value,
        attendant: counterFields.attendant.value.trim(),
        clientNumber: counterFields.clientNumber.value.replace(/\D/g, '').slice(0, 4),
        orderNumber: counterFields.orderNumber.value.replace(/\D/g, '').slice(0, 6),
        estimatedMinutes: Number(counterFields.estimatedMinutes.value || 0) || 0,
        revisionsCount: Number(counterFields.revisionsCount.value || 0) || 0,
        urgent: counterFields.urgent.checked,
        briefing: counterFields.briefing.value.trim(),
        ...timerPatch,
        attachments: normalizeAttachments(draftCounterAttachments)
      };

      const validationErr = validateCounterTicket(payload);
      if (validationErr) {
        if (errEl) errEl.textContent = validationErr;
        return;
      }

      if (byId('counter-save-btn')) byId('counter-save-btn').disabled = true;
      try {
        const saved = await saveCounterTicketRecord(payload);
        if (pendingDeleteCounterAttachments.length) {
          const toClean = [...pendingDeleteCounterAttachments];
          pendingDeleteCounterAttachments = [];
          Promise.allSettled(toClean.map(deleteCloudAttachment));
        }
        counterEditor.close();
        if (byId('message')) byId('message').textContent = `Atendimento ${saved.code} salvo e sincronizado.`;
      } catch (err) {
        if (errEl) errEl.textContent = err.message;
      } finally {
        if (byId('counter-save-btn')) byId('counter-save-btn').disabled = false;
      }
    };
  }

  if (byId('counter-delete-cancel')) byId('counter-delete-cancel').onclick = () => counterDeleteDialog?.close();
  if (byId('counter-delete-form')) {
    byId('counter-delete-form').onsubmit = async e => {
      e.preventDefault();
      if (!deletingCounter) return;
      const target = deletingCounter;
      const confirmBtn = byId('counter-delete-confirm');
      if (confirmBtn) confirmBtn.disabled = true;
      try {
        await deleteCounterTicketRecord(target);
        if (target.attachments?.length) {
          Promise.allSettled(target.attachments.map(deleteCloudAttachment));
        }
        counterDeleteDialog?.close();
        if (counterEditor?.open && editingCounter?.id === target.id) counterEditor.close();
        deletingCounter = null;
        if (byId('message')) byId('message').textContent = `Atendimento ${target.code} excluído.`;
      } catch (err) {
        if (byId('counter-delete-error')) byId('counter-delete-error').textContent = err.message;
      } finally {
        if (confirmBtn) confirmBtn.disabled = false;
      }
    };
  }

  // Live 1-second stopwatch ticker (zero DOM-reflow / never steals focus)
  setInterval(() => {
    const now = Date.now();
    const anyRunning = counterTickets.some(isCounterRunning);
    if (anyRunning) {
      for (const el of document.querySelectorAll('[data-counter-timer-id]')) {
        const ticket = counterTickets.find(t => t.id === el.dataset.counterTimerId);
        if (ticket && isCounterRunning(ticket)) {
          el.textContent = formatStopwatch(counterElapsed(ticket, now));
        }
      }
      const kpiToday = byId('counter-kpi-today-time');
      if (kpiToday) kpiToday.textContent = formatStopwatch(computeTodayTrackedMs(now));
    }
    if (counterEditor?.open && draftCounterTimer.startedAt > 0) {
      const modalReadout = byId('counter-modal-timer-readout');
      if (modalReadout) modalReadout.textContent = formatStopwatch(counterElapsed(draftCounterTimer, now));
    }
  }, 1000);

  if (typeof document !== 'undefined' && byId('search')) {
    document.addEventListener('keydown', event => {
      if (!isViewActive() || document.querySelector('dialog[open]')) return;
      const active = document.activeElement;
      const tag = active?.tagName;
      const activeSearch = activeArea === 'counter' ? byId('counter-search') : byId('search');
      if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || active?.isContentEditable) return;
        event.preventDefault();
        activeSearch?.focus();
        activeSearch?.select?.();
      } else if (event.key === 'Escape' && active === activeSearch) {
        if (activeSearch.value) {
          activeSearch.value = '';
          if (activeArea === 'counter') renderCounter();
          else render();
        } else {
          activeSearch.blur();
        }
      }
    });
  }

  function onActivate() {
    if (storageMode === 'cloud' && !cloudUser) {
      openLoginDialog();
    } else if (storageMode === 'cloud' && cloudUser && !loaded) {
      refresh().catch(() => {});
    }
  }

  start();

  return {
    refresh,
    edit,
    openCounterEditor,
    setActiveArea,
    onActivate,
    openDriveBackup: openDriveBackupDialog,
    applyCloudPrefs,
    openLogin: openLoginDialog,
    signOut: async () => {
      await signOutCloud();
      await handleCloudAuthState(null);
    },
    connectDrive: async () => {
      await requestDriveAccessToken({ prompt: 'auto', loginHint: cloudUser?.email || '' });
      updateCloudBarUI();
    },
    setSearch: (q) => {
      if (byId('search')) {
        byId('search').value = q;
        render();
      }
    }
  };
}

// Auto-initialize when loaded directly in /os-maneger/index.html
if (typeof document !== 'undefined' && document.getElementById('rows') && !document.getElementById('suiteViewFolha')) {
  initOsManager();
              }
