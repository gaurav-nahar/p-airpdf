import React, { useCallback, Suspense, useState, useMemo, useRef, useEffect } from "react";
import InfiniteCanvas from "./InfiniteCanvas";
import DrawingCanvas from "./DrawingCanvas";
import ConnectionLines from "./ConnectionLines";
import EditableTextBoxes from "./EditableTextBoxes";
import DraggableNote from "./DraggableNote";
import GroupLayer from "./GroupLayer";

// Hooks
import useSnippetHandlers from "../../hooks/useSnippetHandlers";
import useBoxHandlers from "./useBoxHandlers";
import useConnections from "../../hooks/useConnections";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useUI } from "../../context/UIContext";
import { useAppActions } from "../../context/AppContext";
import { showToast } from "../layout/Toast";
// Lazy Components
import { initGlobalTouchDrag } from "../pdf/pdfDragHandlers";
const WorkspaceSidebar = React.lazy(() => import("../layout/WorkspaceSidebar"));



/**
 * 🎨 Workspace Component
 * Encapsulates the infinite canvas and all its workspace-specific tools
 * like snippets, editable boxes, drawing canvas, and connection lines.
 */
const Workspace = () => {
    const {
        pdfId,
        activeWorkspace,
        snippets, setSnippets,
        editableBoxes, setEditableBoxes,
        connections, setConnections,
        selectedItem, setSelectedItem,
        lineStartId, setLineStartId,
        lines, setLines,
        handleDeleteSnippet,
        handleDeleteBox,
        canvasRef,
        pdfRef,
        pdf2Ref,
        viewStateRef,
        setIsDirty,
        recordHistory, getSnapshot,
        groups, handleCreateGroup, handleUngroupItems, handleToggleGroupCollapse, handleSetGroupColor, handleRenameGroup,
    } = useWorkspace();

    const {
        tool,
        TOOL_MODES,
        showWorkspaceSidebar, setShowWorkspaceSidebar,
        pdfDrawingColor,
        penSize,
        pdfTabs,
        panel2PdfId,
        startDragWire,
    } = useUI();

    const { jumpToSource } = useAppActions();

    const activePdfId = pdfId;

    // Build a map: pdfId → { color, name } for snippet tinting
    const pdfColorMap = React.useMemo(() => {
        const map = {};
        (pdfTabs || []).forEach(t => { map[String(t.pdfId)] = { color: t.color, name: t.name }; });
        return map;
    }, [pdfTabs]);

    // Move all items in a group by dx/dy (world-space delta)
    const handleMoveGroup = useCallback((groupId, dx, dy) => {
        const group = groups.find(g => g.id === groupId);
        if (!group) return;
        const ids = new Set(group.itemIds.map(String));
        setSnippets(prev => prev.map(s => ids.has(String(s.id)) ? { ...s, x: (s.x || 0) + dx, y: (s.y || 0) + dy } : s));
        setEditableBoxes(prev => prev.map(b => ids.has(String(b.id)) ? { ...b, x: (b.x || 0) + dx, y: (b.y || 0) + dy } : b));
        setIsDirty(true);
    }, [groups, setSnippets, setEditableBoxes, setIsDirty]);

    // 🔄 Dirty-aware setters
    const setSnippetsWithDirty = useCallback((val) => {
        setSnippets(val);
        setIsDirty(true);
    }, [setSnippets, setIsDirty]);

    const setEditableBoxesWithDirty = useCallback((val) => {
        setEditableBoxes(val);
        setIsDirty(true);
    }, [setEditableBoxes, setIsDirty]);

    const setConnectionsWithDirty = useCallback((val) => {
        setConnections(val);
        setIsDirty(true);
    }, [setConnections, setIsDirty]);

    const setLinesWithDirty = useCallback((val) => {
        setLines(val);
        setIsDirty(true);
    }, [setLines, setIsDirty]);


    //  Coordinate Helper Functions (Delegates to InfiniteCanvas)//infiniteCanvas.js
    const screenToWorld = useCallback((x, y) => {
        if (canvasRef.current) {
            return canvasRef.current.screenToWorld(x, y);
        }
        return { x, y }; // Fallback
    }, [canvasRef]);

    const getScale = useCallback(() => {
        if (canvasRef.current) {
            return canvasRef.current.getScale();
        }
        return 1; // Fallback
    }, [canvasRef]);

    // Multi-select state for grouping
    const [selectedItems, setSelectedItems] = useState([]); // [{type: 'snippet'|'box', id: string}]

    const toggleMultiSelect = useCallback((type, id) => {
        setSelectedItems(prev => {
            const exists = prev.find(item => item.type === type && String(item.id) === String(id));
            if (exists) return prev.filter(item => !(item.type === type && String(item.id) === String(id)));
            return [...prev, { type, id: String(id) }];
        });
    }, []);

    const multiSelectedSnippetIds = selectedItems.filter(i => i.type === 'snippet').map(i => i.id);
    const multiSelectedBoxIds = selectedItems.filter(i => i.type === 'box').map(i => i.id);

    // Ids of items in collapsed groups (hidden from render)
    const collapsedItemIds = useMemo(() => {
        const ids = new Set();
        groups.filter(g => g.collapsed).forEach(g => g.itemIds.forEach(id => ids.add(id)));
        return ids;
    }, [groups]);

    // ⌨️ Keyboard shortcuts: Delete selected, Escape deselect, Ctrl+A select all
    useEffect(() => {
        const handler = (e) => {
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;

            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedItems.length > 0) {
                e.preventDefault();
                selectedItems.forEach(item => {
                    if (item.type === 'snippet') handleDeleteSnippet(item.id);
                    else if (item.type === 'box') handleDeleteBox(item.id);
                });
                setSelectedItems([]);
            }
            if (e.key === 'Escape') {
                setSelectedItems([]);
                setSelectedItem(null);
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                e.preventDefault();
                const allSnippets = snippets
                    .filter(s => s.type !== 'anchor' && !collapsedItemIds.has(String(s.id)))
                    .map(s => ({ type: 'snippet', id: String(s.id) }));
                const allBoxes = editableBoxes
                    .filter(b => !collapsedItemIds.has(String(b.id)))
                    .map(b => ({ type: 'box', id: String(b.id) }));
                setSelectedItems([...allSnippets, ...allBoxes]);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [selectedItems, snippets, editableBoxes, collapsedItemIds, handleDeleteSnippet, handleDeleteBox, setSelectedItem]);

    // Rubber-band selection state
    const isRubberBanding = useRef(false);
    const rubberBandStart = useRef(null);
    const [rubberBandRect, setRubberBandRect] = useState(null);

    // Hooks
    // Handles mouse/touch interactions in workspace (like drawing boxes). Calls UseBoxHandlers.js
    const { workspaceRef, drawingBox, handleMouseDown, handleMouseMove, handleMouseUp } =
        useBoxHandlers({ tool, TOOL_MODES, setEditableBoxes: setEditableBoxesWithDirty, screenToWorld, recordHistory, getSnapshot }); // useBoxHandlers.js

    //  Handles dragging items from PDF to workspace. Calls UseSnippetHandlers.js
    const { handleSnippetDrop, addSnippet } = useSnippetHandlers({ // useSnippetHandlers.js
        tool,
        TOOL_MODES,
        pdfRef,
        workspaceRef,
        setSnippets: setSnippetsWithDirty,
        setConnections: setConnectionsWithDirty, // Pass setter for link creation
        screenToWorld,
        getScale,
        recordHistory,
        getSnapshot,
        showToast,
    });

    //  Handles creating lines between notes. Calls UseConnections.js
    const { handleNoteClick } = useConnections({ // useConnections.js
        tool,
        TOOL_MODES,
        lineStartId,
        setLineStartId,
        connections,
        setConnections: setConnectionsWithDirty,
        pdfRef,
        pdf2Ref,
        pdfId,
        panel2PdfId,
        snippets, // Added snippets
        setSelectedItem, // Pass setter to centralized selection
    });

    //  Links a note to highlighted text in the PDF. Calls PDFViewer.js -> getLatestSelection()
    // it is used for select multiple text from pdf and create anchor and connection
    const handleLinkBoxToSelection = useCallback((boxId) => {
        if (!pdfRef.current) return;
        const rawSelection = pdfRef.current.getLatestSelection();
        if (!rawSelection) {
            showToast("First select text in the PDF!", "error");
            return;
        }

        const selections = Array.isArray(rawSelection) ? rawSelection : [rawSelection];
        const newSnippets = [];
        const newConnections = [];

        selections.forEach(sel => {
            const anchorId = `anchor-${Date.now()}-${Math.random()}`;
            const newAnchor = {
                ...sel,
                id: anchorId,
                type: 'anchor', // CRITICAL: Identify as anchor for Bezier logic
                x: -1000, // Hide from workspace
                y: -1000,
            };
            newSnippets.push(newAnchor);
            newConnections.push({ from: String(boxId), to: String(anchorId) });
        });

        setSnippetsWithDirty((prev) => [...prev, ...newSnippets]);
        setConnectionsWithDirty((prev) => [...prev, ...newConnections]);

        // Clear selection after linking
        if (pdfRef.current.clearSelection) {
            pdfRef.current.clearSelection();
        }

        showToast(`Linked ${selections.length} text snippet(s)!`, "success");
    }, [pdfRef, setSnippetsWithDirty, setConnectionsWithDirty]);

    // 🖱️ Helper to get clean coordinates from Mouse or Touch events
    const getTouchEvent = (e) => {
        if (e && e.touches && e.touches.length > 0) {
            const t = e.touches[0];
            return { clientX: t.clientX, clientY: t.clientY };
        }
        return e;
    };

    // 📱 Global Touch Drag Listener for Images from PDF
    // Delegated to pdfDragHandlers.js to keep logic centralized as requested.
    React.useEffect(() => {
        // initGlobalTouchDrag returns a cleanup function
        return initGlobalTouchDrag(addSnippet, screenToWorld, workspaceRef);
    }, [addSnippet, screenToWorld, workspaceRef]);

    // 🖐️ Workspace gesture handlers (unified for mouse & touch)
    const handleUnifiedDown = (e) => {
        if (tool === TOOL_MODES.SELECT) {
            if (!e.shiftKey) { setSelectedItem(null); setSelectedItems([]); }
            if (e.shiftKey) {
                const worldPos = screenToWorld(e.clientX, e.clientY);
                rubberBandStart.current = worldPos;
                isRubberBanding.current = true;
            }
        }
        handleMouseDown(getTouchEvent(e));
    };

    const handleUnifiedMove = (e) => {
        if (isRubberBanding.current && rubberBandStart.current && tool === TOOL_MODES.SELECT) {
            const worldPos = screenToWorld(e.clientX, e.clientY);
            const x = Math.min(rubberBandStart.current.x, worldPos.x);
            const y = Math.min(rubberBandStart.current.y, worldPos.y);
            const w = Math.abs(worldPos.x - rubberBandStart.current.x);
            const h = Math.abs(worldPos.y - rubberBandStart.current.y);
            if (w > 4 || h > 4) setRubberBandRect({ x, y, w, h });
        }
        handleMouseMove(getTouchEvent(e));
    };

    const handleUnifiedUp = (e) => {
        if (isRubberBanding.current && rubberBandRect && (rubberBandRect.w > 8 || rubberBandRect.h > 8)) {
            const { x: rx, y: ry, w: rw, h: rh } = rubberBandRect;
            const newSelected = [];
            snippets.filter(s => s.type !== 'anchor' && !collapsedItemIds.has(String(s.id))).forEach(s => {
                const sw = typeof s.width === 'number' ? s.width : 180;
                const sh = typeof s.height === 'number' ? s.height : 120;
                if (s.x + sw > rx && s.x < rx + rw && s.y + sh > ry && s.y < ry + rh) {
                    newSelected.push({ type: 'snippet', id: String(s.id) });
                }
            });
            editableBoxes.filter(b => !collapsedItemIds.has(String(b.id))).forEach(b => {
                const bw = typeof b.width === 'number' ? b.width : 160;
                const bh = typeof b.height === 'number' ? b.height : 80;
                if (b.x + bw > rx && b.x < rx + rw && b.y + bh > ry && b.y < ry + rh) {
                    newSelected.push({ type: 'box', id: String(b.id) });
                }
            });
            if (newSelected.length > 0) setSelectedItems(newSelected);
        }
        isRubberBanding.current = false;
        rubberBandStart.current = null;
        setRubberBandRect(null);
        handleMouseUp(getTouchEvent(e));
    };

    return (
        <div
            ref={workspaceRef}
            onDrop={handleSnippetDrop} //useSnippetHandlers.js
            onDragOver={(e) => e.preventDefault()}
            onMouseDown={handleUnifiedDown} //useBoxHandlers.js
            onMouseMove={handleUnifiedMove} //useBoxHandlers.js
            onMouseUp={handleUnifiedUp} //useBoxHandlers.js
            onTouchStart={handleUnifiedDown} //useBoxHandlers.js
            onTouchMove={(e) => handleUnifiedMove(e)} //useBoxHandlers.js
            onTouchEnd={handleUnifiedUp} //useBoxHandlers.js
            className="workspace-view-container"
        >
            <button
                onClick={() => setShowWorkspaceSidebar(!showWorkspaceSidebar)}
                title="Manage Workspaces"
                style={{
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
                    zIndex: 100,
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.9)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(0, 0, 0, 0.1)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#1d1d1f',
                    transition: 'all 0.2s ease'
                }}
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="9" y1="3" x2="9" y2="21" />
                </svg>
            </button>

            <InfiniteCanvas
                ref={canvasRef}
                className="infinite-canvas"
                style={{
                    width: "100%", height: "100%",
                    cursor: {
                        [TOOL_MODES.DRAW_LINE]:       "crosshair",
                        [TOOL_MODES.ADD_BOX]:         "crosshair",
                        [TOOL_MODES.PEN]:             "crosshair",
                        [TOOL_MODES.ERASER]:          "crosshair",
                        [TOOL_MODES.HIGHLIGHT_BRUSH]: "crosshair",
                        [TOOL_MODES.STICKY_NOTE]:     "copy",
                    }[tool] || "default",
                }}
                key={activeWorkspace ? activeWorkspace.id : "default-canvas"}
                initialScale={(() => {
                    const s = localStorage.getItem(`view-${pdfId}-${activeWorkspace?.id}`);
                    return s ? JSON.parse(s).scale : 1;
                })()}
                initialPan={(() => {
                    const s = localStorage.getItem(`view-${pdfId}-${activeWorkspace?.id}`);
                    return s ? JSON.parse(s).pan : { x: 0, y: 0 };
                })()}
                onViewChange={(v) => { viewStateRef.current = v; }}
                panningEnabled={tool !== TOOL_MODES.ADD_BOX}
            >
                {/* Tool status hint */}
                <div style={{ position: "absolute", bottom: 20, left: 20, zIndex: 10, background: "rgb(221, 240, 212)", padding: "4px 10px", borderRadius: 6, fontSize: 12, color: "#666", pointerEvents: "none" }}>
                    {tool === TOOL_MODES.DRAW_LINE && (lineStartId ? "Pick second note" : "Pick first note")}
                    {tool === TOOL_MODES.ADD_BOX && "Drag to create text box"}
                    {tool === TOOL_MODES.PEN && "Draw freehand"}
                    {tool === TOOL_MODES.ERASER && "Erase drawings"}
                </div>

                <GroupLayer
                    groups={groups}
                    snippets={snippets}
                    editableBoxes={editableBoxes}
                    onToggleCollapse={handleToggleGroupCollapse}
                    onUngroup={handleUngroupItems}
                    onSetColor={handleSetGroupColor}
                    onRename={handleRenameGroup}
                    onMoveGroup={handleMoveGroup}
                    getScale={getScale}
                />

                {/* Rubber-band selection rectangle */}
                {rubberBandRect && rubberBandRect.w > 4 && (
                    <div style={{
                        position: 'absolute',
                        left: rubberBandRect.x,
                        top: rubberBandRect.y,
                        width: rubberBandRect.w,
                        height: rubberBandRect.h,
                        border: '2px dashed #007bff',
                        background: 'rgba(0,123,255,0.06)',
                        pointerEvents: 'none',
                        zIndex: 50,
                        borderRadius: 4,
                    }} />
                )}
                {/* Live preview while dragging to create a text box */}
                {drawingBox && (
                    <div style={{
                        position: "absolute",
                        left: drawingBox.width < 0 ? drawingBox.x + drawingBox.width : drawingBox.x,
                        top: drawingBox.height < 0 ? drawingBox.y + drawingBox.height : drawingBox.y,
                        width: Math.abs(drawingBox.width),
                        height: Math.abs(drawingBox.height),
                        border: "2px dashed #007bff",
                        background: "rgba(0,123,255,0.06)",
                        borderRadius: 6,
                        pointerEvents: "none",
                        zIndex: 50,
                    }} />
                )}

                <DrawingCanvas
                    tool={tool}
                    lines={lines}
                    setLines={setLinesWithDirty}
                    selectedColor={pdfDrawingColor}
                    penSize={penSize}
                />

                <ConnectionLines
                    snippets={snippets}
                    editableBoxes={editableBoxes}
                    connections={connections}
                    pdfColorMap={pdfColorMap}
                    onDeleteConnection={(id) => {
                        setConnections(prev => prev.filter(c => (c.id || `${c.from}-${c.to}`) !== id));
                        setIsDirty(true);
                    }}
                />

                <EditableTextBoxes
                    editableBoxes={editableBoxes.filter(b => !collapsedItemIds.has(String(b.id)))}
                    setEditableBoxes={setEditableBoxesWithDirty}
                    onDeleteBox={handleDeleteBox}
                    onBoxClick={handleNoteClick}
                    activeConnectionId={lineStartId}
                    selectedBoxId={selectedItem?.type === 'box' ? selectedItem.id : null}
                    onLinkToSelection={handleLinkBoxToSelection}
                    connections={connections}
                    multiSelectedIds={multiSelectedBoxIds}
                    onMultiSelect={(id) => toggleMultiSelect('box', id)}
                    onBoxDrag={(boxId, dx, dy) => {
                        const group = groups.find(g => g.itemIds.includes(String(boxId)));
                        if (group) {
                            const groupIds = new Set(group.itemIds.map(String));
                            setSnippets(prev => prev.map(s => groupIds.has(String(s.id)) ? { ...s, x: s.x + dx, y: s.y + dy } : s));
                            setEditableBoxes(prev => prev.map(b => groupIds.has(String(b.id)) ? { ...b, x: b.x + dx, y: b.y + dy } : b));
                            setIsDirty(true);
                        } else {
                            setEditableBoxesWithDirty(prev => prev.map(b => b.id === boxId ? { ...b, x: b.x + dx, y: b.y + dy } : b));
                        }
                    }}
                />

                <div style={{ position: "relative", flexGrow: 1, zIndex: 3 }}>
                    {snippets.filter(s => s.type !== 'anchor' && !collapsedItemIds.has(String(s.id))).map((s) => (
                        <DraggableNote
                            key={s.id ?? `${s.x}-${s.y}-${Math.random()}`}
                            snippet={s}
                            sourcePdfColor={pdfColorMap[String(s.pdf_id)]?.color || null}
                            sourcePdfName={pdfColorMap[String(s.pdf_id)]?.name || null}
                            onClick={(e) => {
                                if (e.ctrlKey || e.metaKey || e.shiftKey) {
                                    toggleMultiSelect('snippet', s.id);
                                } else {
                                    setSelectedItems([]);
                                    handleNoteClick(s);
                                    if (tool === TOOL_MODES.SELECT) {
                                        // LiquidText core: click note → correct PDF tab switches + scrolls to source
                                        jumpToSource(s);
                                    }
                                }
                            }}
                            onColorChange={(color) => {
                                recordHistory(getSnapshot());
                                setSnippetsWithDirty(prev => prev.map(n => n.id === s.id ? { ...n, bg_color: color } : n));
                            }}
                            onDrag={(dx, dy, action, idOrItem) => {
                                if (action === "drag-start" || action === "resize-start") {
                                    recordHistory(getSnapshot());
                                } else if (action === "cut" || action === "delete") {
                                    handleDeleteSnippet(idOrItem);
                                } else if (action === "paste") {
                                    setSnippetsWithDirty((prev) => [...prev, idOrItem]);
                                } else if (action === "resize") {
                                    setSnippetsWithDirty((prev) =>
                                        prev.map((note) =>
                                            note.id === idOrItem.id ? { ...note, width: idOrItem.width, height: idOrItem.height } : note
                                        )
                                    );
                                } else if (action === "edit") {
                                    recordHistory(getSnapshot());
                                    setSnippetsWithDirty((prev) =>
                                        prev.map((note) =>
                                            note.id === idOrItem.id ? { ...note, text: idOrItem.text } : note
                                        )
                                    );
                                } else if (dx !== null && dy !== null) {
                                    // dx/dy are already world-coordinate deltas (DraggableNote divides by scale)
                                    // If this snippet is in a group, move all group members together
                                    const group = groups.find(g => g.itemIds.includes(String(s.id)));
                                    if (group) {
                                        const groupIds = new Set(group.itemIds.map(String));
                                        setSnippetsWithDirty(prev => prev.map(n =>
                                            groupIds.has(String(n.id)) ? { ...n, x: n.x + dx, y: n.y + dy } : n
                                        ));
                                        setEditableBoxes(prev => prev.map(b =>
                                            groupIds.has(String(b.id)) ? { ...b, x: b.x + dx, y: b.y + dy } : b
                                        ));
                                        setIsDirty(true);
                                    } else {
                                        setSnippetsWithDirty((prev) =>
                                            prev.map((note) =>
                                                note.id === s.id ? { ...note, x: note.x + dx, y: note.y + dy } : note
                                            )
                                        );
                                    }
                                }
                            }}
                            disableDrag={tool !== TOOL_MODES.SELECT}
                            selected={lineStartId === s.id || (selectedItem?.type === 'snippet' && String(selectedItem?.id) === String(s.id))}
                            multiSelected={multiSelectedSnippetIds.includes(String(s.id))}
                            onStartWire={startDragWire ? (snippetId, anchorX, anchorY, mouseX, mouseY) => {
                                startDragWire(
                                    { type: "snippet", snippetId, pdfId: null, anchorX, anchorY },
                                    mouseX, mouseY
                                );
                            } : null}
                        />
                    ))}
                </div>
            </InfiniteCanvas>

            {
                showWorkspaceSidebar && (
                    <Suspense fallback={null}>
                        <WorkspaceSidebar />
                    </Suspense>
                )
            }

            {selectedItems.length >= 2 && (
                <div
                    onPointerDown={e => e.stopPropagation()}
                    onMouseDown={e => e.stopPropagation()}
                    style={{
                    position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
                    background: 'white', padding: '6px 14px', borderRadius: 20,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center',
                    gap: 10, zIndex: 200, border: '1px solid #eee',
                }}>
                    <span style={{ fontSize: 12, color: '#666' }}>{selectedItems.length} items selected</span>
                    <button
                        onClick={() => {
                            const itemIds = selectedItems.map(i => i.id);
                            handleCreateGroup(itemIds);
                            setSelectedItems([]);
                        }}
                        style={{
                            background: '#007bff', color: 'white', border: 'none',
                            borderRadius: 12, padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        }}
                    >
                        Group
                    </button>
                    <button
                        onClick={() => setSelectedItems([])}
                        style={{
                            background: 'transparent', border: '1px solid #ddd',
                            borderRadius: 12, padding: '4px 10px', cursor: 'pointer', fontSize: 12,
                        }}
                    >
                        Clear
                    </button>
                </div>
            )}
        </div>
    );
};

export default Workspace;
