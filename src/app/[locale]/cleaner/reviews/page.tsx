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
  images?: string[];
  categories: {
    thoroughness: number;
    punctuality: number;
    communication: number;
  };
}

const CATEGORY_LABELS: { key: keyof Testimonial['categories']; label: string }[] = [
  { key: 'thoroughness', label: 'Thoroughness' },
  { key: 'punctuality', label: 'Punctuality' },
  { key: 'communication', label: 'Communication' },
];

const EMPTY_TESTIMONIAL: Testimonial = {
  clientName: '',
  rating: 5,
  text: '',
  images: [],
  categories: { thoroughness: 5, punctuality: 5, communication: 5 },
};

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

  const handlePhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const current = t.images || [];
    const remaining = 4 - current.length;
    if (remaining <= 0) return;
    files.slice(0, remaining).forEach((file) => {
      if (file.size > 2 * 1024 * 1024) return;
      const reader = new FileReader();
      reader.onload = () => {
        onChange({
          ...t,
          images: [...(t.images || []), reader.result as string],
        });
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removePhoto = (index: number) => {
    onChange({ ...t, images: (t.images || []).filter((_, i) => i !== index) });
  };

  const cats = t.categories || { thoroughness: 5, punctuality: 5, communication: 5 };

  return (
    <div className="rounded-xl bg-cream p-5" style={{ border: '1px solid rgba(14,14,12,0.06)' }}>
      {/* Header: name, stars, delete */}
      <div className="flex items-center justify-between mb-4">
        <input
          type="text"
          value={t.clientName}
          onChange={(e) => onChange({ ...t, clientName: e.target.value })}
          placeholder="Client name"
          className="font-jost text-sm text-ink bg-transparent focus:outline-none placeholder:text-ink-3/50 w-48"
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

      {/* Review text */}
      <textarea
        value={t.text}
        onChange={(e) => onChange({ ...t, text: e.target.value })}
        placeholder="What did this client say about your work?"
        className="w-full font-jost text-sm font-light text-ink-2 bg-transparent focus:outline-none resize-none placeholder:text-ink-3/40 mb-4"
        rows={2}
      />

      {/* Category ratings */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 mb-4">
        {CATEGORY_LABELS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-2">
            <span className="font-jost text-xs font-light text-ink-3 w-28">{label}</span>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => onChange({ ...t, categories: { ...cats, [key]: v } })}
                >
                  <svg
                    className={`w-3.5 h-3.5 transition-colors ${v <= cats[key] ? 'text-gold' : 'text-ink-3/15 hover:text-gold/40'}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Evidence photos */}
      <div>
        <p className="font-jost text-xs font-light text-ink-3 mb-2">
          Evidence of clean (up to 4 photos)
        </p>
        <div className="flex flex-wrap gap-2">
          {(t.images || []).map((img, i) => (
            <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden group">
              <Image
                src={img}
                alt="Evidence"
                width={80}
                height={80}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => removePhoto(i)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-ink/70 text-cream flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ))}
          {(t.images || []).length < 4 && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-20 h-20 rounded-lg flex flex-col items-center justify-center gap-1 hover:bg-ink/5 transition-colors"
              style={{ border: '1px dashed rgba(14,14,12,0.15)' }}
            >
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span className="font-jost text-[10px] text-ink-3/50">Add</span>
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handlePhotos}
          className="hidden"
        />
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

  const savedTestimonials = testimonials.filter((t) => t.clientName.trim() && t.text.trim());
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
              <span className="font-jost text-xs font-light text-green-600 flex items-center gap-1">
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
              setTestimonials([...testimonials, { ...EMPTY_TESTIMONIAL }]);
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
        {data.reviews.length === 0 && savedTestimonials.length === 0 ? (
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
          <>
            {/* Testimonials */}
            {filter === 0 &&
              savedTestimonials.map((t, i) => {
                const cats = t.categories || { thoroughness: 5, punctuality: 5, communication: 5 };
                return (
                  <div
                    key={`testimonial-${i}`}
                    className="rounded-xl bg-white p-5"
                    style={{ border: '1px solid rgba(14,14,12,0.06)' }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-jost text-sm font-light text-ink">{t.clientName}</p>
                          <span className="rounded-full bg-cream px-2 py-0.5 font-jost text-[10px] font-medium text-ink-3">
                            Testimonial
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, si) => (
                          <svg
                            key={si}
                            className={`w-4 h-4 ${si < t.rating ? 'text-gold' : 'text-ink-3/15'}`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                    </div>
                    <p className="font-jost text-sm font-light text-ink-2 mb-3">{t.text}</p>

                    <div className="flex flex-wrap gap-3 mb-3">
                      {CATEGORY_LABELS.map(({ key, label }) => (
                        <span
                          key={key}
                          className="inline-flex items-center gap-1.5 rounded-full bg-cream px-3 py-1 font-jost text-xs font-light text-ink-2"
                        >
                          {label}: {cats[key]}/5
                        </span>
                      ))}
                    </div>

                    {t.images && t.images.length > 0 && (
                      <div className="flex gap-2">
                        {t.images.map((img, pi) => (
                          <div key={pi} className="w-16 h-16 rounded-lg overflow-hidden">
                            <Image
                              src={img}
                              alt="Evidence of clean"
                              width={64}
                              height={64}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

            {/* Verified reviews */}
            {data.reviews.map((review) => (
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
            ))}
          </>
        )}
      </div>
    </div>
  );
}
