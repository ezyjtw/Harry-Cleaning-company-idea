import { describe, expect, it } from 'vitest';

import { classifyStatus, loadJson, type LoadDeps } from './load-state';

// RENA-019 (B2b, amendment 1): the honest-state table.
function deps(answer: { status: number; body?: unknown } | 'throw', online = true): LoadDeps {
  return {
    online: () => online,
    fetch: async () => {
      if (answer === 'throw') throw new TypeError('Failed to fetch');
      return {
        ok: answer.status >= 200 && answer.status < 300,
        status: answer.status,
        json: async () => {
          if (answer.body === undefined) throw new SyntaxError('not json');
          return answer.body;
        },
      };
    },
  };
}

describe('classifyStatus', () => {
  it.each([
    [401, 'unauthorised'],
    [403, 'forbidden'],
    [429, 'error'],
    [500, 'error'],
    [502, 'error'],
    [404, 'error'],
  ])('%i is %s', (status, failure) => {
    expect(classifyStatus(status)).toBe(failure);
  });
});

describe('loadJson', () => {
  it('a 2xx with rows is ok', async () => {
    expect(await loadJson('/x', deps({ status: 200, body: { data: [1] } }))).toEqual({
      ok: true,
      data: { data: [1] },
    });
  });

  it('a 2xx with no rows is ok and empty (the only empty path)', async () => {
    expect(await loadJson('/x', deps({ status: 200, body: { data: [] } }))).toEqual({
      ok: true,
      data: { data: [] },
    });
  });

  it('only a 401 is session loss', async () => {
    expect(await loadJson('/x', deps({ status: 401, body: {} }))).toEqual({
      ok: false,
      failure: 'unauthorised',
      status: 401,
    });
  });

  it('a 403 is an access error, never session loss', async () => {
    expect(await loadJson('/x', deps({ status: 403, body: {} }))).toMatchObject({
      failure: 'forbidden',
    });
  });

  it('429 and 5xx are retryable errors', async () => {
    expect(await loadJson('/x', deps({ status: 429, body: {} }))).toMatchObject({
      failure: 'error',
    });
    expect(await loadJson('/x', deps({ status: 503, body: {} }))).toMatchObject({
      failure: 'error',
    });
  });

  it('a network failure is offline', async () => {
    expect(await loadJson('/x', deps('throw'))).toEqual({
      ok: false,
      failure: 'offline',
      status: null,
    });
  });

  it('the browser saying offline is offline without a request', async () => {
    let called = false;
    const d = deps({ status: 200, body: {} }, false);
    const f = d.fetch;
    d.fetch = (u) => {
      called = true;
      return f(u);
    };
    expect(await loadJson('/x', d)).toMatchObject({ failure: 'offline' });
    expect(called).toBe(false);
  });

  it('a 2xx that is not JSON is an error, not empty', async () => {
    expect(await loadJson('/x', deps({ status: 200 }))).toMatchObject({ failure: 'error' });
  });
});
