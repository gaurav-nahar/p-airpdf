import React, { useEffect, useState } from "react";

const TOOLBAR_SEPARATOR_STYLE = {
  width: 1,
  height: 18,
  background: "rgba(255,255,255,0.15)",
  margin: "0 4px",
};

const TOOLBAR_BUTTON_STYLE = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  color: "rgba(255,255,255,0.9)",
  padding: "4px 8px",
  borderRadius: 5,
  display: "flex",
  alignItems: "center",
};

const BLOCK_TAGS = new Set([
  "P",
  "DIV",
  "LI",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "BLOCKQUOTE",
  "PRE",
]);

const focusEditor = (editorRef) => {
  editorRef.current?.focus();
};

const runCommand = (editorRef, command, value = null) => {
  focusEditor(editorRef);
  document.execCommand(command, false, value);
};

const applyFontSize = (editorRef, sizePx) => {
  focusEditor(editorRef);
  document.execCommand("fontSize", false, "7");
  editorRef.current?.querySelectorAll('[size="7"]').forEach((el) => {
    el.removeAttribute("size");
    el.style.fontSize = `${sizePx}px`;
  });
};

const getBlockAncestor = (node, editorElement) => {
  let current =
    node?.nodeType === Node.TEXT_NODE
      ? node.parentElement
      : node;

  while (current && current !== editorElement) {
    if (current.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has(current.tagName)) {
      return current;
    }
    current = current.parentElement;
  }

  return editorElement;
};

const getAlignmentValue = (node) => {
  const value = node?.style?.textAlign || window.getComputedStyle(node).textAlign;
  if (value === "center" || value === "right" || value === "justify") return value;
  return "left";
};

const getSelectedBlocks = (editorElement, selection) => {
  if (!editorElement || !selection?.rangeCount) return [];

  const range = selection.getRangeAt(0);
  if (!editorElement.contains(range.commonAncestorContainer)) return [];

  if (range.collapsed) {
    return [getBlockAncestor(range.startContainer, editorElement)];
  }

  const blocks = [];
  const seen = new Set();
  const treeWalker = document.createTreeWalker(
    editorElement,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node) {
        if (!BLOCK_TAGS.has(node.tagName)) return NodeFilter.FILTER_SKIP;
        try {
          return range.intersectsNode(node)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP;
        } catch {
          return NodeFilter.FILTER_SKIP;
        }
      },
    }
  );

  let currentNode = treeWalker.nextNode();
  while (currentNode) {
    const parentBlock = getBlockAncestor(currentNode.parentNode, editorElement);
    if (parentBlock && parentBlock !== editorElement && seen.has(parentBlock)) {
      currentNode = treeWalker.nextNode();
      continue;
    }

    if (!seen.has(currentNode)) {
      seen.add(currentNode);
      blocks.push(currentNode);
    }
    currentNode = treeWalker.nextNode();
  }

  if (blocks.length === 0) {
    return [getBlockAncestor(range.commonAncestorContainer, editorElement)];
  }

  return blocks;
};

const applyAlignment = (editorRef, align) => {
  focusEditor(editorRef);
  const editorElement = editorRef.current;
  const selection = window.getSelection();
  if (!editorElement || !selection?.rangeCount) return;

  const blocks = getSelectedBlocks(editorElement, selection);
  blocks.forEach((block) => {
    if (block && block !== editorElement) {
      block.style.textAlign = align;
    }
  });
};

const getActiveAlignment = (editorRef) => {
  const editorElement = editorRef.current;
  const selection = window.getSelection();
  if (!editorElement || !selection?.rangeCount) return "left";

  const blocks = getSelectedBlocks(editorElement, selection);
  const firstBlock = blocks[0];
  if (!firstBlock) return "left";
  return getAlignmentValue(firstBlock);
};

const RichTextToolbar = ({
  editorRef,
  showSizeMenu,
  setShowSizeMenu,
  top = -46,
}) => {
  const [activeAlign, setActiveAlign] = useState("left");

  useEffect(() => {
    const refreshAlignment = () => {
      const editorElement = editorRef.current;
      if (!editorElement) return;
      const selection = window.getSelection();
      if (!selection?.anchorNode || !editorElement.contains(selection.anchorNode)) return;
      setActiveAlign(getActiveAlignment(editorRef));
    };

    document.addEventListener("selectionchange", refreshAlignment);
    return () => document.removeEventListener("selectionchange", refreshAlignment);
  }, [editorRef]);

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        top,
        left: 0,
        display: "flex",
        alignItems: "center",
        gap: 1,
        padding: "5px 10px",
        background: "rgba(22,22,26,0.95)",
        borderRadius: 10,
        zIndex: 100,
        whiteSpace: "nowrap",
        boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
        minWidth: "max-content",
      }}
    >
    <div style={{ position: "relative" }}>
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowSizeMenu((value) => !value);
        }}
        title="Font size"
        style={{
          background: "rgba(255,255,255,0.1)",
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: 5,
          color: "rgba(255,255,255,0.9)",
          fontSize: 11,
          fontWeight: 600,
          padding: "3px 7px",
          cursor: "pointer",
          lineHeight: 1.4,
          minWidth: 36,
        }}
      >
        px
      </button>

      {showSizeMenu && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: "calc(100% + 5px)",
            left: 0,
            background: "rgba(22,22,26,0.98)",
            borderRadius: 8,
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 2,
            padding: 6,
            zIndex: 200,
            minWidth: 80,
          }}
        >
          {[10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 36].map((size) => (
            <button
              key={size}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                applyFontSize(editorRef, size);
                setShowSizeMenu(false);
              }}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "rgba(255,255,255,0.85)",
                padding: "4px 6px",
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 500,
                textAlign: "center",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              {size}
            </button>
          ))}
        </div>
      )}
    </div>

    <div style={TOOLBAR_SEPARATOR_STYLE} />

    {[
      { cmd: "bold", label: "B", style: { fontWeight: 800, fontSize: 14 } },
      { cmd: "italic", label: "I", style: { fontStyle: "italic", fontSize: 14 } },
      { cmd: "underline", label: "U", style: { textDecoration: "underline", fontSize: 14 } },
    ].map(({ cmd, label, style }) => (
      <button
        key={cmd}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          runCommand(editorRef, cmd);
        }}
        title={cmd.charAt(0).toUpperCase() + cmd.slice(1)}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "rgba(255,255,255,0.9)",
          padding: "4px 9px",
          borderRadius: 5,
          lineHeight: 1.4,
          ...style,
        }}
      >
        {label}
      </button>
    ))}

    <div style={TOOLBAR_SEPARATOR_STYLE} />

    {[
      {
        cmd: "insertOrderedList",
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="10" y1="6" x2="21" y2="6" />
            <line x1="10" y1="12" x2="21" y2="12" />
            <line x1="10" y1="18" x2="21" y2="18" />
            <path d="M4 6h1v4" />
            <path d="M4 10H6" />
            <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1.5" />
          </svg>
        ),
        title: "Numbered list",
      },
      {
        cmd: "insertUnorderedList",
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="9" y1="6" x2="20" y2="6" />
            <line x1="9" y1="12" x2="20" y2="12" />
            <line x1="9" y1="18" x2="20" y2="18" />
            <circle cx="4" cy="6" r="1" fill="currentColor" />
            <circle cx="4" cy="12" r="1" fill="currentColor" />
            <circle cx="4" cy="18" r="1" fill="currentColor" />
          </svg>
        ),
        title: "Bullet list",
      },
    ].map(({ cmd, icon, title }) => (
      <button
        key={cmd}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          runCommand(editorRef, cmd);
        }}
        title={title}
        style={TOOLBAR_BUTTON_STYLE}
      >
        {icon}
      </button>
    ))}

    <div style={TOOLBAR_SEPARATOR_STYLE} />

      {[
      {
        align: "left",
        command: "justifyLeft",
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="15" y2="12" />
            <line x1="3" y1="18" x2="18" y2="18" />
          </svg>
        ),
        title: "Align left",
      },
      {
        align: "center",
        command: "justifyCenter",
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="6" y1="12" x2="18" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        ),
        title: "Align center",
      },
      {
        align: "right",
        command: "justifyRight",
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="9" y1="12" x2="21" y2="12" />
            <line x1="6" y1="18" x2="21" y2="18" />
          </svg>
        ),
        title: "Align right",
      },
      ].map(({ align, command, icon, title }) => (
      <button
        key={align}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          applyAlignment(editorRef, command === "justifyLeft" ? "left" : command === "justifyCenter" ? "center" : "right");
          setActiveAlign(align);
        }}
        title={title}
        style={{
          ...TOOLBAR_BUTTON_STYLE,
          background: activeAlign === align ? "rgba(255,255,255,0.15)" : "transparent",
        }}
      >
        {icon}
      </button>
    ))}

    <div style={TOOLBAR_SEPARATOR_STYLE} />

    <label
      title="Text color"
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      style={{ display: "flex", alignItems: "center", cursor: "pointer", padding: "4px 6px", gap: 3 }}
    >
      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.9)", fontWeight: 700 }}>A</span>
      <input
        type="color"
        defaultValue="#000000"
        onChange={(e) => {
          runCommand(editorRef, "foreColor", e.target.value);
        }}
        style={{ width: 16, height: 16, border: "none", padding: 0, cursor: "pointer", borderRadius: 3 }}
      />
    </label>
    </div>
  );
};

export default RichTextToolbar;
