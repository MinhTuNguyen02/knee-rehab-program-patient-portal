import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
    return (
        <div className="flex-1 flex items-center justify-center p-8 bg-slate-50 dark:bg-slate-950 min-h-[100dvh]">
            <div className="w-full max-w-md space-y-6 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-500/10">
                    <FileQuestion className="h-8 w-8 text-blue-600 dark:text-blue-500" />
                </div>

                <div className="space-y-2">
                    <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                        Page not found
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        The page you are looking for doesn't exist or has been moved.
                    </p>
                </div>

                <div className="pt-4">
                    <Link
                        href="/dashboard"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                        Return to Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
}
