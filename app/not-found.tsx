import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
    return (
        <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-950">
            <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-8 text-center space-y-6">
                <div className="mx-auto w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500">
                    <FileQuestion size={32} />
                </div>
                
                <div className="space-y-2">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Page not found
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">
                        The page you are looking for doesn't exist or has been moved.
                    </p>
                </div>

                <div className="pt-4">
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center justify-center px-6 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary-hover active:scale-[0.98] transition-all w-full"
                    >
                        Return to Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
}
