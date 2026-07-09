'use client';

import { signOut } from 'next-auth/react';
import { useState, useEffect, useCallback } from 'react';

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

const ratingFilters = [0, 5, 4, 3, 2, 1];

export default function ReviewsPage() {
  const [filter, setFilter] = useState(0);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [data, setData] = useState<ReviewsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReviews = useCallback(
    async (ratingFilter: number) => {
      setLoading(true);
      const params = ratingFilter > 0 ? `?rating=${ratingFilter}` : '';
      const res = await fetch(`/api/cleaner/reviews${params}`);
      if (res.status === 401) {
        // R3: signOut (not router.push) — clears the stale cookie so /login
        // renders instead of middleware bouncing back to /dashboard.
        signOut({ callbackUrl: '/login' });
        return;
      }
      if (res.ok) {
        setData(await res.json());
      }
      setLoading(false);
    },
    []
  );

  useEffect(() => {
    fetchReviews(filter);
  }, [filter, fetchReviews]);

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
        <h1 className="font-newsreader text-2xl font-semibold text-ink">Reviews</h1>
        <p className="font-jost text-sm font-light text-ink-2 mt-1">
          See what your customers are saying
        </p>
      </div>

      {/* Overall rating and breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div
          className="rounded-xl bg-surface p-6 text-center"
          style={{ border: '1px solid rgb(var(--color-border))' }}
        >
          <p className="font-newsreader text-5xl font-medium text-ink">{overallRating}</p>
          <div className="flex items-center justify-center gap-1 mt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <svg
                key={i}
                className={`w-5 h-5 ${i < Math.round(Number(overallRating)) ? 'text-rating' : 'text-ink-3/15'}`}
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
          className="rounded-xl bg-surface p-6"
          style={{ border: '1px solid rgb(var(--color-border))' }}
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
                <div className="flex-1 h-2 bg-primary-soft rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
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
          className="rounded-xl bg-surface p-6"
          style={{ border: '1px solid rgb(var(--color-border))' }}
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
                <div className="w-full h-2 bg-primary-soft rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
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
              filter === r ? 'bg-primary text-white' : 'bg-surface text-ink-3 hover:text-ink'
            }`}
            style={{ border: filter === r ? 'none' : '1px solid rgb(var(--color-border))' }}
          >
            {r === 0 ? 'All' : `${r} Star`}
          </button>
        ))}
      </div>

      {/* Reviews list */}
      <div className="space-y-4">
        {data.reviews.length === 0 ? (
          <div
            className="text-center py-12 rounded-xl bg-surface"
            style={{ border: '1px solid rgb(var(--color-border))' }}
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
          <>
            {/* Verified reviews */}
            {data.reviews.map((review) => (
              <div
                key={review.id}
                className="rounded-xl bg-surface p-5"
                style={{ border: '1px solid rgb(var(--color-border))' }}
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
                        className={`w-4 h-4 ${i < review.rating ? 'text-rating' : 'text-ink-3/15'}`}
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
                  <div className="mt-3 ml-4 pl-4 border-l-2 border-primary rounded-r-lg bg-primary/5 p-3">
                    <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-primary mb-1">
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
                      className="w-full rounded-lg px-3 py-2 font-jost text-sm font-light text-ink bg-page focus:outline-none focus:ring-1 focus:ring-primary/30"
                      style={{ border: '1px solid rgb(var(--color-border))' }}
                      rows={3}
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleReply(review.id)}
                        className="rounded-full px-4 py-1.5 bg-primary text-white font-jost text-[12px] font-light hover:bg-primary-hover transition-colors"
                      >
                        Submit Reply
                      </button>
                      <button
                        onClick={() => {
                          setReplyingTo(null);
                          setReplyText('');
                        }}
                        className="rounded-full px-4 py-1.5 bg-surface text-ink font-jost text-[12px] font-light hover:bg-primary-soft transition-colors"
                        style={{ border: '1px solid rgb(var(--color-border))' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : !review.reply ? (
                  <button
                    onClick={() => setReplyingTo(review.id)}
                    className="mt-3 font-jost text-sm font-light text-primary hover:text-primary/80 transition-colors"
                  >
                    Reply to this review
                  </button>
                ) : null}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
