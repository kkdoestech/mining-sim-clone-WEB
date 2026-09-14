/**
 * @file format.js
 * @description Alphabetical Big Number Formatter module for the idle mining simulator.
 * Formats large numerical values using standard incremental game alphabetical tier notation
 * (e.g., 1,250 -> "1.25a", 1,500,000 -> "1.50b", 2,400,000,000 -> "2.40c").
 */

/**
 * Standard incremental alphabetical notation suffixes.
 * Each index corresponds to 10^(index * 3).
 * index 0: "" (< 1,000)
 * index 1: "a" (thousands, 10^3)
 * index 2: "b" (millions, 10^6)
 * index 3: "c" (billions, 10^9)
 * ...
 */
export const SUFFIXES = [
  "", "a", "b", "c", "d", "e", "f", "g", "h", "i",
  "j", "k", "l", "m", "n", "o", "p", "q", "r", "s",
  "t", "u", "v", "w", "x", "y", "z", "aa", "ab", "ac"
];

/**
 * Formats a numerical value using alphabetical tier suffixes with 2 decimal precision.
 *
 * Examples:
 * - formatNumber(950) -> "950"
 * - formatNumber(1250) -> "1.25a"
 * - formatNumber(1500000) -> "1.50b"
 * - formatNumber(2400000000) -> "2.40c"
 *
 * @param {number | string} value - The numerical value to format
 * @returns {string} Formatted string
 */
export function formatNumber(value) {
  const num = typeof value === 'number' ? value : parseFloat(value);

  if (num === null || num === undefined || isNaN(num)) {
    return '0';
  }

  // Handle negative numbers cleanly
  if (num < 0) {
    return '-' + formatNumber(-num);
  }

  // Values strictly below 1,000 are displayed as floored integers
  if (num < 1000) {
    return Math.floor(num).toString();
  }

  // Compute tier index: 1 for 10^3, 2 for 10^6, 3 for 10^9, etc.
  const tier = Math.floor(Math.log10(Math.max(1, num)) / 3);

  // If beyond our registered suffixes, fallback to scientific notation
  if (tier >= SUFFIXES.length) {
    return num.toExponential(2);
  }

  // Calculate scaled value
  const scaled = num / Math.pow(10, tier * 3);

  // Return formatted string with 2 decimal places and the suffix
  return scaled.toFixed(2) + SUFFIXES[tier];
}

/**
 * Parses an alphabetical formatted number string back into a standard JavaScript number.
 *
 * Examples:
 * - parseFormattedNumber("950") -> 950
 * - parseFormattedNumber("1.25a") -> 1250
 * - parseFormattedNumber("1.50b") -> 1500000
 *
 * @param {string} str - Formatted string (e.g. "1.25a", "+50b", "100")
 * @returns {number} Parsed numerical value
 */
export function parseFormattedNumber(str) {
  if (typeof str !== 'string') {
    return typeof str === 'number' ? str : 0;
  }

  // Clean whitespace, currency symbols, and plus signs
  const cleaned = str.replace(/[🪙💎\s+]/g, '').trim().toLowerCase();
  if (!cleaned) return 0;

  // Handle negative sign
  const isNegative = cleaned.startsWith('-');
  const unsigned = isNegative ? cleaned.slice(1) : cleaned;

  // Match number part and trailing suffix letters
  const match = unsigned.match(/^([\d.]+)([a-z]*)$/);
  if (!match) {
    const fallback = parseFloat(unsigned);
    return isNaN(fallback) ? 0 : (isNegative ? -fallback : fallback);
  }

  const baseVal = parseFloat(match[1]);
  const suffix = match[2];

  if (isNaN(baseVal)) return 0;
  if (!suffix) return isNegative ? -baseVal : baseVal;

  const tier = SUFFIXES.indexOf(suffix);
  if (tier === -1) {
    return isNegative ? -baseVal : baseVal;
  }

  const result = baseVal * Math.pow(10, tier * 3);
  return isNegative ? -result : result;
}

