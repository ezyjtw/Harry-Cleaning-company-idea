import { type FC, type ReactNode } from 'react';

const paddingClasses = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
} as const;

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: keyof typeof paddingClasses;
  hover?: boolean;
}

const Card: FC<CardProps> = ({
  children,
  className = '',
  padding = 'md',
  hover = false,
}) => {
  return (
    <div
      className={`
        rounded-xl border border-gray-200 bg-white shadow-sm
        ${paddingClasses[padding]}
        ${hover ? 'transition-shadow duration-200 hover:shadow-md' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

export default Card;
