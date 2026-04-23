import React, { useState, useEffect, useRef, useCallback } from "react";
import { useApp } from "../../context/AppContext";

const COLORS = ["#FFF9C4", "#C8E6C9", "#BBDEFB", "#FFE0B2", "#F8BBD0"];
const STORAGE_KEY = "screen-sticky-notes";

function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
}
function save(notes) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function StickyNote({ note, onUpdate, onDelete }) {
    const [text, setText] = useState(note.text);
    const [editing, setEditing] = useState(note.fresh);
    const [collapsed, setCollapsed] = useState(false);
    const dragging = useRef(false);
    const startPos = useRef({});
    const noteRef = useRef();
    const textareaRef = useRef();

    // Focus when fresh
    useEffect(() => {
        if (note.fresh && textareaRef.current) {
            textareaRef.current.focus();
            onUpdate(note.id, { fresh: false });
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const clampPosition = (x, y, w, h) => {
        const maxX = window.innerWidth - w;
        const maxY = window.innerHeight - h;
        return {
            x: Math.max(0, Math.min(x, maxX)),
            y: Math.max(0, Math.min(y, maxY)),
        };
    };

    const handleHeaderMouseDown = (e) => {
        if (e.target.tagName === "BUTTON") return;
        dragging.current = true;
        startPos.current = {
            mouseX: e.clientX,
            mouseY: e.clientY,
            noteX: note.x,
            noteY: note.y,
        };
        e.preventDefault();

        const onMove = (ev) => {
            if (!dragging.current) return;
            const dx = ev.clientX - startPos.current.mouseX;
            const dy = ev.clientY - startPos.current.mouseY;
            const noteW = note.width || 220;
            const noteH = collapsed ? 34 : (note.height || 160);
            const clamped = clampPosition(
                startPos.current.noteX + dx,
                startPos.current.noteY + dy,
                noteW, noteH
            );
            onUpdate(note.id, clamped);
        };
        const onUp = () => {
            dragging.current = false;
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    };

    const commitText = () => {
        setEditing(false);
        onUpdate(note.id, { text });
    };

    const borderColor = note.color === "#FFF9C4" ? "#F9A825"
        : note.color === "#C8E6C9" ? "#388E3C"
        : note.color === "#BBDEFB" ? "#1565C0"
        : note.color === "#FFE0B2" ? "#E65100"
        : "#AD1457";

    return (
        <div
            ref={noteRef}
            style={{
                position: "fixed",
                left: note.x,
                top: note.y,
                width: note.width || 220,
                height: collapsed ? "auto" : (note.height || 160),
                background: note.color,
                border: `1px solid ${borderColor}`,
                borderRadius: 4,
                boxShadow: "0 6px 20px rgba(0,0,0,0.22), 0 2px 6px rgba(0,0,0,0.12)",
                display: "flex",
                flexDirection: "column",
                zIndex: 9000,
                userSelect: "none",
            }}
        >
            {/* Header / drag bar */}
            <div
                onMouseDown={handleHeaderMouseDown}
                style={{
                    background: borderColor,
                    padding: "5px 8px",
                    cursor: "move",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderRadius: collapsed ? 3 : "3px 3px 0 0",
                    flexShrink: 0,
                }}
            >
                {/* Color picker dots */}
                <div style={{ display: "flex", gap: 4 }}>
                    {COLORS.map(c => (
                        <div
                            key={c}
                            onClick={() => onUpdate(note.id, { color: c })}
                            style={{
                                width: 10, height: 10, borderRadius: "50%",
                                background: c, border: note.color === c ? "2px solid #333" : "1px solid rgba(0,0,0,0.2)",
                                cursor: "pointer", flexShrink: 0,
                            }}
                        />
                    ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <button
                        onClick={() => setCollapsed(c => !c)}
                        style={{
                            background: "none", border: "none", cursor: "pointer",
                            color: "rgba(0,0,0,0.55)", fontSize: 13, lineHeight: 1,
                            padding: "0 3px", display: "flex", alignItems: "center",
                        }}
                        title={collapsed ? "Expand" : "Collapse"}
                    >{collapsed ? "▲" : "▼"}</button>
                    <button
                        onClick={() => onDelete(note.id)}
                        style={{
                            background: "none", border: "none", cursor: "pointer",
                            color: "rgba(0,0,0,0.55)", fontSize: 16, lineHeight: 1,
                            padding: "0 2px", display: "flex", alignItems: "center",
                        }}
                        title="Delete"
                    >×</button>
                </div>
            </div>

            {/* Text area — hidden when collapsed */}
            {!collapsed && (
                <>
                    <textarea
                        ref={textareaRef}
                        value={text}
                        onChange={e => setText(e.target.value)}
                        onFocus={() => setEditing(true)}
                        onBlur={commitText}
                        onKeyDown={e => { if (e.key === "Escape") { commitText(); e.target.blur(); } }}
                        placeholder="Type your note…"
                        style={{
                            flex: 1,
                            resize: "none",
                            border: "none",
                            outline: "none",
                            background: "transparent",
                            fontSize: 13,
                            lineHeight: 1.6,
                            padding: "8px 10px",
                            color: "#333",
                            fontFamily: "inherit",
                            minHeight: 60,
                            cursor: "text",
                            boxSizing: "border-box",
                            width: "100%",
                        }}
                    />
                    {/* Resize handle */}
                    <ResizeHandle noteId={note.id} width={note.width || 220} height={note.height || 160} onUpdate={onUpdate} />
                </>
            )}
        </div>
    );
}

function ResizeHandle({ noteId, width, height, onUpdate }) {
    const startRef = useRef({});

    const onMouseDown = (e) => {
        e.stopPropagation();
        e.preventDefault();
        startRef.current = { x: e.clientX, y: e.clientY, w: width, h: height };

        const onMove = (ev) => {
            const dw = ev.clientX - startRef.current.x;
            const dh = ev.clientY - startRef.current.y;
            onUpdate(noteId, {
                width: Math.max(160, startRef.current.w + dw),
                height: Math.max(120, startRef.current.h + dh),
            });
        };
        const onUp = () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    };

    return (
        <div
            onMouseDown={onMouseDown}
            style={{
                position: "absolute", bottom: 0, right: 0,
                width: 14, height: 14, cursor: "nwse-resize",
                background: "rgba(0,0,0,0.08)",
                borderBottomRightRadius: 3,
                clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
            }}
        />
    );
}

export default function ScreenStickyNotes() {
    const { tool, TOOL_MODES, setTool } = useApp();
    const [notes, setNotes] = useState(load);

    // Persist to localStorage on change
    useEffect(() => { save(notes); }, [notes]);

    const updateNote = useCallback((id, patch) => {
        setNotes(prev => prev.map(n => n.id === id ? { ...n, ...patch } : n));
    }, []);

    const deleteNote = useCallback((id) => {
        setNotes(prev => prev.filter(n => n.id !== id));
    }, []);

    // Click anywhere to place a new sticky note when tool is active
    useEffect(() => {
        if (tool !== TOOL_MODES.STICKY_NOTE) return;

        const handleClick = (e) => {
            // Don't create a note when clicking on an existing note or the navbar
            if (e.target.closest("[data-sticky-note]") || e.target.closest(".main-navbar")) return;

            const newNote = {
                id: `sticky-${Date.now()}`,
                x: e.clientX - 110,   // center the note on click
                y: e.clientY - 20,
                text: "",
                color: COLORS[0],
                fresh: true,
                width: 220,
                height: 160,
            };
            setNotes(prev => [...prev, newNote]);
            // Switch back to select after placing
            setTool(TOOL_MODES.SELECT);
        };

        window.addEventListener("click", handleClick);
        return () => window.removeEventListener("click", handleClick);
    }, [tool, TOOL_MODES, setTool]);

    return (
        <div data-sticky-note="container" style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 8999 }}>
            {notes.map(note => (
                <div key={note.id} data-sticky-note="true" style={{ pointerEvents: "auto", position: "absolute" }}>
                    <StickyNote
                        note={note}
                        onUpdate={updateNote}
                        onDelete={deleteNote}
                    />
                </div>
            ))}
        </div>
    );
}
