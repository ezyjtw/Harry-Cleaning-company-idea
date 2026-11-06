import { describe, expect, it } from 'vitest';

import { SERVICE_AREAS } from '@/lib/areas';

import * as sd from './structured-data';

// RENA-057 (B6.5, James-ruled: proven by raw-content assertion). The served
// bytes are JSON.stringify of these objects (components/JsonLd.tsx).
const raw = (o: unknown) => JSON.stringify(o);

describe('structured data per served area', () => {
  it('the homepage LocalBusiness has no geo, the registered office, and the nine areas', () => {
    const lb = sd.generateLocalBusinessSchema('North-East London and Essex');
    const s = raw(lb);
    expect(s).not.toContain('"geo"');
    expect(s).not.toContain('GeoCoordinates');
    expect(s).toContain(
      '"address":{"@type":"PostalAddress","streetAddress":"66 Paul Street","addressLocality":"London","postalCode":"EC2A 4NA","addressCountry":"GB"}'
    );
    expect(SERVICE_AREAS).toHaveLength(9);
    for (const a of SERVICE_AREAS)
      expect(s).toContain(
        `{"@type":"Place","name":"${a.name}","address":{"@type":"PostalAddress","postalCode":"${a.outcode}","addressCountry":"GB"}}`
      );
  });

  it('an area Service carries its centroid, and none when the lookup failed', () => {
    const chingford = SERVICE_AREAS.find((a) => a.slug === 'chingford');
    expect(chingford).toBeDefined();
    const area = chingford as NonNullable<typeof chingford>;
    const withGeo = raw(
      sd.generateAreaServiceSchema(area, { latitude: 51.63, longitude: -0.0006 }, 'https://x.test')
    );
    expect(withGeo).toContain(
      '"areaServed":{"@type":"Place","name":"Chingford, E4","geo":{"@type":"GeoCoordinates","latitude":51.63,"longitude":-0.0006}}'
    );
    expect(withGeo).toContain('"url":"https://x.test/cleaning/chingford"');
    const without = raw(sd.generateAreaServiceSchema(area, null, 'https://x.test'));
    expect(without).toContain('"areaServed":{"@type":"Place","name":"Chingford, E4"}');
    expect(without).not.toContain('"geo"');
  });

  it('the unused breadcrumb and review aggregate generators are gone', () => {
    expect(Object.keys(sd)).not.toContain('generateBreadcrumbSchema');
    expect(Object.keys(sd)).not.toContain('generateReviewAggregateSchema');
  });
});
