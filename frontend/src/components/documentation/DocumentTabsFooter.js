import React, { useEffect, useRef, useState } from "react";

export default function DocumentTabsFooter({
    documents,
    activeDocumentId,
    onSelect,
    onCreate,
    onRename,
    onDelete,
}) {
    const [editingId, setEditingId] = useState(null);
    const [draftTitle, setDraftTitle] = useState("");
    const inputRef = useRef(null);

    useEffect(() => {
        if (editingId && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editingId]);

    const startRename = (documentItem) => {
        setEditingId(documentItem.id);
        setDraftTitle(documentItem.title);
    };

    const commitRename = () => {
        if (!editingId) return;
        onRename(editingId, draftTitle);
        setEditingId(null);
    };

    return (
        <div className="document-tabs-footer">
            <div className="document-tabs-scroll">
                {documents.map((documentItem) => {
                    const isActive = documentItem.id === activeDocumentId;
                    const isEditing = documentItem.id === editingId;

                    return (
                        <div
                            key={documentItem.id}
                            className={`document-tab-item ${isActive ? "active" : ""}`}
                        >
                            {isEditing ? (
                                <input
                                    ref={inputRef}
                                    value={draftTitle}
                                    onChange={(event) => setDraftTitle(event.target.value)}
                                    onBlur={commitRename}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            event.preventDefault();
                                            commitRename();
                                        }
                                        if (event.key === "Escape") {
                                            setEditingId(null);
                                            setDraftTitle(documentItem.title);
                                        }
                                    }}
                                    className="document-tab-input"
                                />
                            ) : (
                                <button
                                    type="button"
                                    className="document-tab-button"
                                    onClick={() => onSelect(documentItem.id)}
                                    onDoubleClick={() => startRename(documentItem)}
                                    title={documentItem.title}
                                >
                                    {documentItem.title}
                                </button>
                            )}

                            <button
                                type="button"
                                className="document-tab-close"
                                onClick={() => onDelete(documentItem.id)}
                                title={`Delete editor page ${documentItem.title}`}
                            >
                                <i className="bi bi-x-lg" aria-hidden="true" />
                            </button>
                        </div>
                    );
                })}
            </div>

            <button
                type="button"
                className="document-tab-add"
                onClick={onCreate}
                title="Create a new editor page"
            >
                <i className="bi bi-plus-lg" aria-hidden="true" />
            </button>
        </div>
    );
}
