import { type FC } from 'react';
import Spinner from '../ui/Spinner';

const LoadingPage: FC = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-50">
      <Spinner size="lg" className="text-brand-600" />
      <p className="mt-4 text-sm font-medium text-brand-700">Loading...</p>
    </div>
  );
};

export default LoadingPage;
