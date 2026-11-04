import { describe, expect, it } from '@rstest/core';
import { getLineColor, getThreshold } from '../src/composables/server-monitor';

describe('monitor thresholds', () => {
  it('ignores zero and null readings', () => {
    expect(getThreshold([0, null])).toEqual({ median: 0, tolerancePercent: 0.2, min: 0, max: 0 });
    expect(getThreshold([0, 10, null])).toEqual({ median: 10, tolerancePercent: 0.5, min: 10, max: 10 });
  });
  it.each([[10, 0.5], [30, 0.35], [50, 0.25], [100, 0.2], [101, 0.15]])(
    'sets the tolerance for median %s', (value, tolerancePercent) => {
      expect(getThreshold([value])).toMatchObject({ median: value, tolerancePercent });
    },
  );
  it('finds an even median without mutating samples', () => {
    const values = [40, 10, 30, 20];
    expect(getThreshold(values)).toEqual({ median: 25, tolerancePercent: 0.35, min: 10, max: 40 });
    expect(values).toEqual([40, 10, 30, 20]);
  });
  it('trims ten percent of samples from both ends for median calculation', () => {
    expect(getThreshold([1000, 3, 6, 7, 8, 1, 2, 4, 5, 9])).toEqual({
      median: 5.5, tolerancePercent: 0.5, min: 1, max: 1000,
    });
  });
});

describe('monitor line colors', () => {
  it('assigns stable colors and cycles through the palette', () => {
    const names = Array.from({ length: 17 }, (_, index) => `test-monitor-${index}`);
    const colors = names.map(getLineColor);
    expect(colors[0]).toBe('#4e90ff');
    expect(colors[16]).toBe(colors[0]);
    expect(getLineColor(names[1])).toBe(colors[1]);
  });
});
