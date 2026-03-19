'use client';

import { useState } from 'react';

const reviews = [
  {
    text: 'I loved being able to browse cleaners and actually choose who came to my home. I messaged Maria beforehand and knew straight away she was the right fit. She has been amazing.',
    name: 'Amira J.',
    location: 'Walthamstow, E17',
  },
  {
    text: 'Being able to read real reviews and talk to the cleaner before booking made all the difference. I found someone who understood exactly what I needed for my flat.',
    name: 'Daniel R.',
    location: 'Hackney, E8',
  },
  {
    text: 'I was nervous about letting a stranger in, but being able to pick my own cleaner and have a chat first completely put me at ease. Brilliant service and she is always on time.',
    name: 'Sophie L.',
    location: 'Leyton, E10',
  },
  {
    text: 'The whole process was seamless. I chose a cleaner based on her reviews, spoke to her beforehand, and she has been cleaning my place fortnightly ever since. Could not recommend more.',
    name: 'Priya K.',
    location: 'Stratford, E15',
  },
  {
    text: 'What sold me was the ability to actually talk to the cleaner before they come round. I found someone who matched exactly what I was looking for. Five stars across the board.',
    name: 'James W.',
    location: 'Tottenham, N17',
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
                    <div className="mb-5 font-jost text-[14px] tracking-[4px] text-gold-2">
                      ★★★★★
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
