import useSWR from 'swr';
import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import { useSocket } from './useSocket';

export interface ChatMessage {
    id: string;
    conversationId: string;
    senderType: 'patient' | 'staff';
    senderId: string;
    body: string;
    sentAt: string;
    readAt: string | null;
    isPending?: boolean;
    client_timestamp?: number;
    reactions?: Record<string, { count: number; reactorIds: string[] }>;
    replyToMessageId?: string;
    replyToMessage?: ChatMessage;
    imageUrl?: string;
    stickerUrl?: string;
}

export function useChat() {
    const { socket, isConnected, isReconnecting } = useSocket();

    const { data: conversation, error: convError, isLoading: convLoading, mutate } = useSWR(
        '/api/patient/chat/conversation',
        async (url) => {
            const res = await fetch(url);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to load conversation');
            return json.data || json;
        },
        { revalidateOnFocus: false }
    );

    const latestSentAtRef = useRef<string | null>(null);
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const offlineTimerRef = useRef<NodeJS.Timeout | null>(null);

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loadingMessages, setLoadingMessages] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isClinicTyping, setIsClinicTyping] = useState(false);
    const [isClinicOnline, setIsClinicOnline] = useState(false);

    // Offline queue: stored in ref and synced to localStorage
    const pendingQueueRef = useRef<{ id: string; body: string; client_timestamp: number; replyToMessageId?: string; imageUrl?: string; stickerUrl?: string }[]>([]);
    const isFlushingRef = useRef(false);
    const [flushTrigger, setFlushTrigger] = useState(0);

    // 1. Calculate latest timestamp for polling based ONLY on confirmed messages
    useEffect(() => {
        const confirmedMessages = messages.filter(m => !m.isPending);
        if (confirmedMessages.length > 0) {
            latestSentAtRef.current = new Date(
                Math.max(...confirmedMessages.map(m => new Date(m.sentAt).getTime()))
            ).toISOString();
        }
    }, [messages]);

    // Helper to sync queue to localStorage
    const syncQueueToStorage = useCallback((queue: any[]) => {
        if (!conversation) return;
        try {
            localStorage.setItem(`chat_queue_${conversation.id}`, JSON.stringify(queue));
        } catch (e) {
            console.error('Failed to sync offline queue to storage');
        }
    }, [conversation]);

    // 2. Restore queue from localStorage on mount/conversation change
    useEffect(() => {
        if (!conversation) return;
        try {
            const savedQueue = localStorage.getItem(`chat_queue_${conversation.id}`);
            if (savedQueue) {
                pendingQueueRef.current = JSON.parse(savedQueue);
                if (pendingQueueRef.current.length > 0 && isConnected) {
                    setFlushTrigger(n => n + 1);
                }
            }
        } catch (e) {
            console.error('Failed to parse offline queue');
        }
    }, [conversation, isConnected]);

    // Load initial messages once conversation is loaded
    useEffect(() => {
        if (!conversation) return;

        const loadInitialMessages = async () => {
            setLoadingMessages(true);
            setError(null);
            try {
                const res = await fetch('/api/patient/chat/messages?limit=20');
                const data = await res.json();
                if (!res.ok) throw new Error(data.error?.message || 'Failed to load messages');

                setMessages([...data.data || []].reverse());
                setHasMore(data.meta?.hasMore || false);
                await markAsRead();
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoadingMessages(false);
            }
        };

        loadInitialMessages();
    }, [conversation]);

    // WebSocket event listeners
    useEffect(() => {
        if (!socket || !conversation) return;

        const handleMessageReceive = (message: ChatMessage) => {
            setMessages(prev => {
                if (prev.some(m => m.id === message.id)) return prev;
                return [...prev, message];
            });
            mutate();
            socket.emit('message:read', { conversationId: conversation.id });
        };

        const handleMessageRead = (data: { conversationId: string; readBy: string }) => {
            if (data.readBy === 'staff') {
                setMessages(prev => prev.map(m => m.readAt ? m : { ...m, readAt: new Date().toISOString() }));
            }
        };

        const handleTypingStart = (data: { userType: string }) => {
            if (data.userType === 'staff') setIsClinicTyping(true);
        };

        const handleTypingStop = (data: { userType: string }) => {
            if (data.userType === 'staff') setIsClinicTyping(false);
        };

        const handleStaffStatus = (data: { isOnline: boolean }) => {
            if (data.isOnline) {
                if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
                setIsClinicOnline(true);
            } else {
                offlineTimerRef.current = setTimeout(() => setIsClinicOnline(false), 10000);
            }
        };

        const handleReactionUpdate = (data: { messageId: string; reactions: Record<string, { count: number; reactorIds: string[] }> }) => {
            setMessages(prev => prev.map(m =>
                m.id === data.messageId ? { ...m, reactions: data.reactions } : m
            ));
        };

        const handleStreakUpdate = () => {
            mutate(); // Refresh conversation to get updated streakCount / streakActiveToday
        };

        socket.on('message:receive', handleMessageReceive);
        socket.on('message:read', handleMessageRead);
        socket.on('typing:start', handleTypingStart);
        socket.on('typing:stop', handleTypingStop);
        socket.on('staff:status', handleStaffStatus);
        socket.on('reaction:update', handleReactionUpdate);
        socket.on('streak:update', handleStreakUpdate);

        return () => {
            socket.off('message:receive', handleMessageReceive);
            socket.off('message:read', handleMessageRead);
            socket.off('typing:start', handleTypingStart);
            socket.off('typing:stop', handleTypingStop);
            socket.off('staff:status', handleStaffStatus);
            socket.off('reaction:update', handleReactionUpdate);
            socket.off('streak:update', handleStreakUpdate);
        };
    }, [socket, conversation]);

    // Polling fallback when disconnected
    useEffect(() => {
        if (!conversation || isConnected) {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
            return;
        }

        pollingIntervalRef.current = setInterval(async () => {
            try {
                const query = latestSentAtRef.current
                    ? `?after=${encodeURIComponent(latestSentAtRef.current)}`
                    : '';
                const res = await fetch(`/api/patient/chat/messages${query}`);
                if (!res.ok) return;

                const json = await res.json();
                const newMessages: ChatMessage[] = json.data || [];
                if (newMessages.length > 0) {
                    setMessages(prev => {
                        const existingIds = new Set(prev.map(m => m.id));
                        const uniqueNew = newMessages.filter(m => !existingIds.has(m.id));
                        if (uniqueNew.length === 0) return prev;
                        return [...prev, ...uniqueNew];
                    });
                }
            } catch (_) { /* ignore */ }
        }, 4000);

        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
        };
    }, [conversation, isConnected]);

    // Trigger queue flush when connection is restored
    useEffect(() => {
        if (isConnected && socket && conversation) {
            setFlushTrigger(n => n + 1);
            markAsRead();
        }
    }, [isConnected, socket, conversation]);

    // 4. Flush Queue (FIFO, strictly handles socket communication)
    useEffect(() => {
        if (!isConnected || !socket || !conversation) return;
        if (pendingQueueRef.current.length === 0) return;
        if (isFlushingRef.current) return;

        const flushQueue = async () => {
            isFlushingRef.current = true;

            while (pendingQueueRef.current.length > 0) {
                const pending = pendingQueueRef.current[0];

                try {
                    const ackMessage: ChatMessage = await new Promise((resolve, reject) => {
                        const timer = setTimeout(() => reject(new Error('Timeout')), 8000);

                        socket.emit('message:send', {
                            conversationId: conversation.id,
                            id: pending.id,
                            client_timestamp: pending.client_timestamp,
                            body: pending.body,
                            replyToMessageId: pending.replyToMessageId,
                            imageUrl: pending.imageUrl,
                            stickerUrl: pending.stickerUrl,
                        }, (response: any) => {
                            clearTimeout(timer);
                            if (response?.id) resolve(response);
                            else reject(new Error(response?.error?.message || 'Send failed'));
                        });
                    });

                    // Remove from queue only after success
                    pendingQueueRef.current = pendingQueueRef.current.slice(1);
                    syncQueueToStorage(pendingQueueRef.current);
                    mutate(); // Refresh conversation state (for streak counts, etc.)

                    setMessages(prev => {
                        const mapped = prev.map(m =>
                            m.id === pending.id ? { ...ackMessage, isPending: false, sentAt: m.sentAt } : m
                        );
                        const seen = new Set<string>();
                        return mapped.filter(m => {
                            if (seen.has(m.id)) return false;
                            seen.add(m.id);
                            return true;
                        });
                    });

                    await new Promise(r => setTimeout(r, 100)); // avoid rate limit
                } catch (_) {
                    break; // Stop flushing, retry on next trigger
                }
            }

            isFlushingRef.current = false;
        };

        flushQueue();
    }, [flushTrigger, socket, isConnected, conversation, syncQueueToStorage, mutate]);

    useEffect(() => {
        if (isConnected && messages.length > 0) {
            const fetchMissedMessages = async () => {
                try {
                    const query = latestSentAtRef.current
                        ? `?after=${encodeURIComponent(latestSentAtRef.current)}`
                        : '';

                    const res = await fetch(`/api/patient/chat/messages${query}`);
                    if (!res.ok) return;

                    const json = await res.json();
                    const missedMessages: ChatMessage[] = json.data || [];

                    if (missedMessages.length > 0) {
                        setMessages(prev => {
                            const existingIds = new Set(prev.map(m => m.id));
                            const uniqueNew = missedMessages.filter(m => !existingIds.has(m.id));
                            return [...prev, ...uniqueNew];
                        });
                    }
                } catch (e) {
                    console.error("Error fetching missed messages:", e);
                }
            };

            fetchMissedMessages();
        }
    }, [isConnected]);

    const markAsRead = async () => {
        if (!conversation) return;
        if (isConnected && socket) {
            socket.emit('message:read', { conversationId: conversation.id });
        } else {
            try {
                await fetch('/api/patient/chat/conversation', { method: 'PATCH' });
            } catch (_) { /* fail silently */ }
        }
    };

    const emitTyping = useCallback(() => {
        if (!conversation || !isConnected || !socket) return;

        socket.emit('typing:start', { conversationId: conversation.id });

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            socket.emit('typing:stop', { conversationId: conversation.id });
        }, 3000);
    }, [conversation, isConnected, socket]);

    // 3. Send Message Logic: Only updates Optimistic UI and enqueues
    const sendMessage = async (body: string, replyToMessage?: ChatMessage, imageUrl?: string, stickerUrl?: string) => {
        if ((!body.trim() && !imageUrl && !stickerUrl) || !conversation) return;

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        if (socket && isConnected) socket.emit('typing:stop', { conversationId: conversation.id });

        const realUuid = uuidv4();
        const clientTimestamp = Date.now();
        const optimisticMessage: ChatMessage = {
            id: realUuid,
            conversationId: conversation.id,
            senderType: 'patient',
            senderId: 'current-user-id',
            body: body.trim(),
            sentAt: new Date().toISOString(),
            readAt: null,
            isPending: true,
            client_timestamp: clientTimestamp,
            replyToMessageId: replyToMessage?.id,
            replyToMessage: replyToMessage,
            imageUrl,
            stickerUrl,
        };

        // Always show optimistic message immediately
        setMessages(prev => [...prev, optimisticMessage]);

        // Add to persistent queue
        pendingQueueRef.current = [...pendingQueueRef.current, {
            id: realUuid,
            body: body.trim(),
            client_timestamp: clientTimestamp,
            replyToMessageId: replyToMessage?.id,
            imageUrl,
            stickerUrl,
        }];
        syncQueueToStorage(pendingQueueRef.current);

        // Trigger flush (if connected, the flushQueue effect will pick this up)
        setFlushTrigger(n => n + 1);
    };

    const loadMore = async () => {
        if (loadingMore || !hasMore || messages.length === 0) return;
        setLoadingMore(true);
        try {
            const oldestClientTimestamp = messages[0].client_timestamp || new Date(messages[0].sentAt).getTime();
            const res = await fetch(
                `/api/patient/chat/messages?before=${oldestClientTimestamp}&limit=20`
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || 'Failed to load older messages');

            const olderMessages: ChatMessage[] = data.data || [];
            if (olderMessages.length > 0) {
                setMessages(prev => {
                    const existingIds = new Set(prev.map(m => m.id));
                    const uniqueOlder = [...olderMessages].reverse().filter(m => !existingIds.has(m.id));
                    return [...uniqueOlder, ...prev];
                });
            }
            setHasMore(data.meta?.hasMore || false);
        } catch (err: any) {
            toast.error(err.message || 'Could not load older messages');
        } finally {
            setLoadingMore(false);
        }
    };

    const toggleReaction = useCallback((messageId: string, emoji: string) => {
        if (!socket || !isConnected || !conversation) return;
        socket.emit('reaction:toggle', {
            messageId,
            conversationId: conversation.id,
            emoji
        });
    }, [socket, isConnected, conversation]);

    return {
        conversation,
        messages,
        loading: convLoading || (loadingMessages && messages.length === 0),
        loadingMore,
        hasMore,
        sending,
        error: convError ? convError.message : error,
        isConnected,
        isReconnecting,
        isClinicTyping,
        isClinicOnline,
        emitTyping,
        sendMessage,
        loadMore,
        markAsRead,
        toggleReaction,
    };
}
