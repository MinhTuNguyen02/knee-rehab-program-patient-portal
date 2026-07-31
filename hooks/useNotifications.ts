import useSWR from 'swr';
import { useState, useEffect, useRef, useCallback } from 'react';
import { getClientMessaging } from '@/lib/firebase';
import { getToken, onMessage } from 'firebase/messaging';
import useSWRInfinite from 'swr/infinite';

export interface PatientNotification {
    id: string;
    patientId: string;
    type: 'welcome' | 'assessment_reminder' | 'clinic_message';
    title: string;
    body: string;
    payload: Record<string, any> | null;
    readAt: string | null;
    createdAt: string;
}

const fetcher = async (url: string) => {
    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to fetch');
    }
    return json.data;
};

const infiniteFetcher = async (url: string) => {
    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Failed to fetch');
    return json;
};

export function useNotifications() {
    const [isFcmActive, setIsFcmActive] = useState<boolean | null>(null);
    const isChatOpenRef = useRef<boolean>(false);

    const getKey = (pageIndex: number, previousPageData: any) => {
        if (previousPageData && !previousPageData.meta?.hasMore) return null;
        if (pageIndex === 0) return `/api/patient/notifications?limit=20`;

        const lastItem = previousPageData.data[previousPageData.data.length - 1];
        return `/api/patient/notifications?limit=20&before=${lastItem.createdAt}`;
    };

    // Fetch notifications list using SWR
    // Automatically poll every 30 seconds ONLY if FCM is unavailable
    const {
        data: infiniteData,
        error: listError,
        size,
        setSize,
        isLoading: listLoading,
        mutate: mutateList,
    } = useSWRInfinite(getKey, infiniteFetcher, {
        refreshInterval: isFcmActive === false ? 30000 : 0,
        revalidateOnFocus: true,
    });

    // Fetch unread count using SWR
    const {
        data: countData,
        error: countError,
        isLoading: countLoading,
        mutate: mutateCount,
    } = useSWR<{ count: number }>(
        '/api/patient/notifications/unread-count',
        fetcher,
        {
            refreshInterval: isFcmActive === false ? 30000 : 0,
            revalidateOnFocus: true,
        }
    );

    const notificationsData = infiniteData ? infiniteData.flatMap(page => page.data) as PatientNotification[] : [];

    // 🟢 Tính toán trạng thái pagination
    const isLoadingMore = listLoading || (size > 0 && infiniteData && typeof infiniteData[size - 1] === "undefined");
    const isEmpty = infiniteData?.[0]?.data?.length === 0;
    const hasMore = isEmpty ? false : (infiniteData && infiniteData[infiniteData.length - 1]?.meta?.hasMore);

    const loadMore = () => {
        if (hasMore && !isLoadingMore) {
            setSize(size + 1);
        }
    };

    // Trigger local mutation to refresh both list and count
    const refreshNotifications = () => {
        mutateList();
        mutateCount();
    };

    // Actions
    const markAsRead = async (id: string) => {
        try {
            // Optimistic update
            mutateList((prev) => {
                if (!prev) return prev;
                return prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n);
            }, false);
            mutateCount((prev) => {
                if (!prev) return prev;
                return { count: Math.max(0, prev.count - 1) };
            }, false);

            const res = await fetch(`/api/patient/notifications/${id}/read`, {
                method: 'PATCH',
            });
            if (!res.ok) throw new Error('Failed to mark as read');
        } catch (err) {
            console.error(err);
        } finally {
            refreshNotifications();
        }
    };

    const markAllAsRead = async () => {
        try {
            // Optimistic update
            mutateList((prev) => {
                if (!prev) return prev;
                return prev.map(n => ({ ...n, readAt: new Date().toISOString() }));
            }, false);
            mutateCount({ count: 0 }, false);

            const res = await fetch('/api/patient/notifications', {
                method: 'PATCH',
            });
            if (!res.ok) throw new Error('Failed to mark all as read');
        } catch (err) {
            console.error(err);
        } finally {
            refreshNotifications();
        }
    };

    const checkAndClearUnread = useCallback((isOpen: boolean, data: any[]) => {
        if (!isOpen || !data || data.length === 0) return;

        const unreadIds = data
            .filter(n => !n.readAt && n.type === 'clinic_message')
            .map(n => n.id);

        if (unreadIds.length > 0) {
            mutateList(pages => {
                if (!pages) return pages;
                return pages.map(page => ({
                    ...page,
                    data: page.data.map((n: PatientNotification) =>
                        unreadIds.includes(n.id) ? { ...n, readAt: new Date().toISOString() } : n
                    )
                }));
            }, false);

            mutateCount(prev => prev ? { count: Math.max(0, prev.count - unreadIds.length) } : prev, false);

            unreadIds.forEach(id => {
                fetch(`/api/patient/notifications/${id}/read`, { method: 'PATCH' }).catch(console.error);
            });
        }
    }, [mutateList, mutateCount]);

    useEffect(() => {
        const handleChatOpened = () => {
            isChatOpenRef.current = true;
            checkAndClearUnread(true, notificationsData);
        };
        const handleChatClosed = () => {
            isChatOpenRef.current = false;
        };

        window.addEventListener('chat_opened', handleChatOpened);
        window.addEventListener('chat_closed', handleChatClosed);

        return () => {
            window.removeEventListener('chat_opened', handleChatOpened);
            window.removeEventListener('chat_closed', handleChatClosed);
        };
    }, [notificationsData, checkAndClearUnread]);

    useEffect(() => {
        checkAndClearUnread(isChatOpenRef.current, notificationsData);
    }, [notificationsData, checkAndClearUnread]);

    // FCM Setup
    useEffect(() => {
        if (typeof window === 'undefined') return;

        let active = true;

        const setupFCM = async () => {
            try {
                // Request Permission
                if (!('Notification' in window)) {
                    console.log('Browser does not support notifications');
                    if (active) setIsFcmActive(false);
                    return;
                }

                if (Notification.permission === 'default') {
                    await Notification.requestPermission();
                }

                if (Notification.permission !== 'granted') {
                    console.log('Notification permission not granted');
                    if (active) setIsFcmActive(false);
                    return;
                }

                // Register FCM Service Worker
                const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

                // Initialize messaging client
                const messaging = await getClientMessaging();
                if (!messaging) {
                    console.log('Firebase messaging not supported');
                    if (active) setIsFcmActive(false);
                    return;
                }

                // Retrieve token
                const fcmToken = await getToken(messaging, {
                    serviceWorkerRegistration: registration,
                    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
                });

                if (fcmToken) {
                    // Send to Backend
                    await fetch('/api/patient/fcm-token', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fcmToken }),
                    });
                    console.log('Successfully saved FCM token to backend');
                }

                // Attach real-time listener for foreground notifications
                onMessage(messaging, async (payload) => {
                    console.log('Foreground FCM received:', payload);

                    const notifId = payload.data?.id;
                    const notifType = payload.data?.type;

                    if (isChatOpenRef.current && notifType === 'clinic_message') {
                        if (notifId) {
                            try {
                                await fetch(`/api/patient/notifications/${notifId}/read`, { method: 'PATCH' });
                                refreshNotifications();
                            } catch (e) { console.error('Auto-read failed', e); }
                        }
                        return;
                    }
                    refreshNotifications();
                });

                if (active) setIsFcmActive(true);

            } catch (err) {
                console.error('FCM Registration error, falling back to 30s polling:', err);
                if (active) setIsFcmActive(false);
            }
        };

        setupFCM();

        return () => {
            active = false;
        };
    }, []);

    return {
        notifications: notificationsData || [],
        unreadCount: countData?.count || 0,
        loading: listLoading || countLoading,
        loadingMore: isLoadingMore,
        hasMore,
        loadMore,
        error: listError || countError,
        isFcmActive,
        markAsRead,
        markAllAsRead,
        refresh: refreshNotifications
    };
}
