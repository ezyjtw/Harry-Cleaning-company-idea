'use client';

// C2: the homepage reviews slider — now fed REAL reviews by the server
// component (ReviewsSection). Pure presentation; same navy design as before.

import { useState } from 'react';

export interface HomepageReview {
  id: string;
  text: string;
  name: string;
  sourceLabel: string; // "Rena customer" or "via Google" etc.
  stars: number;
}

export default function ReviewsCarousel({
  reviews,
  sectionTitle,
  sectionSubtitle,
}: {
  reviews: HomepageReview[];
  sectionTitle: string;
  sectionSubtitle: string;
}) {
  const [current, setCurrent] = useState(0);

  const prev = () => setCurrent((c) => (c === 0 ? reviews.length - 1 : c - 1));
  const next = () => setCurrent((c) => (c === reviews.length - 1 ? 0 : c + 1));

  return (
    <section className="bg-ink">
      <div className="mx-auto max-w-[1240px] px-5 py-14 md:px-14 md:py-20">
        <p className="mb-2 font-jost text-[12px] uppercase tracking-[0.16em] text-white/70">
          {sectionTitle}
        </p>
        <h2 className="mb-10 font-newsreader text-[32px] font-semibold leading-tight text-white md:mb-14 md:text-[42px]">
          {sectionSubtitle}
        </h2>

        {/* Slider */}
        <div className="relative">
          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${current * 100}%)` }}
            >
              {reviews.map((review) => (
                <div key={review.id} className="w-full flex-shrink-0 px-1">
                  <div
                    className="rounded-lg p-8 md:p-12"
                    style={{ border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <span className="rounded-full bg-white/5 px-3 py-1 font-jost text-[11px] uppercase tracking-wider text-white/80">
                        {review.sourceLabel}
                      </span>
                      <span className="font-jost text-[13px] tracking-[3px] text-white">
                        {'★'.repeat(review.stars)}
                        {'☆'.repeat(5 - review.stars)}
                      </span>
                    </div>
                    <p className="mb-6 font-jost text-[16px] font-light leading-[1.9] text-white/70 md:text-[18px]">
                      &ldquo;{review.text}&rdquo;
                    </p>
                    <div>
                      <span className="font-jost text-[14px] font-medium text-white">
                        {review.name}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between">
            <div className="flex gap-2">
              {reviews.map((r, i) => (
                <button
                  key={r.id}
                  onClick={() => setCurrent(i)}
                  aria-label={`Review ${i + 1}`}
                  className={`h-[6px] rounded-full transition-all ${
                    i === current ? 'w-6 bg-white' : 'w-[6px] bg-white/20'
                  }`}
                />
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={prev}
                aria-label="Previous review"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/70 transition hover:border-white/40 hover:text-white"
              >
                ←
              </button>
              <button
                onClick={next}
                aria-label="Next review"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/70 transition hover:border-white/40 hover:text-white"
              >
                →
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
