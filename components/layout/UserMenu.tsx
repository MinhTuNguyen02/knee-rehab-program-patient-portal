'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, LogOut, ChevronDown } from 'lucide-react';

interface UserMenuProps {
    firstName: string;
    lastName: string;
    email: string;
}

export default function UserMenu({ firstName, lastName, email }: UserMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const menuRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    const fullName = `${firstName} ${lastName}`;
    const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = () => {
        startTransition(async () => {
            try {
                await fetch('/api/auth/logout', { method: 'POST' });
            } catch (err) {
                // ignore
            }
            router.push('/login');
        });
    };

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
                aria-expanded={isOpen}
                aria-haspopup="true"
            >
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm border border-primary/20 shadow-inner">
                    {initials || <User className="w-4 h-4" />}
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 mb-1">
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{fullName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{email}</p>
                    </div>

                    <Link
                        href="/profile"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                        <User className="w-4 h-4 text-gray-400" />
                        <span>Profile</span>
                    </Link>

                    <button
                        onClick={handleLogout}
                        disabled={isPending}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50 text-left"
                    >
                        <LogOut className="w-4 h-4" />
                        <span>{isPending ? 'Signing out...' : 'Sign Out'}</span>
                    </button>
                </div>
            )}
        </div>
    );
}
