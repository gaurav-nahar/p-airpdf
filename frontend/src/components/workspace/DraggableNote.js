import React, { useRef, useState, useEffect, memo } from "react";
import { motion } from "framer-motion";
import { useCanvasStable } from "./InfiniteCanvas";
import ItemContextMenu from "./ItemContextMenu";
import RichTextToolbar from "./RichTextToolbar";
import { isRichTextEmpty, toRichTextHtml } from "./richTextUtils";

/**
 * 🗒️ DraggableNote (Workspace Snippets)
 * ...
 */
const NOTE_COLORS = ['#ffffff', '#FFF9C4', '#DCEDC8', '#B3E5FC', '#F8BBD9', '#E1BEE7', '#FFE0B2'];

const DraggableNote = memo(({
  snippet,
  onClick,
  onDrag,
  selected,
  onDoubleClick,
  disableDrag = false,
  multiSelected = false,
  onColorChange,
  sourcePdfColor = null,   // color of the source PDF tab (e.g. "#3b82f6")
  sourcePdfName = null,    // name of the source PDF for badge
  onStartWire = null,      // (snippetId, clientX, clientY) => void — starts a drag wire
}) => {
  const noteRef = useRef();
  const pos = useRef({ x: 0, y: 0 });
  const { getScale } = useCanvasStable();

  const [contextMenu, setContextMenu] = useState(null);

  // 🎯 DRAG LOGIC — unified pointer handler (mouse + touch + pen/stylus)
  const handlePointerDown = (e) => {
    if (disableDrag) { e.stopPropagation(); return; }
    if (isEditingRef.current) { e.stopPropagation(); return; }
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey || e.shiftKey) return;

    onDrag?.(null, null, "drag-start");
    pos.current = { x: e.clientX, y: e.clientY };

    // Capture pointer → receive all move/up events even during fast pen strokes
    noteRef.current.setPointerCapture(e.pointerId);

    const el = noteRef.current;
    const onMove = (moveEvent) => {
      const scale = getScale ? getScale() : 1;
      const dx = (moveEvent.clientX - pos.current.x) / scale;
      const dy = (moveEvent.clientY - pos.current.y) / scale;
      pos.current = { x: moveEvent.clientX, y: moveEvent.clientY };
      onDrag?.(dx, dy);
    };
    const onUp = () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
  };

  // ✅ Handle right-click (open context menu)
  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  // ✅ Handle copy / cut / delete actions
  const handleCopy = () => {
    localStorage.setItem("globalClipboard", JSON.stringify({ ...snippet, itemType: 'snippet' }));
    setContextMenu(null);
  };

  const handleCut = () => {
    localStorage.setItem("globalClipboard", JSON.stringify({ ...snippet, itemType: 'snippet' }));
    onDrag?.(null, null, "cut", snippet.id); // invokes handleDeleteSnippet in App.js
    setContextMenu(null);
  };

  const handleDelete = () => {
    onDrag?.(null, null, "delete", snippet.id);
    setContextMenu(null);
  };

  const handlePaste = () => {
    const data = localStorage.getItem("globalClipboard");
    if (data) {
      const item = JSON.parse(data);
      const id = `pasted-${Date.now()}`;
      const newItem = {
        ...item,
        id,
        x: snippet.x + 30,
        y: snippet.y + 30,
      };
      onDrag?.(null, null, "paste", newItem);
    }
    setContextMenu(null);
  };

  const contextActions = [
    { label: 'Copy', icon: '📋', onClick: handleCopy },
    { label: 'Cut', icon: '✂️', onClick: handleCut },
    { label: 'Paste', icon: '📥', onClick: handlePaste },
    { label: 'Delete', icon: '🗑', onClick: handleDelete, danger: true },
  ];



  // ✅ Determine image src: Handles both normal URLs and base64 text from the database.
  const imgSrc =
    snippet.src ||
    (snippet.file_data ? `data:image/png;base64,${snippet.file_data}` : null);
  const isImageSnippet = snippet.type === "image" && Boolean(imgSrc);

  // 📐 RESIZE LOGIC: pointer capture so pen never loses the handle mid-drag
  const handleResizePointerDown = (e) => {
    e.stopPropagation();
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const rect = noteRef.current.getBoundingClientRect();
    const startWidth = rect.width;
    const startHeight = rect.height;

    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    onDrag?.(null, null, "resize-start");

    const doResize = (moveEvent) => {
      const scale = getScale() || 1;
      const rawWidth = Math.max(50, startWidth + (moveEvent.clientX - startX)) / scale;
      const rawHeight = Math.max(50, startHeight + (moveEvent.clientY - startY)) / scale;
      let newWidth = rawWidth;
      let newHeight = rawHeight;

      if (isImageSnippet) {
        const aspectRatio = Math.max(0.01, startWidth / Math.max(startHeight, 1));
        const widthDrivenHeight = newWidth / aspectRatio;
        const heightDrivenWidth = newHeight * aspectRatio;
        const widthChange = Math.abs(newWidth - startWidth / scale);
        const heightChange = Math.abs(newHeight - startHeight / scale);

        if (widthChange >= heightChange) {
          newHeight = Math.max(50, widthDrivenHeight);
        } else {
          newWidth = Math.max(50, heightDrivenWidth);
        }
      }

      onDrag?.(null, null, "resize", { id: snippet.id, width: newWidth, height: newHeight });
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

  // ✅ Hover state for better UX
  const [isEditing, setIsEditing] = useState(false);
  const [tempText, setTempText] = useState(snippet.text || "");
  const [showSizeMenu, setShowSizeMenu] = useState(false);
  const editorRef = useRef(null);
  const isEditingRef = useRef(false);
  const tempTextRef = useRef(snippet.text || "");

  // Update tempText if snippet text changes from outside
  useEffect(() => {
    setTempText(snippet.text || "");
  }, [snippet.text]);

  useEffect(() => {
    tempTextRef.current = tempText;
  }, [tempText]);

  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  useEffect(() => {
    if (editorRef.current && !isEditingRef.current) {
      editorRef.current.innerHTML = toRichTextHtml(snippet.text || "");
    }
  }, [snippet.text]);

  useEffect(() => {
    if (isEditing && editorRef.current) {
      editorRef.current.innerHTML = toRichTextHtml(tempTextRef.current || "");
    }
  }, [isEditing]);

  const handleSave = () => {
    setIsEditing(false);
    setShowSizeMenu(false);
    const nextText = editorRef.current?.innerHTML ?? tempText;
    if (nextText !== snippet.text) {
      setTempText(nextText);
      onDrag?.(null, null, "edit", { id: snippet.id, text: nextText });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      const resetValue = toRichTextHtml(snippet.text || "");
      if (editorRef.current) editorRef.current.innerHTML = resetValue;
      setTempText(snippet.text || "");
      setIsEditing(false);
      setShowSizeMenu(false);
      e.stopPropagation();
      return;
    }
    // Let Ctrl/Cmd shortcuts (Ctrl+Z, Ctrl+S, Ctrl+A etc.) pass through to window
    if (e.ctrlKey || e.metaKey) return;
    // Block arrow keys and other keys from triggering canvas shortcuts
    e.stopPropagation();
  };

  return (
    <>
      <motion.div
        ref={noteRef}
        id={`workspace-item-${snippet.id}`}
        onPointerDown={handlePointerDown}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(e);
        }}
        onContextMenu={handleContextMenu}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (snippet.type === "text" || !snippet.type) {
            setIsEditing(true);
            setTimeout(() => editorRef.current?.focus(), 50);
          }
        }}
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        style={{
          position: "absolute",
          left: snippet.x,
          top: snippet.y,
          background: multiSelected ? "#fff3cd" : (snippet.bg_color || (selected ? "#d0e7ff" : "white")),
          borderRadius: "10px",
          padding: isImageSnippet ? 0 : "0.8rem",
          width: snippet.width || 180,
          height: snippet.height || "auto",
          boxShadow: selected ? "0 4px 12px rgba(0,0,0,0.2)" : "0 2px 6px rgba(0,0,0,0.15)",
          borderLeft: multiSelected
            ? "4px solid #fd7e14"
            : sourcePdfColor
              ? `4px solid ${sourcePdfColor}`
              : (snippet.type === "text" || !snippet.type
                  ? "4px solid #007bff"
                  : "4px solid #28a745"),
          cursor: disableDrag ? "default" : (isEditing ? "text" : "move"),
          zIndex: selected ? 20 : 10,
          userSelect: isEditing ? "text" : "none",
          touchAction: "none",
          paddingBottom: isImageSnippet ? 0 : "20px", // Extra space for handle
          paddingRight: isImageSnippet ? 0 : "15px",  // Extra space for handle
          transition: "box-shadow 0.2s, background 0.2s",
          outline: multiSelected ? "2px solid #fd7e14" : "none",
          outlineOffset: "1px",
          minHeight: "40px",
          display: "flex",
          flexDirection: "column",
          overflow: "visible",
        }}
      >
        {isEditing && (snippet.type === "text" || !snippet.type) && (
          <RichTextToolbar
            editorRef={editorRef}
            showSizeMenu={showSizeMenu}
            setShowSizeMenu={setShowSizeMenu}
          />
        )}

        {isEditing ? (
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            dir="auto"
            onFocus={() => setIsEditing(true)}
            onBlur={handleSave}
            onInput={(e) => setTempText(e.currentTarget.innerHTML)}
            onKeyDown={handleKeyDown}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              outline: "none",
              background: "transparent",
              color: "inherit",
              padding: 0,
              margin: 0,
              flexGrow: 1,
              boxSizing: "border-box",
              overflowY: "auto",
              overflowX: "hidden",
              wordBreak: "break-word",
              whiteSpace: "pre-wrap",
              lineHeight: 1.5,
              cursor: "text",
            }}
          />
        ) : snippet.type === "text" || snippet.text || !snippet.type ? (
          isRichTextEmpty(tempText) ? (
            <p style={{ margin: 0, color: "#aaa", fontStyle: "italic" }}>
              Double-click to edit...
            </p>
          ) : (
            <div
              className="workspace-rich-text"
              dir="auto"
              style={{ margin: 0, lineHeight: 1.5, wordBreak: "break-word" }}
              dangerouslySetInnerHTML={{ __html: toRichTextHtml(tempText) }}
            />
          )
        ) : isImageSnippet ? (
          <img
            src={imgSrc}
            alt="snippet"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              pointerEvents: "none",
            }}
          />
        ) : (
          <p style={{ margin: 0, color: "#888" }}>Empty</p>
        )}

        {/* 📄 Source PDF badge — shown on hover when snippet came from a specific PDF */}
        {sourcePdfColor && sourcePdfName && selected && (
          <div
            style={{
              position: "absolute", bottom: 22, right: 4,
              background: sourcePdfColor, color: "white",
              fontSize: 9, fontWeight: 700, padding: "2px 6px",
              borderRadius: 8, opacity: 0.9, pointerEvents: "none",
              maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >{sourcePdfName}</div>
        )}

        {/* 🗑 Delete Button */}
        {selected && (
          <div
            onPointerDown={e => { e.stopPropagation(); e.preventDefault(); }}
            onPointerUp={e => { e.stopPropagation(); onDrag?.(null, null, "delete", snippet.id); }}
            title="Delete"
            style={{
              position: "absolute",
              top: -10,
              right: -10,
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: "#fff",
              color: "#9ca3af",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              cursor: "pointer",
              zIndex: 40,
              boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
              userSelect: "none",
              border: "1.5px solid #d1d5db",
            }}
            onMouseEnter={e => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.borderColor = "#ef4444"; e.currentTarget.style.background = "#fff5f5"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "#9ca3af"; e.currentTarget.style.borderColor = "#d1d5db"; e.currentTarget.style.background = "#fff"; }}
          >
            <i className="bi bi-trash3-fill" />
          </div>
        )}

        {/* 🎨 Color Picker — shows when selected */}
        {selected && onColorChange && (
          <div
            onPointerDown={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
            style={{
              position: "absolute",
              bottom: -32,
              left: 0,
              display: "flex",
              gap: 5,
              background: "white",
              padding: "4px 6px",
              borderRadius: 20,
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              zIndex: 50,
              border: "1px solid #eee",
            }}
          >
            {NOTE_COLORS.map(c => (
              <div
                key={c}
                title={c === '#ffffff' ? 'White' : c}
                onClick={e => { e.stopPropagation(); onColorChange(c); }}
                style={{
                  width: 16, height: 16, borderRadius: "50%",
                  background: c,
                  border: snippet.bg_color === c ? "2px solid #333" : "1px solid #ccc",
                  cursor: "pointer",
                  transition: "transform 0.15s",
                  transform: snippet.bg_color === c ? "scale(1.25)" : "scale(1)",
                }}
              />
            ))}
          </div>
        )}

        {/* 📐 Resize Handle */}
        {!disableDrag && selected && (
          <div
            onPointerDown={handleResizePointerDown}
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: "20px",
              height: "20px",
              cursor: "nwse-resize",
              background: "#666",
              borderTopLeftRadius: "50%",
              borderBottomRightRadius: "10px",
              zIndex: 30,
            }}
            title="Resize"
          />
        )}

        {/* Wire drag handle — drag from here to connect to another note or PDF */}
        {onStartWire && selected && (
          <div
            title="Drag to connect"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              const rect = noteRef.current?.getBoundingClientRect();
              const cx = rect ? rect.left + rect.width / 2 : e.clientX;
              const cy = rect ? rect.top + rect.height / 2 : e.clientY;
              onStartWire(snippet.id, cx, cy, e.clientX, e.clientY);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            style={{
              position: "absolute",
              top: "50%",
              right: -14,
              transform: "translateY(-50%)",
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: sourcePdfColor || "#6366f1",
              border: "2px solid white",
              boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
              cursor: "crosshair",
              zIndex: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              color: "white",
              fontWeight: 700,
              userSelect: "none",
            }}
          >
            +
          </div>
        )}
      </motion.div>

      {/* ✅ Context Menu */}
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

export default DraggableNote;
