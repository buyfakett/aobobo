import { describe, expect, it } from '@rstest/core';
import {
  calcBinary, calcDiskDisplay, calcTransfer, formatCPUText, formatDiskSize,
  getCPUInfo, getPlatformLogoIconClassName, getSystemOSLabel, truncateDecimal,
} from '../src/utils/host';

describe('host CPU information', () => {
  it('normalizes Intel text at word boundaries', () => {
    expect(formatCPUText('Intel INTEL intel Intellect')).toBe('intel intel intel Intellect');
    expect(formatCPUText()).toBe('');
  });
  it.each([
    ['AMD Ryzen 9 7950X 16 Physical Core', 'AMD', 'Ryzen', '7950X', '16'],
    ['AMD Ryzen TR 3990WX 64 Virtual Core', 'AMD', 'Ryzen', '3990WX', '64'],
    ['AMD Ryzen processor 5700G', 'AMD', 'Ryzen', '5700G', ''],
    ['AMD EPYC 7B13 8 Virtual Core', 'AMD', 'EPYC', '7B13', '8'],
    ['Intel Xeon E5-2690 v4 2 Physics Core', 'intel', 'Xeon', 'E5-2690 v4', '2'],
    ['Intel Xeon Platinum 8352Y', 'intel', 'Xeon', '8352Y', ''],
    ['Intel Xeon Gold 6248R', 'intel', 'Xeon', '6248R', ''],
    ['Apple M2', 'Apple', '', '', ''],
    ['unknown', '', '', '', ''],
  ])('extracts %s', (text, company, model, modelNum, cores) => {
    expect(getCPUInfo(text)).toMatchObject({ company, model, modelNum, cores });
  });
  it('returns empty fields for missing CPU data', () => {
    expect(getCPUInfo()).toEqual({ company: '', model: '', modelNum: '', core: '', cores: '' });
  });
});

describe('host units', () => {
  it('computes binary units and petabytes only for large values', () => {
    expect(calcBinary(1024 ** 4)).toEqual({ k: 1024 ** 3, m: 1024 ** 2, g: 1024, t: 1, p: null });
    expect(calcBinary(1024 ** 5).p).toBe(1);
  });
  it.each([
    [0, 0, 'K'], [1024, 1, 'K'], [1024 ** 2, 1024, 'K'],
    [2 * 1024 ** 2, 2, 'M'], [2 * 1024 ** 3, 2, 'G'], [2 * 1024 ** 4, 2, 'T'],
  ])('formats network transfer %s', (bytes, value, unit) => {
    expect(calcTransfer(bytes)).toMatchObject({ value, unit });
  });
  it.each([
    [0, 0, 'G'], [-1, 0, 'G'], [NaN, 0, 'G'], [Infinity, 0, 'G'],
    [10.1 * 1024 ** 3, 10, 'G'], [10.2 * 1024 ** 3, 10.25, 'G'],
    [1024 ** 4, 1, 'T'], [1.2 * 1024 ** 4, 1.25, 'T'],
  ])('rounds disk capacity %s to quarter units', (bytes, value, unit) => {
    expect(calcDiskDisplay(bytes)).toEqual({ value, unit });
  });
  it('formats valid disk capacities and suppresses invalid values', () => {
    expect(formatDiskSize(0)).toBe('0G');
    expect(formatDiskSize(String(40 * 1024 ** 3))).toBe('40G');
    expect(formatDiskSize(-1)).toBe('');
    expect(formatDiskSize('bad')).toBe('');
  });
  it('truncates decimals without rounding', () => {
    expect(truncateDecimal(1.29)).toBe(1.2);
    expect(truncateDecimal('-1.299', 2)).toBe(-1.29);
    expect(truncateDecimal('bad')).toBeNaN();
  });
});

describe('host platform labels', () => {
  it.each([
    ['WINDOWS', 'Windows'], ['linux', 'Linux'], ['darwin', 'MacOS'], ['debian', 'Debian'],
    ['ubuntu', 'Ubuntu'], ['centos', 'CentOS'], ['fedora', 'Fedora'], ['alpine', 'Alpine'],
    ['arch', 'Arch'], ['freebsd', 'FreeBSD'], ['Other', 'Other'], ['', ''],
  ])('formats OS %s', (value, label) => expect(getSystemOSLabel(value)).toBe(label));
  it.each([
    ['Windows Server', 'ri-microsoft-fill'], ['Microsoft Windows', 'ri-microsoft-fill'],
    ['darwin', 'fl-apple'], ['MacOS', 'fl-apple'], ['Ubuntu', 'fl-ubuntu'], ['', 'ri-server-line'],
  ])('selects platform icon %s', (value, icon) => expect(getPlatformLogoIconClassName(value)).toBe(icon));
});
