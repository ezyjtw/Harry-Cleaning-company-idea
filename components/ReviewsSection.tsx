'use client';

import { useState } from 'react';

const reviews = [
  {
    text: 'I browsed through about six cleaners before choosing Maria. Being able to read her reviews and message her beforehand made all the difference. She understood exactly how I like things done.',
    name: 'Amira J.',
    location: 'Walthamstow, E17',
    highlight: 'Chose the perfect cleaner',
    stars: 5,
  },
  {
    text: 'Moved out of my flat last month and needed an end-of-tenancy clean. Booked through Rena on a Tuesday, had it done by Thursday. Landlord returned my full deposit without a single complaint.',
    name: 'Daniel R.',
    location: 'Hackney, E8',
    highlight: 'Full deposit returned',
    stars: 5,
  },
  {
    text: 'As a single mum working full-time, I needed someone reliable. My cleaner has come every fortnight for five months now and has never cancelled once. It is one less thing to worry about.',
    name: 'Sophie L.',
    location: 'Leyton, E10',
    highlight: 'Consistent and reliable',
    stars: 5,
  },
  {
    text: 'I run three Airbnb properties and the turnaround cleaning was always stressful. Now I have a dedicated cleaner for each one through Rena. Guests consistently mention how spotless the place is.',
    name: 'Marcus T.',
    location: 'Stratford, E15',
    highlight: 'Airbnb host',
    stars: 5,
  },
  {
    text: 'Had guests arriving in four hours and my flat was a state. Booked a same-day clean and someone turned up within 45 minutes. Absolute lifesaver. The place looked incredible.',
    name: 'James W.',
    location: 'Tottenham, N17',
    highlight: 'Same-day save',
    stars: 4,
  },
];

export default function ReviewsSection() {
  const [current, setCurrent] = useState(0);

  const prev = () => setCurrent((c) => (c === 0 ? reviews.length - 1 : c - 1));
  const next = () => setCurrent((c) => (c === reviews.length - 1 ? 0 : c + 1));

  return (
    <section className="bg-ink">
      <div className="mx-auto max-w-[1240px] px-5 py-14 md:px-14 md:py-20">
        <p className="mb-2 font-jost text-[12px] uppercase tracking-[0.16em] text-gold-2">
          Reviews
        </p>
        <h2 className="mb-10 font-cormorant text-[32px] font-light leading-tight text-white md:mb-14 md:text-[42px]">
          What our customers say
        </h2>

        {/* Slider */}
        <div className="relative">
          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${current * 100}%)` }}
            >
              {reviews.map((review) => (
                <div key={review.name} className="w-full flex-shrink-0 px-1">
                  <div
                    className="rounded-lg p-8 md:p-12"
                    style={{ border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <span className="rounded-full bg-white/5 px-3 py-1 font-jost text-[11px] uppercase tracking-wider text-gold-2">
                        {review.highlight}
                      </span>
                      <span className="font-jost text-[13px] tracking-[3px] text-gold-2">
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
                      <span className="font-jost text-[13px] text-white/40">
                        {' '}
                        · {review.location}
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
              {reviews.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`h-[6px] rounded-full transition-all ${
                    i === current ? 'w-6 bg-gold' : 'w-[6px] bg-white/20'
                  }`}
                />
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={prev}
                className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-white/10"
                style={{ border: '1px solid rgba(255,255,255,0.15)' }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M10 4L6 8L10 12"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                onClick={next}
                className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-white/10"
                style={{ border: '1px solid rgba(255,255,255,0.15)' }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M6 4L10 8L6 12"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
