export function validDeadline(value) {
  if (!value) return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(value)) return false;
  const [date, time] = value.split('T');
  const parsed = new Date(date + 'T00:00:00Z');
  return Number.isFinite(+parsed) && parsed.toISOString().slice(0, 10) === date && (!time || (Number(time.slice(0, 2)) < 24 && Number(time.slice(3)) < 60));
}

export const PRINT_DEADLINE_MAX_HOURS = 24;
const PRINT_DEADLINE_MAX_MS = PRINT_DEADLINE_MAX_HOURS * 3600 * 1000;

export function parseFortalezaDateTime(value) {
  if (!value || !validDeadline(value)) return NaN;
  return Date.parse(value.length === 10 ? value + 'T23:59:59.999-03:00' : value + ':00-03:00');
}

export function formatFortalezaDateTime(ms) {
  if (!Number.isFinite(ms)) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Fortaleza',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(ms));
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
}

/**
 * Calcula o prazo seguro de finalização para impressão (responsabilidade do setor):
 * sempre no máximo 24h a partir da data de recebimento e nunca depois da data de produção:
 *   prazo = min(recebimento + 24h, data de produção).
 */
export function computePrintDeadline(order = {}) {
  const printedAt = typeof order?.printedAt === 'string' && validDeadline(order.printedAt) ? order.printedAt : '';
  const receivedAt = typeof order?.receivedAt === 'string' && validDeadline(order.receivedAt) ? order.receivedAt : '';
  const explicitProd = typeof order?.productionDate === 'string' && validDeadline(order.productionDate) ? order.productionDate : '';
  const legacyDeadline = typeof order?.deadline === 'string' && validDeadline(order.deadline) ? order.deadline : '';
  const productionDate = explicitProd || (!receivedAt ? legacyDeadline : '');

  const recMs = parseFortalezaDateTime(receivedAt);
  const prodMs = parseFortalezaDateTime(productionDate);
  const limit24hMs = Number.isFinite(recMs) ? recMs + PRINT_DEADLINE_MAX_MS : NaN;
  const limit24h = Number.isFinite(limit24hMs) ? formatFortalezaDateTime(limit24hMs) : '';

  if (Number.isFinite(recMs) && Number.isFinite(prodMs)) {
    const invalidSchedule = prodMs < recMs;
    const constrainedByProduction = prodMs < limit24hMs;
    const cappedBy24h = !constrainedByProduction;
    const printDeadlineMs = Math.min(limit24hMs, prodMs);
    const printDeadline = cappedBy24h ? limit24h : productionDate;
    const bufferHoursBeforeProd = Math.round(((prodMs - printDeadlineMs) / 3600000) * 10) / 10;
    const windowHoursFromReceipt = Math.round(((printDeadlineMs - recMs) / 3600000) * 10) / 10;

    let ruleSummary = '';
    if (invalidSchedule) {
      ruleSummary = 'Atenção: data de produção anterior ao recebimento — finalizar imediatamente!';
    } else if (constrainedByProduction) {
      ruleSummary = `Produção em ${Math.max(0, windowHoursFromReceipt)}h após recebimento — limitado pela data de produção`;
    } else if (bufferHoursBeforeProd > 0) {
      ruleSummary = `Teto de 24h após recebimento (${bufferHoursBeforeProd}h de folga antes da produção)`;
    } else {
      ruleSummary = 'Teto exato de 24h após recebimento (no limite da produção)';
    }

    return {
      printedAt,
      receivedAt,
      productionDate,
      limit24h,
      printDeadline,
      printDeadlineMs,
      cappedBy24h,
      constrainedByProduction,
      invalidSchedule,
      missingReceipt: false,
      missingProductionDate: false,
      bufferHoursBeforeProd,
      windowHoursFromReceipt,
      ruleSummary
    };
  }

  if (Number.isFinite(recMs)) {
    return {
      printedAt,
      receivedAt,
      productionDate: '',
      limit24h,
      printDeadline: limit24h,
      printDeadlineMs: limit24hMs,
      cappedBy24h: true,
      constrainedByProduction: false,
      invalidSchedule: false,
      missingReceipt: false,
      missingProductionDate: true,
      bufferHoursBeforeProd: null,
      windowHoursFromReceipt: PRINT_DEADLINE_MAX_HOURS,
      ruleSummary: 'Teto de 24h a partir do recebimento (informe a data de produção caso seja mais curta)'
    };
  }

  if (Number.isFinite(prodMs)) {
    return {
      printedAt,
      receivedAt: '',
      productionDate,
      limit24h: '',
      printDeadline: productionDate,
      printDeadlineMs: prodMs,
      cappedBy24h: false,
      constrainedByProduction: false,
      invalidSchedule: false,
      missingReceipt: true,
      missingProductionDate: false,
      bufferHoursBeforeProd: 0,
      windowHoursFromReceipt: null,
      ruleSummary: 'Usando data de produção (informe o recebimento para aplicar o teto de 24h)'
    };
  }

  return {
    printedAt,
    receivedAt: '',
    productionDate: '',
    limit24h: '',
    printDeadline: '',
    printDeadlineMs: Infinity,
    cappedBy24h: false,
    constrainedByProduction: false,
    invalidSchedule: false,
    missingReceipt: false,
    missingProductionDate: false,
    bufferHoursBeforeProd: null,
    windowHoursFromReceipt: null,
    ruleSummary: 'Informe a data de recebimento e/ou produção para calcular o prazo de finalização (máx. 24h)'
  };
}

export const workflowSteps = [
  { id: 'received', label: 'Recebimento da OS' },
  { id: 'finishing', label: 'Finalização' },
  { id: 'sent', label: 'Envio para Impressão' },
  { id: 'handoff', label: 'Entrega da OS para o Impressor' },
  { id: 'panel', label: 'Mudança de Status do material no painel de controle' }
];

export function workflowProgress(order) {
  return Math.round(workflowSteps.filter(step => order.workflow?.[step.id] === true).length / workflowSteps.length * 100);
}

export const stages = [
  'Recebido',
  'Processando',
  'Finalização',
  'Pausado',
  'Repassado',
  'Enviado para impressão',
  'Concluído',
  'Prova'
];

export const archivedStages = ['Repassado', 'Concluído'];

export function isPausedStatus(status) {
  return status === 'Pausado';
}

export function isProofStatus(status) {
  return status === 'Prova';
}

export function isHoldStatus(status) {
  return status === 'Pausado' || status === 'Prova';
}

export function isArchivedStatus(status) {
  return status === 'Concluído' || status === 'Repassado' || status === 'Finalizado';
}

export const activeStages = stages.filter(stage => !isArchivedStatus(stage));

export const boardActiveStages = ['Recebido', 'Processando', 'Finalização', 'Enviado para impressão', 'Prova', 'Pausado'];

const oldStages = {
  'Recebida': 'Recebido',
  'Em criação': 'Processando',
  'Em aprovação': 'Finalização',
  'Em ajustes': 'Processando',
  'Liberada para produção': 'Concluído',
  'Finalizado': 'Concluído',
  'Concluido': 'Concluído'
};

export function inferResumeStatus(order) {
  const workflow = order?.workflow;
  if (workflow?.handoff || workflow?.sent) return 'Enviado para impressão';
  if (workflow?.finishing) return 'Finalização';
  if (workflow?.received) return 'Processando';
  return 'Recebido';
}

export function deriveStatusFromWorkflow(workflow, currentStatus = 'Recebido') {
  if (!workflow || typeof workflow !== 'object') return currentStatus;
  const doneCount = workflowSteps.filter(step => workflow[step.id] === true).length;
  if (doneCount === workflowSteps.length) return 'Concluído';
  if (isHoldStatus(currentStatus) || currentStatus === 'Repassado') return currentStatus;
  if (workflow.handoff || workflow.sent) return 'Enviado para impressão';
  if (workflow.finishing) return 'Finalização';
  if (workflow.received) return currentStatus === 'Recebido' ? 'Processando' : currentStatus;
  return currentStatus === 'Concluído' ? 'Processando' : currentStatus;
}

export function formatOrderNumber(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/[-/.\s]/.test(trimmed)) {
    const [left = '', ...rest] = trimmed.split(/[-/.\s]+/);
    const client = left.replace(/\D/g, '').slice(0, 4);
    const request = rest.join('').replace(/\D/g, '').slice(0, 6);
    if (!client || !request) return trimmed;
    return client.padStart(4, '0') + '-' + request.padStart(6, '0');
  }
  const digits = trimmed.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 4) return trimmed;
  return digits.slice(0, 4).padStart(4, '0') + '-' + digits.slice(4).padStart(6, '0');
}

export const DEFAULT_ORDER_LINK_BASE = 'https://www.nblgrafica.com/admin/?imprimastore=pedidos/detalhes&id=';
export const DEFAULT_ORDER_PRINT_LINK_BASE = 'https://www.nblgrafica.com/admin/extras/imprimir/pedido.php?id=';
export const DEFAULT_ORDER_PATH_BASE = 'Q:\\0 - 2019\\0 - OS SITE\\';

export function parseOrderNumberParts(number) {
  const formatted = formatOrderNumber(String(number || ''));
  if (!/^\d{4}-\d{6}$/.test(formatted)) return null;
  const [client, request] = formatted.split('-');
  const orderNumeric = Number(request);
  if (!Number.isSafeInteger(orderNumeric) || orderNumeric <= 0) return null;
  return {
    formatted,
    client,
    request,
    orderId: String(orderNumeric)
  };
}

export function buildDefaultOrderLink(number) {
  const parts = parseOrderNumberParts(number);
  if (!parts) return '';
  return `${DEFAULT_ORDER_LINK_BASE}${parts.orderId}`;
}

export function buildDefaultOrderPrintLink(number) {
  const parts = parseOrderNumberParts(number);
  if (!parts) return '';
  return `${DEFAULT_ORDER_PRINT_LINK_BASE}${parts.orderId}`;
}

export function buildDefaultOrderPath(number) {
  const parts = parseOrderNumberParts(number);
  if (!parts) return '';
  return `${DEFAULT_ORDER_PATH_BASE}${parts.client}\\Pedido ${parts.orderId}`;
}

export function buildDefaultOrderReferences(number) {
  const parts = parseOrderNumberParts(number);
  if (!parts) return { link: '', printLink: '', path: '' };
  return {
    link: `${DEFAULT_ORDER_LINK_BASE}${parts.orderId}`,
    printLink: `${DEFAULT_ORDER_PRINT_LINK_BASE}${parts.orderId}`,
    path: `${DEFAULT_ORDER_PATH_BASE}${parts.client}\\Pedido ${parts.orderId}`
  };
}

export function effectiveOrderLink(order) {
  return sanitizeHttpUrl(order?.link, '') || buildDefaultOrderLink(order?.number);
}

export function effectiveOrderPrintLink(order) {
  return sanitizeHttpUrl(order?.printLink, '') || buildDefaultOrderPrintLink(order?.number);
}

export function effectiveOrderPath(order) {
  const manual = typeof order?.path === 'string' ? order.path.trim() : '';
  return manual || buildDefaultOrderPath(order?.number);
}

/** Allow only explicit http(s) URLs to prevent javascript:/data: links and unsafe previews. */
export function sanitizeHttpUrl(rawUrl, fallback = '') {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return fallback;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : fallback;
  } catch {
    return fallback;
  }
}

export function normalizeAttachments(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(item => item && typeof item === 'object' && !Array.isArray(item))
    .slice(0, 30)
    .map(item => ({
      id: String(item.id || '').slice(0, 120),
      name: String(item.name || 'Arquivo').slice(0, 240),
      mimeType: String(item.mimeType || 'application/octet-stream').slice(0, 120),
      size: Number.isFinite(Number(item.size)) && Number(item.size) >= 0 ? Math.trunc(Number(item.size)) : 0,
      provider: ['gdrive', 'supabase', 'url'].includes(item.provider) ? item.provider : 'url',
      driveFileId: String(item.driveFileId || '').slice(0, 200),
      storagePath: String(item.storagePath || '').slice(0, 500),
      webViewLink: sanitizeHttpUrl(item.webViewLink, '').slice(0, 2000),
      previewUrl: sanitizeHttpUrl(item.previewUrl, '').slice(0, 2000),
      downloadUrl: sanitizeHttpUrl(item.downloadUrl, '').slice(0, 2000),
      uploadedBy: String(item.uploadedBy || '').slice(0, 160),
      uploadedAt: String(item.uploadedAt || '').slice(0, 60)
    }));
}

export const printerCategories = [
  'Digital Laser / Toner',
  'Offset',
  'Plotter / Grande Formato',
  'Jato de Tinta',
  'Sublimação / DTF',
  'Flexografia / Rótulo',
  'Outra'
];

export function normalizeTitle(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLocaleUpperCase('pt-BR');
}

export function formatItemNumber(value) {
  const raw = typeof value === 'number' && Number.isFinite(value)
    ? String(Math.trunc(value))
    : typeof value === 'string'
      ? value.trim()
      : '';
  if (!raw) return '';
  if (!/^\d+$/.test(raw) || raw.length > 6) return raw;
  return raw.padStart(6, '0');
}

export function parseItemBatchInput(rawText) {
  const tokens = String(rawText || '')
    .split(/[\s,;]+/)
    .map(token => token.trim())
    .filter(Boolean);
  const valid = [];
  const invalid = [];
  const seen = new Set();
  for (const token of tokens) {
    const formatted = formatItemNumber(token);
    if (!/^\d{6}$/.test(formatted)) {
      invalid.push(token);
      continue;
    }
    if (!seen.has(formatted)) {
      seen.add(formatted);
      valid.push({ number: formatted, label: '' });
    }
  }
  return { valid, invalid };
}

export function normalizeItems(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const result = [];
  for (const raw of value) {
    const rawNum = typeof raw === 'string' || typeof raw === 'number'
      ? raw
      : raw && typeof raw === 'object' && !Array.isArray(raw)
        ? raw.number
        : '';
    const number = formatItemNumber(rawNum);
    if (!/^\d{6}$/.test(number) || seen.has(number)) continue;
    seen.add(number);
    const rawLabel = raw && typeof raw === 'object' && typeof raw.label === 'string'
      ? raw.label.trim().replace(/\s+/g, ' ').slice(0, 120)
      : '';
    result.push({ number, label: rawLabel });
    if (result.length >= 100) break;
  }
  return result;
}

export function normalizeReminders(value) {
  if (!Array.isArray(value)) return [];
  const result = [];
  const seen = new Set();
  for (let i = 0; i < value.length; i++) {
    const raw = value[i];
    const rawText = typeof raw === 'string'
      ? raw
      : raw && typeof raw === 'object' && !Array.isArray(raw)
        ? raw.text
        : '';
    const text = typeof rawText === 'string' ? rawText.trim().slice(0, 500) : '';
    if (!text) continue;
    const idRaw = raw && typeof raw === 'object' && typeof raw.id === 'string'
      ? raw.id.trim().slice(0, 80)
      : '';
    const createdAt = raw && typeof raw === 'object' && typeof raw.createdAt === 'string'
      ? raw.createdAt.trim().slice(0, 60)
      : '';
    const fallbackId = `rem_${i}_${text.slice(0, 16).replace(/[^a-zA-Z0-9]/g, '') || 'item'}`;
    const key = idRaw ? `id:${idRaw}` : `txt:${text.toLocaleLowerCase('pt-BR')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      id: idRaw || fallbackId,
      text,
      createdAt
    });
    if (result.length >= 50) break;
  }
  return result;
}

export function formatCopyValue(order, part = 'os', { mode = 'single', itemNumber = '', separator = '-' } = {}) {
  const num = typeof order?.number === 'string' ? formatOrderNumber(order.number) : '';
  const [client = '', request = ''] = num.includes('-') ? num.split('-') : [num, ''];
  const items = normalizeItems(order?.items || []);
  const formattedArg = itemNumber ? formatItemNumber(itemNumber) : '';
  const targetItem = /^\d{6}$/.test(formattedArg) ? formattedArg : (items[0]?.number || '');

  if (mode === 'complete' || part === 'full') {
    const parts = targetItem ? [client, request, targetItem] : [client, request];
    return parts.filter(Boolean).join(separator);
  }
  if (part === 'client') return client;
  if (part === 'request') return request;
  if (part === 'item') return targetItem;
  return num;
}

export function normalizePrinters(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const result = [];
  for (const raw of value) {
    if (typeof raw !== 'string') continue;
    const clean = raw.trim().replace(/\s+/g, ' ').slice(0, 80);
    if (!clean) continue;
    const key = clean.toLocaleLowerCase('pt-BR');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
    if (result.length >= 20) break;
  }
  return result;
}

export function normalizePrinterEntry(item) {
  if (!item || typeof item !== 'object') return null;
  const name = String(item.name || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  if (!name) return null;
  const rawId = String(item.id || '').trim();
  const slug = name
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 56);
  const id = (rawId || ('prt-' + (slug || 'item'))).slice(0, 80);
  return {
    id,
    name,
    category: String(item.category || '').trim().slice(0, 60),
    notes: String(item.notes || '').trim().slice(0, 240),
    createdAt: String(item.createdAt || item.created_at || '').slice(0, 60)
  };
}

export function normalizePrinterCatalog(value) {
  if (!Array.isArray(value)) return [];
  const map = new Map();
  for (const raw of value) {
    const entry = typeof raw === 'string'
      ? normalizePrinterEntry({ name: raw })
      : normalizePrinterEntry(raw);
    if (!entry) continue;
    const key = entry.name.toLocaleLowerCase('pt-BR');
    if (!map.has(key)) map.set(key, entry);
  }
  return Array.from(map.values())
    .slice(0, 200)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export function readBackupPrinters(data) {
  if (data?.app === 'ibd-suite' && data?.osManeger) {
    return normalizePrinterCatalog(data.osManeger.printersCatalog);
  }
  return normalizePrinterCatalog(data?.printersCatalog);
}

export function normalize(order) {
  if (!order || typeof order !== 'object') return order;
  const number = typeof order.number === 'string' ? formatOrderNumber(order.number) : order.number;
  const rawWorkflow = order.workflow && typeof order.workflow === 'object' && !Array.isArray(order.workflow)
    ? { ...order.workflow }
    : undefined;
  const embeddedPrinters = rawWorkflow?._printers;
  const embeddedItems = rawWorkflow?._items;
  const embeddedReminders = rawWorkflow?._reminders;
  const embeddedPrintedAt = rawWorkflow?._printedAt;
  const embeddedReceivedAt = rawWorkflow?._receivedAt;
  const embeddedProductionDate = rawWorkflow?._productionDate;
  const embeddedPrintLink = rawWorkflow?._printLink;
  let cleanWorkflow = rawWorkflow;
  if (
    rawWorkflow &&
    ('_printers' in rawWorkflow || '_items' in rawWorkflow || '_reminders' in rawWorkflow ||
      '_printedAt' in rawWorkflow || '_receivedAt' in rawWorkflow || '_productionDate' in rawWorkflow || '_printLink' in rawWorkflow)
  ) {
    cleanWorkflow = { ...rawWorkflow };
    delete cleanWorkflow._printers;
    delete cleanWorkflow._items;
    delete cleanWorkflow._reminders;
    delete cleanWorkflow._printedAt;
    delete cleanWorkflow._receivedAt;
    delete cleanWorkflow._productionDate;
    delete cleanWorkflow._printLink;
  }
  const printedAt = typeof order.printedAt === 'string'
    ? order.printedAt
    : (typeof embeddedPrintedAt === 'string' ? embeddedPrintedAt : '');
  const receivedAt = typeof order.receivedAt === 'string'
    ? order.receivedAt
    : (typeof embeddedReceivedAt === 'string' ? embeddedReceivedAt : '');
  const productionDate = typeof order.productionDate === 'string'
    ? order.productionDate
    : (typeof embeddedProductionDate === 'string' ? embeddedProductionDate : '');
  const printLink = typeof order.printLink === 'string'
    ? order.printLink
    : (typeof embeddedPrintLink === 'string' ? embeddedPrintLink : '');
  return {
    ...order,
    number,
    title: typeof order.title === 'string' ? normalizeTitle(order.title) : order.title,
    status: oldStages[order.status] || order.status,
    pausedFrom: typeof order.pausedFrom === 'string' ? (oldStages[order.pausedFrom] || order.pausedFrom) : '',
    printLink,
    printedAt,
    receivedAt,
    productionDate,
    ...(cleanWorkflow !== undefined ? { workflow: cleanWorkflow } : {}),
    attachments: normalizeAttachments(order.attachments),
    printers: normalizePrinters(Array.isArray(order.printers) ? order.printers : embeddedPrinters),
    items: normalizeItems(Array.isArray(order.items) ? order.items : embeddedItems),
    reminders: normalizeReminders(Array.isArray(order.reminders) ? order.reminders : embeddedReminders)
  };
}

export const complexities = ['Baixa', 'Média', 'Alta'];

// Legacy records keep their former newest-first ordering. New orders join the tail.
export function rankOf(order) {
  return order.rank || 'M' + String(9999999999999 - Date.parse(order.updated)).padStart(13, '0') + order.number + 'M';
}

export function compareQueue(a, b) {
  const left = rankOf(a), right = rankOf(b);
  return left < right ? -1 : left > right ? 1 : a.number.localeCompare(b.number);
}

// Generate a printable key strictly between adjacent ranks, including prefix pairs.
export function rankBetween(left, right, number) {
  let prefix = '';
  for (let i = 0; ; i++) {
    const lo = left.charCodeAt(i) || 32;
    const hi = right?.charCodeAt(i) || 126;
    if (hi - lo > 1) return prefix + String.fromCharCode(Math.floor((hi + lo) / 2)) + number + 'M';
    prefix += String.fromCharCode(lo);
    if (lo < hi) right = null;
  }
}

export function elapsed(order, now = Date.now()) {
  return (order.elapsedMs || 0) + (order.startedAt ? Math.max(0, now - order.startedAt) : 0);
}

/** Freeze any running stopwatch when moving to a paused or archived stage. */
export function stopTimerPatch(order, now = Date.now()) {
  return order?.startedAt ? { elapsedMs: elapsed(order, now), startedAt: 0 } : {};
}

function isSafeHttpUrl(url) {
  if (!url) return true;
  try {
    return ['https:', 'http:'].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

export function validate(order) {
  const rawAttachments = order?.attachments;
  if (rawAttachments != null) {
    if (!Array.isArray(rawAttachments)) return 'Lista de anexos inválida.';
    if (rawAttachments.length > 30) return 'Limite máximo de 30 anexos por OS.';
    for (const item of rawAttachments) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return 'Anexo inválido.';
      if (typeof item.name !== 'string' || !item.name.trim() || item.name.length > 240) return 'Nome de anexo inválido.';
      for (const linkKey of ['webViewLink', 'previewUrl', 'downloadUrl']) {
        if (item[linkKey] && (typeof item[linkKey] !== 'string' || item[linkKey].length > 2000 || !isSafeHttpUrl(item[linkKey]))) {
          return 'Link do anexo inválido.';
        }
      }
    }
  }
  const rawPrinters = order?.printers;
  if (rawPrinters != null) {
    if (!Array.isArray(rawPrinters)) return 'Lista de impressoras inválida.';
    if (rawPrinters.length > 20) return 'Limite máximo de 20 impressoras por OS.';
    if (rawPrinters.some(p => typeof p !== 'string' || p.length > 80)) return 'Impressora inválida na OS.';
  }
  const rawItems = order?.items;
  if (rawItems != null) {
    if (!Array.isArray(rawItems)) return 'Lista de itens inválida.';
    if (rawItems.length > 100) return 'Limite máximo de 100 itens por OS.';
    for (const item of rawItems) {
      const rawNum = typeof item === 'string' || typeof item === 'number'
        ? item
        : item && typeof item === 'object' && !Array.isArray(item)
          ? item.number
          : null;
      const formatted = formatItemNumber(rawNum);
      if (!/^\d{6}$/.test(formatted)) {
        return 'Informe números de item válidos com até 6 dígitos (padrão 000000).';
      }
      if (item && typeof item === 'object' && item.label != null && (typeof item.label !== 'string' || item.label.length > 120)) {
        return 'Descrição do item inválida (máx. 120 caracteres).';
      }
    }
  }
  const rawReminders = order?.reminders;
  if (rawReminders != null) {
    if (!Array.isArray(rawReminders)) return 'Lista de lembretes inválida.';
    if (rawReminders.length > 50) return 'Limite máximo de 50 lembretes por OS.';
    for (const rem of rawReminders) {
      const rawText = typeof rem === 'string'
        ? rem
        : rem && typeof rem === 'object' && !Array.isArray(rem)
          ? rem.text
          : null;
      if (typeof rawText !== 'string' || !rawText.trim() || rawText.length > 500) {
        return 'Lembrete inválido (máx. 500 caracteres).';
      }
    }
  }
  order = order && normalize(order);
  if (!order || !/^\d{4}-\d{6}$/.test(order.number) || typeof order.number !== 'string') return 'Informe quatro dígitos de cliente e seis de pedido.';
  if (!stages.includes(order.status)) return 'Selecione uma etapa válida.';
  for (const [field, max] of Object.entries({ title: 160, link: 2000, path: 2000, notes: 20000 })) {
    if (typeof order[field] !== 'string' || order[field].length > max) return 'Confira o tamanho dos campos.';
  }
  if (order.complexity && !complexities.includes(order.complexity)) return 'Selecione uma complexidade válida.';
  if (order.owner != null && (typeof order.owner !== 'string' || order.owner.length > 160)) return 'Confira o nome do responsável.';
  if (order.pausedFrom && (typeof order.pausedFrom !== 'string' || !stages.includes(order.pausedFrom))) return 'Etapa de retomada inválida.';
  if (order.urgent != null && typeof order.urgent !== 'boolean') return 'Urgência inválida.';
  if (!validDeadline(order.deadline)) return 'Confira a data e a hora do prazo.';
  if (!validDeadline(order.printedAt)) return 'Confira a data e a hora de impressão da OS.';
  if (!validDeadline(order.receivedAt)) return 'Confira a data e a hora de recebimento da OS.';
  if (!validDeadline(order.productionDate)) return 'Confira a data e a hora de produção da OS.';
  for (const key of ['elapsedMs', 'startedAt']) {
    if (order[key] != null && (!Number.isSafeInteger(order[key]) || order[key] < 0)) return 'Tempo inválido.';
  }
  if (order.rank != null && (typeof order.rank !== 'string' || !/^[ -~]*M$/.test(order.rank))) return 'Posição inválida.';
  if (order.workflow != null && (typeof order.workflow !== 'object' || Array.isArray(order.workflow) || Object.entries(order.workflow).some(([key, value]) => !workflowSteps.some(step => step.id === key) || typeof value !== 'boolean'))) return 'Checklist inválido.';
  if (order.link && !isSafeHttpUrl(order.link)) {
    return 'Informe um link iniciado por https:// ou http://.';
  }
  if (order.printLink && (typeof order.printLink !== 'string' || order.printLink.length > 2000 || !isSafeHttpUrl(order.printLink))) {
    return 'Informe um link de impressão iniciado por https:// ou http://.';
  }
  return '';
}

export function record(input) {
  const normalized = normalize(input);
  const { number, title, status, link, printLink, path, notes, version, attachments, items, reminders, printedAt, receivedAt, productionDate } = normalized;
  const now = Date.now();
  const rank = input.rank || (input.updated ? rankOf(input) : 'N' + now + number + 'M');
  const calc = computePrintDeadline(normalized);
  const effectiveDeadline = (receivedAt || productionDate) ? calc.printDeadline : (input.deadline || '');
  return {
    number,
    title,
    status,
    link,
    printLink: printLink || '',
    path,
    notes,
    rank,
    complexity: input.complexity || '',
    urgent: !!input.urgent,
    deadline: effectiveDeadline,
    printedAt: printedAt || '',
    receivedAt: receivedAt || '',
    productionDate: productionDate || '',
    owner: input.owner || '',
    pausedFrom: typeof input.pausedFrom === 'string' && activeStages.includes(input.pausedFrom) && !isHoldStatus(input.pausedFrom) ? input.pausedFrom : '',
    elapsedMs: input.elapsedMs || 0,
    startedAt: input.startedAt || 0,
    workflow: Object.fromEntries(workflowSteps.map(step => [step.id, input.workflow?.[step.id] === true])),
    attachments: attachments || [],
    printers: normalizePrinters(input.printers),
    items: items || [],
    reminders: reminders || [],
    version: version + 1,
    updated: new Date(now).toISOString()
  };
}

export function readBackup(data) {
  const isLegacyOs = data?.app === 'os-maneger' && data.schema === 1 && Array.isArray(data.orders);
  const isSuiteV2 = data?.app === 'ibd-suite' && data.schema === 2 && Array.isArray(data.osManeger?.orders);
  if (!isLegacyOs && !isSuiteV2) throw Error('Arquivo de backup incompatível.');
  const rawOrders = isSuiteV2 ? data.osManeger.orders : data.orders;
  if (rawOrders.length > 5000) throw Error('Arquivo de backup excede o limite de 5.000 OS.');
  const numbers = new Set();
  return rawOrders.map((source, index) => {
    if (!source || typeof source !== 'object') throw Error('Registro inválido no backup.');
    const order = normalize(source);
    const error = validate(order);
    if (error || numbers.has(order.number)) throw Error(error || 'O backup contém números de OS repetidos.');
    numbers.add(order.number);
    return record({ ...order, version: 0, rank: order.rank || 'N' + String(index).padStart(13, '0') + order.number + 'M', startedAt: 0 });
  });
}

export function readSuiteBackup(data) {
  const orders = readBackup(data);
  const printersCatalog = readBackupPrinters(data);
  const counterTickets = readBackupCounterTickets(data);
  if (data?.app !== 'ibd-suite' || data.schema !== 2) {
    return {
      app: 'os-maneger',
      schema: 1,
      exportedAt: String(data?.exportedAt || ''),
      exportedBy: String(data?.exportedBy || ''),
      orders,
      printersCatalog,
      counterTickets,
      osmPrefs: null,
      folhaTemplates: [],
      folhaCustomPresets: null,
      folhaWorkspace: null,
      nblWorkspace: null,
      nblProjects: []
    };
  }
  const folha = data.folha && typeof data.folha === 'object' ? data.folha : {};
  const nbl = data.numeraBloco && typeof data.numeraBloco === 'object' ? data.numeraBloco : {};
  const osmPrefs = data.osManeger?.prefs && typeof data.osManeger.prefs === 'object' ? data.osManeger.prefs : null;
  const folhaTemplates = Array.isArray(folha.templates)
    ? folha.templates
      .filter(t => t && typeof t.name === 'string' && t.name.trim() && t.state && typeof t.state === 'object')
      .slice(0, 200)
      .map(t => ({ name: t.name.trim().slice(0, 140), state: t.state }))
    : [];
  const folhaCustomPresets = folha.customPresets && typeof folha.customPresets === 'object'
    ? {
        papers: Array.isArray(folha.customPresets.papers) ? folha.customPresets.papers.slice(0, 60) : [],
        pieces: Array.isArray(folha.customPresets.pieces) ? folha.customPresets.pieces.slice(0, 60) : []
      }
    : null;
  const folhaWorkspace = folha.workspace && typeof folha.workspace === 'object' ? folha.workspace : null;
  const nblWorkspace = nbl.workspace && typeof nbl.workspace === 'object' ? nbl.workspace : null;
  const nblProjects = Array.isArray(nbl.projects)
    ? nbl.projects
      .filter(p => p && typeof p.name === 'string' && p.name.trim() && p.state && typeof p.state === 'object')
      .slice(0, 100)
      .map(p => ({
        id: String(p.id || '').slice(0, 80),
        name: p.name.trim().slice(0, 120),
        state: p.state,
        updated: String(p.updated || '')
      }))
    : [];
  return {
    app: 'ibd-suite',
    schema: 2,
    exportedAt: String(data.exportedAt || ''),
    exportedBy: String(data.exportedBy || ''),
    orders,
    printersCatalog,
    counterTickets,
    osmPrefs,
    folhaTemplates,
    folhaCustomPresets,
    folhaWorkspace,
    nblWorkspace,
    nblProjects
  };
}

export function restorePlan(incoming, current, overwrite) {
  const existing = new Map(current.map(order => [order.number, order]));
  return incoming.filter(order => overwrite || !existing.has(order.number)).map(order => ({
    ...order,
    version: existing.get(order.number)?.version || 0
  }));
}

// ============================================================================
// Atendimento de Balcão (Criação, Ajuste & Cronômetro — sem exigência de nº cliente/pedido)
// ============================================================================

export const counterServiceTypes = [
  { id: 'criacao', label: 'Criação de Arte' },
  { id: 'ajuste', label: 'Ajuste de Arquivo' },
  { id: 'fechamento', label: 'Fechamento / Pré-impressão' },
  { id: 'vetorizacao', label: 'Vetorização / Redesenho' },
  { id: 'orcamento', label: 'Orçamento / Diagramação' }
];

export const counterChannels = [
  { id: 'balcao', label: 'Balcão presencial' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'email', label: 'E-mail' },
  { id: 'telefone', label: 'Telefone' }
];

export const counterFileStatuses = [
  { id: 'cliente_trouxe', label: 'Cliente trouxe arquivo' },
  { id: 'sem_arquivo', label: 'Criar do zero (sem arquivo)' },
  { id: 'reenvio', label: 'Aguardando reenvio / referência' },
  { id: 'aprovado', label: 'Arte aprovada' }
];

export const counterActiveStages = [
  'Aguardando',
  'Em criação',
  'Em ajuste',
  'Aguardando aprovação',
  'Pausado'
];

export const counterArchivedStages = [
  'Convertido em OS',
  'Finalizado',
  'Cancelado'
];

export const counterStages = [...counterActiveStages, ...counterArchivedStages];

const counterServiceIds = new Set(counterServiceTypes.map(s => s.id));
const counterChannelIds = new Set(counterChannels.map(c => c.id));
const counterFileStatusIds = new Set(counterFileStatuses.map(f => f.id));

export function isCounterArchivedStatus(status) {
  return counterArchivedStages.includes(status);
}

export function isCounterHoldStatus(status) {
  return status === 'Aguardando aprovação' || status === 'Pausado';
}

export function counterServiceLabel(id) {
  return counterServiceTypes.find(s => s.id === id)?.label || 'Criação de Arte';
}

export function counterChannelLabel(id) {
  return counterChannels.find(c => c.id === id)?.label || 'Balcão presencial';
}

export function counterFileStatusLabel(id) {
  return counterFileStatuses.find(f => f.id === id)?.label || 'Cliente trouxe arquivo';
}

export function generateCounterId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return 'bal_' + crypto.randomUUID().replace(/-/g, '').slice(0, 14);
  }
  return 'bal_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

export function formatCounterCode(raw, now = Date.now()) {
  const clean = String(raw || '').trim().toUpperCase();
  if (/^BAL-\d{6}-[A-Z0-9]{4,8}$/.test(clean)) return clean;
  const d = new Date(now);
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const suffix = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 4)
    : Math.random().toString(36).slice(2, 6)).toUpperCase();
  return `BAL-${yy}${mm}${dd}-${suffix}`;
}

export function normalizeCounterSessions(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const startedAt = Number.isSafeInteger(Number(entry.startedAt)) && Number(entry.startedAt) > 0 ? Number(entry.startedAt) : 0;
    const endedAt = Number.isSafeInteger(Number(entry.endedAt)) && Number(entry.endedAt) >= startedAt ? Number(entry.endedAt) : 0;
    const durationMs = Number.isSafeInteger(Number(entry.durationMs)) && Number(entry.durationMs) >= 0
      ? Number(entry.durationMs)
      : (endedAt > startedAt ? endedAt - startedAt : 0);
    if (durationMs <= 0) continue;
    out.push({
      id: String(entry.id || `ses_${out.length + 1}`).slice(0, 60),
      startedAt,
      endedAt,
      durationMs,
      note: String(entry.note || '').trim().slice(0, 160)
    });
    if (out.length >= 100) break;
  }
  return out;
}

export function normalizeCounterTicket(input = {}) {
  const raw = input && typeof input === 'object' ? input : {};
  const id = String(raw.id || '').trim().slice(0, 80);
  const code = String(raw.code || '').trim().toUpperCase().slice(0, 32);
  const customerName = String(raw.customerName ?? raw.customer_name ?? '').trim().slice(0, 160);
  const customerContact = String(raw.customerContact ?? raw.customer_contact ?? '').trim().slice(0, 120);
  const rawClientDigits = String(raw.clientNumber ?? raw.client_number ?? '').replace(/\D/g, '');
  const clientNumber = rawClientDigits ? rawClientDigits.slice(-4).padStart(4, '0') : '';
  const rawOrderDigits = String(raw.orderNumber ?? raw.order_number ?? '').replace(/\D/g, '');
  const orderNumber = rawOrderDigits ? rawOrderDigits.slice(-6).padStart(6, '0') : '';
  const rawLinkedOs = String(raw.linkedOsNumber ?? raw.linked_os_number ?? '').trim();
  const formattedLinkedOs = rawLinkedOs ? formatOrderNumber(rawLinkedOs) : '';
  const linkedOsNumber = /^\d{4}-\d{6}$/.test(formattedLinkedOs) ? formattedLinkedOs : '';

  const rawService = String(raw.serviceType ?? raw.service_type ?? 'criacao').trim().toLowerCase();
  const serviceType = counterServiceIds.has(rawService) ? rawService : 'criacao';
  const rawChannel = String(raw.channel ?? 'balcao').trim().toLowerCase();
  const channel = counterChannelIds.has(rawChannel) ? rawChannel : 'balcao';
  const rawFileStatus = String(raw.fileStatus ?? raw.file_status ?? 'cliente_trouxe').trim().toLowerCase();
  const fileStatus = counterFileStatusIds.has(rawFileStatus) ? rawFileStatus : 'cliente_trouxe';

  const rawStatus = String(raw.status || 'Aguardando').trim();
  const status = counterStages.includes(rawStatus) ? rawStatus : 'Aguardando';
  const title = normalizeTitle(raw.title || '');
  const briefing = String(raw.briefing ?? raw.notes ?? '').trim().slice(0, 20000);
  const attendant = String(raw.attendant ?? raw.owner ?? '').trim().slice(0, 160);
  const urgent = Boolean(raw.urgent);
  const estNum = Math.trunc(Number(raw.estimatedMinutes ?? raw.estimated_minutes ?? 0) || 0);
  const estimatedMinutes = Math.max(0, Math.min(1440, estNum));
  const revNum = Math.trunc(Number(raw.revisionsCount ?? raw.revisions_count ?? 0) || 0);
  const revisionsCount = Math.max(0, Math.min(99, revNum));
  const elapsedMs = Math.max(0, Math.trunc(Number(raw.elapsedMs ?? raw.elapsed_ms ?? 0) || 0));
  const startedAt = Math.max(0, Math.trunc(Number(raw.startedAt ?? raw.started_at ?? 0) || 0));
  const version = Math.max(0, Math.trunc(Number(raw.version || 0) || 0));
  const createdAt = String(raw.createdAt ?? raw.created_at ?? '').trim();
  const updated = String(raw.updated || '').trim();

  return {
    id,
    code,
    customerName,
    customerContact,
    clientNumber,
    orderNumber,
    linkedOsNumber,
    serviceType,
    channel,
    fileStatus,
    title,
    briefing,
    status,
    attendant,
    urgent,
    estimatedMinutes,
    revisionsCount,
    elapsedMs,
    startedAt,
    sessions: normalizeCounterSessions(raw.sessions),
    attachments: normalizeAttachments(raw.attachments),
    version,
    createdAt,
    updated
  };
}

export function validateCounterTicket(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return 'Atendimento inválido.';
  if (input.attachments != null) {
    if (!Array.isArray(input.attachments)) return 'Lista de anexos inválida.';
    if (input.attachments.length > 30) return 'Limite máximo de 30 anexos por atendimento.';
    for (const item of input.attachments) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return 'Anexo inválido.';
      if (typeof item.name !== 'string' || !item.name.trim() || item.name.length > 240) return 'Nome de anexo inválido.';
      for (const linkKey of ['webViewLink', 'previewUrl', 'downloadUrl']) {
        if (item[linkKey] && (typeof item[linkKey] !== 'string' || item[linkKey].length > 2000 || !isSafeHttpUrl(item[linkKey]))) {
          return 'Link do anexo inválido.';
        }
      }
    }
  }
  const ticket = normalizeCounterTicket(input);
  if (!ticket.title && !ticket.customerName && !ticket.briefing) {
    return 'Informe ao menos o serviço, o nome do cliente ou o briefing do atendimento.';
  }
  if (!counterStages.includes(ticket.status)) return 'Selecione um status válido para o atendimento.';
  if (!counterServiceIds.has(ticket.serviceType)) return 'Selecione um tipo de serviço válido.';
  if (!counterChannelIds.has(ticket.channel)) return 'Selecione um canal válido.';
  if (!counterFileStatusIds.has(ticket.fileStatus)) return 'Selecione uma situação de arquivo válida.';
  if (input.clientNumber && !/^\d{1,4}$/.test(String(input.clientNumber).replace(/\D/g, ''))) {
    return 'Número de cliente opcional deve ter até 4 dígitos.';
  }
  if (input.orderNumber && !/^\d{1,6}$/.test(String(input.orderNumber).replace(/\D/g, ''))) {
    return 'Número de pedido opcional deve ter até 6 dígitos.';
  }
  if (input.linkedOsNumber && !/^\d{4}-\d{6}$/.test(formatOrderNumber(input.linkedOsNumber))) {
    return 'Número da OS vinculada inválido.';
  }
  if (!Number.isSafeInteger(ticket.elapsedMs) || ticket.elapsedMs < 0) return 'Tempo acumulado inválido.';
  if (!Number.isSafeInteger(ticket.startedAt) || ticket.startedAt < 0) return 'Início do cronômetro inválido.';
  return '';
}

export function recordCounterTicket(input, now = Date.now()) {
  const t = normalizeCounterTicket(input);
  const iso = new Date(now).toISOString();
  return {
    ...t,
    id: t.id || generateCounterId(),
    code: formatCounterCode(t.code, now),
    version: t.version + 1,
    createdAt: t.createdAt || iso,
    updated: iso
  };
}

export function counterElapsed(ticket, now = Date.now()) {
  if (!ticket || typeof ticket !== 'object') return 0;
  const base = Math.max(0, Number(ticket.elapsedMs || 0));
  const started = Math.max(0, Number(ticket.startedAt || 0));
  return base + (started > 0 ? Math.max(0, now - started) : 0);
}

export function formatStopwatch(ms) {
  const totalSeconds = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map(n => String(n).padStart(2, '0')).join(':');
}

export function startCounterTimerPatch(ticket, now = Date.now()) {
  const t = normalizeCounterTicket(ticket);
  if (t.startedAt > 0) return {};
  const nextStatus = (t.status === 'Aguardando' || t.status === 'Pausado' || t.status === 'Aguardando aprovação')
    ? (t.serviceType === 'ajuste' ? 'Em ajuste' : 'Em criação')
    : t.status;
  return {
    startedAt: now,
    status: nextStatus
  };
}

export function stopCounterTimerPatch(ticket, now = Date.now(), note = '') {
  const t = normalizeCounterTicket(ticket);
  if (!t.startedAt) return { elapsedMs: t.elapsedMs, startedAt: 0, sessions: t.sessions };
  const delta = Math.max(0, now - t.startedAt);
  const nextElapsed = t.elapsedMs + delta;
  const sessions = [...t.sessions];
  if (delta >= 1000) {
    sessions.push({
      id: 'ses_' + now.toString(36) + Math.random().toString(36).slice(2, 5),
      startedAt: t.startedAt,
      endedAt: now,
      durationMs: delta,
      note: String(note || counterServiceLabel(t.serviceType)).slice(0, 160)
    });
  }
  return {
    elapsedMs: nextElapsed,
    startedAt: 0,
    sessions: sessions.slice(-100)
  };
}

export function counterRestorePlan(incoming, current, overwrite) {
  const existingById = new Map((current || []).map(item => [item.id, item]));
  const existingByCode = new Map((current || []).map(item => [item.code, item]));
  return (incoming || [])
    .filter(item => {
      const found = existingById.get(item.id) || existingByCode.get(item.code);
      return overwrite || !found;
    })
    .map(item => {
      const found = existingById.get(item.id) || existingByCode.get(item.code);
      return {
        ...item,
        id: found?.id || item.id || generateCounterId(),
        version: found?.version || 0
      };
    });
}

export function readBackupCounterTickets(data) {
  const raw = Array.isArray(data?.osManeger?.counterTickets)
    ? data.osManeger.counterTickets
    : Array.isArray(data?.counterTickets)
      ? data.counterTickets
      : [];
  const seen = new Set();
  const out = [];
  for (const entry of raw.slice(0, 3000)) {
    if (!entry || typeof entry !== 'object') continue;
    const norm = normalizeCounterTicket({ ...entry, startedAt: 0 });
    const err = validateCounterTicket(norm);
    if (err) continue;
    const id = norm.id || generateCounterId();
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(recordCounterTicket({ ...norm, id, version: 0 }));
  }
  return out;
}
