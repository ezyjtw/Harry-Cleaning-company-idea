"use client";

import { useState } from "react";

interface ReviewItem {
  id: string;
  clientName: string;
  date: string;
  rating: number;
  comment: string;
  reply?: string;
  categories: {
    thoroughness: number;
    punctuality: number;
    communication: number;
    value: number;
  };
}

const mockReviews: ReviewItem[] = [
  {
    id: "1", clientName: "Alice M.", date: "2026-03-12", rating: 5,
    comment: "Absolutely spotless! Sarah is incredibly thorough and professional. She went above and beyond what was expected. Will definitely book again.",
    categories: { thoroughness: 5, punctuality: 5, communication: 5, value: 5 },
  },
  {
    id: "2", clientName: "Tom R.", date: "2026-03-10", rating: 4,
    comment: "Great job overall. Very punctual and friendly. The bathroom could have used a bit more attention but otherwise excellent.",
    reply: "Thank you Tom! I will make sure to pay extra attention to the bathroom next time.",
    categories: { thoroughness: 4, punctuality: 5, communication: 4, value: 4 },
  },
  {
    id: "3", clientName: "Nina P.", date: "2026-03-08", rating: 5,
    comment: "Best cleaner we have ever had. Highly recommend! Everything was immaculate.",
    categories: { thoroughness: 5, punctuality: 5, communication: 5, value: 5 },
  },
  {
    id: "4", clientName: "Ben S.", date: "2026-03-05", rating: 3,
    comment: "Decent clean but arrived 20 minutes late. The quality of work was fine once she got started.",
    categories: { thoroughness: 3, punctuality: 2, communication: 3, value: 3 },
  },
  {
    id: "5", clientName: "Laura K.", date: "2026-03-02", rating: 5,
    comment: "Fantastic deep clean of our flat. Sarah is meticulous and left the place sparkling. Very friendly too.",
    categories: { thoroughness: 5, punctuality: 5, communication: 5, value: 4 },
  },
  {
    id: "6", clientName: "Chris W.", date: "2026-02-28", rating: 4,
    comment: "Very pleased with the end of tenancy clean. Professional and efficient.",
    categories: { thoroughness: 4, punctuality: 4, communication: 5, value: 4 },
  },
];

const ratingFilters = [0, 5, 4, 3, 2, 1]; // 0 = All

export default function ReviewsPage() {
  const [filter, setFilter] = useState(0);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [reviews, setReviews] = useState(mockReviews);

  const filteredReviews = filter === 0 ? reviews : reviews.filter((r) => r.rating === filter);

  const overallRating = (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1);

  const categoryAverages = {
    thoroughness: (reviews.reduce((s, r) => s + r.categories.thoroughness, 0) / reviews.length).toFixed(1),
    punctuality: (reviews.reduce((s, r) => s + r.categories.punctuality, 0) / reviews.length).toFixed(1),
    communication: (reviews.reduce((s, r) => s + r.categories.communication, 0) / reviews.length).toFixed(1),
    value: (reviews.reduce((s, r) => s + r.categories.value, 0) / reviews.length).toFixed(1),
  };

  const ratingDistribution = [5, 4, 3, 2, 1].map((r) => ({
    rating: r,
    count: reviews.filter((rev) => rev.rating === r).length,
    percentage: (reviews.filter((rev) => rev.rating === r).length / reviews.length) * 100,
  }));

  const handleReply = (reviewId: string) => {
    if (!replyText.trim()) return;
    setReviews((prev) =>
      prev.map((r) => (r.id === reviewId ? { ...r, reply: replyText } : r))
    );
    setReplyingTo(null);
    setReplyText("");
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Reviews</h1>
        <p className="text-gray-500 mt-1">See what your customers are saying</p>
      </div>

      {/* Overall rating and breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Overall score */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <p className="text-5xl font-bold text-gray-900">{overallRating}</p>
          <div className="flex items-center justify-center gap-1 mt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <svg
                key={i}
                className={`w-5 h-5 ${i < Math.round(Number(overallRating)) ? "text-yellow-400" : "text-gray-200"}`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <p className="text-sm text-gray-500 mt-1">Based on {reviews.length} reviews</p>
        </div>

        {/* Rating distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Rating Distribution</h3>
          <div className="space-y-2">
            {ratingDistribution.map((item) => (
              <div key={item.rating} className="flex items-center gap-2">
                <span className="text-sm text-gray-600 w-8">{item.rating} star</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${item.percentage}%` }} />
                </div>
                <span className="text-sm text-gray-500 w-6 text-right">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Category breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Category Breakdown</h3>
          <div className="space-y-3">
            {Object.entries(categoryAverages).map(([key, value]) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600 capitalize">{key}</span>
                  <span className="text-sm font-medium text-gray-900">{value}</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(Number(value) / 5) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filter by rating */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-sm font-medium text-gray-700">Filter:</span>
        {ratingFilters.map((r) => (
          <button
            key={r}
            onClick={() => setFilter(r)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              filter === r
                ? "bg-blue-600 text-white"
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            {r === 0 ? "All" : `${r} Star`}
          </button>
        ))}
      </div>

      {/* Reviews list */}
      <div className="space-y-4">
        {filteredReviews.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <p className="text-gray-500">No reviews matching this filter.</p>
          </div>
        ) : (
          filteredReviews.map((review) => (
            <div key={review.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-medium text-gray-900">{review.clientName}</p>
                  <p className="text-xs text-gray-400">{review.date}</p>
                </div>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg
                      key={i}
                      className={`w-4 h-4 ${i < review.rating ? "text-yellow-400" : "text-gray-200"}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
              </div>
              <p className="text-sm text-gray-700">{review.comment}</p>

              {/* Reply */}
              {review.reply && (
                <div className="mt-3 ml-4 pl-4 border-l-2 border-blue-200 bg-blue-50 rounded-r-lg p-3">
                  <p className="text-xs font-medium text-blue-700 mb-1">Your Reply</p>
                  <p className="text-sm text-gray-700">{review.reply}</p>
                </div>
              )}

              {/* Reply form */}
              {!review.reply && replyingTo === review.id ? (
                <div className="mt-3">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write your reply..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleReply(review.id)}
                      className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Submit Reply
                    </button>
                    <button
                      onClick={() => { setReplyingTo(null); setReplyText(""); }}
                      className="px-4 py-1.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : !review.reply ? (
                <button
                  onClick={() => setReplyingTo(review.id)}
                  className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
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
