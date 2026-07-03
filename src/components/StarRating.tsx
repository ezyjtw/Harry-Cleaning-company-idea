export default function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.5;
  const empty = 5 - full - (hasHalf ? 1 : 0);

  return (
    <span className="inline-flex text-rating" aria-label={`${rating} out of 5 stars`}>
      {'★'.repeat(full)}
      {hasHalf && '★'}
      {'☆'.repeat(empty)}
    </span>
  );
}
