import React, { useRef, useEffect, useState, useCallback } from "react";
import { useApp } from "../../context/AppContext";
import api from "../../api/api";

function BookmarkItem({ bm, onJump, onDelete, onRename }) {
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(bm.name || `Page ${bm.page_num}`);
    const inputRef = useRef(null);

    useEffect(() => { setName(bm.name || `Page ${bm.page_num}`); }, [bm.name, bm.page_num]);

    const commit = useCallback(() => {
        setEditing(false);
        const trimmed = name.trim();
        if (trimmed && trimmed !== bm.name) onRename(bm.id, trimmed);
    }, [name, bm.id, bm.name, onRename]);

    useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

    return (
        <div
            style={{
                display: "flex", alignItems: "flex-start", padding: "9px 14px",
                cursor: "pointer", borderBottom: "1px solid #f3f4f6", gap: 10,
                transition: "background 0.1s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "#fffbeb"}
            onMouseLeave={e => e.currentTarget.style.background = ""}
            onClick={() => { if (!editing) onJump(bm.page_num); }}
        >
            {/* Bookmark ribbon icon + page number */}
            <div style={{ minWidth: 32, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 2 }}>
                <svg width="18" height="22" viewBox="0 0 18 22" fill="#f59e0b">
                    <path d="M1 1h16v20l-8-5-8 5V1z" stroke="#d97706" strokeWidth="1" strokeLinejoin="round"/>
                </svg>
                <span style={{ fontSize: 9, fontWeight: 700, color: "#92400e", marginTop: 1 }}>{bm.page_num}</span>
            </div>

            {/* Name / inline editor */}
            <div style={{ flex: 1, minWidth: 0 }}>
                {editing ? (
                    <input
                        ref={inputRef}
                        value={name}
                        onChange={e => setName(e.target.value)}
                        onBlur={commit}
                        onKeyDown={e => {
                            if (e.key === "Enter") commit();
                            if (e.key === "Escape") { setEditing(false); setName(bm.name || `Page ${bm.page_num}`); }
                            e.stopPropagation();
                        }}
                        onClick={e => e.stopPropagation()}
                        style={{
                            width: "100%", fontSize: 12, padding: "2px 6px",
                            border: "1px solid #fcd34d", borderRadius: 4,
                            outline: "none", background: "#fffbeb", boxSizing: "border-box",
                        }}
                    />
                ) : (
                    <div
                        onDoubleClick={e => { e.stopPropagation(); setEditing(true); }}
                        title="Double-click to rename"
                        style={{
                            fontSize: 12, fontWeight: 500, color: "#1f2937", lineHeight: 1.45,
                            overflow: "hidden", textOverflow: "ellipsis",
                            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                        }}
                    >{name}</div>
                )}
                <div style={{ fontSize: 10, color: "#b0b7c3", marginTop: 3 }}>
                    {new Date(bm.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    {" · double-click to rename"}
                </div>
            </div>

            {/* Delete */}
            <button
                onClick={e => { e.stopPropagation(); onDelete(bm.id); }}
                title="Remove bookmark"
                style={{
                    border: "none", background: "transparent", cursor: "pointer",
                    color: "#d1d5db", fontSize: 15, padding: "1px 3px",
                    borderRadius: 4, lineHeight: 1, flexShrink: 0, marginTop: 2,
                    transition: "color 0.15s",
                }}
                onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                onMouseLeave={e => e.currentTarget.style.color = "#d1d5db"}
            >×</button>
        </div>
    );
}

export default function BookmarksSidebar() {
    const {
        bookmarks, setBookmarks,
        showBookmarks, setShowBookmarks,
        handleAddBookmark, handleDeleteBookmark,
        pdfRef,
    } = useApp();

    const panelRef = useRef(null);
    const [addName, setAddName] = useState("");
    const [showAddForm, setShowAddForm] = useState(false);

    // Close on outside click
    useEffect(() => {
        if (!showBookmarks) return;
        const handler = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) setShowBookmarks(false);
        };
        const t = setTimeout(() => document.addEventListener("mousedown", handler), 150);
        return () => { clearTimeout(t); document.removeEventListener("mousedown", handler); };
    }, [showBookmarks, setShowBookmarks]);

    const handleJump = (pageNum) => {
        pdfRef.current?.scrollToPage(pageNum);
        setShowBookmarks(false);
    };

    const handleQuickAdd = async () => {
        const pg = pdfRef.current?.getCurrentPageNum?.() || 1;
        await handleAddBookmark(pg, addName.trim() || `Page ${pg}`);
        setAddName("");
        setShowAddForm(false);
    };

    const handleRename = useCallback(async (id, newName) => {
        try {
            await api.patch(`/bookmarks/${id}`, { name: newName });
            setBookmarks(prev => prev.map(b => b.id === id ? { ...b, name: newName } : b));
        } catch (err) {
            console.error("Rename bookmark failed:", err);
        }
    }, [setBookmarks]);

    if (!showBookmarks) return null;

    return (
        <div
            ref={panelRef}
            style={{
                position: "fixed", top: 56, right: 0,
                width: 272, height: "calc(100vh - 56px)",
                background: "#fff", borderLeft: "1px solid #e5e7eb",
                boxShadow: "-4px 0 24px rgba(0,0,0,0.1)",
                zIndex: 800, display: "flex", flexDirection: "column",
                fontFamily: "system-ui, -apple-system, sans-serif",
            }}
        >
            {/* Header */}
            <div style={{
                padding: "11px 14px 9px", borderBottom: "1px solid #f0f0f0",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "#fffbeb",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b" stroke="#d97706" strokeWidth="1.5">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                    </svg>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "#1f2937" }}>Bookmarks</span>
                    {bookmarks.length > 0 && (
                        <span style={{
                            background: "#f59e0b", color: "white",
                            borderRadius: 10, fontSize: 10, fontWeight: 700, padding: "1px 6px",
                        }}>{bookmarks.length}</span>
                    )}
                </div>
                <div style={{ display: "flex", gap: 5 }}>
                    <button
                        onClick={() => setShowAddForm(v => !v)}
                        title="Bookmark current page"
                        style={{
                            border: "none", background: showAddForm ? "#fef3c7" : "#f3f4f6",
                            borderRadius: 6, width: 26, height: 26, cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 17, color: "#374151",
                        }}
                    >+</button>
                    <button
                        onClick={() => setShowBookmarks(false)}
                        style={{
                            border: "none", background: "transparent", cursor: "pointer",
                            fontSize: 16, color: "#9ca3af", display: "flex",
                            alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 6,
                        }}
                    >×</button>
                </div>
            </div>

            {/* Quick-add form */}
            {showAddForm && (
                <div style={{
                    padding: "8px 14px", borderBottom: "1px solid #f0f0f0",
                    background: "#fffbeb", display: "flex", gap: 7,
                }}>
                    <input
                        autoFocus
                        value={addName}
                        onChange={e => setAddName(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === "Enter") handleQuickAdd();
                            if (e.key === "Escape") setShowAddForm(false);
                        }}
                        placeholder={`Label for page ${pdfRef.current?.getCurrentPageNum?.() || 1}…`}
                        style={{
                            flex: 1, fontSize: 12, padding: "5px 8px",
                            border: "1px solid #fcd34d", borderRadius: 6,
                            outline: "none", background: "white",
                        }}
                    />
                    <button
                        onClick={handleQuickAdd}
                        style={{
                            background: "#f59e0b", color: "white", border: "none",
                            borderRadius: 6, padding: "5px 11px", cursor: "pointer",
                            fontSize: 12, fontWeight: 700,
                        }}
                    >Add</button>
                </div>
            )}

            {/* Bookmarks list */}
            <div style={{ flex: 1, overflowY: "auto" }}>
                {bookmarks.length === 0 ? (
                    <div style={{
                        textAlign: "center", color: "#9ca3af", fontSize: 12,
                        padding: "36px 20px", lineHeight: 1.7,
                    }}>
                        <svg width="30" height="30" viewBox="0 0 24 24" fill="#fcd34d" stroke="#f59e0b" strokeWidth="1.5"
                            style={{ display: "block", margin: "0 auto 10px" }}>
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                        </svg>
                        <div style={{ fontWeight: 600, color: "#6b7280", marginBottom: 5 }}>No bookmarks yet</div>
                        <div>Select text in the PDF and click<br/><strong>Bookmark</strong> in the popup,<br/>or press <strong>+</strong> to bookmark current page.</div>
                    </div>
                ) : (
                    bookmarks.map(bm => (
                        <BookmarkItem
                            key={bm.id}
                            bm={bm}
                            onJump={handleJump}
                            onDelete={handleDeleteBookmark}
                            onRename={handleRename}
                        />
                    ))
                )}
            </div>

            {/* Footer */}
            {bookmarks.length > 0 && (
                <div style={{
                    padding: "6px 14px", borderTop: "1px solid #f0f0f0",
                    fontSize: 10, color: "#9ca3af", textAlign: "center", background: "#fafafa",
                }}>
                    Click to jump · Double-click name to rename
                </div>
            )}
        </div>
    );
}
