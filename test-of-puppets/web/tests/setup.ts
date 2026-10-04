import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';

// findBy*/waitFor esperam 1 s por padrão; com a suíte inteira em paralelo isso estoura sem haver bug.
configure({ asyncUtilTimeout: 8000 });

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
});
