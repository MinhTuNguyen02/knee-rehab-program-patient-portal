import { useState, useRef, useEffect } from 'react';
import { useNotifications, PatientNotification } from '@/hooks/useNotifications';
import { Bell, MessageCircle, ClipboardCheck, Sparkles, Check, CheckSquare, RefreshCw, AlertCircle, X } from 'lucide-react';
import { formatDate, formatNotificationTime } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';

export default function NotificationDropdown() {
    const router = useRouter();
    const {
        notifications,
        unreadCount,
        isFcmActive,
        loading,
        loadingMore,
        hasMore,
        loadMore,
        markAsRead,
        markAllAsRead,
        refresh
    } = useNotifications();

    const [isOpen, setIsOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const handleNotificationClick = async (notification: PatientNotification) => {
        if (!notification.readAt) {
            await markAsRead(notification.id);
        }
        // Keep isOpen state as preferred by user
        const targetLink = notification.payload?.link;
        if (targetLink && targetLink !== '#') {
            router.push(targetLink);
        }
    };

    // Detect client-side mount and screen resizing
    useEffect(() => {
        setMounted(true);
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 640); // 640px = Tailwind's sm breakpoint
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Close on click outside (only for desktop inline dropdown)
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (!isMobile && containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isMobile]);

    // Auto-focus first element when dropdown opens
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                if (dropdownRef.current) {
                    const focusable = dropdownRef.current.querySelectorAll<HTMLElement>(
                        'button:not([disabled]), [tabindex="0"]'
                    );
                    if (focusable.length > 0) {
                        focusable[0].focus();
                    }
                }
            }, 50);
        }
    }, [isOpen]);

    // Handle Keyboard events for Escape and Tab Focus Trap
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
                triggerRef.current?.focus();
                return;
            }

            if (e.key === 'Tab') {
                if (!dropdownRef.current) return;

                // Get all focusable elements inside the active dropdown/drawer
                const focusableElements = dropdownRef.current.querySelectorAll<HTMLElement>(
                    'button:not([disabled]), [tabindex="0"]'
                );

                if (focusableElements.length === 0) return;

                const firstElement = focusableElements[0];
                const lastElement = focusableElements[focusableElements.length - 1];

                if (e.shiftKey) {
                    // Shift + Tab: Wrap from first to last
                    if (document.activeElement === firstElement) {
                        lastElement.focus();
                        e.preventDefault();
                    }
                } else {
                    // Tab: Wrap from last to first
                    if (document.activeElement === lastElement) {
                        firstElement.focus();
                        e.preventDefault();
                    }
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        if (target.scrollHeight - target.scrollTop <= target.clientHeight + 50) {
            if (hasMore && !loadingMore) {
                loadMore();
            }
        }
    };

    const getNotificationIcon = (type: PatientNotification['type']) => {
        switch (type) {
            case 'clinic_message':
                return (
                    <div className="p-2 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                        <MessageCircle className="w-5 h-5" />
                    </div>
                );
            case 'assessment_reminder':
                return (
                    <div className="p-2 rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                        <ClipboardCheck className="w-5 h-5" />
                    </div>
                );
            case 'welcome':
            default:
                return (
                    <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                        <Sparkles className="w-5 h-5" />
                    </div>
                );
        }
    };

    // Render mobile drawer using React Portal to escape backdrop-blur stacking context
    const mobileDrawer = isOpen && isMobile && mounted ? createPortal(
        <>
            {/* Backdrop overlay */}
            <div
                onClick={() => setIsOpen(false)}
                className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm z-50 animate-in fade-in duration-200"
            />
            {/* Slide-out Panel */}
            <div
                ref={dropdownRef}
                role="dialog"
                aria-label="Notifications Drawer"
                className="fixed top-0 right-0 h-full w-[290px] sm:w-[320px] bg-white dark:bg-slate-900 border-l border-slate-100 dark:border-slate-800 shadow-2xl z-50 overflow-hidden flex flex-col animate-in slide-in-from-right duration-300"
            >
                {/* Header */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-950 dark:text-white text-base">Notifications</span>
                        <span
                            title={isFcmActive ? 'FCM Real-time Active' : 'Polling (FCM Unavailable)'}
                            className={`h-2.5 w-2.5 rounded-full ${isFcmActive ? 'bg-emerald-500 animate-ping-once' : 'bg-amber-400'
                                }`}
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="text-xs font-semibold text-primary hover:text-primary-dark transition-colors flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
                                aria-label="Mark all notifications as read"
                            >
                                <CheckSquare className="w-3.5 h-3.5" />
                                Mark all read
                            </button>
                        )}
                        {/* Close Drawer Button */}
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
                            aria-label="Close notifications panel"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Notification List Container */}
                <div
                    className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800"
                    onScroll={handleScroll}
                >
                    {notifications.length === 0 ? (
                        <div className="py-12 px-4 text-center flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                            <Bell className="w-8 h-8 mb-2 opacity-50" />
                            <span className="text-sm font-medium">All caught up! No notifications.</span>
                        </div>
                    ) : (
                        notifications.map((notification) => (
                            <div
                                key={notification.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => handleNotificationClick(notification)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        handleNotificationClick(notification);
                                    }
                                }}
                                className={`p-4 flex gap-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 relative cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${!notification.readAt ? 'bg-primary/5 dark:bg-primary/10' : ''
                                    }`}
                                aria-label={`Notification: ${notification.title}. ${notification.body}. Date: ${formatDate(notification.createdAt)}. Status: ${notification.readAt ? 'Read' : 'Unread'}`}
                            >
                                {getNotificationIcon(notification.type)}

                                <div className="flex-1 min-w-0 pr-4">
                                    <div className="flex justify-between items-start gap-1">
                                        <span className="font-semibold text-sm text-slate-900 dark:text-white truncate block">
                                            {notification.title}
                                        </span>
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap mt-0.5">
                                            {formatNotificationTime(notification.createdAt)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                                        {notification.body}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                    {loadingMore && (
                        <div className="py-4 flex justify-center">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                        </div>
                    )}
                </div>
            </div>
        </>,
        document.body
    ) : null;

    return (
        <div className="relative" ref={containerRef}>
            {/* Bell Trigger */}
            <button
                ref={triggerRef}
                onClick={() => setIsOpen(!isOpen)}
                className={`relative p-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-all duration-200 focus:outline-none hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-primary ${isOpen ? 'bg-slate-100 dark:bg-slate-800 text-slate-950 dark:text-white' : ''
                    }`}
                aria-expanded={isOpen}
                aria-haspopup="dialog"
                aria-label={`Notifications. ${unreadCount} unread notifications.`}
            >
                <Bell className={`w-5.5 h-5.5 transition-transform duration-300 ${isOpen ? 'rotate-12 scale-105' : ''}`} />

                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-md animate-pulse">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Desktop Dropdown Panel */}
            {isOpen && !isMobile && (
                <div
                    ref={dropdownRef}
                    role="dialog"
                    aria-label="Notifications Dropdown Panel"
                    className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                >
                    {/* Header */}
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-950 dark:text-white text-base">Notifications</span>
                            <span
                                title={isFcmActive ? 'FCM Real-time Active' : 'Polling (FCM Unavailable)'}
                                className={`h-2.5 w-2.5 rounded-full ${isFcmActive ? 'bg-emerald-500 animate-ping-once' : 'bg-amber-400'}`}
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    className="text-xs font-semibold text-primary hover:text-primary-dark transition-colors flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
                                    aria-label="Mark all notifications as read"
                                >
                                    <CheckSquare className="w-3.5 h-3.5" />
                                    Mark all read
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Notification List */}
                    <div
                        className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800"
                        onScroll={handleScroll}
                    >
                        {notifications.length === 0 ? (
                            <div className="py-12 px-4 text-center flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                                <Bell className="w-8 h-8 mb-2 opacity-50" />
                                <span className="text-sm font-medium">All caught up! No notifications.</span>
                            </div>
                        ) : (
                            notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => handleNotificationClick(notification)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            handleNotificationClick(notification);
                                        }
                                    }}
                                    className={`p-4 flex gap-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 relative cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${!notification.readAt ? 'bg-primary/5 dark:bg-primary/10' : ''
                                        }`}
                                    aria-label={`Notification: ${notification.title}. ${notification.body}. Date: ${formatDate(notification.createdAt)}. Status: ${notification.readAt ? 'Read' : 'Unread'}`}
                                >
                                    {getNotificationIcon(notification.type)}

                                    <div className="flex-1 min-w-0 pr-4">
                                        <div className="flex justify-between items-start gap-1">
                                            <span className="font-semibold text-sm text-slate-900 dark:text-white truncate block">
                                                {notification.title}
                                            </span>
                                            <span className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap mt-0.5">
                                                {formatNotificationTime(notification.createdAt)}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                                            {notification.body}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                        {loadingMore && (
                            <div className="py-4 flex justify-center">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Portal-rendered Mobile Drawer */}
            {mobileDrawer}
        </div>
    );
}
