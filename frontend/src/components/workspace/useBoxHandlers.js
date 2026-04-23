//this file is used for create a editable box in workspace
import { useRef, useState } from "react";

export default function useBoxHandlers({ tool, TOOL_MODES, setEditableBoxes, screenToWorld, recordHistory, getSnapshot }) {
  const dragStart = useRef(null);
  const isDragging = useRef(false);
  const [drawingBox, setDrawingBox] = useState(null);
  const workspaceRef = useRef();

  // 🔧 Extract correct clientX/Y from mouse or touch
  const getClientPos = (e) => {
    if (e.touches && e.touches.length > 0) {
      const touch = e.touches[0];
      return { clientX: touch.clientX, clientY: touch.clientY };
    }
    if (e.changedTouches && e.changedTouches.length > 0) {
      const touch = e.changedTouches[0];
      return { clientX: touch.clientX, clientY: touch.clientY };
    }
    return { clientX: e.clientX, clientY: e.clientY };
  };

  const handlePointerDown = (e) => {
    if (tool !== TOOL_MODES.ADD_BOX) return;

    const { clientX, clientY } = getClientPos(e);

    // Convert screen coordinates to world coordinates
    const worldPos = screenToWorld(clientX, clientY);

    dragStart.current = { x: worldPos.x, y: worldPos.y };
    isDragging.current = true;
    setDrawingBox(null);

    // Only prevent default for touchstart to stop scrolling
    if (e.type && e.type.startsWith("touch")) e.preventDefault();
  };

  const handlePointerMove = (e) => {
    if (!isDragging.current || tool !== TOOL_MODES.ADD_BOX) return;

    const { clientX, clientY } = getClientPos(e);

    // Convert current screen pos to world pos
    const worldPos = screenToWorld(clientX, clientY);

    const dx = worldPos.x - dragStart.current.x;
    const dy = worldPos.y - dragStart.current.y;

    if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;

    setDrawingBox({
      x: dragStart.current.x,
      y: dragStart.current.y,
      width: dx,
      height: dy,
    });

    // Only prevent default for touchmove to avoid scroll
    if (e.type && e.type.startsWith("touch")) e.preventDefault();
  };

  const handlePointerUp = (e) => {
    if (!isDragging.current || tool !== TOOL_MODES.ADD_BOX) return;

    isDragging.current = false;

    if (!drawingBox) return;

    if (Math.abs(drawingBox.width) < 10 || Math.abs(drawingBox.height) < 10) {
      setDrawingBox(null);
      return;
    }

    const normalized = {
      x: drawingBox.width < 0 ? drawingBox.x + drawingBox.width : drawingBox.x,
      y: drawingBox.height < 0 ? drawingBox.y + drawingBox.height : drawingBox.y,
      width: Math.abs(drawingBox.width),
      height: Math.abs(drawingBox.height),
    };

    const newBox = {
      id: `box-${Date.now()}`,
      type: 'box',
      ...normalized,
      text: "",
    };

    if (recordHistory && getSnapshot) recordHistory(getSnapshot());
    setEditableBoxes((prev) => [...prev, newBox]);
    setDrawingBox(null);
  };

  return {
    workspaceRef,
    drawingBox,
    handleMouseDown: handlePointerDown,
    handleMouseMove: handlePointerMove,
    handleMouseUp: handlePointerUp,
    handleTouchStart: handlePointerDown,
    handleTouchMove: handlePointerMove,
    handleTouchEnd: handlePointerUp,
  };
}
