import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import * as pro from '../../../mobile/nav';
import * as cust from '../../../mobile-customer/nav';

// B5 (RENA-022, 024, 029, 036, 037, 039, 047, 031/082; deviation 10): the
// shells' navigation tables, replacing the out-of-repo rig judgment table.
const O = 'https://www.renacleaning.co.uk';
const proCtx = pro.buildNavCtx(O, 'android');
const proIos = pro.buildNavCtx(O, 'ios');
const custCtx = cust.buildNavCtx(O, 'ios');
const S0 = pro.INITIAL_NAV_STATE;

describe('the two shells share one core', () => {
  it('the core section is byte-identical in both nav.ts files', () => {
    const core = (f: string) => {
      const s = readFileSync(f, 'utf8');
      return s.slice(s.indexOf('// ─── Shared core (identical'));
    };
    expect(core('mobile/nav.ts')).toBe(core('mobile-customer/nav.ts'));
  });
});

describe('B5.1 resolveLink: Pro', () => {
  it.each([
    ['/app/offer/abc', 'today', `${O}/app/offer/abc`],
    ['/app/today', 'today', null],
    ['/app/today/', 'today', null],
    ['/app/today?', 'today', null],
    ['/en/app/jobs', 'jobs', null],
    ['/cleaner/jobs/j1', 'jobs', `${O}/cleaner/jobs/j1`],
    ['/messages?bookingId=b', 'messages', `${O}/messages?bookingId=b`],
    [`${O}/app/earnings`, 'earnings', null],
    ['renapro://app/offer/abc', 'today', `${O}/app/offer/abc`],
    ['renapro://jobs', 'jobs', null],
    ['/app/profile', 'today', `${O}/app/profile`],
    ['/open/pro/app/offer/abc', 'today', `${O}/app/offer/abc`],
    ['HTTPS://WWW.RENACLEANING.CO.UK/messages', 'messages', null],
  ])('%s → %s', (raw, tab, forward) => {
    expect(pro.resolveLink(raw, proCtx)).toEqual({ kind: 'tab', tab, forward });
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['javascript:alert(1)', 'unparsable'],
    ['https://www.renacleaning.co.uk.evil.com/messages?x=1', 'foreign'],
    ['https://www.renacleaning.co.uk@evil.com/messages', 'unparsable'],
    ['http://www.renacleaning.co.uk/messages', 'foreign'],
    ['/cleaner/profile', 'unowned'],
    ['/open/customer/x', 'unowned'],
    ['/Messages', 'unowned'],
    ['/open/pro/open/pro/app/today', 'unowned'],
  ])('%s → ignore (%s)', (raw, reason) => {
    expect(pro.resolveLink(raw, proCtx)).toEqual({ kind: 'ignore', reason });
  });
});

describe('B5.1 resolveLink: customer', () => {
  it.each([
    ['/booking/abc/approve-topup', 'mycleans', `${O}/booking/abc/approve-topup`],
    ['/pay/abc?token=t', 'mycleans', `${O}/pay/abc?token=t`],
    ['/messages?bookingId=b', 'messages', `${O}/messages?bookingId=b`],
    ['/cleaners/c1', 'cleaners', `${O}/cleaners/c1`],
    ['/cleaners', 'cleaners', null],
    ['/account/bookings', 'mycleans', null],
    ['/account/settings', 'home', `${O}/account/settings`],
    ['/services/deep', 'book', `${O}/services/deep`],
    ['/book/c1', 'book', `${O}/book/c1`],
    ['rena://mycleans', 'mycleans', null],
    ['rena://account/bookings', 'mycleans', null],
    ['rena://booking/b1', 'mycleans', `${O}/booking/b1`],
    ['/en/app/home', 'home', null],
    ['/open/customer/booking/b1', 'mycleans', `${O}/booking/b1`],
  ])('%s → %s', (raw, tab, forward) => {
    expect(cust.resolveLink(raw, custCtx)).toEqual({ kind: 'tab', tab, forward });
  });

  it.each([
    ['/open/pro/app/today', 'unowned'],
    ['/app/today', 'unowned'],
    ['https://evil.example/booking/b1', 'foreign'],
  ])('%s → ignore (%s)', (raw, reason) => {
    expect(cust.resolveLink(raw, custCtx)).toEqual({ kind: 'ignore', reason });
  });
});

describe('isRenaOrigin', () => {
  it.each([
    [`${O}/login`, true],
    ['https://WWW.RenaCleaning.co.uk/x', true],
    ['https://www.renacleaning.co.uk.evil.com/login', false],
    ['https://www.renacleaning.co.uk@evil.com/login', false],
    ['https://www.renacleaning.co.uk:8443/login', false],
    ['http://www.renacleaning.co.uk/login', false],
    ['/login', false],
  ])('%s → %s', (url, want) => {
    expect(pro.isRenaOrigin(url, proCtx)).toBe(want);
  });
});

describe('B5.2 classifyNavigation', () => {
  const inFlow = { stripeFlow: true, lastSameOriginPath: '/cleaner/stripe/connect' };
  it.each([
    ['same-origin page', { url: `${O}/cleaner/jobs/j1` }, S0, 'ALLOW_IN_PANE'],
    ['same-origin tab root', { url: `${O}/app/earnings` }, S0, 'CROSS_TAB'],
    ['lookalike host', { url: 'https://www.renacleaning.co.uk.evil.com/x' }, S0, 'OPEN_EXTERNAL'],
    ['userinfo trick', { url: 'https://www.renacleaning.co.uk@evil.com/x' }, S0, 'BLOCK'],
    ['http same host', { url: 'http://www.renacleaning.co.uk/x' }, S0, 'BLOCK'],
    ['js.stripe.com in flow', { url: 'https://js.stripe.com/v3' }, inFlow, 'ALLOW_IN_PANE'],
    [
      'connect.stripe.com out of flow',
      { url: 'https://connect.stripe.com/x' },
      S0,
      'OPEN_EXTERNAL',
    ],
    [
      'connect.stripe.com from the Connect page',
      { url: 'https://connect.stripe.com/x' },
      { stripeFlow: false, lastSameOriginPath: '/cleaner/stripe/connect' },
      'ALLOW_IN_PANE',
    ],
    [
      '3DS sub frame',
      { url: 'https://hooks.stripe.com/3d_secure/x', isTopFrame: false },
      S0,
      'ALLOW_IN_PANE',
    ],
    [
      'issuer sub frame',
      { url: 'https://acs.bank.example/x', isTopFrame: false },
      S0,
      'ALLOW_IN_PANE',
    ],
    ['mailto', { url: 'mailto:support@renacleaning.co.uk' }, S0, 'OS_HANDLE'],
    ['tel', { url: 'tel:+442000000000' }, S0, 'OS_HANDLE'],
    ['sms', { url: 'sms:+442000000000' }, S0, 'OS_HANDLE'],
    ['javascript', { url: 'javascript:alert(1)' }, S0, 'BLOCK'],
    ['intent', { url: 'intent://x#Intent;end' }, S0, 'BLOCK'],
    ['data', { url: 'data:text/html,hi' }, S0, 'BLOCK'],
    ['about:blank', { url: 'about:blank' }, S0, 'ALLOW_IN_PANE'],
    ['Pro Android statement', { url: `${O}/api/cleaner/statement` }, S0, 'STATEMENT'],
    ['statement with a query', { url: `${O}/api/cleaner/statement?taxYear=2026` }, S0, 'STATEMENT'],
    ['statements is not a statement', { url: `${O}/api/cleaner/statements` }, S0, 'ALLOW_IN_PANE'],
    ['Stripe return reroute', { url: `${O}/app/today` }, inFlow, 'STRIPE_RETURN'],
    [
      'Connect exit page stays',
      { url: `${O}/cleaner/onboarding-complete` },
      inFlow,
      'ALLOW_IN_PANE',
    ],
  ] as const)('Pro: %s', (_label, req, state, want) => {
    expect(pro.classifyNavigation(req, state, proCtx)).toBe(want);
  });

  it('the statement intercept is Android only; iOS uses onFileDownload', () => {
    expect(pro.classifyNavigation({ url: `${O}/api/cleaner/statement` }, S0, proIos)).toBe(
      'ALLOW_IN_PANE'
    );
  });

  it.each([
    ['checkout from a booking page', '/booking/b1', 'ALLOW_IN_PANE'],
    ['checkout from the pay page', '/pay/p1', 'ALLOW_IN_PANE'],
    ['Stripe from Home (not a payment page)', '/app/home', 'OPEN_EXTERNAL'],
  ] as const)('customer: %s', (_label, from, want) => {
    expect(
      cust.classifyNavigation(
        { url: 'https://checkout.stripe.com/c/pay/x' },
        { stripeFlow: false, lastSameOriginPath: from },
        custCtx
      )
    ).toBe(want);
  });

  it('customer: no Stripe return reroute and no statement intercept (Pro only)', () => {
    const flow = { stripeFlow: true, lastSameOriginPath: '/booking/b1' };
    expect(cust.classifyNavigation({ url: `${O}/booking/b1` }, flow, custCtx)).toBe(
      'ALLOW_IN_PANE'
    );
    expect(
      cust.classifyNavigation(
        { url: `${O}/api/cleaner/statement` },
        S0,
        cust.buildNavCtx(O, 'android')
      )
    ).toBe('ALLOW_IN_PANE');
  });

  it('flow state: entering Stripe from Connect sets it; the next same-origin landing clears it', () => {
    let s = pro.nextNavState(S0, { url: `${O}/cleaner/stripe/connect` }, 'ALLOW_IN_PANE', proCtx);
    expect(s).toEqual({ stripeFlow: false, lastSameOriginPath: '/cleaner/stripe/connect' });
    const toStripe = { url: 'https://connect.stripe.com/x' };
    const v = pro.classifyNavigation(toStripe, s, proCtx);
    expect(v).toBe('ALLOW_IN_PANE');
    s = pro.nextNavState(s, toStripe, v, proCtx);
    expect(s.stripeFlow).toBe(true);
    const back = { url: `${O}/app/today` };
    const v2 = pro.classifyNavigation(back, s, proCtx);
    expect(v2).toBe('STRIPE_RETURN');
    expect(pro.nextNavState(s, back, v2, proCtx).stripeFlow).toBe(false);
    expect(
      pro.nextNavState(s, { url: 'https://x.example/', isTopFrame: false }, 'ALLOW_IN_PANE', proCtx)
    ).toBe(s);
  });

  it('dev origin: http allowed only for the dev host', () => {
    const dev = pro.buildNavCtx(O, 'ios', '192.168.1.5');
    expect(pro.classifyNavigation({ url: 'http://192.168.1.5:3000/x' }, S0, dev)).toBe(
      'ALLOW_IN_PANE'
    );
    expect(pro.classifyNavigation({ url: 'http://192.168.1.5/x' }, S0, dev)).toBe('ALLOW_IN_PANE');
    expect(pro.classifyNavigation({ url: 'http://10.0.0.9:3000/x' }, S0, dev)).toBe('BLOCK');
    // Production never accepts a port.
    expect(
      pro.classifyNavigation({ url: 'https://www.renacleaning.co.uk:443/x' }, S0, proCtx)
    ).toBe('BLOCK');
  });
});

describe('B5.2 isStatementUrl (RENA-036)', () => {
  it.each([
    [`${O}/api/cleaner/statement`, true],
    [`${O}/api/cleaner/statement?taxYear=2026`, true],
    [`${O}/en/api/cleaner/statement`, false],
    [`${O}/api/cleaner/statements`, false],
    [`${O}/api/cleaner/statement/x`, false],
    ['https://www.renacleaning.co.uk.evil.com/api/cleaner/statement', false],
    ['https://www.renacleaning.co.uk@evil.com/api/cleaner/statement', false],
    ['http://www.renacleaning.co.uk/api/cleaner/statement', false],
    ['https://evil.example/x?u=/api/cleaner/statement', false],
    ['/api/cleaner/statement', false],
  ])('%s → %s', (url, want) => {
    expect(pro.isStatementUrl(url, proIos)).toBe(want);
  });
});

describe('B5.3 nextSessionLostAction (James-ruled)', () => {
  const run = (seq: [number | 'network', number][]) => {
    let s = pro.INITIAL_SESSION_LOSS;
    let out = false;
    for (const [status, t] of seq) {
      const r = pro.nextSessionLostAction(s, status, t);
      s = r.state;
      out = out || r.logout;
    }
    return out;
  };
  it.each([
    [
      '401, 401 within 5 s',
      [
        [401, 0],
        [401, 3000],
      ],
      false,
    ],
    [
      '401, 15 s, 401',
      [
        [401, 0],
        [401, 15000],
      ],
      true,
    ],
    [
      '401, 200, 401',
      [
        [401, 0],
        [200, 5000],
        [401, 15000],
      ],
      false,
    ],
    [
      '401, 403, 401 (a definitive 403 resets)',
      [
        [401, 0],
        [403, 5000],
        [401, 15000],
      ],
      false,
    ],
    [
      '401, 500, 401',
      [
        [401, 0],
        [500, 5000],
        [401, 15000],
      ],
      true,
    ],
    [
      '401, 429, 401',
      [
        [401, 0],
        [429, 5000],
        [401, 15000],
      ],
      true,
    ],
    [
      '401, network, 401',
      [
        [401, 0],
        ['network', 5000],
        [401, 15000],
      ],
      true,
    ],
    [
      '401 then 4 minutes then 401 (window reset)',
      [
        [401, 0],
        [401, 240000],
      ],
      false,
    ],
    [
      '401, 4 minutes, 401, 15 s, 401',
      [
        [401, 0],
        [401, 240000],
        [401, 255000],
      ],
      true,
    ],
    [
      '403 alone never logs out',
      [
        [403, 0],
        [403, 15000],
        [403, 30000],
      ],
      false,
    ],
  ] as const)('%s', (_label, seq, want) => {
    expect(run(seq as unknown as [number | 'network', number][])).toBe(want);
  });
});

describe('B5.4 parseShellMessage', () => {
  const code = 'a'.repeat(43);
  const msg = (o: Record<string, unknown>) => JSON.stringify(o);
  it('valid for the app own role only', () => {
    const ok = { type: 'signedUp', handoffCode: code, email: 'a@b.c', role: 'CLEANER' };
    expect(pro.parseShellMessage(msg(ok))).toEqual(ok);
    expect(cust.parseShellMessage(msg(ok))).toBeNull();
    const c = { ...ok, role: 'CLIENT' };
    expect(cust.parseShellMessage(msg(c))).toEqual(c);
    expect(pro.parseShellMessage(msg(c))).toBeNull();
  });
  it.each([
    ['unknown type', { type: 'loggedIn', handoffCode: code, email: 'a@b.c', role: 'CLEANER' }],
    ['missing code', { type: 'signedUp', email: 'a@b.c', role: 'CLEANER' }],
    [
      'a Bearer instead of a code',
      { type: 'signedUp', handoffCode: 'eyJ.x.y', email: 'a@b.c', role: 'CLEANER' },
    ],
    ['bad email', { type: 'signedUp', handoffCode: code, email: 'nope', role: 'CLEANER' }],
  ])('%s → null', (_label, o) => {
    expect(pro.parseShellMessage(msg(o))).toBeNull();
  });
  it('malformed JSON → null', () => {
    expect(pro.parseShellMessage('{nope')).toBeNull();
    expect(pro.parseShellMessage('null')).toBeNull();
  });
});

describe('B5.4 isPortalLanding (the handoff fallback)', () => {
  it.each([
    [`${O}/account`, true],
    [`${O}/en/account?welcome=1`, true],
    [`${O}/cleaner`, true],
    [`${O}/cleaner/jobs/j1`, true],
    [`${O}/dashboard`, true],
    [`${O}/signup`, false],
    [`${O}/join`, false],
    [`${O}/accounting`, false],
    ['https://evil.example/account', false],
    ['https://www.renacleaning.co.uk@evil.example/account', false],
  ])('%s → %s', (url, want) => {
    expect(pro.isPortalLanding(url, proCtx)).toBe(want);
  });
});

describe('B5.8 push decisions', () => {
  it.each([
    [{ asked: false, granted: false }, 'show_card'],
    [{ asked: true, granted: false }, 'none'],
    [{ asked: false, granted: true }, 'register'],
    [{ asked: true, granted: true }, 'register'],
  ] as const)('entry %o → %s', (input, want) => {
    expect(pro.pushEntryDecision(input)).toBe(want);
  });
  it.each([
    [{ granted: true, canAskAgain: false }, 'already_on'],
    [{ granted: false, canAskAgain: true }, 'ask'],
    [{ granted: false, canAskAgain: false }, 'open_settings'],
  ] as const)('door %o → %s', (input, want) => {
    expect(pro.pushDoorDecision(input)).toBe(want);
  });
});

describe('STRING-LAW: the onOpenWindow script, cooked and delivered (B5.2)', () => {
  it.each([
    [`${O}/app/offer/abc`],
    [`${O}/x?q="quoted"&a='single'`],
    [`${O}/x?back=\\slash`],
    [`${O}/x#</script><script>alert(1)</script>`],
    [`${O}/x?ls=\u2028ps=\u2029`],
    [`${O}/x?u=caf\u00e9\u{1F9F9}`],
    ['javascript:alert(1)'],
  ])('%s parses and assigns exactly the URL', (url) => {
    const delivered = pro.locationAssignScript(url);
    expect(delivered).toBe(cust.locationAssignScript(url));
    expect(delivered.includes('\u2028')).toBe(false);
    expect(delivered.includes('\u2029')).toBe(false);
    // The engine's own parse of the exact string the WebView receives
    // (CLAUDE.md STRING-LAW requires new Function over the delivered string).
    // eslint-disable-next-line no-new-func
    const run = new Function('window', delivered) as (w: {
      location: { href?: string };
    }) => unknown;
    const w = { location: {} as { href?: string } };
    expect(run(w)).toBeUndefined();
    expect(w.location.href).toBe(url);
  });
});
