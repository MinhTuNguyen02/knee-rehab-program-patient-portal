"use client";

import { useEffect } from "react";
import { AlertCircle, WifiOff } from "lucide-react";
import Link from "next/link";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    const isNetworkError = error.message?.toLowerCase().includes("failed to fetch") || error.message?.toLowerCase().includes("network");

    return (
        <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-950">
            <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-8 text-center space-y-6">
                <div className="mx-auto w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500">
                    {isNetworkError ? <WifiOff size={32} /> : <AlertCircle size={32} />}
                </div>
                
                <div className="space-y-2">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {isNetworkError ? "No connection" : "Something went wrong"}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">
                        {isNetworkError 
                            ? "Please check your network." 
                            : "Please try again."}
                    </p>
                </div>

                <div className="flex items-center justify-center gap-4 pt-4">
                    <button
                        onClick={reset}
                        className="px-6 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary-hover active:scale-[0.98] transition-all"
                    >
                        Try again
                    </button>
                    <Link
                        href="/dashboard"
                        className="px-6 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-[0.98] transition-all"
                    >
                        Back Home
                    </Link>
                </div>
            </div>
        </div>
    );
}
