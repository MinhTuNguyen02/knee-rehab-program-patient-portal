import useSWR from 'swr';
import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
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
}

export function useChat() {
    const { socket, isConnected, isReconnecting } = useSocket();

    const { data: conversation, error: convError, isLoading: convLoading } = useSWR(
        '/api/patient/chat/conversation',
        async (url) => {
            const res = await fetch(url);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to load conversation');
            return json;
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

    // Offline queue: stored in ref (no re-render), triggered via counter
    const pendingQueueRef = useRef<{ id: string; body: string }[]>([]);
    const isFlushingRef = useRef(false);
    const [flushTrigger, setFlushTrigger] = useState(0);

    useEffect(() => {
        if (messages.length > 0) {
            latestSentAtRef.current = new Date(
                Math.max(...messages.map(m => new Date(m.sentAt).getTime()))
            ).toISOString();
        }
    }, [messages]);

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
                const existingIds = new Set(prev.map(m => m.id));
                if (existingIds.has(message.id)) return prev;
                return [...prev, message];
            });
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

        socket.on('message:receive', handleMessageReceive);
        socket.on('message:read', handleMessageRead);
        socket.on('typing:start', handleTypingStart);
        socket.on('typing:stop', handleTypingStop);
        socket.on('staff:status', handleStaffStatus);

        return () => {
            socket.off('message:receive', handleMessageReceive);
            socket.off('message:read', handleMessageRead);
            socket.off('typing:start', handleTypingStart);
            socket.off('typing:stop', handleTypingStop);
            socket.off('staff:status', handleStaffStatus);
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
        }
    }, [isConnected, socket, conversation]);

    // Flush pending queue — runs whenever flushTrigger increments
    useEffect(() => {
        if (!isConnected || !socket || !conversation) return;
        if (pendingQueueRef.current.length === 0) return;
        if (isFlushingRef.current) return;

        const flushQueue = async () => {
            isFlushingRef.current = true;

            while (pendingQueueRef.current.length > 0) {
                const pending = pendingQueueRef.current[0];

                try {
                    const newMessage: ChatMessage = await new Promise((resolve, reject) => {
                        const timer = setTimeout(() => reject(new Error('Timeout')), 8000);

                        socket.emit('message:send', {
                            conversationId: conversation.id,
                            body: pending.body,
                            tempId: pending.id,
                        }, (response: any) => {
                            clearTimeout(timer);
                            if (response?.id) resolve(response);
                            else reject(new Error(response?.error?.message || 'Send failed'));
                        });
                    });

                    // Remove from queue only after success
                    pendingQueueRef.current = pendingQueueRef.current.slice(1);

                    setMessages(prev => {
                        const mapped = prev.map(m =>
                            m.id === pending.id ? { ...newMessage, isPending: false } : m
                        );
                        const seen = new Set<string>();
                        return mapped.filter(m => {
                            if (seen.has(m.id)) return false;
                            seen.add(m.id);
                            return true;
                        });
                    });

                    await new Promise(r => setTimeout(r, 100));
                } catch (_) {
                    break; // Stop flushing, retry on next trigger
                }
            }

            isFlushingRef.current = false;
        };

        flushQueue();
    }, [flushTrigger, socket, isConnected, conversation]);

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

    const sendMessage = async (body: string) => {
        if (!body.trim() || !conversation) return;

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        if (socket && isConnected) socket.emit('typing:stop', { conversationId: conversation.id });

        const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const optimisticMessage: ChatMessage = {
            id: tempId,
            conversationId: conversation.id,
            senderType: 'patient',
            senderId: 'optimistic',
            body: body.trim(),
            sentAt: new Date().toISOString(),
            readAt: null,
            isPending: true,
        };

        // Always show optimistic message immediately
        setMessages(prev => [...prev, optimisticMessage]);

        if (isConnected && socket) {
            // Online path: send via socket, await ACK
            setSending(true);
            try {
                const newMessage: ChatMessage = await new Promise((resolve, reject) => {
                    const timer = setTimeout(() => reject(new Error('Timeout')), 8000);

                    socket.emit('message:send', {
                        conversationId: conversation.id,
                        body: body.trim(),
                        tempId,
                    }, (response: any) => {
                        clearTimeout(timer);
                        if (response?.id) resolve(response);
                        else reject(new Error('Failed to send message via socket'));
                    });
                });

                setMessages(prev => {
                    const mapped = prev.map(m =>
                        m.id === tempId ? { ...newMessage, isPending: false } : m
                    );
                    const seen = new Set<string>();
                    return mapped.filter(m => {
                        if (seen.has(m.id)) return false;
                        seen.add(m.id);
                        return true;
                    });
                });
            } catch (err: any) {
                toast.error('Network error. Message queued.');
                pendingQueueRef.current = [...pendingQueueRef.current, { id: tempId, body: body.trim() }];
            } finally {
                setSending(false);
            }
        } else {
            // Offline path: queue immediately, no blocking
            pendingQueueRef.current = [...pendingQueueRef.current, { id: tempId, body: body.trim() }];
        }
    };

    const loadMore = async () => {
        if (loadingMore || !hasMore || messages.length === 0) return;
        setLoadingMore(true);
        try {
            const oldestSentAt = messages[0].sentAt;
            const res = await fetch(
                `/api/patient/chat/messages?before=${encodeURIComponent(oldestSentAt)}&limit=20`
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
    };
}
