const currencyFormatter = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

export function formatCurrency(val) {
  return currencyFormatter.format(Number(val) || 0);
}

export function formatNumber(val) {
  const num = Number(val) || 0;
  return Number.isInteger(num) ? num.toString() : num.toFixed(2);
}

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatCompactCurrency(val) {
  const num = Number(val) || 0;
  if (Math.abs(num) >= 1000000) {
    return `$${(num / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(num) >= 1000) {
    return `$${Math.round(num / 1000)}k`;
  }
  return `$${Math.round(num)}`;
}

export function getTrendMeta(actualVal, prevVal) {
  const act = Number(actualVal) || 0;
  const prev = Number(prevVal) || 0;
  const diff = act - prev;

  if (prev === 0 && act === 0) {
    return {
      direction: 'flat',
      label: 'Sin variación',
      shortLabel: '0%',
      pct: 0,
      diff: 0,
      colorClass: 'neutral',
      strokeColor: '#94a3b8',
      arrow: '→',
    };
  }
  if (prev === 0 && act > 0) {
    return {
      direction: 'up',
      label: 'En Ascenso',
      shortLabel: '+100%',
      pct: 100,
      diff,
      colorClass: 'up',
      strokeColor: '#10b981',
      arrow: '▲',
    };
  }

  const pct = ((act - prev) / Math.abs(prev)) * 100;
  if (diff > 0) {
    return {
      direction: 'up',
      label: 'En Ascenso',
      shortLabel: `+${pct.toFixed(1)}%`,
      pct,
      diff,
      colorClass: 'up',
      strokeColor: '#10b981',
      arrow: '▲',
    };
  }
  if (diff < 0) {
    return {
      direction: 'down',
      label: 'En Descenso',
      shortLabel: `${pct.toFixed(1)}%`,
      pct,
      diff,
      colorClass: 'down',
      strokeColor: '#ef4444',
      arrow: '▼',
    };
  }
  return {
    direction: 'flat',
    label: 'Estable',
    shortLabel: '0.0%',
    pct: 0,
    diff: 0,
    colorClass: 'neutral',
    strokeColor: '#94a3b8',
    arrow: '→',
  };
}

export function showFeedback(boxEl, type, message) {
  if (!boxEl) return;
  boxEl.className = `status-box ${type}`;
  boxEl.textContent = message;
  boxEl.classList.remove('hidden');
}

export function isIntegerOnlyUnit(unidadMedida) {
  const u = String(unidadMedida || 'UN').toUpperCase();
  return u === 'UN' || u === 'CAJA';
}

export function blockDecimalKeystrokesOnIntegerInput(e) {
  if (e.key === '.' || e.key === ',' || e.key === 'e' || e.key === 'E' || e.key === '-') {
    e.preventDefault();
  }
}

export function sanitizeIntegerInputValue(inputEl) {
  if (!inputEl) return;
  const raw = String(inputEl.value || '');
  if (/[.,eE-]/.test(raw)) {
    const cleaned = raw.replace(/[^0-9]/g, '');
    inputEl.value = cleaned;
  }
}
