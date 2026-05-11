'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';

interface ReviewItem {
  id: string;
  clientName: string;
  date: string;
  rating: number;
  comment: string;
  reply?: string | null;
  categories: {
    thoroughness: number;
    punctuality: number;
    communication: number;
  };
}

interface ReviewsData {
  reviews: ReviewItem[];
  overallRating: number;
  totalReviews: number;
  distribution: Record<number, number>;
  avgCategories: {
    thoroughness: number;
    punctuality: number;
    communication: number;
  };
}

interface Testimonial {
  clientName: string;
  rating: number;
  text: string;
  image?: string;
}

function TestimonialCard({
  testimonial: t,
  onChange,
  onDelete,
}: {
  testimonial: Testimonial;
  onChange: (t: Testimonial) => void;
  onDelete: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => onChange({ ...t, image: reader.result as string });
    reader.readAsDataURL(file);
  };

  return (
    <div className="rounded-xl bg-cream p-4" style={{ border: '1px solid rgba(14,14,12,0.06)' }}>
      <div className="flex items-start gap-3">
        {/* Photo upload */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex-shrink-0 w-12 h-12 rounded-full bg-ink/5 flex items-center justify-center overflow-hidden hover:bg-ink/10 transition-colors"
        >
          {t.image ? (
            <Image
              src={t.image}
              alt={t.clientName || 'Client'}
              width={48}
              height={48}
              className="w-full h-full object-cover"
            />
          ) : (
            <svg
              className="w-5 h-5 text-ink-3/40"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handlePhoto}
          className="hidden"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <input
              type="text"
              value={t.clientName}
              onChange={(e) => onChange({ ...t, clientName: e.target.value })}
              placeholder="Client name"
              className="font-jost text-sm text-ink bg-transparent focus:outline-none placeholder:text-ink-3/50 w-44"
            />
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} type="button" onClick={() => onChange({ ...t, rating: star })}>
                  <svg
                    className={`w-4 h-4 transition-colors ${star <= t.rating ? 'text-gold' : 'text-ink-3/15 hover:text-gold/40'}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </button>
              ))}
              <button
                type="button"
                onClick={onDelete}
                className="ml-2 text-ink-3/30 hover:text-red-400 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
          <textarea
            value={t.text}
            onChange={(e) => onChange({ ...t, text: e.target.value })}
            placeholder="What did this client say about your work?"
            className="w-full font-jost text-sm font-light text-ink-2 bg-transparent focus:outline-none resize-none placeholder:text-ink-3/40"
            rows={2}
          />
        </div>
      </div>
    </div>
  );
}

const ratingFilters = [0, 5, 4, 3, 2, 1];

export default function ReviewsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState(0);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [data, setData] = useState<ReviewsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [testimonialsSaving, setTestimonialsSaving] = useState(false);
  const [testimonialsSaved, setTestimonialsSaved] = useState(false);

  const fetchReviews = useCallback(
    async (ratingFilter: number) => {
      setLoading(true);
      const params = ratingFilter > 0 ? `?rating=${ratingFilter}` : '';
      const res = await fetch(`/api/cleaner/reviews${params}`);
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      if (res.ok) {
        setData(await res.json());
      }
      setLoading(false);
    },
    [router]
  );

  useEffect(() => {
    fetchReviews(filter);
  }, [filter, fetchReviews]);

  useEffect(() => {
    fetch('/api/cleaner/profile')
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.testimonials && Array.isArray(d.testimonials)) {
          setTestimonials(d.testimonials);
        }
      })
      .catch(() => {});
  }, []);

  const handleReply = useCallback(
    async (reviewId: string) => {
      if (!replyText.trim()) return;
      const res = await fetch('/api/cleaner/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId, reply: replyText }),
      });
      if (res.ok && data) {
        setData({
          ...data,
          reviews: data.reviews.map((r) => (r.id === reviewId ? { ...r, reply: replyText } : r)),
        });
        setReplyingTo(null);
        setReplyText('');
      }
    },
    [replyText, data]
  );

  const saveTestimonials = useCallback(async () => {
    setTestimonialsSaving(true);
    const valid = testimonials.filter((t) => t.clientName.trim() && t.text.trim());
    const res = await fetch('/api/cleaner/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testimonials: valid }),
    });
    setTestimonialsSaving(false);
    if (res.ok) {
      setTestimonialsSaved(true);
      setTimeout(() => setTestimonialsSaved(false), 3000);
    }
  }, [testimonials]);

  if (loading && !data) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-ink/5 rounded-lg w-32" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-ink/5 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const overallRating = data.overallRating.toFixed(1);
  const ratingDistribution = [5, 4, 3, 2, 1].map((r) => ({
    rating: r,
    count: data.distribution[r] || 0,
    percentage: data.totalReviews > 0 ? ((data.distribution[r] || 0) / data.totalReviews) * 100 : 0,
  }));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="font-cormorant text-2xl font-light text-ink">Reviews</h1>
        <p className="font-jost text-sm font-light text-ink-2 mt-1">
          See what your customers are saying
        </p>
      </div>

      {/* Client testimonials */}
      <div
        className="rounded-xl bg-white p-6 mb-8"
        style={{ border: '1px solid rgba(14,14,12,0.06)' }}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-cormorant text-lg font-light text-ink">Client Testimonials</h2>
          <div className="flex items-center gap-2">
            {testimonialsSaved && (
              <span className="font-jost text-xs font-light text-gold flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Saved
              </span>
            )}
            {testimonials.length > 0 && (
              <button
                onClick={saveTestimonials}
                disabled={testimonialsSaving}
                className="rounded-full px-4 py-1.5 bg-ink text-cream font-jost text-[12px] font-light hover:bg-ink/90 transition disabled:opacity-50"
              >
                {testimonialsSaving ? 'Saving...' : 'Save'}
              </button>
            )}
          </div>
        </div>
        <p className="font-jost text-sm font-light text-ink-2 mb-5">
          Add up to 3 reviews from previous clients to showcase your work
        </p>

        <div className="space-y-3">
          {testimonials.map((t, i) => (
            <TestimonialCard
              key={i}
              testimonial={t}
              onChange={(updated) => {
                const list = [...testimonials];
                list[i] = updated;
                setTestimonials(list);
                setTestimonialsSaved(false);
              }}
              onDelete={() => {
                setTestimonials(testimonials.filter((_, j) => j !== i));
                setTestimonialsSaved(false);
              }}
            />
          ))}
        </div>

        {testimonials.length < 3 && (
          <button
            type="button"
            onClick={() => {
              setTestimonials([
                ...testimonials,
                { clientName: '', rating: 5, text: '', image: '' },
              ]);
              setTestimonialsSaved(false);
            }}
            className="mt-3 flex items-center gap-2 rounded-lg px-4 py-2.5 font-jost text-sm font-light text-ink hover:bg-cream-2 transition-colors"
            style={{ border: '1px dashed rgba(14,14,12,0.12)' }}
          >
            <svg
              className="w-4 h-4 text-ink-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add testimonial ({testimonials.length}/3)
          </button>
        )}
      </div>

      {/* Overall rating and breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div
          className="rounded-xl bg-white p-6 text-center"
          style={{ border: '1px solid rgba(14,14,12,0.06)' }}
        >
          <p className="font-cormorant text-5xl font-light text-ink">{overallRating}</p>
          <div className="flex items-center justify-center gap-1 mt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <svg
                key={i}
                className={`w-5 h-5 ${i < Math.round(Number(overallRating)) ? 'text-gold' : 'text-ink-3/15'}`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <p className="font-jost text-sm font-light text-ink-3 mt-1">
            Based on {data.totalReviews} reviews
          </p>
        </div>

        <div
          className="rounded-xl bg-white p-6"
          style={{ border: '1px solid rgba(14,14,12,0.06)' }}
        >
          <h3 className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 mb-4">
            Rating Distribution
          </h3>
          <div className="space-y-2">
            {ratingDistribution.map((item) => (
              <div key={item.rating} className="flex items-center gap-2">
                <span className="font-jost text-sm font-light text-ink-2 w-8">
                  {item.rating} star
                </span>
                <div className="flex-1 h-2 bg-cream-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gold rounded-full"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
                <span className="font-jost text-sm font-light text-ink-3 w-6 text-right">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div
          className="rounded-xl bg-white p-6"
          style={{ border: '1px solid rgba(14,14,12,0.06)' }}
        >
          <h3 className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 mb-4">
            Category Breakdown
          </h3>
          <div className="space-y-3">
            {Object.entries(data.avgCategories).map(([key, value]) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-jost text-sm font-light text-ink-2 capitalize">{key}</span>
                  <span className="font-jost text-sm font-light text-ink">{value.toFixed(1)}</span>
                </div>
                <div className="w-full h-2 bg-cream-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gold rounded-full"
                    style={{ width: `${(value / 5) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 mb-6">
        <span className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">Filter:</span>
        {ratingFilters.map((r) => (
          <button
            key={r}
            onClick={() => setFilter(r)}
            className={`rounded-full px-3.5 py-1.5 font-jost text-sm font-light transition-colors ${
              filter === r ? 'bg-ink text-cream' : 'bg-white text-ink-3 hover:text-ink'
            }`}
            style={{ border: filter === r ? 'none' : '1px solid rgba(14,14,12,0.08)' }}
          >
            {r === 0 ? 'All' : `${r} Star`}
          </button>
        ))}
      </div>

      {/* Reviews list */}
      <div className="space-y-4">
        {data.reviews.length === 0 ? (
          <div
            className="text-center py-12 rounded-xl bg-white"
            style={{ border: '1px solid rgba(14,14,12,0.06)' }}
          >
            <svg
              className="w-10 h-10 text-ink-3/20 mx-auto mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
              />
            </svg>
            <p className="font-jost text-sm font-light text-ink-3">
              {filter > 0 ? 'No reviews matching this filter.' : 'No reviews yet.'}
            </p>
          </div>
        ) : (
          data.reviews.map((review) => (
            <div
              key={review.id}
              className="rounded-xl bg-white p-5"
              style={{ border: '1px solid rgba(14,14,12,0.06)' }}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-jost text-sm font-light text-ink">{review.clientName}</p>
                  <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                    {review.date}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg
                      key={i}
                      className={`w-4 h-4 ${i < review.rating ? 'text-gold' : 'text-ink-3/15'}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
              </div>
              <p className="font-jost text-sm font-light text-ink-2">{review.comment}</p>

              {review.reply && (
                <div className="mt-3 ml-4 pl-4 border-l-2 border-gold rounded-r-lg bg-gold/5 p-3">
                  <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-gold mb-1">
                    Your Reply
                  </p>
                  <p className="font-jost text-sm font-light text-ink-2">{review.reply}</p>
                </div>
              )}

              {!review.reply && replyingTo === review.id ? (
                <div className="mt-3">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write your reply..."
                    className="w-full rounded-lg px-3 py-2 font-jost text-sm font-light text-ink bg-cream focus:outline-none focus:ring-1 focus:ring-gold/30"
                    style={{ border: '1px solid rgba(14,14,12,0.08)' }}
                    rows={3}
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleReply(review.id)}
                      className="rounded-full px-4 py-1.5 bg-ink text-cream font-jost text-[12px] font-light hover:bg-ink/90 transition-colors"
                    >
                      Submit Reply
                    </button>
                    <button
                      onClick={() => {
                        setReplyingTo(null);
                        setReplyText('');
                      }}
                      className="rounded-full px-4 py-1.5 bg-white text-ink font-jost text-[12px] font-light hover:bg-cream-2 transition-colors"
                      style={{ border: '1px solid rgba(14,14,12,0.08)' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : !review.reply ? (
                <button
                  onClick={() => setReplyingTo(review.id)}
                  className="mt-3 font-jost text-sm font-light text-gold hover:text-gold/80 transition-colors"
                >
                  Reply to this review
                </button>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
