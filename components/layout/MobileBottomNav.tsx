'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'History', href: '/history' },
    { name: 'Chat', href: '/chat' },
    { name: 'Profile', href: '/profile' },
];

export default function MobileBottomNav() {
    const pathname = usePathname();

    return (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex z-40 pb-safe">
            {navItems.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);

                return (
                    <Link
                        key={item.name}
                        href={item.href}
                        className={`relative flex-1 h-full flex flex-col items-center justify-center gap-1 text-sm font-medium transition-all duration-200 ${isActive
                            ? 'text-primary bg-gray-100 dark:bg-gray-800'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                            }`}
                    >
                        {isActive && (
                            <span className="absolute top-0 w-full h-[3px] bg-primary rounded-b-md animate-fade-in" />
                        )}

                        <span className={isActive ? 'font-bold' : ''}>
                            {item.name}
                        </span>
                    </Link>
                );
            })}
        </div>
    );
}