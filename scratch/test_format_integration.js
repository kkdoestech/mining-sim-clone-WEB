import assert from 'node:assert';
import { formatNumber, parseFormattedNumber, SUFFIXES } from '../js/utils/format.js';
import { formatNumber as formatFromStations } from '../js/stations.js';
import { formatNumber as formatFromJuice } from '../js/juice.js';
import { formatNumber as formatFromUI } from '../js/ui.js';
import { formatNumber as formatFromEconomy } from '../js/economy.js';

console.log('--- TEST 1: Suffixes Catalog ---');
assert.strictEqual(SUFFIXES.length, 30, 'SUFFIXES must have 30 items');
assert.strictEqual(SUFFIXES[0], '');
assert.strictEqual(SUFFIXES[1], 'a');
assert.strictEqual(SUFFIXES[2], 'b');
assert.strictEqual(SUFFIXES[3], 'c');
assert.strictEqual(SUFFIXES[26], 'z');
assert.strictEqual(SUFFIXES[27], 'aa');
assert.strictEqual(SUFFIXES[28], 'ab');
assert.strictEqual(SUFFIXES[29], 'ac');
console.log('✓ Suffixes array verified');

console.log('--- TEST 2: formatNumber Numerical Conversions ---');
assert.strictEqual(formatNumber(0), '0');
assert.strictEqual(formatNumber(950), '950');
assert.strictEqual(formatNumber(999.9), '999');
assert.strictEqual(formatNumber(1250), '1.25a');
assert.strictEqual(formatNumber(1500000), '1.50b');
assert.strictEqual(formatNumber(2400000000), '2.40c');
assert.strictEqual(formatNumber(1000000000000), '1.00d');
assert.strictEqual(formatNumber(1e15), '1.00e');
assert.strictEqual(formatNumber(-1250), '-1.25a');
assert.strictEqual(formatNumber(null), '0');
assert.strictEqual(formatNumber(NaN), '0');
assert.strictEqual(formatNumber('5000'), '5.00a');
console.log('✓ All formatNumber conversions verified');

console.log('--- TEST 3: parseFormattedNumber Reverse Conversions ---');
assert.strictEqual(parseFormattedNumber('950'), 950);
assert.strictEqual(parseFormattedNumber('1.25a'), 1250);
assert.strictEqual(parseFormattedNumber('1.50b'), 1500000);
assert.strictEqual(parseFormattedNumber('2.40c'), 2400000000);
assert.strictEqual(parseFormattedNumber('+25a 🪙'), 25000);
assert.strictEqual(parseFormattedNumber('-1.5b'), -1500000);
console.log('✓ parseFormattedNumber reverse conversions verified');

console.log('--- TEST 4: Cross-Module Exports ---');
assert.strictEqual(formatFromStations(1250), '1.25a');
assert.strictEqual(formatFromJuice(1500000), '1.50b');
assert.strictEqual(formatFromUI(2400000000), '2.40c');
assert.strictEqual(formatFromEconomy(10000), '10.00a');
console.log('✓ formatNumber cross-module re-exports verified');

console.log('\n🎉 ALL FORMATTER TESTS PASSED SUCCESSFULLY!');
