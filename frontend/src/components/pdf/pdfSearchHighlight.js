import { useState, useEffect, useRef, useCallback } from "react";
import { extractTextFromPDF, searchInText } from "./pdfSearch";
import { scrollToSnippet as scrollToSnippetUtil } from "./pdfScrollUtils";
import { useApp } from "../../context/AppContext";

/**
 * @typedef {Object} NodeInfo
 * @property {Node} node - The text node.
 * @property {number} start - Starting index in the cumulative string.
 * @property {string} text - Content of the node.
 * @property {number} len - Length of the content.
 */

/**
 * ✨ Drawing the Highlight Boxes (Core Logic)
 * 
 * This function handles the heavy lifting of finding text in the DOM 
 * and drawing semi-transparent boxes over it.
 */
export const highlightMatchesOnPage = (
    wrapper,
    searchText,
    currentMatchIndex,
    matchesRef,
    shrinkMapRef,
    zoomLevel = 1
) => {
    // 1. Validation & Initialization
    if (!wrapper || !searchText || searchText.length < 2) {
        wrapper?.querySelectorAll(".search-highlight").forEach((el) => el.remove());
        return;
    }

    const textLayer = wrapper.querySelector(".textLayer");
    if (!textLayer) return;

    const pageNum = parseInt(wrapper.dataset.pageNumber, 10);
    const wrapperRect = wrapper.getBoundingClientRect();
    const scale = shrinkMapRef?.current?.[pageNum] ?? 1;

    // Cleanup previous highlighting pass
    wrapper.querySelectorAll(".search-highlight").forEach((el) => el.remove());

    // 2. Index Mapping (DOM Text -> Cumulative String)
    /** @type {NodeInfo[]} */
    const nodes = [];
    let cumulativeText = "";

    const walker = document.createTreeWalker(textLayer, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while ((node = walker.nextNode())) {
        nodes.push({
            node,
            start: cumulativeText.length,
            text: node.textContent,
            len: node.textContent.length,
        });
        cumulativeText += node.textContent;
    }

    // 3. Prepare Regex for Search
    const escapedSearch = searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const searchRegex = new RegExp(escapedSearch.replace(/\s+/g, "\\s+"), "gi");

    // 4. Determine Global Match Offset for this Page
    // (Used to identify which match is "Current" across the whole PDF)
    let firstGlobalMatchIndexOnPage = -1;
    if (matchesRef?.current) {
        for (let i = 0; i < matchesRef.current.length; i++) {
            if (matchesRef.current[i].pageNum === pageNum) {
                firstGlobalMatchIndexOnPage = i;
                break;
            }
        }
    }

    // 5. Highlighting Loop
    let match;
    let localMatchCounter = 0;

    while ((match = searchRegex.exec(cumulativeText)) !== null) {
        const matchStart = match.index;
        const matchEnd = match.index + match[0].length;

        // Identify if this specific match is the one currently selected in Navbar
        const isCurrentActiveMatch =
            firstGlobalMatchIndexOnPage !== -1 &&
            (firstGlobalMatchIndexOnPage + localMatchCounter) === currentMatchIndex;

        // 6. Use Range API to find exact DOM coordinates
        const range = document.createRange();
        let startNodeInfo = null;
        let endNodeInfo = null;

        // Find nodes containing start and end of this match
        for (const item of nodes) {
            const itemEnd = item.start + item.len;
            if (!startNodeInfo && item.start <= matchStart && itemEnd > matchStart) {
                startNodeInfo = item;
            }
            if (startNodeInfo && item.start < matchEnd && itemEnd >= matchEnd) {
                endNodeInfo = item;
                break;
            }
        }

        if (startNodeInfo && endNodeInfo) {
            try {
                range.setStart(startNodeInfo.node, matchStart - startNodeInfo.start);
                range.setEnd(endNodeInfo.node, matchEnd - endNodeInfo.start);

                // 7. Create Highlight Overlays
                const rects = range.getClientRects();
                for (const rect of rects) {
                    if (rect.width <= 0 || rect.height <= 0) continue;

                    const highlightEl = document.createElement("div");
                    highlightEl.className = `search-highlight${isCurrentActiveMatch ? " current-search-highlight" : ""}`;

                    // Style Properties
                    Object.assign(highlightEl.style, {
                        position: "absolute",
                        left: `${(rect.left - wrapperRect.left) / (zoomLevel * scale)}px`,
                        top: `${(rect.top - wrapperRect.top) / (zoomLevel * scale)}px`,
                        width: `${rect.width / (zoomLevel * scale)}px`,
                        height: `${rect.height / (zoomLevel * scale)}px`,
                        backgroundColor: isCurrentActiveMatch ? "rgba(255, 120, 0, 0.75)" : "rgba(255, 255, 0, 0.45)",
                        pointerEvents: "none",
                        zIndex: "3",
                        borderRadius: "2px"
                    });

                    if (isCurrentActiveMatch) {
                        highlightEl.style.boxShadow = "0 0 6px rgba(0,0,0,0.4)";
                        highlightEl.style.border = "1px solid rgba(255,255,255,0.5)";
                    }

                    wrapper.appendChild(highlightEl);
                }
            } catch (err) {
                console.warn("[Highlight] Failed to create range for match:", err);
            }
        }
        localMatchCounter++;
    }
};

/**
 * 🎣 useSearchHighlight Hook
 * 
 * Manages the search flow: Extraction -> Query -> Highlighting -> Navigation.
 */
export const useSearchHighlight = (
    containerRef,
    pdfDocRef,
    shrinkMapRef,
    pdfLoaded,
    contentRef = null
) => {
    // Consume Global Search State
    const {
        searchText,
        currentMatchIndex,
        setSearchMatches: onMatchesFound,
        zoomLevel
    } = useApp();

    const [pagesText, setPagesText] = useState([]);
    const matchesRef = useRef([]);
    const latestRef = useRef({ searchText, currentMatchIndex, zoomLevel });

    // Keep Ref updated for async callbacks
    useEffect(() => {
        latestRef.current = { searchText, currentMatchIndex, zoomLevel };
    }, [searchText, currentMatchIndex, zoomLevel]);

    // SECTION 1: Text Extraction (One-time on PDF load)
    useEffect(() => {
        if (!pdfLoaded || !pdfDocRef.current || pagesText.length > 0) return;

        const performExtraction = async () => {
            try {
                const textData = await extractTextFromPDF(pdfDocRef.current);
                setPagesText(textData);
            } catch (err) {
                console.error("[Search] Text extraction failed:", err);
            }
        };

        performExtraction();
    }, [pdfLoaded, pdfDocRef, pagesText.length]);

    // SECTION 2: Highlighting Dispatcher
    const applyHighlightsToPage = useCallback((pageWrapper) => {
        const {
            searchText: currentQuery,
            currentMatchIndex: activeIdx,
            zoomLevel: currentZoom
        } = latestRef.current;

        highlightMatchesOnPage(
            pageWrapper,
            currentQuery,
            activeIdx,
            matchesRef,
            shrinkMapRef,
            currentZoom
        );
    }, [shrinkMapRef]);

    // SECTION 3: Global Search Effect
    useEffect(() => {
        if (!pagesText.length) return;

        // Perform search across extraction data
        const foundMatches = searchInText(pagesText, searchText);
        matchesRef.current = foundMatches;

        if (onMatchesFound) onMatchesFound(foundMatches);

        // Update UI for visible pages
        const container = containerRef.current;
        const targetContainer = contentRef ? contentRef.current : container;

        if (container && targetContainer) {
            const timer = setTimeout(() => {
                Array.from(targetContainer.children).forEach((wrapper) => {
                    if (wrapper.dataset.loaded === "true") {
                        applyHighlightsToPage(wrapper);
                    }
                });
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [searchText, pagesText, currentMatchIndex, onMatchesFound, applyHighlightsToPage, containerRef, contentRef]);

    // SECTION 4: Navigation & Auto-Scroll
    useEffect(() => {
        if (currentMatchIndex < 0 || !matchesRef.current[currentMatchIndex]) return;

        const targetMatch = matchesRef.current[currentMatchIndex];
        const container = containerRef.current;
        const targetContainer = contentRef ? contentRef.current : container;

        if (!container || !targetContainer || !pdfDocRef.current) return;

        // Command scroll to target page (handles lazy loading)
        scrollToSnippetUtil(
            container,
            { pageNum: targetMatch.pageNum, isSearchMatch: true },
            pdfDocRef.current
        );

        // Verification Loop: Ensure highlights appear even if page took time to load
        const pageWrapper = Array.from(targetContainer.children).find(
            (el) => parseInt(el.dataset.pageNumber, 10) === targetMatch.pageNum
        );

        if (pageWrapper) {
            let retryCount = 0;
            const attemptHighlight = () => {
                if (pageWrapper.dataset.loaded === "true") {
                    applyHighlightsToPage(pageWrapper);
                } else if (retryCount < 20) {
                    retryCount++;
                    setTimeout(attemptHighlight, 100);
                }
            };
            attemptHighlight();
        }
    }, [currentMatchIndex, applyHighlightsToPage, containerRef, pdfDocRef, contentRef]);

    return {
        pagesText,
        matchesRef,
        highlightMatchesOnPage: applyHighlightsToPage,
    };
};
