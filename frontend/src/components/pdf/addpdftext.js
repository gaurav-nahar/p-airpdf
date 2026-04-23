
import { useCallback, useEffect } from 'react';
import { useApp } from "../../context/AppContext";

const STICKY_SHADOW = "0 4px 12px rgba(0,0,0,0.18), 0 1px 3px rgba(0,0,0,0.1)";
const STICKY_WIDTH = 180;
const STICKY_MIN_HEIGHT = 100;

const STICKY_COLORS = [
    { bg: "#FFF9C4", header: "#F9A825" },
    { bg: "#C8E6C9", header: "#4CAF50" },
    { bg: "#BBDEFB", header: "#1976D2" },
    { bg: "#FCE4EC", header: "#E91E63" },
    { bg: "#F3F4F6", header: "#9CA3AF" },
];
const getColorScheme = (color) => STICKY_COLORS.find(c => c.bg === color) || STICKY_COLORS[0];

export const usePdfText = (containerRef, getCurrentPageNum, contentRef = null) => {
    const {
        pdfAnnotations,
        setPdfAnnotations,
        handleDeletePdfText: onDeletePdfText,
        setDeletedPdfTexts,
        setIsDirty,
        tool,
        TOOL_MODES
    } = useApp();

    // 🎨 renderPdfAnnotation: Renders a sticky note on a page wrapper
    const renderPdfAnnotation = useCallback((wrapper, annot) => {
        const id = `pdf-annot-${annot.id}`;
        let div = wrapper.querySelector(`[data-annot-id="${id}"]`);

        if (!div) {
            div = document.createElement("div");
            div.dataset.annotId = id;
            div.style.position = "absolute";
            div.style.zIndex = "1000";
            div.style.transform = "translate(-50%, -50%)";
            wrapper.appendChild(div);
        }

        const colorScheme = getColorScheme(annot.color);

        // Position
        div.style.left = `${annot.xPct * 100}%`;
        div.style.top = `${annot.yPct * 100}%`;

        // Sticky note base styles
        div.style.width = `${STICKY_WIDTH}px`;
        div.style.minHeight = `${STICKY_MIN_HEIGHT}px`;
        div.style.background = colorScheme.bg;
        div.style.border = `1px solid ${colorScheme.header}`;
        div.style.borderRadius = "3px";
        div.style.boxShadow = STICKY_SHADOW;
        div.style.display = "flex";
        div.style.flexDirection = "column";
        div.style.userSelect = "none";
        div.style.pointerEvents = "auto";
        div.style.touchAction = annot.isEditing ? "auto" : "none";
        div.style.cursor = annot.isEditing ? "default" : "grab";
        div.style.overflow = "hidden";

        const updatePosition = (left, top) => {
            div.style.left = left;
            div.style.top = top;
        };

        const updateAnnotations = (updater) => {
            setPdfAnnotations(updater);
            if (setIsDirty) setIsDirty(true);
        };

        // Drag logic
        const handleStart = (clientX, clientY) => {
            const wrapperRect = wrapper.getBoundingClientRect();
            const startX = clientX;
            const startY = clientY;
            const initialXPct = annot.xPct;
            const initialYPct = annot.yPct;
            let hasMoved = false;
            div.style.cursor = "grabbing";
            div.style.zIndex = "1001";

            const onMove = (moveX, moveY) => {
                const dx = moveX - startX;
                const dy = moveY - startY;
                if (!hasMoved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
                    hasMoved = true;
                    div.dataset.dragging = "true";
                }
                if (hasMoved) {
                    const cx = Math.max(0, Math.min(1, initialXPct + dx / wrapperRect.width));
                    const cy = Math.max(0, Math.min(1, initialYPct + dy / wrapperRect.height));
                    updatePosition(`${cx * 100}%`, `${cy * 100}%`);
                }
            };

            const onEnd = (endX, endY) => {
                div.style.cursor = annot.isEditing ? "default" : "grab";
                div.style.zIndex = "1000";
                if (hasMoved) {
                    const dx = endX - startX;
                    const dy = endY - startY;
                    const fx = Math.max(0, Math.min(1, initialXPct + dx / wrapperRect.width));
                    const fy = Math.max(0, Math.min(1, initialYPct + dy / wrapperRect.height));
                    updateAnnotations(prev => prev.map(a =>
                        a.id === annot.id ? { ...a, xPct: fx, yPct: fy } : a
                    ));
                    setTimeout(() => delete div.dataset.dragging, 50);
                }
            };
            return { onMove, onEnd };
        };

        // Mouse drag
        div.onmousedown = (e) => {
            if (e.target.tagName === "TEXTAREA" || e.target.tagName === "BUTTON") return;
            e.preventDefault();
            e.stopPropagation();
            const { onMove, onEnd } = handleStart(e.clientX, e.clientY);
            const onMouseMove = (ev) => { ev.preventDefault(); onMove(ev.clientX, ev.clientY); };
            const onMouseUp = (ev) => {
                window.removeEventListener("mousemove", onMouseMove);
                window.removeEventListener("mouseup", onMouseUp);
                onEnd(ev.clientX, ev.clientY);
            };
            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);
        };

        // Rebuild inner content
        div.innerHTML = "";

        // ── Top bar (header strip) ──
        const header = document.createElement("div");
        header.style.cssText = `
            background: ${colorScheme.header};
            height: 26px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 6px;
            cursor: ${annot.isEditing ? "default" : "grab"};
            flex-shrink: 0;
            gap: 4px;
        `;

        // Color picker dots
        const colorPicker = document.createElement("div");
        colorPicker.style.cssText = "display:flex; gap:3px; align-items:center;";
        STICKY_COLORS.forEach(c => {
            const dot = document.createElement("div");
            const isActive = c.bg === colorScheme.bg;
            dot.style.cssText = `
                width: 10px; height: 10px; border-radius: 50%; cursor: pointer;
                background: ${c.bg}; border: 1.5px solid rgba(0,0,0,0.2);
                ${isActive ? "outline: 2px solid rgba(0,0,0,0.5); outline-offset: 1px;" : ""}
                flex-shrink: 0;
            `;
            dot.onmousedown = (e) => {
                e.stopPropagation();
                e.preventDefault();
                updateAnnotations(prev => prev.map(a =>
                    a.id === annot.id ? { ...a, color: c.bg } : a
                ));
            };
            colorPicker.appendChild(dot);
        });
        header.appendChild(colorPicker);

        // Delete button
        const delBtn = document.createElement("button");
        delBtn.innerHTML = "&times;";
        delBtn.style.cssText = `
            background: none; border: none; cursor: pointer;
            color: rgba(0,0,0,0.5); font-size: 16px; line-height: 1;
            padding: 0 2px; display: flex; align-items: center;
            margin-left: auto;
        `;
        delBtn.onclick = (e) => {
            e.stopPropagation();
            if (onDeletePdfText) onDeletePdfText(annot.id);
        };
        header.appendChild(delBtn);
        div.appendChild(header);

        // ── Textarea ──
        const textarea = document.createElement("textarea");
        textarea.value = annot.text;
        textarea.placeholder = "Type note here…";
        textarea.style.cssText = `
            flex: 1;
            width: 100%;
            min-height: ${STICKY_MIN_HEIGHT - 26}px;
            resize: none;
            border: none;
            outline: none;
            background: transparent;
            font-size: 13px;
            line-height: 1.5;
            padding: 6px 8px;
            color: #333;
            font-family: inherit;
            box-sizing: border-box;
            cursor: ${annot.isEditing ? "text" : "grab"};
        `;

        if (!annot.isEditing) {
            textarea.readOnly = true;
        }

        textarea.onmousedown = (e) => {
            e.stopPropagation(); // prevent div drag when clicking textarea
        };

        textarea.ondblclick = (e) => {
            e.stopPropagation();
            textarea.readOnly = false;
            textarea.style.cursor = "text";
            textarea.focus();
            updateAnnotations(prev => prev.map(a =>
                a.id === annot.id ? { ...a, isEditing: true } : a
            ));
        };

        textarea.onblur = () => {
            const newText = textarea.value.trim();
            if (!newText) {
                // Silently remove empty note without confirm dialog
                if (!String(annot.id).startsWith('pdf-annot-')) {
                    setDeletedPdfTexts(prev => [...prev, annot.id]);
                }
                updateAnnotations(prev => prev.filter(a => String(a.id) !== String(annot.id)));
                return;
            }
            textarea.readOnly = true;
            textarea.style.cursor = "grab";
            updateAnnotations(prev => prev.map(a =>
                a.id === annot.id ? { ...a, text: textarea.value, isEditing: false } : a
            ));
        };

        textarea.onkeydown = (e) => {
            if (e.key === "Escape") textarea.blur();
        };

        div.appendChild(textarea);

        if (annot.isEditing) {
            setTimeout(() => {
                textarea.readOnly = false;
                textarea.focus();
            }, 10);
        }

    }, [setPdfAnnotations, onDeletePdfText, setDeletedPdfTexts, setIsDirty, tool, TOOL_MODES]);

    // 🔄 Update DOM when annotations change
    useEffect(() => {
        const container = containerRef.current;
        const contentContainer = contentRef ? contentRef.current : container;
        if (!container || !contentContainer) return;

        // Remove annotations no longer in state
        const allRendered = contentContainer.querySelectorAll('[data-annot-id^="pdf-annot-"]');
        allRendered.forEach(el => {
            const id = el.dataset.annotId.replace('pdf-annot-', '');
            if (!pdfAnnotations.some(a => String(a.id) === id)) {
                el.remove();
            }
        });

        pdfAnnotations.forEach(a => {
            const wrapper = contentContainer.querySelector(`.pdf-page-wrapper[data-page-number="${a.pageNum}"]`);
            if (wrapper && wrapper.dataset.loaded === "true") {
                renderPdfAnnotation(wrapper, a);
            }
        });
    }, [pdfAnnotations, renderPdfAnnotation, containerRef, contentRef]);


    // Legacy: place note at center of current page (called from toolbar button)
    const addPdfText = useCallback(() => {
        const pageNum = getCurrentPageNum ? getCurrentPageNum() : 1;
        const newAnnot = {
            id: `pdf-annot-${Date.now()}`,
            pageNum,
            xPct: 0.5,
            yPct: 0.3,
            text: "",
            isEditing: true
        };
        setPdfAnnotations(prev => [...prev, newAnnot]);
        if (setIsDirty) setIsDirty(true);
    }, [getCurrentPageNum, setPdfAnnotations, setIsDirty]);

    return { renderPdfAnnotation, addPdfText };
};
