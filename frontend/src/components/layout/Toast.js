import React, { useState, useEffect } from "react";

let toastId = 0;

/**
 * Toast notification system.
 * Usage: window.dispatchEvent(new CustomEvent('show-toast', { detail: { message, type } }))
 * Types: 'success' | 'error' | 'info'
 */
export default function Toast() {
    const [toasts, setToasts] = useState([]);

    useEffect(() => {
        const handler = (e) => {
            const { message, type = 'info', duration = 2800 } = e.detail;
            const id = ++toastId;
            setToasts(prev => [...prev, { id, message, type }]);
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, duration);
        };
        window.addEventListener('show-toast', handler);
        return () => window.removeEventListener('show-toast', handler);
    }, []);

    if (toasts.length === 0) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: 28,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            pointerEvents: 'none'
        }}>
            {toasts.map(t => (
                <div key={t.id} style={{
                    background: t.type === 'error' ? '#ff3b30' : t.type === 'success' ? '#34c759' : '#1d1d1f',
                    color: 'white',
                    padding: '9px 20px',
                    borderRadius: 24,
                    fontSize: 13,
                    fontWeight: 500,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
                    animation: 'toastIn 0.22s ease-out',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    letterSpacing: '0.01em',
                    maxWidth: 340,
                    textAlign: 'center',
                    backdropFilter: 'blur(8px)',
                }}>
                    {t.message}
                </div>
            ))}
            <style>{`
                @keyframes toastIn {
                    from { opacity: 0; transform: translateY(10px) scale(0.96); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </div>
    );
}

/** Helper: call from anywhere */
export function showToast(message, type = 'info', duration = 2800) {
    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message, type, duration } }));
}
