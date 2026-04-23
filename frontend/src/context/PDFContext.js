import React, { createContext, useState, useContext, useMemo } from 'react';

const PDFContext = createContext(null);

export const PDFProvider = ({ children }) => {
    // ── PDF identity ──────────────────────────────────────────────────────────
    const [selectedPDF, setSelectedPDF] = useState(null);
    const [pdfName, setPdfName] = useState("");

    // ── Annotations ───────────────────────────────────────────────────────────
    const [highlights, setHighlights] = useState([]);
    const [pdfAnnotations, setPdfAnnotations] = useState([]);
    const [pdfLines, setPdfLines] = useState([]);
    const [brushHighlights, setBrushHighlights] = useState([]);
    const [pdfConnectionLines, setPdfConnectionLines] = useState([]);
    const [drawingLine, setDrawingLine] = useState(null);
    const [activePdfConnId, setActivePdfConnId] = useState(null);

    // Pending deletes (sent to backend on save)
    const [deletedHighlights, setDeletedHighlights] = useState([]);
    const [deletedPdfTexts, setDeletedPdfTexts] = useState([]);

    // ── Bookmarks ─────────────────────────────────────────────────────────────
    const [bookmarks, setBookmarks] = useState([]);

    // ── Search ────────────────────────────────────────────────────────────────
    const [searchText, setSearchText] = useState("");
    const [searchMatches, setSearchMatches] = useState([]);
    const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);

    // ── Summary panel ─────────────────────────────────────────────────────────
    const [showSummary, setShowSummary] = useState(false);
    const [summary, setSummary] = useState("");
    const [summaryLoading, setSummaryLoading] = useState(false);

    // ── Save state ────────────────────────────────────────────────────────────
    const [savingPdf, setSavingPdf] = useState(false);

    // ── Derived: unified annotation list sorted by page ───────────────────────
    const allAnnotations = React.useMemo(() => {
        const combined = [];
        highlights.forEach(hl => combined.push({
            id: hl.id, pageNum: hl.pageNum, type: 'highlight',
            content: hl.content || `Highlighted text on page ${hl.pageNum}`,
            color: hl.color, data: hl,
        }));
        pdfAnnotations.forEach(annot => combined.push({
            id: annot.id, pageNum: annot.pageNum, type: 'text',
            content: annot.text || 'Text Note', color: null, data: annot,
        }));
        brushHighlights.forEach(h => combined.push({
            id: h.id, pageNum: h.pageNum, type: 'brush-highlight',
            content: `Brush highlight on page ${h.pageNum}`, color: h.color, data: h,
        }));
        pdfLines.forEach(line => combined.push({
            id: line.id, pageNum: line.pageNum, type: 'drawing',
            content: 'Pen Drawing', color: line.color, data: line,
        }));
        return combined.sort((a, b) => a.pageNum - b.pageNum);
    }, [highlights, pdfAnnotations, pdfLines, brushHighlights]);

    // ── Memoized context value ────────────────────────────────────────────────
    const value = useMemo(() => ({
        selectedPDF, setSelectedPDF,
        pdfName, setPdfName,
        highlights, setHighlights,
        pdfAnnotations, setPdfAnnotations,
        pdfLines, setPdfLines,
        brushHighlights, setBrushHighlights,
        pdfConnectionLines, setPdfConnectionLines,
        drawingLine, setDrawingLine,
        activePdfConnId, setActivePdfConnId,
        deletedHighlights, setDeletedHighlights,
        deletedPdfTexts, setDeletedPdfTexts,
        bookmarks, setBookmarks,
        searchText, setSearchText,
        searchMatches, setSearchMatches,
        currentMatchIndex, setCurrentMatchIndex,
        showSummary, setShowSummary,
        summary, setSummary,
        summaryLoading, setSummaryLoading,
        savingPdf, setSavingPdf,
        allAnnotations,
    }), [
        selectedPDF, pdfName,
        highlights, pdfAnnotations, pdfLines, brushHighlights, pdfConnectionLines, drawingLine, activePdfConnId,
        deletedHighlights, deletedPdfTexts, bookmarks,
        searchText, searchMatches, currentMatchIndex,
        showSummary, summary, summaryLoading, savingPdf,
        allAnnotations,
    ]);

    return <PDFContext.Provider value={value}>{children}</PDFContext.Provider>;
};

export const usePDF = () => {
    const ctx = useContext(PDFContext);
    if (!ctx) throw new Error('usePDF must be used within PDFProvider');
    return ctx;
};

export default PDFContext;
