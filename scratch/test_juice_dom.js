import assert from 'node:assert';

// Create a minimal DOM mock for testing juice.js in node
globalThis.document = {
  _rocks: {},
  getElementById(id) {
    if (id === 'mine-stage') {
      return this._stage;
    }
    if (id === 'juice-container') {
      return this._stage?.querySelector('#juice-container');
    }
    if (id.startsWith('rock-')) {
      if (!this._rocks[id]) {
        this._rocks[id] = {
          id,
          classList: {
            classes: new Set(),
            remove(cls) { this.classes.delete(cls); },
            add(cls) { this.classes.add(cls); },
            contains(cls) { return this.classes.has(cls); }
          },
          offsetWidth: 50,
          getBoundingClientRect() {
            return { left: 50, top: 150, width: 50, height: 50 };
          }
        };
      }
      return this._rocks[id];
    }
    return null;
  },
  createElement(tag) {
    const el = {
      tagName: tag.toUpperCase(),
      className: '',
      textContent: '',
      style: {
        _props: {},
        setProperty(k, v) { this._props[k] = v; },
        getProperty(k) { return this._props[k]; }
      },
      setAttribute(k, v) {
        this._attrs = this._attrs || {};
        this._attrs[k] = v;
      },
      parentNode: null,
      children: [],
      listeners: {},
      addEventListener(evt, fn) {
        this.listeners[evt] = this.listeners[evt] || [];
        this.listeners[evt].push(fn);
      },
      dispatchEvent(evt) {
        if (this.listeners[evt]) {
          this.listeners[evt].forEach(f => f());
        }
      },
      appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
        return child;
      },
      removeChild(child) {
        const idx = this.children.indexOf(child);
        if (idx !== -1) {
          this.children.splice(idx, 1);
          child.parentNode = null;
        }
        return child;
      },
      querySelector(sel) {
        if (sel === '#juice-container') {
          return this.children.find(c => c.id === 'juice-container') || null;
        }
        return null;
      }
    };
    return el;
  }
};

globalThis.document._stage = globalThis.document.createElement('div');
globalThis.document._stage.id = 'mine-stage';
globalThis.document._stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: 480, height: 480 });

const {
  createFloatingText,
  createRockImpactParticles,
  triggerOreNodePunch,
  getStationRockCoords
} = await import('../js/juice.js');

console.log('--- TEST 1: createFloatingText DOM Lifecycle ---');
const span = createFloatingText(100, 150, '+25 🪙', '#f5a623');
assert.ok(span, 'Floating text element must be created');
assert.strictEqual(span.tagName, 'SPAN');
assert.strictEqual(span.textContent, '+25 🪙');
assert.strictEqual(span.style.left, '100px');
assert.strictEqual(span.style.top, '150px');
assert.strictEqual(span.style.color, '#f5a623');
assert.ok(span.parentNode, 'Span must be attached to parent container');

// Dispatch animationend event -> should cleanly remove from DOM
span.dispatchEvent('animationend');
assert.strictEqual(span.parentNode, null, 'Span must be removed from parent upon animationend');
console.log('✓ Floating text DOM creation and self-cleanup verified');

console.log('--- TEST 2: createRockImpactParticles Dispersal ---');
const container = globalThis.document.getElementById('juice-container');
const beforeCount = container.children.length;

createRockImpactParticles(75, 150, '#d97706');
const afterCount = container.children.length;
const spawned = afterCount - beforeCount;
assert.ok(spawned >= 4 && spawned <= 6, `Expected 4-6 particles spawned, got ${spawned}`);

// Check first particle styles and custom properties
const p1 = container.children[beforeCount];
assert.strictEqual(p1.style.backgroundColor, '#d97706');
assert.strictEqual(p1.style.left, '75px');
assert.strictEqual(p1.style.top, '150px');
assert.ok(p1.style._props['--tx'], 'Particle must have --tx property');
assert.ok(p1.style._props['--ty'], 'Particle must have --ty property');
assert.ok(p1.style._props['--drop'], 'Particle must have --drop property');
assert.ok(p1.style._props['--rot'], 'Particle must have --rot property');

// Animationend cleanup
p1.dispatchEvent('animationend');
assert.strictEqual(p1.parentNode, null, 'Particle must remove itself on animationend');
console.log('✓ Rock impact particle dispersal and cleanup verified');

console.log('--- TEST 3: triggerOreNodePunch Animation Trigger ---');
triggerOreNodePunch('station-1');
const rock = globalThis.document.getElementById('rock-station-1');
assert.ok(rock.classList.contains('node-squash-punch'), 'Ore rock must have node-squash-punch class');
console.log('✓ Ore node squash punch animation class verified');

console.log('\n🎉 ALL DOM JUICE TESTS PASSED SUCCESSFULLY!');
