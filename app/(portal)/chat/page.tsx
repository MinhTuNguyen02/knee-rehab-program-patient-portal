'use client';

import { useState, useRef, useEffect, UIEvent, useMemo } from 'react';
import { Send, Check, CheckCheck, MessageSquare, AlertCircle, ArrowLeft } from 'lucide-react';
import { useChat, ChatMessage } from '@/hooks/useChat';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function ChatPage() {
    const {
        conversation,
        messages,
        loading,
        loadingMore,
        hasMore,
        sending,
        error,
        sendMessage,
        loadMore
    } = useChat();

    const [inputText, setInputText] = useState('');
    const messageListRef = useRef<HTMLDivElement>(null);
    const previousHeightRef = useRef<number>(0);
    const lastMessageIdRef = useRef<string | null>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const lastReadPatientMsgId = useMemo(() => {
        const lastReadMsg = [...messages].reverse().find(m => m.senderType === 'patient' && m.readAt);
        return lastReadMsg ? lastReadMsg.id : null;
    }, [messages]);

    // Scroll to bottom on initial load and when new messages are added at the bottom
    useEffect(() => {
        if (!loading && messages.length > 0) {
            const currentLastMsg = messages[messages.length - 1];

            if (lastMessageIdRef.current !== currentLastMsg.id) {
                setTimeout(scrollToBottom, 50);
            }

            lastMessageIdRef.current = currentLastMsg.id;
        }
    }, [messages, loading]);

    const scrollToBottom = () => {
        if (messageListRef.current) {
            messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
        }
    };

    const handleScroll = async (e: UIEvent<HTMLDivElement>) => {
        if (loadingMore || !hasMore) return;

        const target = e.currentTarget;
        if (target.scrollTop <= 1 && messages.length > 0) {
            // Save scroll height before loading more
            previousHeightRef.current = target.scrollHeight;

            await loadMore();

            // Lock scroll position to prevent jumping
            setTimeout(() => {
                if (messageListRef.current) {
                    const newHeight = messageListRef.current.scrollHeight;
                    messageListRef.current.scrollTop = newHeight - previousHeightRef.current;
                }
            }, 100);
        }
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputText(e.target.value);

        const target = e.target;
        target.style.height = 'auto';
        target.style.height = `${target.scrollHeight}px`;
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        if (e && e.preventDefault) {
            e.preventDefault();
        }

        const text = inputText.trim();
        if (!text || sending) return;

        setInputText('');

        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
        }

        inputRef.current?.focus();

        setTimeout(scrollToBottom, 10);

        try {
            await sendMessage(text);
            setTimeout(scrollToBottom, 50);
        } catch (err) {
            // Error toast is handled inside useChat
            setInputText(text);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();

            handleSendMessage(e as unknown as React.FormEvent);
        }
    };

    // Group messages by friendly day dates
    const groupMessagesByDay = (msgs: ChatMessage[]) => {
        const groups: { [key: string]: ChatMessage[] } = {};

        msgs.forEach(msg => {
            const dateKey = formatGroupDate(msg.sentAt);
            if (!groups[dateKey]) {
                groups[dateKey] = [];
            }
            groups[dateKey].push(msg);
        });

        return Object.entries(groups);
    };

    const formatGroupDate = (dateStr: string) => {
        const d = new Date(dateStr);
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);

        if (d.toDateString() === today.toDateString()) {
            return 'Today';
        }
        if (d.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        }

        const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
        if (d.getFullYear() !== today.getFullYear()) {
            options.year = 'numeric';
        }
        return d.toLocaleDateString('en-US', options);
    };

    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    };

    // Toast error notifications on state changes
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
                <div className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-slate-150 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 shadow-md">
                    <div className="flex items-center gap-3">
                        <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold shadow-sm">
                            AKC
                            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-amber-400 border-2 border-white dark:border-slate-900" />
                        </div>
                        <div>
                            <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">Adelaide Knee Clinic</h1>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Typically replies within 1 business day</p>
                        </div>
                    </div>
                </div>

                {/* Chat Body Scroll Container */}
                <div
                    ref={messageListRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto px-6 py-4 bg-slate-50/50 dark:bg-slate-900/30"
                >
                    {loadingMore && (
                        <div className="flex justify-center py-2">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                        </div>
                    )}

                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-4">
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
                        groupMessagesByDay(messages).map(([dayKey, dayMsgs]) => (
                            <div key={dayKey} className="flex flex-col">
                                {/* Date Separator Header */}
                                <div className="flex justify-center mt-6 mb-4">
                                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-100 dark:border-slate-800/80 shadow-2xs uppercase tracking-wider">
                                        {dayKey}
                                    </span>
                                </div>

                                {dayMsgs.map((msg, index) => {
                                    const isPatient = msg.senderType === 'patient';
                                    const prevMsg = dayMsgs[index - 1];
                                    const nextMsg = dayMsgs[index + 1];

                                    const FIVE_MINUTES = 5 * 60 * 1000;

                                    // Determine the position of the message
                                    const isFirstInGroup = !prevMsg ||
                                        prevMsg.senderType !== msg.senderType ||
                                        (new Date(msg.sentAt).getTime() - new Date(prevMsg.sentAt).getTime() > FIVE_MINUTES);

                                    const isLastInGroup = !nextMsg ||
                                        nextMsg.senderType !== msg.senderType ||
                                        (new Date(nextMsg.sentAt).getTime() - new Date(msg.sentAt).getTime() > FIVE_MINUTES);

                                    const isAbsoluteLastMsg = msg.id === messages[messages.length - 1].id && isPatient;
                                    const isLastReadMsg = msg.id === lastReadPatientMsgId;
                                    const showStatusBlock = isAbsoluteLastMsg || (isPatient && isLastReadMsg);

                                    // Border Radius
                                    let bubbleShapeClass = 'rounded-2xl';
                                    if (isPatient) {
                                        if (isFirstInGroup && isLastInGroup) {
                                            bubbleShapeClass;
                                        } else if (isFirstInGroup) {
                                            bubbleShapeClass += ' rounded-br-xs';
                                        } else if (isLastInGroup) {
                                            bubbleShapeClass += ' rounded-tr-xs';
                                        } else {
                                            bubbleShapeClass += ' rounded-tr-xs rounded-br-xs';
                                        }
                                    } else { // Staff
                                        if (isFirstInGroup && isLastInGroup) {
                                            bubbleShapeClass;
                                        } else if (isFirstInGroup) {
                                            bubbleShapeClass += ' rounded-bl-xs';
                                        } else if (isLastInGroup) {
                                            bubbleShapeClass += ' rounded-tl-xs';
                                        } else {
                                            bubbleShapeClass += ' rounded-tl-xs rounded-bl-xs';
                                        }
                                    }

                                    // Space between messages
                                    const marginTopClass = index === 0 ? '' : isFirstInGroup ? 'mt-6' : 'mt-1';

                                    return (
                                        <div
                                            key={msg.id}
                                            className={`flex flex-col ${isPatient ? 'items-end' : 'items-start'} ${marginTopClass}`}
                                        >
                                            <div className="max-w-[80%] sm:max-w-[70%]">
                                                {/* Staff Name Tag - Only appear in the first message of the cluster */}
                                                {!isPatient && isFirstInGroup && (
                                                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 ml-1.5 mb-1 block text-left">
                                                        Clinic Staff
                                                    </span>
                                                )}

                                                {/* Message text bubble wrapper */}
                                                <div className={`relative group flex items-center w-fit max-w-full ${isPatient ? 'ml-auto' : 'mr-auto'}`}>
                                                    <div
                                                        className={`px-4.5 py-2.5 text-base leading-relaxed max-w-full ${isPatient
                                                            ? `bg-primary text-white shadow-xs ${bubbleShapeClass}`
                                                            : `bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/60 dark:border-slate-700/60 shadow-2xs ${bubbleShapeClass}`
                                                            }`}
                                                    >
                                                        <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-left">{msg.body}</p>
                                                    </div>
                                                    <span
                                                        className={`absolute ${isPatient ? 'right-full mr-3' : 'left-full ml-3'
                                                            } opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-xs font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap select-none cursor-default top-1/2 -translate-y-1/2`}
                                                    >
                                                        {formatTime(msg.sentAt)}
                                                    </span>
                                                </div>

                                                {/* Timestamp - Only appear in the last message of the cluster */}
                                                {showStatusBlock && (
                                                    <div className="flex items-center gap-1 mt-1 px-1 justify-end">
                                                        <span className="text-xs text-slate-400 dark:text-slate-500">
                                                            {formatTime(msg.sentAt)}
                                                        </span>

                                                        {/* Single/double tick read receipt for Patient Messages */}
                                                        {isPatient && (
                                                            <span title={msg.readAt ? 'Seen' : 'Sent'} className="text-primary dark:text-primary-light">
                                                                {msg.readAt ? (
                                                                    <CheckCheck className="w-3.5 h-3.5" />
                                                                ) : (
                                                                    <Check className="w-3.5 h-3.5 text-slate-350" />
                                                                )}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))
                    )}
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
                            placeholder="Type a message..."
                            onKeyDown={handleKeyDown}
                            rows={1}
                            className="flex-1 resize-none overflow-y-auto max-h-[250px] min-h-[44px] px-4 py-2 bg-slate-50 hover:bg-slate-100/60 dark:bg-slate-800/50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white dark:focus:bg-slate-800 text-sm text-slate-900 dark:text-white transition-all disabled:opacity-50"
                        />
                        <button
                            type="submit"
                            disabled={!inputText.trim() || sending}
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