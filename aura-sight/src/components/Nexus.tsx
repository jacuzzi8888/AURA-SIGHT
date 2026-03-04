import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export interface NexusProps {
    readonly isActive: boolean;
    readonly directorMessage: string | null;
    readonly onToggle: () => void;
    readonly className?: string;
}

export const Nexus: React.FC<NexusProps> = ({
    isActive,
    directorMessage,
    onToggle,
    className = '',
}) => {
    const shortMessage = directorMessage?.split(" ").slice(-1)[0].replace(".", "") || "UP";
    const [isPressing, setIsPressing] = useState(false);
    const [pressProgress, setPressProgress] = useState(0);
    const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pressFrameRef = useRef<number | null>(null);

    const startPress = () => {
        console.log("startPress triggered, isActive:", isActive);
        if (isActive) {
            onToggle(); // Tap to stop if already active
            return;
        }

        setIsPressing(true);
        setPressProgress(0);

        let startTime = Date.now();
        const duration = 800; // ms to hold

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            setPressProgress(progress);

            if (progress < 1) {
                pressFrameRef.current = requestAnimationFrame(animate);
            }
        };
        pressFrameRef.current = requestAnimationFrame(animate);

        console.log("Nexus hold timer scheduled for", duration, "ms");
        pressTimerRef.current = setTimeout(() => {
            if ('vibrate' in navigator) navigator.vibrate(50);
            console.log("Nexus hold duration REACHED. Calling onToggle now...");
            onToggle();
            setIsPressing(false);
            setPressProgress(0);
        }, duration);
    };

    const cancelPress = () => {
        if (!isActive) {
            console.log("cancelPress triggered, clearing timer");
            setIsPressing(false);
            setPressProgress(0);
            if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
            if (pressFrameRef.current) cancelAnimationFrame(pressFrameRef.current);
        }
    };

    useEffect(() => {
        return () => {
            if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
            if (pressFrameRef.current) cancelAnimationFrame(pressFrameRef.current);
        };
    }, []);

    return (
        <div className={cn("relative flex h-full w-full flex-col overflow-hidden items-center justify-center", className)}>
            {/* Background Shift */}
            {isActive && (
                <div className="absolute inset-0 pointer-events-none bg-aura-dark/60 backdrop-blur-md z-0 transition-opacity duration-500" />
            )}

            {/* The Director */}
            {isActive && directorMessage && (
                <div className="absolute top-16 px-10 text-center z-20 animate-in fade-in slide-in-from-top-4 duration-500">
                    <h1 className="text-white text-3xl font-bold font-sans tracking-tight uppercase leading-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
                        {directorMessage.length > 20 ? directorMessage.substring(0, 20) + "..." : directorMessage}
                    </h1>
                </div>
            )}

            {/* The Ring Interactor */}
            <button
                onPointerDown={startPress}
                onPointerUp={cancelPress}
                onPointerLeave={cancelPress}
                onContextMenu={(e) => e.preventDefault()}
                className="relative z-10 flex items-center justify-center w-[220px] h-[220px] rounded-full border border-white/40 focus:outline-none transition-transform duration-300"
                style={{ transform: isPressing ? 'scale(0.95)' : 'scale(1)' }}
                aria-label={isActive ? "Stop Scanning" : "Long press to scan"}
            >
                {/* Progress Ring visual when holding */}
                {!isActive && isPressing && (
                    <div
                        className="absolute inset-0 rounded-full"
                        style={{
                            background: `conic-gradient(var(--color-aura-primary) ${pressProgress * 360}deg, transparent 0deg)`,
                            maskImage: 'radial-gradient(transparent 65%, black 66%)',
                            WebkitMaskImage: 'radial-gradient(transparent 65%, black 66%)'
                        }}
                    />
                )}

                <div
                    className={cn(
                        "w-[200px] h-[200px] rounded-full transition-all duration-500 flex items-center justify-center overflow-hidden",
                        isActive
                            ? "bg-aura-primary scale-100 border-none shadow-[0_0_80px_rgba(19,127,236,0.6)] animate-pulse"
                            : "bg-transparent border-2 border-white/90 scale-95"
                    )}
                >
                    {/* Voice Waveform when active */}
                    {isActive && (
                        <div className="flex items-center justify-center gap-1.5 h-16 w-full">
                            {[0.8, 0.4, 1, 0.6, 0.9].map((scale, i) => (
                                <div
                                    key={i}
                                    className="w-2 bg-white rounded-full animate-pulse"
                                    style={{
                                        height: `${scale * 100}%`,
                                        animationDelay: `${i * 0.15}s`,
                                        animationDuration: '0.8s'
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </button>

            {/* Instructions */}
            {!isActive && (
                <div className={cn("absolute bottom-32 text-center z-10 transition-opacity duration-300", isPressing ? "opacity-0" : "opacity-100")}>
                    <p className="text-white text-xl font-medium tracking-tight opacity-90 px-8">Tap and hold to talk to Aura</p>
                    <p className="text-slate-300 text-[10px] font-bold tracking-[0.3em] uppercase mt-3 opacity-60">Unified Intelligence Standby</p>
                </div>
            )}

            {/* Pathfinder Sub-Label (Optional during Active) */}
            {isActive && (
                <div className="absolute bottom-32 text-center z-10 animate-in slide-in-from-bottom flex flex-col items-center gap-1 w-3/4 max-w-sm">
                    <span className="text-aura-primary text-xs font-bold uppercase tracking-widest bg-aura-primary/10 px-3 py-1 rounded-full border border-aura-primary/30">Scanning</span>
                    <p className="text-white text-lg font-medium tracking-wide mt-2">{directorMessage}</p>
                </div>
            )}
        </div>
    );
};
