'use client';

import { useState, useRef, useEffect, UIEvent, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Send, Check, CheckCheck, MessageSquare, AlertCircle, ArrowLeft, ChevronDown, Smile, SmilePlus, CornerUpLeft, X, ImagePlus } from 'lucide-react';
import { useChat, ChatMessage } from '@/hooks/useChat';
import { SocketProvider } from '@/hooks/useSocket';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { formatBubbleTime, formatDateDivider } from '@/lib/utils';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { EmojiClickData } from 'emoji-picker-react';
import ImageLightbox from '@/components/ImageLightbox';

const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });

const DEFAULT_REACTIONS = [
    { unified: '1f44d', emoji: '👍' },
    { unified: '2764-fe0f', emoji: '❤️' },
    { unified: '1f606', emoji: '😆' },
    { unified: '1f62e', emoji: '😮' },
];

type ChatItem =
    | { type: 'date'; id: string; dateStr: string }
    | {
        type: 'message';
        id: string;
        message: ChatMessage;
        isPatient: boolean;
        isFirstInGroup: boolean;
        isLastInGroup: boolean;
        showStatusBlock: boolean;
    };

export default function ChatPage() {
    return (
        <SocketProvider>
            <ChatPageInner />
        </SocketProvider>
    );
}

function ChatPageInner() {
    const {
        conversation,
        messages,
        loading,
        loadingMore,
        hasMore,
        sending,
        error,
        isConnected,
        isReconnecting,
        isClinicTyping,
        isClinicOnline,
        emitTyping,
        sendMessage,
        loadMore,
        toggleReaction
    } = useChat();

    const [inputText, setInputText] = useState('');
    const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
    const [imageToSend, setImageToSend] = useState<string | null>(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

    const parentRef = useRef<HTMLDivElement>(null);
    const previousHeightRef = useRef<number>(0);
    const lastMessageIdRef = useRef<string | null>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const emojiPickerRef = useRef<HTMLDivElement>(null);
    const emojiBtnRef = useRef<HTMLButtonElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [activeTimeMsgId, setActiveTimeMsgId] = useState<string | null>(null);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
    const [reactionPickerMsgId, setReactionPickerMsgId] = useState<string | null>(null);

    const reactionPickerRef = useRef<HTMLDivElement>(null);
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const lastReadPatientMsgId = useMemo(() => {
        const lastReadMsg = [...messages].reverse().find(m => m.senderType === 'patient' && m.readAt);
        return lastReadMsg ? lastReadMsg.id : null;
    }, [messages]);

    useEffect(() => {
        window.dispatchEvent(new Event('chat_opened'));

        return () => {
            window.dispatchEvent(new Event('chat_closed'));
        };
    }, []);

    // Close reaction picker when clicking outside
    useEffect(() => {
        if (!reactionPickerMsgId) return;
        const handler = (e: MouseEvent) => {
            if (reactionPickerRef.current && !reactionPickerRef.current.contains(e.target as Node)) {
                setReactionPickerMsgId(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [reactionPickerMsgId]);

    // Flatten data Virtualizer
    const flatItems = useMemo(() => {
        const items: ChatItem[] = [];
        let currentDateKey: string | null = null;

        messages.forEach((msg, index) => {
            const dateKey = formatDateDivider(msg.sentAt);

            if (dateKey !== currentDateKey) {
                items.push({ type: 'date', id: `date-${dateKey}`, dateStr: dateKey });
                currentDateKey = dateKey;
            }

            const prevMsg = messages[index - 1];
            const nextMsg = messages[index + 1];
            const FIVE_MINUTES = 5 * 60 * 1000;

            const isPatient = msg.senderType === 'patient';

            const isFirstInGroup = !prevMsg ||
                prevMsg.senderType !== msg.senderType ||
                (new Date(msg.sentAt).getTime() - new Date(prevMsg.sentAt).getTime() > FIVE_MINUTES) ||
                formatDateDivider(prevMsg.sentAt) !== dateKey;

            const isLastInGroup = !nextMsg ||
                nextMsg.senderType !== msg.senderType ||
                (new Date(nextMsg.sentAt).getTime() - new Date(msg.sentAt).getTime() > FIVE_MINUTES) ||
                formatDateDivider(nextMsg.sentAt) !== dateKey;

            const isAbsoluteLastMsg = index === messages.length - 1 && isPatient;
            const isLastReadMsg = msg.id === lastReadPatientMsgId;
            const showStatusBlock = isAbsoluteLastMsg || (isPatient && isLastReadMsg);

            items.push({
                type: 'message',
                id: msg.id,
                message: msg,
                isPatient,
                isFirstInGroup,
                isLastInGroup,
                showStatusBlock
            });
        });

        return items;
    }, [messages, lastReadPatientMsgId]);

    // Virtualizer
    const virtualizer = useVirtualizer({
        count: flatItems.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 80, // Chiều cao ước tính
        overscan: 10,
    });

    // Wrap measureElement in useCallback to avoid flushSync-inside-render warning
    // flushSync is called internally by react-virtual; using a stable callback ref
    // ensures it fires after DOM commit, not during React's render phase.
    const measureRef = useCallback((el: Element | null) => {
        virtualizer.measureElement(el);
    }, [virtualizer]);

    // Close emoji picker when clicking outside
    useEffect(() => {
        if (!showEmojiPicker) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (
                emojiPickerRef.current &&
                !emojiPickerRef.current.contains(e.target as Node) &&
                emojiBtnRef.current &&
                !emojiBtnRef.current.contains(e.target as Node)
            ) {
                setShowEmojiPicker(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showEmojiPicker]);

    const handleEmojiClick = useCallback((emojiData: EmojiClickData) => {
        const emoji = emojiData.emoji;
        const textarea = inputRef.current;
        if (!textarea) {
            setInputText(prev => prev + emoji);
            return;
        }
        const start = textarea.selectionStart ?? inputText.length;
        const end = textarea.selectionEnd ?? inputText.length;
        const newText = inputText.slice(0, start) + emoji + inputText.slice(end);
        setInputText(newText);
        // Restore cursor position after state update
        requestAnimationFrame(() => {
            textarea.focus();
            const newPos = start + emoji.length;
            textarea.setSelectionRange(newPos, newPos);
            // Auto-resize
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        });
    }, [inputText]);

    const scrollToBottom = (smooth = false) => {
        if (flatItems.length > 0) {
            virtualizer.scrollToIndex(flatItems.length - 1, {
                align: 'end',
                behavior: smooth ? 'smooth' : 'auto'
            });
            setShowScrollButton(false);
        }
    };

    const scrollToMessage = (messageId: string) => {
        const index = flatItems.findIndex(item => item.id === messageId);
        if (index !== -1) {
            virtualizer.scrollToIndex(index, { align: 'center', behavior: 'smooth' });
        }
    };

    const lastItemId = flatItems.length > 0 ? flatItems[flatItems.length - 1].id : null;

    useEffect(() => {
        if (!loading && lastItemId) {
            if (lastMessageIdRef.current !== lastItemId) {
                requestAnimationFrame(() => scrollToBottom());
                lastMessageIdRef.current = lastItemId;
            }
        }
    }, [loading, lastItemId]);

    // Load More
    const handleScroll = async (e: UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;

        setShowScrollButton(distanceFromBottom > 50);

        if (loadingMore || !hasMore) return;

        if (target.scrollTop <= 1 && flatItems.length > 0) {
            previousHeightRef.current = target.scrollHeight;
            await loadMore();

            setTimeout(() => {
                if (parentRef.current) {
                    const newHeight = parentRef.current.scrollHeight;
                    parentRef.current.scrollTop = newHeight - previousHeightRef.current;
                }
            }, 0);
        }
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputText(e.target.value);
        emitTyping();

        const target = e.target;
        target.style.height = 'auto';
        target.style.height = `${target.scrollHeight}px`;
    };

    const uploadImageFile = async (file: File) => {
        setIsUploadingImage(true);
        setImagePreviewUrl(URL.createObjectURL(file));
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await fetch('/api/patient/chat/upload-image', { method: 'POST', body: fd });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Upload failed');
            setImageToSend(json.data?.url || json.url);
        } catch (err: any) {
            setImagePreviewUrl(null);
            setImageToSend(null);
            toast.error(err.message || 'Image upload failed');
        } finally {
            setIsUploadingImage(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) uploadImageFile(file);
        e.target.value = '';
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of Array.from(items)) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) uploadImageFile(file);
                return;
            }
        }
    };

    const clearImage = () => {
        setImageToSend(null);
        if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
        setImagePreviewUrl(null);
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        if (e && e.preventDefault) e.preventDefault();

        const text = inputText.trim();
        if ((!text && !imageToSend) || sending || isUploadingImage) return;

        setInputText('');

        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
        }
        inputRef.current?.focus();
        scrollToBottom();

        const imgUrl = imageToSend;
        clearImage();

        try {
            await sendMessage(text, replyingTo || undefined, imgUrl || undefined);
            setReplyingTo(null);
            scrollToBottom();
        } catch (err) {
            setInputText(text);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage(e as unknown as React.FormEvent);
        }
    };

    useEffect(() => {
        if (isClinicTyping && !showScrollButton) scrollToBottom(true);
    }, [isClinicTyping]);

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                <p className="text-gray-500 text-sm">Opening conversation...</p>
            </div>
        );
    }

    if (error && messages.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4 text-center px-4">
                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <div className="space-y-1">
                    <h3 className="font-bold text-slate-900 dark:text-white">Connection Error</h3>
                    <p className="text-sm text-slate-500">{error}</p>
                </div>
                <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 mt-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg font-medium text-sm transition-colors"
                >
                    Try Again
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-4 -mx-4 -mt-8 sm:mx-0 sm:mt-0">
            <Link
                href="/dashboard"
                className="flex hidden sm:flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
                <ArrowLeft className="w-4 h-4" />
                Back to dashboard
            </Link>
            <div className="max-w-4xl mx-auto flex flex-col h-[calc(100dvh-8rem)] sm:h-[calc(100vh-10rem)] md:h-[calc(100vh-11rem)] bg-white dark:bg-slate-900 rounded-none sm:rounded-2xl border-0 sm:border border-slate-200 dark:border-slate-800 shadow-none sm:shadow-sm overflow-hidden animate-fade-in">
                {/* Header Area */}
                <div className="relative z-10 flex flex-col shrink-0 shadow-md">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-150 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <div className="flex items-center gap-3">
                            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold shadow-sm">
                                AKC
                                {isClinicOnline && (<span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-slate-900 bg-green-500" />)}
                                {/* <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-slate-900 ${isClinicOnline ? 'bg-green-500' : 'bg-amber-400'}`} /> */}
                            </div>
                            <div>
                                <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">Adelaide Knee Clinic</h1>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{isClinicOnline ? 'Online' : 'Typically replies within 1 business day'}</p>
                            </div>
                        </div>
                    </div>
                    {/* Reconnection Banner */}

                </div>

                {/* Chat Body Scroll Container */}
                <div className="flex-1 relative min-h-0 flex flex-col bg-slate-50/50 dark:bg-slate-900/30">

                    <div
                        ref={parentRef}
                        onScroll={handleScroll}
                        className="flex-1 overflow-y-auto relative p-4"
                    >
                        {isReconnecting && (
                            <div className="sticky top-4 z-10 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-2 flex items-center justify-center gap-2 mb-4 mx-auto max-w-sm shadow-sm">
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-amber-600 dark:border-amber-500"></div>
                                <span className="text-xs font-medium text-amber-700 dark:text-amber-500">Reconnecting...</span>
                            </div>
                        )}
                        {loadingMore && (
                            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-white/80 dark:bg-slate-800/80 p-2 rounded-full shadow-sm backdrop-blur-sm">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                            </div>
                        )}

                        {messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full py-16 px-4 text-center space-y-4">
                                <div className="p-4 bg-primary/5 rounded-full text-primary">
                                    <MessageSquare className="w-10 h-10 opacity-70" />
                                </div>
                                <div className="max-w-sm space-y-1">
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Start the conversation</h3>
                                    <p className="text-xs text-slate-500 leading-relaxed font-normal">
                                        Have a question about your KRPS results? Send us a message and our team will get back to you.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div
                                style={{
                                    height: `${virtualizer.getTotalSize()}px`,
                                    width: '100%',
                                    position: 'relative',
                                }}
                            >
                                {virtualizer.getVirtualItems().map((virtualRow) => {
                                    const item = flatItems[virtualRow.index];
                                    const isPending = item.type === 'message' ? item.message.isPending : false;

                                    return (
                                        <div
                                            key={item.id}
                                            data-index={virtualRow.index}
                                            ref={measureRef}
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '100%',
                                                transform: `translateY(${virtualRow.start}px)`,
                                            }}
                                            className="px-6"
                                        >
                                            {item.type === 'date' ? (
                                                <div className="flex justify-center pt-6 pb-4">
                                                    <span className="text-[10px] font-bold text-slate-440 dark:text-slate-500 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-100 dark:border-slate-800/80 shadow-2xs uppercase tracking-wider">
                                                        {item.dateStr}
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className={`w-full ${item.isFirstInGroup ? 'pt-6' : ''} pb-1`}>
                                                    {!item.isPatient && item.isFirstInGroup && (
                                                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 ml-1.5 mb-1 block text-left">
                                                            Clinic Staff
                                                        </span>
                                                    )}
                                                    {/* Hover wrapper: relative for absolute toolbar */}
                                                    <div
                                                        className={`relative w-fit max-w-full ${item.isPatient ? 'ml-auto' : 'mr-auto'}`}
                                                        onMouseEnter={() => {
                                                            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                                                            setHoveredMsgId(item.id);
                                                        }}
                                                        onMouseLeave={() => {
                                                            if (reactionPickerMsgId === item.id) return;
                                                            hoverTimeoutRef.current = setTimeout(() => setHoveredMsgId(null), 120);
                                                        }}
                                                    >
                                                        {/* Reaction toolbar — absolute, above the bubble */}
                                                        <div className={`absolute bottom-full mb-1 z-30 flex items-center gap-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-1.5 py-1 shadow-md transition-all duration-150
                                                            ${item.isPatient ? 'right-0' : 'left-0'}
                                                            ${(hoveredMsgId === item.id || reactionPickerMsgId === item.id)
                                                                ? 'opacity-100 scale-100 pointer-events-auto'
                                                                : 'opacity-0 scale-90 pointer-events-none'}`}
                                                        >
                                                            {/* 4 quick reaction emojis */}
                                                            {DEFAULT_REACTIONS.map(({ unified, emoji }) => (
                                                                <button
                                                                    key={unified}
                                                                    type="button"
                                                                    title={emoji}
                                                                    onClick={() => toggleReaction(item.id, emoji)}
                                                                    className="text-lg leading-none w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 hover:scale-125 transition-all duration-100 cursor-pointer"
                                                                >
                                                                    {emoji}
                                                                </button>
                                                            ))}

                                                            {/* Divider */}
                                                            <span className="w-px h-4 bg-slate-200 dark:bg-slate-600 mx-0.5 shrink-0" />

                                                            {/* More reactions button */}
                                                            <div className="relative" ref={reactionPickerMsgId === item.id ? reactionPickerRef : null}>
                                                                <button
                                                                    type="button"
                                                                    title="More reactions"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setReactionPickerMsgId(prev => prev === item.id ? null : item.id);
                                                                        setHoveredMsgId(item.id);
                                                                    }}
                                                                    className={`w-7 h-7 flex items-center justify-center rounded-full transition-all cursor-pointer
                                                                        ${reactionPickerMsgId === item.id
                                                                            ? 'bg-primary/10 text-primary'
                                                                            : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary'}`}
                                                                >
                                                                    <SmilePlus className="w-4 h-4" />
                                                                </button>

                                                                {/* Full picker anchored to this button */}
                                                                {reactionPickerMsgId === item.id && (
                                                                    <div className={`absolute bottom-full mb-2 z-50 drop-shadow-2xl ${item.isPatient ? 'right-0' : 'left-0'}`}>
                                                                        <EmojiPicker
                                                                            onEmojiClick={(emojiData) => {
                                                                                toggleReaction(item.id, emojiData.emoji);
                                                                                setReactionPickerMsgId(null);
                                                                                setHoveredMsgId(null);
                                                                            }}
                                                                            theme={"auto" as any}
                                                                            emojiStyle={"native" as any}
                                                                            autoFocusSearch={false}
                                                                            height={360}
                                                                            width={300}
                                                                            searchPlaceholder="Find emoji..."
                                                                            lazyLoadEmojis
                                                                            previewConfig={{ showPreview: false }}
                                                                            style={{
                                                                                '--epr-bg-color': 'var(--color-background, #fff)',
                                                                                '--epr-category-label-bg-color': 'var(--color-background, #fff)',
                                                                                '--epr-text-color': 'var(--color-foreground, #0f172a)',
                                                                                '--epr-search-border-color': 'var(--color-border, #e2e8f0)',
                                                                                '--epr-border-color': 'var(--color-border, #e2e8f0)',
                                                                                borderRadius: '16px',
                                                                                border: '1px solid',
                                                                                borderColor: 'var(--color-border, #e2e8f0)',
                                                                            } as React.CSSProperties}
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Divider */}
                                                            <span className="w-px h-4 bg-slate-200 dark:bg-slate-600 mx-0.5 shrink-0" />

                                                            {/* Reply button */}
                                                            <button
                                                                type="button"
                                                                title="Reply"
                                                                onClick={() => {
                                                                    setReplyingTo(item.message);
                                                                    inputRef.current?.focus();
                                                                }}
                                                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-all cursor-pointer"
                                                            >
                                                                <CornerUpLeft className="w-4 h-4" />
                                                            </button>
                                                        </div>

                                                        {/* Message bubble + Reactions */}
                                                        <div className={`flex flex-col gap-1 w-full max-w-full ${item.isPatient ? 'items-end' : 'items-start'}`}>
                                                            {item.message.replyToMessage && (
                                                                <div 
                                                                    className={`mb-0 max-w-[85%] text-xs bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 p-2 rounded-xl border border-slate-200/50 dark:border-slate-700/50 relative cursor-pointer hover:opacity-100 transition-opacity ${item.isPatient ? 'opacity-80' : 'opacity-80'}`}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (item.message.replyToMessageId) {
                                                                            scrollToMessage(item.message.replyToMessageId);
                                                                        }
                                                                    }}
                                                                >
                                                                    <p className="font-semibold mb-0.5 opacity-80">
                                                                        {item.message.replyToMessage.senderType === 'patient' ? 'Patient' : 'Clinic'}
                                                                    </p>
                                                                    {item.message.replyToMessage.imageUrl ? (
                                                                        <p className="opacity-70 italic">📷 Image</p>
                                                                    ) : (
                                                                        <p className="truncate opacity-90">{item.message.replyToMessage.body}</p>
                                                                    )}
                                                                    <div className={`absolute top-full w-2 h-2 bg-slate-100 dark:bg-slate-800/80 border-b border-r border-slate-200/50 dark:border-slate-700/50 transform rotate-45 ${item.isPatient ? 'right-4 -mt-1' : 'left-4 -mt-1'}`}></div>
                                                                </div>
                                                            )}
                                                            <div
                                                                className={`relative group flex items-center cursor-pointer sm:cursor-auto w-fit max-w-full ${item.isPatient ? 'ml-auto' : 'mr-auto'}`}
                                                                onClick={() => setActiveTimeMsgId(prev => prev === item.id ? null : item.id)}
                                                            >
                                                                <div
                                                                    className={`transition-opacity overflow-hidden ${isPending ? 'opacity-60' : 'opacity-100'} ${item.isPatient
                                                                        ? 'bg-primary text-white shadow-xs rounded-2xl' +
                                                                        (item.isFirstInGroup && item.isLastInGroup ? '' : item.isFirstInGroup ? ' rounded-br-xs' : item.isLastInGroup ? ' rounded-tr-xs' : ' rounded-tr-xs rounded-br-xs')
                                                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/60 dark:border-slate-700/60 shadow-2xs rounded-2xl' +
                                                                        (item.isFirstInGroup && item.isLastInGroup ? '' : item.isFirstInGroup ? ' rounded-bl-xs' : item.isLastInGroup ? ' rounded-tl-xs' : ' rounded-tl-xs rounded-bl-xs')
                                                                        } ${item.message.imageUrl && !item.message.body ? 'p-1' : 'px-4.5 py-2.5'}`}
                                                                >
                                                                    {item.message.imageUrl && (
                                                                        <img
                                                                            src={item.message.imageUrl}
                                                                            alt="Shared image"
                                                                            className="max-w-[280px] max-h-[320px] w-auto h-auto object-cover rounded-lg cursor-zoom-in block"
                                                                            style={{ display: 'block' }}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setLightboxSrc(item.message.imageUrl || null);
                                                                            }}
                                                                        />
                                                                    )}
                                                                    {item.message.body && (
                                                                        <p className={`whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-left ${item.message.imageUrl ? 'mt-1.5 px-2 pb-1' : ''}`}>
                                                                            {item.message.body}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <span
                                                                    className={`absolute ${item.isPatient ? 'right-full mr-3' : 'left-full ml-3'} 
                                                                        transition-opacity duration-200 text-xs font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap select-none top-1/2 -translate-y-1/2
                                                                        ${activeTimeMsgId === item.id ? 'opacity-100' : 'opacity-0 sm:group-hover:opacity-100'} 
                                                                    `}
                                                                >
                                                                    {formatBubbleTime(item.message.sentAt)}
                                                                </span>
                                                            </div>
                                                            
                                                            {/* Render Reactions */}
                                                            {item.message.reactions && Object.keys(item.message.reactions).length > 0 && (
                                                                <div className={`flex flex-wrap gap-1 mt-0.5 w-full ${item.isPatient ? 'justify-end' : 'justify-start'}`}>
                                                                    {Object.entries(item.message.reactions).map(([emoji, { count, reactorIds }]) => {
                                                                        const hasReacted = conversation?.patientId ? reactorIds.includes(conversation.patientId) : false;
                                                                        return (
                                                                            <button
                                                                                key={emoji}
                                                                                onClick={() => toggleReaction(item.id, emoji)}
                                                                                className={`flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded-full border transition-colors shadow-xs
                                                                                    ${hasReacted 
                                                                                        ? 'bg-primary/10 border-primary/30 text-primary dark:text-primary-light' 
                                                                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                                                                                    }`}
                                                                            >
                                                                                <span className="text-[13px] leading-none">{emoji}</span>
                                                                                <span className="leading-none">{count}</span>
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {item.showStatusBlock && (
                                                        <div className="flex items-center gap-1 mt-1 px-1 justify-end min-h-[20px]">
                                                            {isPending ? (
                                                                <span className="text-[10px] italic text-slate-400 dark:text-slate-500">
                                                                    Sending...
                                                                </span>
                                                            ) : (
                                                                <>
                                                                    <span className="text-xs text-slate-400 dark:text-slate-500">
                                                                        {formatBubbleTime(item.message.sentAt)}
                                                                    </span>

                                                                    {item.isPatient && (
                                                                        <span title={item.message.readAt ? 'Seen' : 'Sent'} className="text-primary dark:text-primary-light">
                                                                            {item.message.readAt ? (
                                                                                <CheckCheck className="w-3.5 h-3.5" />
                                                                            ) : (
                                                                                <Check className="w-3.5 h-3.5 text-slate-350" />
                                                                            )}
                                                                        </span>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Typing Indicator */}
                    {(isClinicTyping && !showScrollButton) && (
                        <div className="px-6 py-2 bg-slate-50/50 dark:bg-slate-900/30 flex items-center gap-2">
                            <span className="text-xs text-slate-500 italic">Clinic is typing</span>
                            <div className="flex gap-1">
                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={() => scrollToBottom(true)}
                        className={`absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center justify-center w-9 h-9 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md rounded-full text-slate-500 hover:text-primary transition-all duration-300 z-20 ${showScrollButton
                            ? 'opacity-100 translate-y-0'
                            : 'opacity-0 translate-y-4 pointer-events-none'
                            }`}
                        aria-label="Scroll to bottom"
                    >
                        {isClinicTyping ? (
                            <div className="flex gap-1">
                                <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce"></span>
                            </div>) : <ChevronDown className="w-5 h-5" />}

                    </button>
                </div>

                {/* Message Input Form */}
                <form
                    onSubmit={handleSendMessage}
                    className="p-4 border-t border-slate-150 dark:border-slate-850 bg-white dark:bg-slate-900 shrink-0 relative"
                >
                    {replyingTo && (
                        <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl px-4 py-2.5 mb-3 border border-slate-200 dark:border-slate-700 relative shadow-sm">
                            <div className="w-1 absolute left-0 top-2 bottom-2 bg-primary rounded-r-md"></div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-primary mb-0.5">
                                    Replying to {replyingTo.senderType === 'patient' ? 'You' : 'Clinic'}
                                </p>
                                <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                                    {replyingTo.body}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setReplyingTo(null)}
                                className="p-1 rounded-full text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                            </button>
                        </div>
                    )}

                    {/* Image preview strip */}
                    {imagePreviewUrl && (
                        <div className="flex items-center gap-3 mb-3">
                            <div className="relative inline-block">
                                <img
                                    src={imagePreviewUrl}
                                    alt="Image to send"
                                    className="h-20 w-20 object-cover rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"
                                />
                                {isUploadingImage && (
                                    <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={clearImage}
                                    disabled={isUploadingImage}
                                    className="absolute -top-2 -right-2 w-5 h-5 bg-slate-700 text-white rounded-full flex items-center justify-center hover:bg-red-500 transition-colors cursor-pointer"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                            {!isUploadingImage && <span className="text-xs text-green-600 dark:text-green-400 font-medium">Ready to send</span>}
                            {isUploadingImage && <span className="text-xs text-slate-500 dark:text-slate-400">Uploading...</span>}
                        </div>
                    )}

                    {/* Emoji Picker Popover */}
                    {showEmojiPicker && (
                        <div
                            ref={emojiPickerRef}
                            className="absolute bottom-full left-4 mb-2 z-50 drop-shadow-2xl"
                        >
                            <EmojiPicker
                                onEmojiClick={handleEmojiClick}
                                theme={"auto" as any}
                                emojiStyle={"native" as any}
                                height={380}
                                width={320}
                                searchPlaceholder="Find emoji..."
                                lazyLoadEmojis
                                previewConfig={{ showPreview: false }}
                                style={{
                                    '--epr-bg-color': 'var(--color-background, #fff)',
                                    '--epr-category-label-bg-color': 'var(--color-background, #fff)',
                                    '--epr-text-color': 'var(--color-foreground, #0f172a)',
                                    '--epr-search-border-color': 'var(--color-border, #e2e8f0)',
                                    '--epr-border-color': 'var(--color-border, #e2e8f0)',
                                    borderRadius: '16px',
                                    border: '1px solid',
                                    borderColor: 'var(--color-border, #e2e8f0)',
                                } as React.CSSProperties}
                            />
                        </div>
                    )}

                    <div className="flex items-end gap-3">
                        {/* Hidden file input */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileSelect}
                        />

                        {/* Emoji Button */}
                        <button
                            ref={emojiBtnRef}
                            type="button"
                            aria-label="Open emoji picker"
                            onClick={() => setShowEmojiPicker(prev => !prev)}
                            className={`flex h-11 w-11 items-center justify-center rounded-xl border transition-all shrink-0 cursor-pointer
                            ${showEmojiPicker
                                    ? 'bg-primary/10 border-primary/30 text-primary'
                                    : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700/80 text-slate-400 hover:text-primary dark:hover:text-primary'
                                }`}
                        >
                            <Smile className="w-5 h-5" />
                        </button>

                        {/* Image Button */}
                        <button
                            type="button"
                            aria-label="Send image"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploadingImage}
                            className="flex h-11 w-11 items-center justify-center rounded-xl border transition-all shrink-0 cursor-pointer bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700/80 text-slate-400 hover:text-primary dark:hover:text-primary disabled:opacity-40"
                        >
                            <ImagePlus className="w-5 h-5" />
                        </button>

                        <textarea
                            ref={inputRef}
                            value={inputText}
                            onChange={handleTextChange}
                            onPaste={handlePaste}
                            placeholder={"Type a message..."}
                            onKeyDown={handleKeyDown}
                            rows={1}
                            className="flex-1 resize-none overflow-y-auto max-h-[250px] min-h-[44px] px-4 py-2 bg-slate-50 hover:bg-slate-100/60 dark:bg-slate-800/50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white dark:focus:bg-slate-800 text-sm text-slate-900 dark:text-white transition-all disabled:opacity-50"
                        />
                        <button
                            type="submit"
                            disabled={(!inputText.trim() && !imageToSend) || sending || isUploadingImage}
                            className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary hover:bg-primary-hover active:scale-[0.97] transition-all text-white disabled:opacity-30 disabled:pointer-events-none shadow-md shrink-0 shadow-primary/10"
                            aria-label="Send message"
                        >
                            <Send className="w-4.5 h-4.5" />
                        </button>
                    </div>
                </form>
            </div>
            {lightboxSrc && (
                <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
            )}
        </div>
    );
}