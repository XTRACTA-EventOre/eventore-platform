import { OperationError } from '../application/OperationError.js';
export const SCALE = 10n ** 30n;
const units = { g: 1n, kg: 1000n, t: 1000000n };
export function decimal(value, { zero = false } = {}) {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) throw new OperationError(400, 'INVALID_MASS', 'Indica una cantidad decimal válida');
  const [integer, fraction = ''] = value.split('.');
  if (integer.length > 35 || fraction.length > 30) throw new OperationError(400, 'INVALID_MASS_PRECISION', 'La cantidad admite 35 dígitos enteros y 30 decimales');
  const result = BigInt(integer) * SCALE + BigInt(fraction.padEnd(30, '0'));
  if (result === 0n && !zero) throw new OperationError(400, 'INVALID_MASS', 'La cantidad debe ser positiva');
  return result;
}
export function mass(weight, unit, options) {
  if (!Object.hasOwn(units, unit)) throw new OperationError(400, 'INVALID_UNIT', 'Usa g, kg o t');
  return decimal(weight, options) * units[unit];
}
export function formatDecimal(value) {
  const negative = value < 0n; if (negative) value = -value;
  const integer = value / SCALE, fraction = (value % SCALE).toString().padStart(30, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${integer}${fraction ? '.' + fraction : ''}`;
}
export function formatMass(value, unit) {
  if (!Object.hasOwn(units, unit) || value % units[unit] !== 0n) throw new OperationError(400, 'UNREPRESENTABLE_MASS', 'La conversión excede la precisión admitida');
  const result = formatDecimal(value / units[unit]); decimal(result, { zero: true }); return result;
}
export function percentage(part, total) {
  if (total <= 0n) throw new OperationError(400, 'INVALID_REFERENCE', 'La masa de referencia debe ser positiva');
  const micros = part * 100000000n / total;
  return `${micros / 1000000n}.${(micros % 1000000n).toString().padStart(6, '0')}`.replace(/\.?0+$/, '');
}
export function compareCheckpoint(reference, measured) {
  const before = mass(reference.weight, reference.weightUnit), after = mass(measured.weight, measured.weightUnit);
  const loss = before > after ? before - after : 0n;
  return { referenceWeight: reference.weight, referenceUnit: reference.weightUnit,
    measuredWeight: measured.weight, measuredUnit: measured.weightUnit,
    lossPercentage: percentage(loss, before), critical: loss * 100n >= before * 10n,
    interpretation: 'Diferencia de peso por investigar; no demuestra robo' };
}
