import React, { useState } from "react";

/**
 * 🚀 PageJumpBox: A "True On-Demand" Modal for jumping to PDF pages.
 * Based on the PDF Thumbnail modal style for resource efficiency.
 */
const PageJumpBox = ({ pdfRef, onClose }) => {
    // These only run when the modal is opened
    const total = pdfRef.current?.pdfDoc?.numPages || 0;
    const current = pdfRef.current?.getCurrentPageNum() || 1;
    const [val, setVal] = useState(String(current));

    const handleGo = () => {
        const p = parseInt(val, 10);
        if (!isNaN(p) && p >= 1 && p <= total) {
            pdfRef.current?.scrollToPage(p);
            onClose();
        }
    };

    return (
        <div className="pdf-thumbnail-overlay" onClick={onClose}>
            <div className="page-jump-modal" onClick={(e) => e.stopPropagation()}>
                <div className="page-jump-header">
                    <h3>Jump to Page</h3>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="page-jump-body">
                    <p className="page-jump-info">
                        You are currently on page <strong>{current}</strong> of <strong>{total}</strong>
                    </p>

                    <div className="page-jump-input-group">
                        <input
                            autoFocus
                            type="number"
                            value={val}
                            onChange={(e) => setVal(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleGo()}
                            min="1"
                            max={total}
                            placeholder="Page #"
                        />
                        <button className="page-jump-go-btn" onClick={handleGo}>
                            Go to Page
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PageJumpBox;
