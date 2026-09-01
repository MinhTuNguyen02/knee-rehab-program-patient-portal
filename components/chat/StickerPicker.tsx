'use client';

import { useState, useEffect } from 'react';
import { Clock, Sticker as StickerIcon, X } from 'lucide-react';

export interface StickerItem {
    id: string;
    packId: string;
    url: string;
    keyUrl?: string;
    altText?: string;
    sortOrder: number;
}

export interface StickerPackData {
    id: string;
    name: string;
    thumbnailUrl: string;
    sortOrder: number;
    stickers: StickerItem[];
}

interface StickerPickerProps {
    onSelectSticker: (stickerUrl: string) => void;
    onClose?: () => void;
}

export function StickerPicker({ onSelectSticker, onClose }: StickerPickerProps) {
    const [packs, setPacks] = useState<StickerPackData[]>([]);
    const [loading, setLoading] = useState(true);
    const [activePackId, setActivePackId] = useState<string>('recent');
    const [recentStickers, setRecentStickers] = useState<string[]>([]);

    useEffect(() => {
        try {
            const saved = localStorage.getItem('krps_recent_stickers');
            if (saved) {
                setRecentStickers(JSON.parse(saved));
            }
        } catch (e) { }

        fetch('/api/stickers/packs')
            .then((res) => res.json())
            .then((data) => {
                const list = Array.isArray(data) ? data : data.data || [];
                setPacks(list);
                if (list.length > 0) {
                    setActivePackId(list[0].id);
                }
            })
            .catch((err) => console.error('Failed to load sticker packs:', err))
            .finally(() => setLoading(false));
    }, []);

    const handleStickerClick = (url: string) => {
        try {
            const updatedRecent = [url, ...recentStickers.filter((u) => u !== url)].slice(0, 16);
            setRecentStickers(updatedRecent);
            localStorage.setItem('krps_recent_stickers', JSON.stringify(updatedRecent));
        } catch (e) { }

        onSelectSticker(url);
        onClose?.();
    };

    const currentPack = packs.find((p) => p.id === activePackId);

    return (
        <div className="w-[320px] h-[360px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl flex flex-col overflow-hidden select-none animate-in fade-in zoom-in-95 duration-150">
            {/* Tier 1: Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 shrink-0">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <StickerIcon className="w-3.5 h-3.5 text-primary" />
                    {activePackId === 'recent' ? 'Recent Stickers' : currentPack?.name || 'Stickers'}
                </span>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Tier 2: Sticker Grid (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                {loading ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                    </div>
                ) : activePackId === 'recent' ? (
                    recentStickers.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
                            <Clock className="w-8 h-8 stroke-1 opacity-50" />
                            <span>No recent stickers yet</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-4 gap-2">
                            {recentStickers.map((url, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleStickerClick(url)}
                                    className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all transform hover:scale-110 active:scale-95 flex items-center justify-center aspect-square cursor-pointer"
                                >
                                    <img src={url} alt="Sticker" className="w-16 h-16 object-contain" />
                                </button>
                            ))}
                        </div>
                    )
                ) : (
                    <div className="grid grid-cols-4 gap-2">
                        {currentPack?.stickers.map((s) => (
                            <button
                                key={s.id}
                                onClick={() => handleStickerClick(s.url)}
                                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all transform hover:scale-110 active:scale-95 flex items-center justify-center aspect-square cursor-pointer"
                                title={s.altText}
                            >
                                <img src={s.keyUrl || s.url} alt={s.altText || 'Sticker'} className="w-16 h-16 object-contain" />
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Tier 3: Bottom Dock Bar */}
            <div className="h-12 border-t border-slate-150 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850 px-2 flex items-center gap-1 overflow-x-auto shrink-0 custom-scrollbar">
                {/* Recent Tab */}
                <button
                    type="button"
                    onClick={() => setActivePackId('recent')}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${activePackId === 'recent'
                        ? 'bg-primary/10 text-primary border border-primary/20'
                        : 'text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                        }`}
                    title="Recent"
                >
                    <Clock className="w-4.5 h-4.5" />
                </button>

                <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1 shrink-0" />

                {/* Sticker Pack Thumbnails */}
                {packs.map((pack) => (
                    <button
                        key={pack.id}
                        type="button"
                        onClick={() => setActivePackId(pack.id)}
                        className={`w-9 h-9 rounded-xl p-1 flex items-center justify-center shrink-0 transition-all cursor-pointer ${activePackId === pack.id
                            ? 'bg-primary/10 border border-primary/30 shadow-xs'
                            : 'opacity-70 hover:opacity-100 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                            }`}
                        title={pack.name}
                    >
                        <img src={pack.thumbnailUrl} alt={pack.name} className="w-6 h-6 object-contain" />
                    </button>
                ))}
            </div>
        </div>
    );
}
