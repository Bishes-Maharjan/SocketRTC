import { FileQuestion, Home } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="hero min-h-screen bg-base-200">
      <div className="hero-content text-center">
        <div className="max-w-md">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute -inset-1 rounded-full bg-primary/20 blur-xl animate-pulse"></div>
              <FileQuestion className="w-24 h-24 text-primary relative z-10" />
            </div>
          </div>
          
          <h1 className="text-9xl font-bold text-primary opacity-20 select-none">404</h1>
          <h2 className="text-4xl font-bold -mt-12 mb-4 relative z-10">Page Not Found</h2>
          
          <p className="py-6 text-base-content/70 text-lg">
            Whoops! It seems like you've wandered into uncharted territory. 
            The page you are looking for doesn't exist or has been moved.
          </p>
          
          <div className="flex justify-center gap-4">
            <Link href="/" className="btn btn-primary btn-wide gap-2 group">
              <Home className="w-5 h-5 transition-transform group-hover:-translate-y-1" />
              Return Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
