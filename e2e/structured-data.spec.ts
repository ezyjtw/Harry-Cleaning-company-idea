import { test, expect } from '@playwright/test';

// RENA-057 (B6.5, James-ruled: proven by raw-content assertion on the served
// bytes). The rig cannot reach postcodes.io, so /cleaning/chingford renders
// its no-centroid form here; the centroid form is proven by the unit test and
// on staging after deploy.
const ldBlocks = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);

test('the homepage JSON-LD has no geo and names the registered office and areas', async ({
  request,
}) => {
  const html = await (await request.get('/')).text();
  const lb = ldBlocks(html).find((b) => b.includes('"@type":"LocalBusiness"'));
  expect(lb).toBeDefined();
  expect(lb).not.toContain('"geo"');
  expect(lb).toContain('"streetAddress":"66 Paul Street"');
  expect(lb).toContain(
    '{"@type":"Place","name":"Chingford","address":{"@type":"PostalAddress","postalCode":"E4","addressCountry":"GB"}}'
  );
});

test('/cleaning/chingford serves its Service Place, with geo only from a centroid', async ({
  request,
}) => {
  const html = await (await request.get('/cleaning/chingford')).text();
  const svc = ldBlocks(html).find((b) => b.includes('"@type":"Service"'));
  expect(svc).toBeDefined();
  expect(svc).toContain('"areaServed":{"@type":"Place","name":"Chingford, E4"');
  expect(svc).not.toContain('51.5074');
});
