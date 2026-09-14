/**
 * @file juice.js
 * @description Game Feel & Juice system providing floating combat/economy text,
 * dynamic rock impact particle bursts, and squash-and-stretch impact animations.
 */

/**
 * Retrieves or lazily creates the dedicated overlay container inside #mine-stage.
 * @returns {HTMLElement | null}
 */
export function getJuiceContainer() {
  if (typeof document === 'undefined') return null;

  let container = document.getElementById('juice-container');
  if (!container) {
    const stage = document.getElementById('mine-stage');
    if (stage) {
      container = document.createElement('div');
      container.id = 'juice-container';
      container.className = 'juice-layer';
      container.setAttribute('aria-hidden', 'true');
      stage.appendChild(container);
    }
  }
  return container;
}

/**
 * Spawns a lightweight DOM <span> at (x, y) with text like "+15 🪙" or "CRIT!".
 * Floats upward by 40px while fading out over 800ms, then self-destructs on animationend.
 *
 * @param {number} x - Horizontal coordinate relative to #mine-stage
 * @param {number} y - Vertical coordinate relative to #mine-stage
 * @param {string} text - Floating label text
 * @param {string} [color='#f5a623'] - CSS color string for text
 * @returns {HTMLSpanElement | null}
 */
export function createFloatingText(x, y, text, color = '#f5a623') {
  const container = getJuiceContainer();
  if (!container) return null;

  const span = document.createElement('span');
  span.className = 'juice-floating-text';
  span.textContent = text;
  span.style.left = `${Math.round(x)}px`;
  span.style.top = `${Math.round(y)}px`;

  if (color) {
    span.style.color = color;
  }

  // Self-destruct cleanly on animation completion
  const cleanup = () => {
    if (span.parentNode) {
      span.parentNode.removeChild(span);
    }
  };

  span.addEventListener('animationend', cleanup, { once: true });
  // Fallback safety timer if tab is backgrounded
  setTimeout(cleanup, 900);

  container.appendChild(span);
  return span;
}

/**
 * Spawns 4 to 6 tiny square particles around (x, y).
 * Disperses outward with randomized velocities and gravity drop, self-destructing after 400ms.
 *
 * @param {number} x - Horizontal impact coordinate
 * @param {number} y - Vertical impact coordinate
 * @param {string} [color='#927856'] - Particle color hex or CSS color
 */
export function createRockImpactParticles(x, y, color = '#927856') {
  const container = getJuiceContainer();
  if (!container) return;

  // 4 to 6 particles per hit
  const count = 4 + Math.floor(Math.random() * 3);

  for (let i = 0; i < count; i++) {
    const particle = document.createElement('div');
    particle.className = 'juice-rock-particle';

    // Randomized physical characteristics
    const size = 3 + Math.floor(Math.random() * 4); // 3px to 6px
    const tx = Math.round((Math.random() - 0.5) * 50); // -25px to +25px horizontal scatter
    const ty = Math.round(-10 - Math.random() * 24);   // -10px to -34px initial burst upward
    const drop = Math.round(20 + Math.random() * 28);  // downward gravity fall
    const rot = Math.round((Math.random() - 0.5) * 480); // rotation tumble

    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.backgroundColor = color;
    particle.style.left = `${Math.round(x)}px`;
    particle.style.top = `${Math.round(y)}px`;
    particle.style.setProperty('--tx', `${tx}px`);
    particle.style.setProperty('--ty', `${ty}px`);
    particle.style.setProperty('--drop', `${drop}px`);
    particle.style.setProperty('--rot', `${rot}deg`);

    const cleanup = () => {
      if (particle.parentNode) {
        particle.parentNode.removeChild(particle);
      }
    };

    particle.addEventListener('animationend', cleanup, { once: true });
    setTimeout(cleanup, 450); // Fallback timeout

    container.appendChild(particle);
  }
}

/**
 * Triggers a subtle squash-and-stretch CSS punch animation on the ore node rock.
 * @param {string} stationId - Element id of the station (e.g. 'station-1')
 */
export function triggerOreNodePunch(stationId) {
  if (typeof document === 'undefined') return;

  const rock = document.getElementById(`rock-${stationId}`);
  if (!rock) return;

  rock.classList.remove('node-squash-punch');
  // Trigger DOM reflow to restart CSS animation cleanly
  void rock.offsetWidth;
  rock.classList.add('node-squash-punch');
}

/**
 * Computes exact center coordinates (x, y) of a station's ore node rock
 * relative to the #mine-stage arena container.
 * @param {string} stationId
 * @returns {{ x: number, y: number }}
 */
export function getStationRockCoords(stationId) {
  if (typeof document !== 'undefined') {
    const stage = document.getElementById('mine-stage');
    const rock = document.getElementById(`rock-${stationId}`);
    if (stage && rock) {
      const stageRect = stage.getBoundingClientRect();
      const rockRect = rock.getBoundingClientRect();
      return {
        x: Math.round(rockRect.left - stageRect.left + rockRect.width / 2),
        y: Math.round(rockRect.top - stageRect.top + rockRect.height / 2)
      };
    }
  }

  // Reliable fallback coordinates based on station layout
  switch (stationId) {
    case 'station-1': return { x: 74, y: 152 };
    case 'station-2': return { x: 74, y: 256 };
    case 'station-3': return { x: 74, y: 362 };
    default: return { x: 74, y: 152 };
  }
}

/**
 * Maps station ids to their characteristic mineral particle color.
 * @param {string} stationId
 * @returns {string}
 */
export function getStationParticleColor(stationId) {
  switch (stationId) {
    case 'station-1':
      return '#8b6d48'; // Dirt & Coal brown/earth
    case 'station-2':
      return '#d97706'; // Copper reddish-bronze
    case 'station-3':
      return '#fbbf24'; // Gold glittering amber
    default:
      return '#9ca3af'; // Neutral rock stone
  }
}

