import { type FC } from 'react';

const variantClasses = {
  text: 'rounded-md',
  circular: 'rounded-full',
  rectangular: 'rounded-lg',
} as const;

const variantDefaults = {
  text: { width: '100%', height: '1rem' },
  circular: { width: '3rem', height: '3rem' },
  rectangular: { width: '100%', height: '8rem' },
} as const;

interface SkeletonProps {
  variant?: keyof typeof variantClasses;
  width?: string | number;
  height?: string | number;
  className?: string;
}

const Skeleton: FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  className = '',
}) => {
  const defaults = variantDefaults[variant];

  return (
    <div
      className={`animate-pulse bg-gray-200 ${variantClasses[variant]} ${className}`}
      style={{
        width: width ?? defaults.width,
        height: height ?? defaults.height,
      }}
      aria-hidden="true"
    />
  );
};

export default Skeleton;
