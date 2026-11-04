import { afterEach, rstest } from '@rstest/core';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  rstest.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  rstest.useRealTimers();
});
