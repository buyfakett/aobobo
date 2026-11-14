import { afterEach, beforeEach, rstest } from '@rstest/core';
import { cleanup } from '@testing-library/react';
import i18n from '@/i18n';

beforeEach(async () => {
  await i18n.changeLanguage('zh-CN');
});

afterEach(() => {
  cleanup();
  rstest.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  rstest.useRealTimers();
});
