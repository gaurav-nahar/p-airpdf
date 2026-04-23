import React from 'react';
import ReactDOM from 'react-dom';

/**
 * 🛠️ ItemContextMenu
 * A reusable context menu component that renders via React Portal.
 */
const ItemContextMenu = ({ x, y, actions, onClose }) => {
    const menuRef = React.useRef(null);

    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                onClose();
            }
        };

        const handleContextMenu = (event) => {
            // Close existing menu if a new right-click happens elsewhere
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                onClose();
            }
        };

        // Use capture phase to ensure we catch the event before it's stopped elsewhere
        document.addEventListener('mousedown', handleClickOutside, true);
        document.addEventListener('contextmenu', handleContextMenu, true);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside, true);
            document.removeEventListener('contextmenu', handleContextMenu, true);
        };
    }, [onClose]);

    if (!actions || actions.length === 0) return null;

    return ReactDOM.createPortal(
        <div
            ref={menuRef}
            style={{
                position: 'fixed',
                top: y,
                left: x,
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(0, 0, 0, 0.08)',
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
                zIndex: 10000,
                padding: '6px',
                minWidth: '180px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                animation: 'contextMenuAppear 0.15s ease-out'
            }}
            onMouseLeave={onClose}
            onContextMenu={(e) => e.preventDefault()}
        >
            <style>
                {`
                    @keyframes contextMenuAppear {
                        from { opacity: 0; transform: scale(0.95); }
                        to { opacity: 1; transform: scale(1); }
                    }
                `}
            </style>
            {actions.map((action, index) => (
                <div
                    key={index}
                    onClick={(e) => {
                        e.stopPropagation();
                        action.onClick();
                        onClose();
                    }}
                    style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        color: action.danger ? '#ff3b30' : '#1d1d1f',
                        transition: 'background 0.2s',
                        fontWeight: '500'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = action.danger ? '#fff1f0' : '#f5f5f7'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                    {action.icon && <span>{action.icon}</span>}
                    {action.label}
                </div>
            ))}
        </div>,
        document.body
    );
};

export default ItemContextMenu;
