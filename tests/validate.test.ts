import { describe, expect, it } from '@rstest/core';
import validate from '../src/utils/validate';

describe('value validation', () => {
  it.each(['', null, undefined])('recognizes empty %s', (value) => expect(validate.isEmpty(value)).toBe(true));
  it.each([0, false, [], {}, ' '])('preserves nonempty %s', (value) => expect(validate.isEmpty(value)).toBe(false));
  it.each([0, '', false, []])('recognizes set %s', (value) => expect(validate.isSet(value)).toBe(true));
  it.each([null, undefined])('rejects unset %s', (value) => expect(validate.isSet(value)).toBe(false));
  it('distinguishes arrays, objects, strings and numbers', () => {
    expect(validate.isArray([])).toBe(true);
    expect(validate.isArray({})).toBe(false);
    expect(validate.isObject({})).toBe(true);
    expect(validate.isObject(null)).toBe(false);
    expect(validate.isObject([])).toBe(false);
    expect(validate.isObject('x')).toBe(false);
    expect(validate.isNumber(1)).toBe(true);
    expect(validate.isNumber(Number.NaN)).toBe(false);
    expect(validate.isNumber('1')).toBe(false);
    expect(validate.isString('')).toBe(true);
    expect(validate.isString(1)).toBe(false);
  });
  it('checks own properties without trusting overridden prototype methods', () => {
    const object = Object.assign(Object.create({ inherited: 1 }), { own: 2, hasOwnProperty: null });
    expect(validate.hasOwn(object, 'own')).toBe(true);
    expect(validate.hasOwn(object, 'inherited')).toBe(false);
    expect(validate.hasOwn(Object.create(null), 'missing')).toBe(false);
  });
});
