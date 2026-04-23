import React from "react";
import LexicalEditor from "./LexicalEditor";
import DocumentTabsFooter from "./DocumentTabsFooter";

export default function DocumentationPanel({
    documents,
    activeDocumentId,
    onSelectDocument,
    onCreateDocument,
    onRenameDocument,
    onDeleteDocument,
    onUpdateDocumentContent,
}) {
    const activeDocument =
        documents.find((documentItem) => documentItem.id === activeDocumentId) ||
        documents[0] ||
        null;

    return (
        <div className="documentation-panel">
            <DocumentTabsFooter
                documents={documents}
                activeDocumentId={activeDocumentId}
                onSelect={onSelectDocument}
                onCreate={onCreateDocument}
                onRename={onRenameDocument}
                onDelete={onDeleteDocument}
            />

            <div className="documentation-body">
                {activeDocument && (
                    <LexicalEditor
                        key={activeDocument.id}
                        documentId={activeDocument.id}
                        initialState={activeDocument.content}
                        onChange={(nextState) =>
                            onUpdateDocumentContent(activeDocument.id, nextState)
                        }
                    />
                )}
            </div>
        </div>
    );
}
