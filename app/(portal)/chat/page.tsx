'use client';

import { useState, useRef, useEffect, UIEvent, useMemo } from 'react';
import { Send, Check, CheckCheck, MessageSquare, AlertCircle, ArrowLeft, ChevronDown } from 'lucide-react';
import { useChat, ChatMessage } from '@/hooks/useChat';
import { SocketProvider } from '@/hooks/useSocket';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { formatBubbleTime, formatDateDivider } from '@/lib/utils';
import { useVirtualizer } from '@tanstack/react-virtual';

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
        loadMore
    } = useChat();

    const [inputText, setInputText] = useState('');

    const parentRef = useRef<HTMLDivElement>(null);
    const previousHeightRef = useRef<number>(0);
    const lastMessageIdRef = useRef<string | null>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const [activeTimeMsgId, setActiveTimeMsgId] = useState<string | null>(null);
    const [showScrollButton, setShowScrollButton] = useState(false);

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

    const scrollToBottom = (smooth = false) => {
        if (flatItems.length > 0) {
            virtualizer.scrollToIndex(flatItems.length - 1, {
                align: 'end',
                behavior: smooth ? 'smooth' : 'auto'
            });
            setShowScrollButton(false);
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

    const handleSendMessage = async (e: React.FormEvent) => {
        if (e && e.preventDefault) e.preventDefault();

        const text = inputText.trim();
        if (!text || sending) return;

        setInputText('');

        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
        }
        inputRef.current?.focus();
        scrollToBottom();

        try {
            await sendMessage(text);
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
                                            ref={virtualizer.measureElement}
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
                                                    {/* <div className="max-w-[80%] sm:max-w-[70%]"> */}
                                                    {!item.isPatient && item.isFirstInGroup && (
                                                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 ml-1.5 mb-1 block text-left">
                                                            Clinic Staff
                                                        </span>
                                                    )}

                                                    <div
                                                        className={`relative group flex items-center w-fit max-w-full cursor-pointer sm:cursor-auto ${item.isPatient ? 'ml-auto' : 'mr-auto'}`}
                                                        onClick={() => setActiveTimeMsgId(prev => prev === item.id ? null : item.id)}
                                                    >
                                                        <div
                                                            className={`px-4.5 py-2.5 text-base leading-relaxed max-w-full transition-opacity ${isPending ? 'opacity-60' : 'opacity-100'} ${item.isPatient
                                                                ? 'bg-primary text-white shadow-xs rounded-2xl' +
                                                                (item.isFirstInGroup && item.isLastInGroup ? '' : item.isFirstInGroup ? ' rounded-br-xs' : item.isLastInGroup ? ' rounded-tr-xs' : ' rounded-tr-xs rounded-br-xs')
                                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/60 dark:border-slate-700/60 shadow-2xs rounded-2xl' +
                                                                (item.isFirstInGroup && item.isLastInGroup ? '' : item.isFirstInGroup ? ' rounded-bl-xs' : item.isLastInGroup ? ' rounded-tl-xs' : ' rounded-tl-xs rounded-bl-xs')
                                                                }`}
                                                        >
                                                            <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-left">{item.message.body}</p>
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
                                                    {/* </div> */}
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
                    className="p-4 border-t border-slate-150 dark:border-slate-850 bg-white dark:bg-slate-900 shrink-0"
                >
                    <div className="flex items-end gap-3">
                        <textarea
                            ref={inputRef}
                            value={inputText}
                            onChange={handleTextChange}
                            disabled={isReconnecting}
                            placeholder={isReconnecting ? "Reconnecting..." : "Type a message..."}
                            onKeyDown={handleKeyDown}
                            rows={1}
                            className="flex-1 resize-none overflow-y-auto max-h-[250px] min-h-[44px] px-4 py-2 bg-slate-50 hover:bg-slate-100/60 dark:bg-slate-800/50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white dark:focus:bg-slate-800 text-sm text-slate-900 dark:text-white transition-all disabled:opacity-50"
                        />
                        <button
                            type="submit"
                            disabled={!inputText.trim() || sending || isReconnecting}
                            className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary hover:bg-primary-hover active:scale-[0.97] transition-all text-white disabled:opacity-30 disabled:pointer-events-none shadow-md shrink-0 shadow-primary/10"
                            aria-label="Send message"
                        >
                            <Send className="w-4.5 h-4.5" />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}