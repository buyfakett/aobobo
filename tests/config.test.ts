import { describe, expect, it } from '@rstest/core';
import config, { hasRuntimeShowAvailability, mergeAoboboConfig, mergeNazhuaConfig } from '@/config';

describe('runtime configuration', () => {
  it('exposes compatible merge helpers and applies overrides without replacing other values', () => {
    const original = { ...config.aobobo };
    try {
      expect(window.$mergeAoboboConfig).toBe(mergeAoboboConfig);
      expect(window.$mergeNazhuaConfig).toBe(mergeAoboboConfig);
      expect(mergeNazhuaConfig).toBe(mergeAoboboConfig);
      expect(hasRuntimeShowAvailability).toBe(false);
      mergeAoboboConfig({ title: 'Custom dashboard', showAvailability: true });
      expect(config.aobobo.title).toBe('Custom dashboard');
      expect(config.aobobo.showAvailability).toBe(true);
      expect(config.aobobo.v1ApiProfilePath).toBe(original.v1ApiProfilePath);
    } finally { Object.assign(config.aobobo, original); }
  });
});
