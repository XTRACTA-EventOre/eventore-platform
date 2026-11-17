import { describe, test, expect } from '@jest/globals';
import { mass, formatMass, compareCheckpoint, percentage } from '../../src/shared/domain/decimalMass.js';
describe('exact mass arithmetic and checkpoint tolerance', () => {
  test('does not introduce floating point error in sums and unit conversions', () => {
    expect(formatMass(mass('0.1','kg') + mass('0.2','kg'), 'kg')).toBe('0.3');
    expect(mass('1','kg')).toBe(mass('1000','g'));
    const exact = '12345678901234567890123456789012345.123456789012345678901234567891';
    expect(formatMass(mass(exact,'g'),'g')).toBe(exact);
  });
  test('exactly 10 percent is critical while a smaller loss is not', () => {
    expect(compareCheckpoint({ weight: '100', weightUnit: 'kg' }, { weight: '90000', weightUnit: 'g' })).toMatchObject({ critical: true, lossPercentage: '10' });
    expect(compareCheckpoint({ weight: '100', weightUnit: 'kg' }, { weight: '90.000000000000000000000000000001', weightUnit: 'kg' }).critical).toBe(false);
    expect(compareCheckpoint({ weight: '100', weightUnit: 'kg' }, { weight: '110', weightUnit: 'kg' }).critical).toBe(false);
    expect(percentage(0n,1n)).toBe('0');
  });
  test('rejects unsupported units and invalid reference values', () => {
    expect(() => mass('1','oz')).toThrow('g, kg o t');
    expect(() => mass('0','kg')).toThrow('positiva');
    expect(() => percentage(1n,0n)).toThrow('positiva');
  });
});
