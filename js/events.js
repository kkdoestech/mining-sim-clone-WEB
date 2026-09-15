/**
 * @file events.js
 * @description Live-Ops Flash Events System for the idle mining simulator.
 * Dynamically triggers high-impact temporary events every 3.5 minutes for 45 seconds:
 * - 2X_POWDER_RUSH: Doubles all Mithril Powder earned from bounties and node breaks.
 * - GOBLIN_THIEF: Spawns a mischievous goblin sprite running across the bottom floor,
 *   clickable up to 5 times for sudden bursts of +50a coins or +25 powder.
 */

import { gameState } from './state.js';
import {
  createFloatingText,
  createRockImpactParticles,
  shake
} from './juice.js';

export const FLASH_EVENTS = {
  POWDER_RUSH: '2X_POWDER_RUSH',
  GOBLIN_THIEF: 'GOBLIN_THIEF'
};

export const EVENT_INTERVAL = 210; // 3.5 minutes in seconds
export const EVENT_DURATION = 45;  // 45 seconds duration
export const MAX_GOBLIN_CLICKS = 5;

/**
 * Runtime state for Live-Ops Flash Events
 */
export const eventsState = {
  /** @type {string | null} */
  activeEvent: null,
  eventTimer: 0,
  nextEventTimer: EVENT_INTERVAL,
  goblinClicksLeft: MAX_GOBLIN_CLICKS
};

/**
 * Checks whether a specific flash event (or any event) is currently active.
 * @param {string} [eventName]
 * @returns {boolean}
 */
export function isFlashEventActive(eventName) {
  if (eventName) {
    return eventsState.activeEvent === eventName;
  }
  return eventsState.activeEvent !== null;
}

/**
 * Formats seconds into mm:ss format (e.g. 00:32).
 * @param {number} seconds
 * @returns {string}
 */
export function formatTimeRemaining(seconds) {
  const total = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(total / 60).toLocaleString();
  const secs = total % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Returns human-readable display title for an active event.
 * @param {string} eventName
 * @returns {string}
 */
export function getEventDisplayTitle(eventName) {
  switch (eventName) {
    case FLASH_EVENTS.POWDER_RUSH:
      return '2X POWDER RUSH 🟣';
    case FLASH_EVENTS.GOBLIN_THIEF:
      return 'GOBLIN THIEF ENCOUNTER 🧌';
    default:
      return eventName;
  }
}

/**
 * Starts a flash event by name, or rolls a random one if omitted.
 * @param {string} [eventType]
 * @returns {string} Active event name
 */
export function startFlashEvent(eventType) {
  const selected = eventType || (Math.random() < 0.5 ? FLASH_EVENTS.POWDER_RUSH : FLASH_EVENTS.GOBLIN_THIEF);

  eventsState.activeEvent = selected;
  eventsState.eventTimer = EVENT_DURATION;
  eventsState.goblinClicksLeft = MAX_GOBLIN_CLICKS;

  updateFlashEventBarDOM();

  if (selected === FLASH_EVENTS.GOBLIN_THIEF) {
    spawnGoblinThiefDOM();
  }

  // Audio/Visual juice alert
  if (typeof document !== 'undefined') {
    const stage = document.getElementById('mine-stage');
    if (stage) {
      createFloatingText(
        160,
        90,
        `⚡ FLASH EVENT: ${getEventDisplayTitle(selected)}!`,
        selected === FLASH_EVENTS.POWDER_RUSH ? '#c084fc' : '#4ade80'
      );
    }
  }

  return selected;
}

/**
 * Concludes the active flash event, cleans up sprites and timers, and hides alert bar.
 */
export function endFlashEvent() {
  eventsState.activeEvent = null;
  eventsState.eventTimer = 0;
  eventsState.nextEventTimer = EVENT_INTERVAL;
  eventsState.goblinClicksLeft = MAX_GOBLIN_CLICKS;

  removeGoblinThiefDOM();
  updateFlashEventBarDOM();
}

/**
 * Ticks flash event timers by delta time every frame inside the 60FPS loop.
 * @param {number} dt - Frame delta time in seconds
 */
export function updateEvents(dt) {
  if (eventsState.activeEvent) {
    eventsState.eventTimer = Math.max(0, eventsState.eventTimer - dt);

    if (eventsState.eventTimer <= 0) {
      endFlashEvent();
    } else {
      updateFlashEventBarDOM();
    }
  } else {
    eventsState.nextEventTimer = Math.max(0, eventsState.nextEventTimer - dt);

    if (eventsState.nextEventTimer <= 0) {
      startFlashEvent();
    }
  }
}

/** Cache for tracking previous second integer to prevent DOM text thrashing */
let lastEventSeconds = -1;

/**
 * Synchronizes the top alert bar DOM elements with current event state.
 */
export function updateFlashEventBarDOM() {
  if (typeof document === 'undefined') return;

  const bar = document.getElementById('flash-event-bar');
  if (!bar) return;

  if (!eventsState.activeEvent) {
    if (!bar.classList.contains('hidden')) {
      bar.classList.add('hidden');
    }
    lastEventSeconds = -1;
    return;
  }

  if (bar.classList.contains('hidden')) {
    bar.classList.remove('hidden');
  }

  // Visual theme class depending on event type
  bar.classList.toggle('theme-powder-rush', eventsState.activeEvent === FLASH_EVENTS.POWDER_RUSH);
  bar.classList.toggle('theme-goblin-thief', eventsState.activeEvent === FLASH_EVENTS.GOBLIN_THIEF);

  const titleEl = document.getElementById('flash-event-title');
  if (titleEl) {
    const expectedTitle = `⚡ FLASH EVENT: ${getEventDisplayTitle(eventsState.activeEvent)}`;
    if (titleEl.textContent !== expectedTitle) {
      titleEl.textContent = expectedTitle;
    }
  }

  const timerEl = document.getElementById('flash-event-timer');
  const remainingSec = Math.ceil(eventsState.eventTimer);

  if (timerEl && remainingSec !== lastEventSeconds) {
    lastEventSeconds = remainingSec;
    timerEl.textContent = `(${formatTimeRemaining(eventsState.eventTimer)} remaining)`;
  }
}

/**
 * Injects the animated Goblin Thief sprite DOM element onto the quarry bottom floor.
 */
export function spawnGoblinThiefDOM() {
  if (typeof document === 'undefined') return;

  removeGoblinThiefDOM();

  const stage = document.getElementById('mine-stage');
  if (!stage) return;

  const goblin = document.createElement('div');
  goblin.id = 'goblin-runner';
  goblin.className = 'goblin-runner';
  goblin.setAttribute('data-action', 'hit-goblin');
  goblin.setAttribute('title', 'Click to attack Goblin Thief!');

  goblin.innerHTML = `
    <div class="goblin-speech">Catch me! 💰</div>
    <div class="goblin-pips" id="goblin-pips">
      ${'<span class="pip pip-full"></span>'.repeat(MAX_GOBLIN_CLICKS)}
    </div>
    <div class="goblin-sprite-wrap">
      <span class="goblin-sprite">🧌</span>
      <span class="goblin-loot-bag">🎒</span>
    </div>
  `;

  stage.appendChild(goblin);
}

/**
 * Removes the Goblin Thief DOM element if present.
 */
export function removeGoblinThiefDOM() {
  if (typeof document === 'undefined') return;

  const goblin = document.getElementById('goblin-runner');
  if (goblin && goblin.parentNode) {
    goblin.parentNode.removeChild(goblin);
  }
}

/**
 * Handles the player clicking / tapping the Goblin Thief sprite:
 * 1. Decrements available clicks (up to 5 clicks max).
 * 2. Rewards random drop: 50% chance for +50.00a coins, 50% for +25 Mithril Powder.
 * 3. Spawns impact juice particles and floating combat text.
 * 4. Updates hit pips.
 * 5. On 5th hit, triggers poof escape and concludes event.
 *
 * @param {MouseEvent | TouchEvent} [clickEvent]
 * @returns {{ success: boolean, rewardType?: 'coins' | 'powder', amount?: number, clicksRemaining?: number }}
 */
export function onClickGoblinThief(clickEvent) {
  if (eventsState.activeEvent !== FLASH_EVENTS.GOBLIN_THIEF) {
    return { success: false };
  }

  if (eventsState.goblinClicksLeft <= 0) {
    return { success: false };
  }

  eventsState.goblinClicksLeft -= 1;
  const clicksLeft = eventsState.goblinClicksLeft;

  // Determine hit location
  let hitX = 160;
  let hitY = 410;

  if (typeof document !== 'undefined') {
    const goblin = document.getElementById('goblin-runner');
    const stage = document.getElementById('mine-stage');
    if (goblin && stage) {
      const gRect = goblin.getBoundingClientRect();
      const sRect = stage.getBoundingClientRect();
      hitX = Math.round(gRect.left - sRect.left + gRect.width / 2);
      hitY = Math.round(gRect.top - sRect.top + 10);

      // Trigger squash / punch hit animation
      goblin.classList.remove('goblin-hit');
      void goblin.offsetWidth;
      goblin.classList.add('goblin-hit');

      // Update speech bubble text
      const speech = goblin.querySelector('.goblin-speech');
      if (speech) {
        const screams = ['Ouch! 💥', 'My loot! 🪙', 'Hey!! 💢', 'Hands off! 🎒', 'Yikes! 🏃'];
        speech.textContent = screams[Math.floor(Math.random() * screams.length)];
      }

      // Update hit pips
      const pipsContainer = document.getElementById('goblin-pips');
      if (pipsContainer) {
        pipsContainer.innerHTML = Array.from({ length: MAX_GOBLIN_CLICKS }, (_, i) => {
          return `<span class="pip ${i < clicksLeft ? 'pip-full' : 'pip-empty'}"></span>`;
        }).join('');
      }
    }
  }

  // 50% chance for +50a coins (50,000), 50% chance for +25 Mithril Powder
  const isPowder = Math.random() < 0.5;
  let rewardType = 'coins';
  let amount = 50000;

  if (isPowder) {
    rewardType = 'powder';
    amount = 25;
    if (typeof gameState.addPowder === 'function') {
      gameState.addPowder(amount);
    } else {
      gameState.player.powder = (gameState.player.powder || 0) + amount;
    }
    createFloatingText(hitX, hitY - 20, `+${amount} 🟣`, '#c084fc');
    createRockImpactParticles(hitX, hitY, '#c084fc');
  } else {
    if (typeof gameState.addCoins === 'function') {
      gameState.addCoins(amount);
    } else {
      gameState.player.coins += amount;
    }
    createFloatingText(hitX, hitY - 20, `+${Math.floor(amount).toLocaleString()} 🪙`, '#f5a623');
    createRockImpactParticles(hitX, hitY, '#f5a623');
  }

  // If 5 clicks exhausted, the goblin escapes / poofs away
  if (clicksLeft <= 0) {
    shake(200);
    createFloatingText(hitX, hitY - 40, 'ESCAPED! 💨', '#94a3b8');
    createRockImpactParticles(hitX, hitY, '#94a3b8');

    if (typeof document !== 'undefined') {
      const goblin = document.getElementById('goblin-runner');
      if (goblin) {
        goblin.classList.add('goblin-poof');
        setTimeout(() => {
          endFlashEvent();
        }, 300);
      } else {
        endFlashEvent();
      }
    } else {
      endFlashEvent();
    }
  }

  return {
    success: true,
    rewardType,
    amount,
    clicksRemaining: clicksLeft
  };
}

