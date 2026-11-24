import {
  compareQueue,
  complexities,
  computePrintDeadline,
  workflowProgress,
  validDeadline,
  stages,
  isArchivedStatus,
  isPausedStatus,
  isProofStatus,
  isHoldStatus,
  normalizeItems,
  normalizeReminders,
  isCounterArchivedStatus,
  isCounterHoldStatus,
  counterElapsed
} from './model.js';

export const workTimeZone = 'America/Fortaleza';

const criticalHoursMs = 4 * 3600 * 1000;
const soonHoursMs = 24 * 3600 * 1000;

const statusQueueOrder = {
  'Processando': 0,
  'Finalização': 1,
  'Recebido': 2,
  'Enviado para impressão': 3,
  'Prova': 4,
  'Pausado': 5,
  'Repassado': 6,
  'Concluído': 7,
  'Finalizado': 7
};

export function isPaused(order) {
  return isPausedStatus(order?.status);
}

export function isProof(order) {
  return isProofStatus(order?.status);
}

export function isEndOfQueue(order) {
  return isHoldStatus(order?.status);
}

export function effectiveDeadline(order) {
  if (!order || typeof order !== 'object') return '';
  if (order.receivedAt || order.productionDate) {
    return computePrintDeadline(order).printDeadline || order.deadline || '';
  }
  return order.deadline || '';
}

export function deadlineTime(value) {
  if (!value || !validDeadline(value)) return Infinity;
  return Date.parse(value.length === 10 ? value + 'T23:59:59.999-03:00' : value + ':00-03:00');
}

export function isArchived(order) {
  return isArchivedStatus(order?.status);
}

export function isComplete(order) {
  return isArchived(order) || workflowProgress(order) === 100;
}

export function isOverdue(order, now = Date.now()) {
  return !isComplete(order) && deadlineTime(effectiveDeadline(order)) < now;
}

/** Compute dynamic queue tier and contextual badge metadata without mutating the record. */
export function getDynamicQueueInfo(order, now = Date.now()) {
  if (isArchived(order)) {
    const label = order?.status === 'Repassado' ? 'Repassada' : 'Concluída';
    return { tier: 9, key: 'archived', label, tone: 'archived' };
  }
  const due = deadlineTime(effectiveDeadline(order));
  const msLeft = due - now;
  const overdue = Number.isFinite(due) && msLeft < 0;
  if (isProof(order)) {
    return {
      tier: 5,
      key: 'proof',
      label: overdue ? 'Prova · prazo vencido' : 'Prova · fim da fila',
      tone: 'proof'
    };
  }
  if (isPaused(order)) {
    return {
      tier: 6,
      key: 'paused',
      label: overdue ? 'Pausada · prazo vencido' : 'Pausada · fim da fila',
      tone: 'paused'
    };
  }
  if (overdue) return { tier: 0, key: 'overdue', label: 'Atrasada', tone: 'danger' };
  if (order?.urgent) return { tier: 1, key: 'urgent', label: 'Urgente', tone: 'urgent' };
  if (Number.isFinite(msLeft) && msLeft <= criticalHoursMs) return { tier: 1, key: 'critical', label: 'Prazo crítico', tone: 'urgent' };
  if (Number.isFinite(msLeft) && msLeft <= soonHoursMs) return { tier: 2, key: 'soon', label: 'Prazo próximo', tone: 'soon' };
  if (order?.status === 'Enviado para impressão') return { tier: 4, key: 'print', label: 'Em impressão', tone: 'flow' };
  if (order?.startedAt) return { tier: 3, key: 'running', label: 'Em execução', tone: 'active' };
  return { tier: 3, key: 'flow', label: 'Em fluxo', tone: 'flow' };
}

function compareDynamic(a, b, now) {
  const infoA = getDynamicQueueInfo(a, now);
  const infoB = getDynamicQueueInfo(b, now);
  const tierDiff = infoA.tier - infoB.tier;
  if (tierDiff) return tierDiff;
  if (infoA.tier === 0) {
    return (Number(!!b.urgent) - Number(!!a.urgent))
      || (deadlineTime(effectiveDeadline(a)) - deadlineTime(effectiveDeadline(b)))
      || (workflowProgress(b) - workflowProgress(a));
  }
  if (infoA.tier === 1 || infoA.tier === 2) {
    return (Number(!!b.urgent) - Number(!!a.urgent))
      || (Number(!!b.startedAt) - Number(!!a.startedAt))
      || (deadlineTime(effectiveDeadline(a)) - deadlineTime(effectiveDeadline(b)))
      || (complexities.indexOf(b.complexity) - complexities.indexOf(a.complexity))
      || (workflowProgress(b) - workflowProgress(a));
  }
  if (infoA.tier === 3) {
    const rankA = statusQueueOrder[a.status] ?? stages.indexOf(a.status);
    const rankB = statusQueueOrder[b.status] ?? stages.indexOf(b.status);
    return (Number(!!b.startedAt) - Number(!!a.startedAt))
      || (rankA - rankB)
      || (deadlineTime(effectiveDeadline(a)) - deadlineTime(effectiveDeadline(b)))
      || (complexities.indexOf(b.complexity) - complexities.indexOf(a.complexity))
      || (workflowProgress(b) - workflowProgress(a));
  }
  if (infoA.tier === 5 || infoA.tier === 6) {
    return (Number(!!b.urgent) - Number(!!a.urgent))
      || (deadlineTime(effectiveDeadline(a)) - deadlineTime(effectiveDeadline(b)))
      || ((Date.parse(b.updated) || 0) - (Date.parse(a.updated) || 0));
  }
  return (Date.parse(b.updated) || 0) - (Date.parse(a.updated) || 0);
}

export function filterOrders(orders, filters = {}, now = Date.now()) {
  const term = (filters.search || '').trim().toLocaleLowerCase('pt-BR');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: workTimeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return orders.filter(order => {
    if (filters.archived === true && !isArchived(order)) return false;
    if (filters.archived === false && isArchived(order)) return false;
    if (filters.status && order.status !== filters.status) return false;
    if (filters.complexity && (filters.complexity === 'none' ? !!order.complexity : order.complexity !== filters.complexity)) return false;
    if (filters.urgency && !!order.urgent !== (filters.urgency === 'urgent')) return false;
    const effDue = effectiveDeadline(order);
    if (filters.deadline === 'overdue' && !isOverdue(order, now)) return false;
    if (filters.deadline === 'today' && effDue.slice(0, 10) !== today) return false;
    if (filters.deadline === 'none' && effDue) return false;
    if (filters.deadline === 'ontime' && (isComplete(order) || !effDue || deadlineTime(effDue) < now)) return false;
    const printerList = Array.isArray(order.printers) ? order.printers : [];
    if (filters.printer) {
      if (filters.printer === 'none') {
        if (printerList.length) return false;
      } else {
        const targetPrinter = String(filters.printer).toLocaleLowerCase('pt-BR');
        if (!printerList.some(p => String(p || '').toLocaleLowerCase('pt-BR') === targetPrinter)) return false;
      }
    }
    const attachmentNames = Array.isArray(order.attachments) ? order.attachments.map(a => a?.name || '') : [];
    const itemTokens = normalizeItems(order.items).flatMap(item => [
      item.number,
      item.label,
      `${order.number}-${item.number}`
    ]);
    const reminderTexts = normalizeReminders(order.reminders).map(r => r.text);
    return !term || [
      order.number,
      order.number.replace('-', ''),
      order.title,
      order.notes,
      order.owner,
      order.path,
      order.link,
      ...printerList,
      ...attachmentNames,
      ...itemTokens,
      ...reminderTexts
    ].some(value => (value || '').toLocaleLowerCase('pt-BR').includes(term));
  });
}

function holdRank(order) {
  if (isPaused(order)) return 2;
  if (isProof(order)) return 1;
  return 0;
}

export function sortOrders(orders, sort = 'queue', now = Date.now()) {
  return [...orders].sort((a, b) => {
    const pauseDiff = sort === 'queue' ? 0 : holdRank(a) - holdRank(b);
    if (pauseDiff) return pauseDiff;
    let result = 0;
    if (sort === 'dynamic') result = compareDynamic(a, b, now);
    if (sort === 'status') {
      const rankA = statusQueueOrder[a.status] ?? stages.indexOf(a.status);
      const rankB = statusQueueOrder[b.status] ?? stages.indexOf(b.status);
      result = rankA - rankB || (Number(!!b.urgent) - Number(!!a.urgent));
    }
    if (sort === 'deadline') result = deadlineTime(effectiveDeadline(a)) - deadlineTime(effectiveDeadline(b));
    if (sort === 'urgent') result = Number(!!b.urgent) - Number(!!a.urgent);
    if (sort === 'updated') result = Date.parse(b.updated) - Date.parse(a.updated);
    if (sort === 'number') result = a.number.localeCompare(b.number);
    if (sort === 'complexity') result = complexities.indexOf(b.complexity) - complexities.indexOf(a.complexity);
    if (sort === 'progress') result = workflowProgress(b) - workflowProgress(a);
    return (Number.isNaN(result) ? 0 : result) || compareQueue(a, b);
  });
}

// ============================================================================
// Filtros e ordenação — Atendimento de Balcão
// ============================================================================

const counterStageOrder = {
  'Em criação': 0,
  'Em ajuste': 1,
  'Aguardando': 2,
  'Aguardando aprovação': 3,
  'Pausado': 4,
  'Convertido em OS': 5,
  'Finalizado': 6,
  'Cancelado': 7
};

export function isCounterArchived(ticket) {
  return isCounterArchivedStatus(ticket?.status);
}

export function isCounterRunning(ticket) {
  return Number(ticket?.startedAt || 0) > 0;
}

export function filterCounterTickets(tickets, filters = {}) {
  const term = String(filters.search || '').trim().toLocaleLowerCase('pt-BR');
  return (tickets || []).filter(ticket => {
    if (filters.archived === true && !isCounterArchived(ticket)) return false;
    if (filters.archived === false && isCounterArchived(ticket)) return false;
    if (filters.status && ticket.status !== filters.status) return false;
    if (filters.serviceType && ticket.serviceType !== filters.serviceType) return false;
    if (filters.channel && ticket.channel !== filters.channel) return false;
    if (filters.urgent === 'urgent' && !ticket.urgent) return false;
    if (filters.urgent === 'running' && !isCounterRunning(ticket)) return false;
    if (!term) return true;
    const attachmentNames = Array.isArray(ticket.attachments) ? ticket.attachments.map(a => a?.name || '') : [];
    return [
      ticket.code,
      ticket.customerName,
      ticket.customerContact,
      ticket.clientNumber,
      ticket.orderNumber,
      ticket.linkedOsNumber,
      ticket.title,
      ticket.briefing,
      ticket.attendant,
      ...attachmentNames
    ].some(val => String(val || '').toLocaleLowerCase('pt-BR').includes(term));
  });
}

function counterSmartRank(ticket) {
  if (isCounterArchived(ticket)) return 9;
  if (isCounterRunning(ticket)) return 0;
  if (ticket?.urgent && !isCounterHoldStatus(ticket.status)) return 1;
  if (ticket?.status === 'Em criação' || ticket?.status === 'Em ajuste') return 2;
  if (ticket?.status === 'Aguardando') return 3;
  if (ticket?.status === 'Aguardando aprovação') return 4;
  if (ticket?.status === 'Pausado') return 5;
  return 6;
}

export function sortCounterTickets(tickets, sort = 'smart', now = Date.now()) {
  return [...(tickets || [])].sort((a, b) => {
    if (sort === 'elapsed') {
      return (counterElapsed(b, now) - counterElapsed(a, now)) || ((Date.parse(b.updated) || 0) - (Date.parse(a.updated) || 0));
    }
    if (sort === 'created') {
      return (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0);
    }
    if (sort === 'updated') {
      return (Date.parse(b.updated) || 0) - (Date.parse(a.updated) || 0);
    }
    if (sort === 'revisions') {
      return ((b.revisionsCount || 0) - (a.revisionsCount || 0)) || ((Date.parse(b.updated) || 0) - (Date.parse(a.updated) || 0));
    }
    // smart (default): rodando > cliente no balcão > em criação/ajuste > aguardando > aprovação > pausado
    const tierDiff = counterSmartRank(a) - counterSmartRank(b);
    if (tierDiff) return tierDiff;
    const urgDiff = Number(!!b.urgent) - Number(!!a.urgent);
    if (urgDiff) return urgDiff;
    const stageDiff = (counterStageOrder[a.status] ?? 9) - (counterStageOrder[b.status] ?? 9);
    if (stageDiff) return stageDiff;
    return (Date.parse(b.updated) || 0) - (Date.parse(a.updated) || 0);
  });
}
