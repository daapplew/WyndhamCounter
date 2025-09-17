const HURDLE_VALUES = {
  1: 160,
  2: 224,
  3: 288,
  4: 314,
  5: 352,
};

const FALLBACK_QUALIFIED_RATE = 0.5;
const FALLBACK_SCORE_RATE = 0.6;

const counters = {
  scores: 0,
  pitches: 0,
  booked: 0,
};

const scoreBreakdown = {
  qualified: 0,
  nq: 0,
};

const plannerState = {
  targetRevenue: 5000,
  closingRatio: 25,
};

let averageHurdle = 2;
let averageGiftCost = 75;

const counterElements = {
  scores: document.querySelector('[data-counter="scores"]'),
  pitches: document.querySelector('[data-counter="pitches"]'),
  booked: document.querySelector('[data-counter="booked"]'),
};

const displayElements = {
  scores: counterElements.scores?.querySelector('.counter__display') ?? null,
  pitches: counterElements.pitches?.querySelector('.counter__display') ?? null,
  booked: counterElements.booked?.querySelector('.counter__display') ?? null,
};

const breakdownElements = {
  qualified: counterElements.scores?.querySelector('[data-score="qualified"] .breakdown-value') ?? null,
  nq: counterElements.scores?.querySelector('[data-score="nq"] .breakdown-value') ?? null,
};

const ratioElement = document.getElementById('ratioValue');
const revenueElement = document.getElementById('revenueValue');
const hurdleButtons = Array.from(document.querySelectorAll('.hurdle-btn'));
const hurdleLabel = document.getElementById('hurdleLabel');
const giftCostLabel = document.getElementById('giftCostLabel');
const resetButton = document.getElementById('resetBtn');

const plannerElements = {
  targetValue: document.getElementById('plannerTargetValue'),
  closingRatio: document.getElementById('plannerClosingRatio'),
  perPersonNote: document.getElementById('plannerPerPersonNote'),
  netPerTour: document.getElementById('plannerNetPerTour'),
  averageHurdle: document.getElementById('plannerAverageHurdle'),
  giftCost: document.getElementById('plannerGiftCost'),
  bookedNeeded: document.getElementById('plannerBookedNeeded'),
  qualifiedNeeded: document.getElementById('plannerQualifiedNeeded'),
  scoresNeeded: document.getElementById('plannerScoresNeeded'),
  pitchesNeeded: document.getElementById('plannerPitchesNeeded'),
  assumptions: document.getElementById('plannerAssumptions'),
};

const scorePrompt = document.getElementById('scorePrompt');
const hurdlePrompt = document.getElementById('hurdlePrompt');
const avgGiftInput = document.getElementById('avgGiftInput');
const valuePrompt = document.getElementById('valuePrompt');
const valuePromptQuestion = document.getElementById('valuePromptQuestion');
const valuePromptInput = document.getElementById('valuePromptInput');

const tabButtons = Array.from(document.querySelectorAll('[data-tab]'));
const tabPanels = Array.from(document.querySelectorAll('.tab-panel'));
const editableElements = Array.from(document.querySelectorAll('[data-editable]'));

const EDIT_LABELS = {
  'counter:scores': 'Set total scores',
  'counter:pitches': 'Set total pitches',
  'counter:booked': 'Set total booked',
  'breakdown:qualified': 'Set qualified count',
  'breakdown:nq': 'Set NQ count',
  'planner:targetRevenue': 'Set target revenue',
  'planner:closingRatio': 'Set closing ratio',
  'config:averageHurdle': 'Set average hurdle',
  'config:giftCost': 'Set average gift cost',
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getBaseForHurdle(hurdle) {
  const clamped = clamp(Number.isFinite(hurdle) ? hurdle : 1, 1, 5);
  const lower = Math.floor(clamped);
  const upper = Math.ceil(clamped);

  const lowerValue = HURDLE_VALUES[lower] ?? 0;
  const upperValue = HURDLE_VALUES[upper] ?? lowerValue;

  if (lower === upper) {
    return lowerValue;
  }

  const ratio = clamped - lower;
  return lowerValue + (upperValue - lowerValue) * ratio;
}

function getPerPersonValue() {
  const base = getBaseForHurdle(averageHurdle);
  return Math.max(0, base - averageGiftCost);
}

function renderCounter(key) {
  if (!displayElements[key]) {
    return;
  }
  displayElements[key].textContent = counters[key];
}

function renderScoreBreakdown() {
  if (breakdownElements.qualified) {
    breakdownElements.qualified.textContent = scoreBreakdown.qualified;
  }
  if (breakdownElements.nq) {
    breakdownElements.nq.textContent = scoreBreakdown.nq;
  }
}

function formatRatio(value) {
  const rounded = value >= 10 ? value.toFixed(0) : value.toFixed(1);
  return `${rounded.replace(/\.0$/, '')}%`;
}

function formatCurrency(value, fractionDigits = 2) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

function formatCurrencySmart(value) {
  const digits = Number.isInteger(value) ? 0 : 2;
  return formatCurrency(value, digits);
}

function formatPercent(value, digits = 0) {
  return `${value.toFixed(digits)}%`;
}

function toInteger(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
}

function roundToDecimals(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function getStepPrecision(step) {
  if (!Number.isFinite(step)) {
    return 0;
  }
  const stepString = step.toString();
  if (stepString.includes('e')) {
    const [, exponent] = stepString.split('e-');
    return Number.parseInt(exponent ?? '0', 10);
  }
  const decimalPart = stepString.split('.')[1] ?? '';
  return decimalPart.length;
}

function updateRatio() {
  if (!ratioElement) {
    return;
  }
  if (scoreBreakdown.qualified === 0) {
    ratioElement.textContent = '0%';
    return;
  }
  const ratio = (counters.booked / scoreBreakdown.qualified) * 100;
  ratioElement.textContent = formatRatio(ratio);
}

function updateRevenue() {
  if (!revenueElement) {
    return;
  }
  const perPerson = getPerPersonValue();
  const total = counters.booked * perPerson;
  const digits = Number.isInteger(total) ? 0 : 2;
  revenueElement.textContent = formatCurrency(total, digits);
}

function safeRatio(numerator, denominator, fallback) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return { value: fallback, usingFallback: true };
  }
  const ratio = numerator / denominator;
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return { value: fallback, usingFallback: true };
  }
  return { value: Math.max(0, Math.min(1, ratio)), usingFallback: false };
}

function computePlannerRequirements() {
  const perPerson = getPerPersonValue();
  const closingRatioDecimal = plannerState.closingRatio / 100;
  const closingRatioValid = closingRatioDecimal > 0;

  const qualifiedRatioInfo = safeRatio(scoreBreakdown.qualified, counters.scores, FALLBACK_QUALIFIED_RATE);
  const scorePerPitchInfo = safeRatio(counters.scores, counters.pitches, FALLBACK_SCORE_RATE);

  if (perPerson <= 0 || !closingRatioValid) {
    return {
      perPerson,
      closingRatioDecimal,
      qualifiedRatioInfo,
      scorePerPitchInfo,
      bookedNeeded: 0,
      qualifiedNeeded: 0,
      scoresNeeded: 0,
      pitch