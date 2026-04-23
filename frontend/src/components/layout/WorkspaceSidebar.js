import { useState } from "react";
import { useApp } from "../../context/AppContext";
import { getCurrentTimestampName } from "../../utils/defaultNames";

/**
 * 📚 WorkspaceSidebar: A premium sidebar to manage multiple research contexts.
 * Features: Apple-style glassmorphism, smooth animations, and intuitive UI.
 */
const WorkspaceSidebar = () => {
    const {
        workspaces,
        activeWorkspace,
        setActiveWorkspace,
        handleAddWorkspace,
        setShowWorkspaceSidebar
    } = useApp();

    const [newWsName, setNewWsName] = useState("");
    const [isAdding, setIsAdding] = useState(false);

    const onSelect = (ws) => {
        setActiveWorkspace(ws);
        setShowWorkspaceSidebar(false);
    };

    const onClose = () => setShowWorkspaceSidebar(false);

    const handleAdd = () => {
        handleAddWorkspace(newWsName.trim() || getCurrentTimestampName());
        setNewWsName("");
        setIsAdding(false);
    };

    return (
        <>
            {/* Backdrop for closing when clicking outside */}
            <div
                className="workspace-sidebar-backdrop"
                onClick={onClose}
            />

            <div className="workspace-sidebar">
                <div className="sidebar-header">
                    <div className="header-title">
                        <h2>Workspaces</h2>
                        <span className="workspace-count">{workspaces.length} total</span>
                    </div>
                    <button onClick={onClose} className="sidebar-close-btn">✕</button>
                </div>

                <div className="sidebar-content">
                    {/* Add Workspace Action */}
                    {!isAdding ? (
                        <button
                            className="add-ws-trigger"
                            onClick={() => {
                                setNewWsName(getCurrentTimestampName());
                                setIsAdding(true);
                            }}
                        >
                            <span className="plus-icon">+</span> New Workspace
                        </button>
                    ) : (
                        <div className="add-ws-form animate-slide-down">
                            <input
                                autoFocus
                                type="text"
                                placeholder={getCurrentTimestampName()}
                                value={newWsName}
                                onChange={(e) => setNewWsName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                            />
                            <div className="form-actions">
                                <button className="cancel-btn" onClick={() => {
                                    setIsAdding(false);
                                    setNewWsName("");
                                }}>Cancel</button>
                                <button className="confirm-btn" onClick={handleAdd}>Create</button>
                            </div>
                        </div>
                    )}

                    <div className="workspace-divider">Recent Workspaces</div>

                    <div className="workspace-list">
                        {workspaces.map((ws) => (
                            <div
                                key={ws.id}
                                className={`workspace-item ${activeWorkspace?.id === ws.id ? 'active' : ''}`}
                                onClick={() => onSelect(ws)}
                            >
                                <div className="workspace-info">
                                    <div className="workspace-icon">
                                        {(ws.name || "?").charAt(0).toUpperCase()}
                                    </div>
                                    <span className="workspace-name">{ws.name}</span>
                                </div>
                                {activeWorkspace?.id === ws.id && (
                                    <span className="current-badge">Active</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="sidebar-footer">
                    <p>Select a workspace to switch contexts. Your notes and highlights will be saved separately.</p>
                </div>

                <style>
                    {`
                    .workspace-sidebar-backdrop {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(0, 0, 0, 0.1);
                        z-index: 1000;
                        backdrop-filter: blur(2px);
                        animation: fadeIn 0.3s ease-out;
                    }

                    .workspace-sidebar {
                        position: fixed;
                        top: 0;
                        right: 0;
                        width: 320px;
                        height: 100vh;
                        background: rgba(255, 255, 255, 0.9);
                        backdrop-filter: blur(20px) saturate(180%);
                        z-index: 1001;
                        box-shadow: -10px 0 30px rgba(0, 0, 0, 0.1);
                        display: flex;
                        flex-direction: column;
                        animation: slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    }

                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }

                    @keyframes slideInRight {
                        from { transform: translateX(100%); }
                        to { transform: translateX(0); }
                    }

                    @keyframes slide-down {
                        from { opacity: 0; transform: translateY(-10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }

                    .sidebar-header {
                        padding: 24px 20px;
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        border-bottom: 1px solid rgba(0, 0, 0, 0.05);
                    }

                    .header-title h2 {
                        margin: 0;
                        font-size: 20px;
                        font-weight: 700;
                        color: #1d1d1f;
                    }

                    .workspace-count {
                        font-size: 12px;
                        color: #86868b;
                        margin-top: 4px;
                        display: block;
                    }

                    .sidebar-close-btn {
                        background: rgba(0, 0, 0, 0.05);
                        border: none;
                        width: 28px;
                        height: 28px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        cursor: pointer;
                        color: #1d1d1f;
                        transition: all 0.2s;
                    }

                    .sidebar-close-btn:hover {
                        background: rgba(0, 0, 0, 0.1);
                    }

                    .sidebar-content {
                        flex: 1;
                        overflow-y: auto;
                        padding: 20px;
                    }

                    .add-ws-trigger {
                        width: 100%;
                        padding: 12px;
                        background: #007aff;
                        color: white;
                        border: none;
                        border-radius: 12px;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 8px;
                        transition: all 0.2s;
                        box-shadow: 0 4px 12px rgba(0, 122, 255, 0.2);
                        margin-bottom: 24px;
                    }

                    .add-ws-trigger:hover {
                        background: #0071e3;
                        transform: translateY(-1px);
                        box-shadow: 0 6px 16px rgba(0, 122, 255, 0.3);
                    }

                    .add-ws-form {
                        background: white;
                        padding: 16px;
                        border-radius: 12px;
                        border: 1px solid rgba(0, 0, 0, 0.1);
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
                        margin-bottom: 24px;
                        animation: slide-down 0.2s ease-out;
                    }

                    .add-ws-form input {
                        width: 100%;
                        padding: 10px 12px;
                        border: 1px solid rgba(0, 0, 0, 0.1);
                        border-radius: 8px;
                        font-size: 14px;
                        margin-bottom: 12px;
                        outline: none;
                        transition: border-color 0.2s;
                    }

                    .add-ws-form input:focus {
                        border-color: #007aff;
                    }

                    .form-actions {
                        display: flex;
                        gap: 8px;
                        justify-content: flex-end;
                    }

                    .cancel-btn {
                        background: transparent;
                        border: none;
                        color: #86868b;
                        font-size: 13px;
                        padding: 6px 12px;
                        cursor: pointer;
                    }

                    .confirm-btn {
                        background: #007aff;
                        color: white;
                        border: none;
                        padding: 6px 16px;
                        border-radius: 6px;
                        font-size: 13px;
                        font-weight: 600;
                        cursor: pointer;
                    }

                    .workspace-divider {
                        font-size: 11px;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                        color: #86868b;
                        margin-bottom: 12px;
                        padding-left: 4px;
                    }

                    .workspace-list {
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                    }

                    .workspace-item {
                        padding: 12px;
                        border-radius: 12px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        cursor: pointer;
                        transition: all 0.2s;
                        background: transparent;
                    }

                    .workspace-item:hover {
                        background: rgba(0, 0, 0, 0.03);
                    }

                    .workspace-item.active {
                        background: rgba(0, 122, 255, 0.1);
                        border: 1px solid rgba(0, 122, 255, 0.2);
                    }

                    .workspace-info {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                    }

                    .workspace-icon {
                        width: 32px;
                        height: 32px;
                        border-radius: 8px;
                        background: rgba(0, 0, 0, 0.05);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: 700;
                        font-size: 14px;
                        color: #1d1d1f;
                    }

                    .active .workspace-icon {
                        background: #007aff;
                        color: white;
                    }

                    .workspace-name {
                        font-size: 14px;
                        font-weight: 500;
                        color: #1d1d1f;
                    }

                    .current-badge {
                        font-size: 10px;
                        background: #007aff;
                        color: white;
                        padding: 2px 6px;
                        border-radius: 4px;
                        font-weight: 600;
                        text-transform: uppercase;
                    }

                    .sidebar-footer {
                        padding: 20px;
                        background: rgba(0, 0, 0, 0.02);
                        border-top: 1px solid rgba(0, 0, 0, 0.05);
                    }

                    .sidebar-footer p {
                        margin: 0;
                        font-size: 11px;
                        color: #86868b;
                        line-height: 1.5;
                        text-align: center;
                    }
                    `}
                </style>
            </div>
        </>
    );
};

export default WorkspaceSidebar;
