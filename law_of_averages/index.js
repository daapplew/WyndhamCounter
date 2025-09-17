const HURDLE_VALUES = {
  1: 160,
  2: 224,
  3: 288,
  4: 314,
  5: 352,
};

const counters = {
  scores: 0,
  pitches: 0,
  booked: 0,
};

let selectedHurdle = 2;
let averageGiftCost = 75;

const scoreBreakdown = {
  qualified: 0,
  nq: 0,
};

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
const scorePrompt = document.getElementById('scorePrompt');
const hurdlePrompt = document.getElementById('hurdlePrompt');
const avgGiftInput = document.getElementById('avgGiftInput');

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
  const base = HURDLE_VALUES[selectedHurdle] ?? 0;
  const perPerson = Math.max(0, base - averageGiftCost);
  const total = counters.booked * perPerson;
  const digits = Number.isInteger(total) ? 0 : 2;
  revenueElement.textContent = formatCurrency(total, digits);
}

function renderAll() {
  Object.keys(displayElements).forEach((key) => renderCounter(key));
  renderScoreBreakdown();
  updateRatio();
  updateRevenue();
  updateMoneyMeta();
}

function promptScoreSelection() {
  if (!scorePrompt) {
    return Promise.resolve(null);
  }
  if (scorePrompt.open) {
    return Promise.resolve(null);
  }

  scorePrompt.returnValue = '';

  return new Promise((resolve) => {
    const handleClose = () => {
      scorePrompt.removeEventListener('close', handleClose);
      const choice = scorePrompt.returnValue;
      if (choice === 'qualified' || choice === 'nq') {
        resolve(choice);
      } else {
        resolve(null);
      }
    };

    scorePrompt.addEventListener('close', handleClose, { once: true });
    scorePrompt.showModal();
  });
}

function incrementScore(choice) {
  counters.scores += 1;
  if (choice === 'qualified') {
    scoreBreakdown.qualified += 1;
  } else if (choice === 'nq') {
    scoreBreakdown.nq += 1;
  }
}

function decrementScore() {
  if (counters.scores === 0) {
    return;
  }
  if (scoreBreakdown.nq > 0) {
    scoreBreakdown.nq -= 1;
    counters.scores -= 1;
    return;
  }
  if (scoreBreakdown.qualified > 0) {
    scoreBreakdown.qualified -= 1;
    counters.scores -= 1;
  }
}

function updateMoneyMeta() {
  hurdleButtons.forEach((button) => {
    const value = Number(button.dataset.hurdle);
    button.classList.toggle('is-active', value === selectedHurdle);
  });

  if (hurdleLabel) {
    hurdleLabel.textContent = selectedHurdle;
  }

  if (giftCostLabel) {
    const digits = Number.isInteger(averageGiftCost) ? 0 : 2;
    giftCostLabel.textContent = formatCurrency(averageGiftCost, digits);
  }
}

function openHurdlePrompt(hurdle) {
  if (!hurdlePrompt) {
    return Promise.resolve(null);
  }

  if (avgGiftInput) {
    avgGiftInput.value = Number.isFinite(averageGiftCost) ? String(averageGiftCost) : '';
  }

  hurdlePrompt.returnValue = '';

  return new Promise((resolve) => {
    const handleClose = () => {
      hurdlePrompt.removeEventListener('close', handleClose);
      if (hurdlePrompt.returnValue === 'save' && avgGiftInput) {
        const parsed = Number.parseFloat(avgGiftInput.value);
        if (Number.isFinite(parsed) && parsed >= 0) {
          resolve({ hurdle, avgGiftCost: parsed });
          return;
        }
      }
      resolve(null);
    };

    hurdlePrompt.addEventListener('close', handleClose, { once: true });
    hurdlePrompt.showModal();
    if (avgGiftInput) {
      requestAnimationFrame(() => {
        avgGiftInput.select();
      });
    }
  });
}

Object.entries(counterElements).forEach(([key, counterEl]) => {
  if (!counterEl) {
    return;
  }

  const controls = counterEl.querySelector('.counter__controls');
  if (!controls) {
    return;
  }

  controls.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) {
      return;
    }

    const action = button.dataset.action;

    if (action === 'increment') {
      if (key === 'scores') {
        const choice = await promptScoreSelection();
        if (!choice) {
          return;
        }
        incrementScore(choice);
      } else {
        counters[key] += 1;
      }
    } else if (action === 'decrement') {
      if (key === 'scores') {
        decrementScore();
      } else {
        counters[key] = Math.max(0, counters[key] - 1);
      }
    }

    renderAll();
  });
});

hurdleButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    const hurdle = Number(button.dataset.hurdle);
    if (!Number.isInteger(hurdle) || hurdle < 1 || hurdle > 5) {
      return;
    }

    const result = await openHurdlePrompt(hurdle);
    if (!result) {
      updateMoneyMeta();
      return;
    }

    selectedHurdle = result.hurdle;
    averageGiftCost = result.avgGiftCost;
    renderAll();
  });
});

if (resetButton) {
  resetButton.addEventListener('click', () => {
    Object.keys(counters).forEach((key) => {
      counters[key] = 0;
    });
    Object.keys(scoreBreakdown).forEach((key) => {
      scoreBreakdown[key] = 0;
    });
    renderAll();
  });
}

renderAll();
