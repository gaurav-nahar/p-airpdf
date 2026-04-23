import { useEffect } from 'react';
import { useApp } from '../../context/AppContext';

/**
 * ⌨️ KeyboardShortcuts
 * A non-rendering component that manages global keyboard listeners.
 */
const KeyboardShortcuts = () => {
    const {
        selectedItem,
        snippets,
        editableBoxes,
        handleDeleteSnippet,
        handleDeleteBox,
        setEditableBoxes,
        setSnippets,
        setSelectedItem
    } = useApp();

    useEffect(() => {
        const handleKeyDown = (e) => {
            // Don't trigger shortcuts if user is typing in an input or textarea
            if (["TEXTAREA", "INPUT"].includes(document.activeElement.tagName)) return;

            // Ctrl/Cmd + C (Copy)
            if ((e.ctrlKey || e.metaKey) && e.key === "c") {
                if (!selectedItem) return;
                const item = selectedItem.type === 'snippet'
                    ? snippets.find(s => String(s.id) === String(selectedItem.id))
                    : editableBoxes.find(b => String(b.id) === String(selectedItem.id));

                if (item) {
                    localStorage.setItem("globalClipboard", JSON.stringify({ ...item, itemType: selectedItem.type }));
                }
            }

            // Ctrl/Cmd + X (Cut)
            if ((e.ctrlKey || e.metaKey) && e.key === "x") {
                if (!selectedItem) return;
                const item = selectedItem.type === 'snippet'
                    ? snippets.find(s => String(s.id) === String(selectedItem.id))
                    : editableBoxes.find(b => String(b.id) === String(selectedItem.id));

                if (item) {
                    localStorage.setItem("globalClipboard", JSON.stringify({ ...item, itemType: selectedItem.type }));
                    if (selectedItem.type === 'snippet') {
                        handleDeleteSnippet(selectedItem.id);
                    } else {
                        handleDeleteBox(selectedItem.id);
                    }
                    setSelectedItem(null);
                }
            }

            // Ctrl/Cmd + V (Paste)
            if ((e.ctrlKey || e.metaKey) && e.key === "v") {
                const data = localStorage.getItem("globalClipboard");
                if (data) {
                    const item = JSON.parse(data);
                    const id = `pasted-${Date.now()}`;
                    const newItem = {
                        ...item,
                        id,
                        x: (item.x || 100) + 30,
                        y: (item.y || 100) + 30
                    };
                    delete newItem.itemType;

                    if (item.itemType === 'box') {
                        setEditableBoxes(prev => [...prev, newItem]);
                    } else {
                        setSnippets(prev => [...prev, newItem]);
                    }
                    setSelectedItem({ id, type: item.itemType });
                }
            }

            // Delete Key
            if (e.key === "Delete") {
                if (!selectedItem) return;
                if (selectedItem.type === 'snippet') {
                    handleDeleteSnippet(selectedItem.id);
                } else {
                    handleDeleteBox(selectedItem.id);
                }
                setSelectedItem(null);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [
        selectedItem,
        snippets,
        editableBoxes,
        handleDeleteSnippet,
        handleDeleteBox,
        setEditableBoxes,
        setSnippets,
        setSelectedItem
    ]);

    return null; // This component doesn't render anything
};

export default KeyboardShortcuts;
