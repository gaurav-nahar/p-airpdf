import { useCanvasStable } from "./InfiniteCanvas"; // stable: no re-render on pan/zoom
import React, { useState, useCallback, memo, useRef, useEffect } from "react";
import ItemContextMenu from "./ItemContextMenu";
import RichTextToolbar from "./RichTextToolbar";
import { toRichTextHtml } from "./richTextUtils";
const SingleBox = memo(({
  box,
  onDrag,
  onResize,
  onChange,
  onContextMenu,
  onBoxClick, // handleNoteClick in useConnections.js
  isSelected,
  isSelectedForConn,
  hasConnection,
  isMultiSelected = false,
  onMultiSelect,
  onDelete
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showSizeMenu, setShowSizeMenu] = useState(false);
  const boxRef = useRef();
  const textareaRef = useRef();
  const isEditingRef = useRef(false);

  // Keep ref in sync for use in effects that shouldn't re-run on isEditing change
  useEffect(() => { isEditingRef.current = isEditing; }, [isEditing]);

  // Sync box.text → innerHTML when content changes externally (load/undo) but not while user is typing
  useEffect(() => {
    if (textareaRef.current && !isEditingRef.current) {
      textareaRef.current.innerHTML = toRichTextHtml(box.text || "");
    }
  }, [box.text]);

  // Block wheel events from reaching InfiniteCanvas's native listener
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const stop = (e) => e.stopPropagation();
    el.addEventListener('wheel', stop, { passive: false });
    return () => el.removeEventListener('wheel', stop);
  }, []);
  const pos = useRef({ x: 0, y: 0 });
  const pressTimer = useRef(null); // Timer for long press
  const isMoved = useRef(false); // Track if user is dragging
  const startPos = useRef({ x: 0, y: 0 }); // Track starting position for movement threshold
  const { getScale } = useCanvasStable();


   const handleDoubleClick = (e) => {
    e.stopPropagation();
    if (!isEditing) {
      setIsEditing(true);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };
  // 🖱️✏️📱 Unified pointer handler (mouse + touch + pen/stylus)
  const handlePressStart = (e) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      e.stopPropagation();
      onMultiSelect?.(box.id);
      return;
    }
    e.stopPropagation();

    pos.current = { x: e.clientX, y: e.clientY };
    startPos.current = { x: e.clientX, y: e.clientY };
    isMoved.current = false;

    // Capture pointer → guaranteed move/up events for fast pen strokes
    boxRef.current.setPointerCapture(e.pointerId);

    if (!isEditing) {
      pressTimer.current = setTimeout(() => {
        if (!isMoved.current) {
          onContextMenu(e, box.id);
          pressTimer.current = null;
        }
      }, 500);
    }

    const el = boxRef.current;
    const onMove = (moveEvent) => {
      moveEvent.stopPropagation();
      moveEvent.preventDefault();

      const dist = Math.sqrt(
        Math.pow(moveEvent.clientX - startPos.current.x, 2) +
        Math.pow(moveEvent.clientY - startPos.current.y, 2)
      );
      if (dist > 5) {
        isMoved.current = true;
        if (pressTimer.current) {
          clearTimeout(pressTimer.current);
          pressTimer.current = null;
        }
      }

      if (isMoved.current && !isEditingRef.current) {
        const scale = getScale();
        const dx = (moveEvent.clientX - pos.current.x) / scale;
        const dy = (moveEvent.clientY - pos.current.y) / scale;
        pos.current = { x: moveEvent.clientX, y: moveEvent.clientY };
        onDrag(box.id, dx, dy);
      }
    };

    const onUp = () => {
      if (pressTimer.current) {
        clearTimeout(pressTimer.current);
        pressTimer.current = null;
        if (!isMoved.current && !isEditingRef.current) {
          onBoxClick?.(box);
        }
      }
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
  };

  // 📐 Resize — pointer capture so pen never loses the handle mid-drag
  const startResize = (e) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = box.width || 160;
    const startHeight = box.height || 80;
    const scale = getScale();

    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);

    const doResize = (moveEvent) => {
      const deltaX = (moveEvent.clientX - startX) / scale;
      const deltaY = (moveEvent.clientY - startY) / scale;
      onResize(box.id, Math.max(50, startWidth + deltaX), Math.max(50, startHeight + deltaY));
    };
    const stopResize = () => {
      el.removeEventListener("pointermove", doResize);
      el.removeEventListener("pointerup", stopResize);
      el.removeEventListener("pointercancel", stopResize);
    };
    el.addEventListener("pointermove", doResize);
    el.addEventListener("pointerup", stopResize);
    el.addEventListener("pointercancel", stopResize);
  };

  return (
    <div
      ref={boxRef}
      id={`workspace-item-${box.id}`}
      onPointerDown={handlePressStart}
      onDoubleClick={handleDoubleClick}
      onClick={(e) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
          e.stopPropagation();
          onMultiSelect?.(box.id);
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e, box.id);
      }}
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.width || 160,
        height: box.height || 80,
        zIndex: (isSelected || isSelectedForConn) ? 20 : 10,
        border: isMultiSelected
          ? "2px solid #fd7e14"
          : (isSelectedForConn
              ? "3px solid #007bff"
              : isSelected
                  ? "2px solid #007bff"
                  : "1px solid #ccc"),
        borderRadius: 8,
        background: isMultiSelected ? "#fff3cd" : (isSelectedForConn ? "#f0f7ff" : "white"),
        boxShadow: (isSelectedForConn || isSelected)
          ? "0 4px 12px rgba(0,0,0,0.2)"
          : "0 2px 6px rgba(0,0,0,0.15)",
        cursor: isEditing ? "default" : "move",
        userSelect: "none",
        touchAction: "none",
        overflow: "visible",
      }}
      onWheel={(e) => e.stopPropagation()}

    >
      {/* ❌ Delete Button — corner badge outside the box */}
      {(isSelected || isMultiSelected) && !isEditing && (
        <div
          onPointerDown={e => { e.stopPropagation(); e.preventDefault(); }}
          onPointerUp={e => { e.stopPropagation(); onDelete?.(box.id); }}
          title="Delete"
          style={{
            position: "absolute", top: -9, right: -9,
            width: 20, height: 20, borderRadius: "50%",
            background: "#ff4d4f", color: "white",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 700, cursor: "pointer",
            zIndex: 60, boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
            lineHeight: 1, userSelect: "none",
          }}
        >
          ×
        </div>
      )}

      <div style={{
        position: "absolute",
        top: -10,
        right: -10,
        display: hasConnection ? "flex" : "none",
        background: "#007bff",
        color: "white",
        borderRadius: "50%",
        width: 20,
        height: 20,
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10,
        zIndex: 30,
        boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
        cursor: "pointer",
        pointerEvents: "auto"
      }}
      onPointerDown={e => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); onBoxClick?.(box); }}>
        🔗
      </div>

      {/* Formatting toolbar — visible when editing */}
      {isEditing && (
        <RichTextToolbar
          editorRef={textareaRef}
          showSizeMenu={showSizeMenu}
          setShowSizeMenu={setShowSizeMenu}
        />
      )}

      {/* Inner clip wrapper — clips content to box bounds */}
      <div style={{
        position: "absolute", inset: 0,
        borderRadius: 8, overflow: "hidden",
        pointerEvents: "none",
      }}>
        <div
          ref={textareaRef}
          id={`text-box-input-${box.id}`}
          className="workspace-rich-text"
          contentEditable={isEditing}
          suppressContentEditableWarning
          dir="auto"
          onFocus={() => setIsEditing(true)}
          onBlur={() => { setIsEditing(false); setShowSizeMenu(false); }}
          onInput={(e) => onChange(box.id, e.currentTarget.innerHTML)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.currentTarget.blur();
            }
            e.stopPropagation();
          }}
          onPointerDown={(e) => isEditing && e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            outline: "none",
            fontSize: "14px",
            background: "transparent",
            padding: 6,
            overflowY: "auto",
            overflowX: "hidden",
            cursor: isEditing ? "text" : "move",
            pointerEvents: "auto",
            scrollbarWidth: "thin",
            scrollbarColor: "#ccc transparent",
            boxSizing: "border-box",
            wordBreak: "break-word",
            whiteSpace: "pre-wrap",
            lineHeight: 1.5,
          }}
        />
      </div>

      {/* Resize handle */}
      <div
        onPointerDown={startResize}
        style={{
          position: "absolute",
          bottom: 0,
          right: 0,
          width: 15,
          height: 15,
          cursor: "nwse-resize",
          background: "rgba(0,0,0,0.1)",
          borderBottomRightRadius: 8,
          clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
          touchAction: "none",
        }}
      />
    </div>
  );
});

const EditableTextBoxes = memo(({
  editableBoxes,
  onDeleteBox, // handleDeleteBox in App.js
  onBoxClick, // handleNoteClick in useConnections.js
  activeConnectionId,
  selectedBoxId: propSelectedBoxId, // From App.js
  onLinkToSelection, // handleLinkBoxToSelection in App.js
  connections = [],
  setEditableBoxes, // state update in App.js
  multiSelectedIds = [],
  onMultiSelect,
  onBoxDrag
}) => {
  const [contextMenu, setContextMenu] = useState(null);
  const [localSelectedBoxId, setLocalSelectedBoxId] = useState(null);

  const selectedBoxId = propSelectedBoxId || localSelectedBoxId;

  const handleContextMenu = useCallback((e, id) => {
    e.preventDefault();
    e.stopPropagation();
    setLocalSelectedBoxId(id);
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleCopy = useCallback(() => {
    const box = editableBoxes.find((b) => b.id === selectedBoxId);
    if (box) localStorage.setItem("globalClipboard", JSON.stringify({ ...box, itemType: 'box' }));
    setContextMenu(null);
  }, [editableBoxes, selectedBoxId]);

  const handleCut = useCallback(() => {
    const box = editableBoxes.find((b) => b.id === selectedBoxId);
    if (box) {
      localStorage.setItem("globalClipboard", JSON.stringify({ ...box, itemType: 'box' }));
      onDeleteBox(selectedBoxId); // call handleDeleteBox in App.js
    }
    setContextMenu(null);
  }, [selectedBoxId, editableBoxes, onDeleteBox]);

  const handleDelete = useCallback(() => {
    if (selectedBoxId) {
      onDeleteBox(selectedBoxId); // call handleDeleteBox in App.js
    }
    setContextMenu(null);
  }, [selectedBoxId, onDeleteBox]);

  const handlePaste = useCallback(() => {
    const data = localStorage.getItem("globalClipboard");
    if (data) {
      const item = JSON.parse(data);
      const id = `pasted-${Date.now()}`;
      const newItem = {
        ...item,
        id,
        x: (item.x || 100) + 30,
        y: (item.y || 100) + 30,
      };
      setEditableBoxes((prev) => [...prev, newItem]); // updates state in App.js
    }
    setContextMenu(null);
  }, [setEditableBoxes]);

  const handleChange = useCallback((id, text) => {
    setEditableBoxes((prev) => // updates state in App.js
      prev.map((b) => (b.id === id ? { ...b, text } : b))
    );
  }, [setEditableBoxes]);

  const handleDrag = useCallback((id, dx, dy) => {
    if (onBoxDrag) {
      onBoxDrag(id, dx, dy);
    } else {
      setEditableBoxes((prev) =>
        prev.map((b) => (b.id === id ? { ...b, x: b.x + dx, y: b.y + dy } : b))
      );
    }
  }, [setEditableBoxes, onBoxDrag]);

  const handleResize = useCallback((id, width, height) => {
    setEditableBoxes((prev) => // updates state in App.js
      prev.map((b) => (b.id === id ? { ...b, width, height } : b))
    );
  }, [setEditableBoxes]);

  const contextActions = [
    { label: 'Copy', icon: '📋', onClick: handleCopy },
    { label: 'Cut', icon: '✂️', onClick: handleCut },
    { label: 'Paste', icon: '📥', onClick: handlePaste },
    {
      label: 'Link to PDF Selection',
      icon: '🔗',
      onClick: () => onLinkToSelection(selectedBoxId)
    },
    { label: 'Delete', icon: '🗑', onClick: handleDelete, danger: true },
  ];


  return (
    <>
      {editableBoxes.map((b) => (
        <SingleBox
          key={b.id}
          box={b}
          onDrag={handleDrag}
          onResize={handleResize}
          onChange={handleChange}
          onContextMenu={handleContextMenu}
          onBoxClick={onBoxClick}
          isSelected={selectedBoxId === b.id}
          isSelectedForConn={String(activeConnectionId) === String(b.id)}
          hasConnection={connections.some(c => String(c.from) === String(b.id) || String(c.to) === String(b.id))}
          isMultiSelected={multiSelectedIds.includes(String(b.id))}
          onMultiSelect={onMultiSelect}
          onDelete={onDeleteBox}
        />
      ))}

      {contextMenu && (
        <ItemContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={contextActions}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
});

export default EditableTextBoxes;
