import { createContext, useState, useContext, useCallback, useEffect, useRef, useMemo } from 'react';
import useUndoRedo from '../hooks/useUndoRedo';
import { getCurrentTimestampName } from '../utils/defaultNames';

const WorkspaceContext = createContext(null);

const GROUP_PALETTE = ['#FFE4B5', '#B5E4FF', '#D4FFD4', '#FFD4E8', '#E0D4FF', '#FFFDB5'];

export const WorkspaceProvider = ({ children }) => {
    // ── Canvas data ───────────────────────────────────────────────────────────
    const [snippets, setSnippets] = useState([]);
    const [editableBoxes, setEditableBoxes] = useState([]);
    const [connections, setConnections] = useState([]);
    const [lines, setLines] = useState([]);
    const [groups, setGroups] = useState([]);
    const [existingSnippetsMap, setExistingSnippetsMap] = useState({});
    const [selectedItem, setSelectedItem] = useState(null);
    const [lineStartId, setLineStartId] = useState(null);

    // ── Workspace identity ────────────────────────────────────────────────────
    const [pdfId, setPdfId] = useState(null);
    const [activeWorkspace, setActiveWorkspace] = useState(null);
    const [workspaces, setWorkspaces] = useState([]);
    const [pendingSummaryWorkspaceId, setPendingSummaryWorkspaceId] = useState(null);
    const [pendingSummaryText, setPendingSummaryText] = useState(null);

    // ── Save state ────────────────────────────────────────────────────────────
    const [isDirty, setIsDirty] = useState(false);
    const [savingWorkspace, setSavingWorkspace] = useState(false);

    // ── Stable refs ───────────────────────────────────────────────────────────
    const canvasRef = useRef(null);
    const viewStateRef = useRef({ scale: 1, pan: { x: 0, y: 0 } });
    const saveRef = useRef(null);
    const pdfRef = useRef(null);    // left PDF panel
    const pdf2Ref = useRef(null);   // right PDF panel

    // ── Snapshot refs (latest values for undo/redo without stale closures) ────
    const snippetsRef = useRef(snippets);
    const connectionsRef = useRef(connections);
    const editableBoxesRef = useRef(editableBoxes);
    const linesRef = useRef(lines);
    const groupsRef = useRef(groups);
    useEffect(() => { snippetsRef.current = snippets; }, [snippets]);
    useEffect(() => { connectionsRef.current = connections; }, [connections]);
    useEffect(() => { editableBoxesRef.current = editableBoxes; }, [editableBoxes]);
    useEffect(() => { linesRef.current = lines; }, [lines]);
    useEffect(() => { groupsRef.current = groups; }, [groups]);

    // ── Undo / Redo ───────────────────────────────────────────────────────────
    const { recordHistory, undo, redo, canUndo, canRedo, clearHistory } = useUndoRedo();

    const getSnapshot = useCallback(() => ({
        snippets: snippetsRef.current,
        editableBoxes: editableBoxesRef.current,
        lines: linesRef.current,
        connections: connectionsRef.current,
        groups: groupsRef.current,
    }), []);

    // Clear history and groups when the active workspace changes
    useEffect(() => {
        clearHistory();
        setGroups([]);
    }, [activeWorkspace?.id, clearHistory]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleUndo = useCallback(() => {
        const snapshot = undo(getSnapshot());
        if (!snapshot) return;
        setSnippets(snapshot.snippets);
        setEditableBoxes(snapshot.editableBoxes);
        setLines(snapshot.lines);
        setConnections(snapshot.connections);
        setGroups(snapshot.groups || []);
        setIsDirty(true);
    }, [undo, getSnapshot]);

    const handleRedo = useCallback(() => {
        const snapshot = redo(getSnapshot());
        if (!snapshot) return;
        setSnippets(snapshot.snippets);
        setEditableBoxes(snapshot.editableBoxes);
        setLines(snapshot.lines);
        setConnections(snapshot.connections);
        setGroups(snapshot.groups || []);
        setIsDirty(true);
    }, [redo, getSnapshot]);

    // ── Item delete handlers (self-contained, only touch WorkspaceContext) ────

    const handleDeleteBox = useCallback((targetBoxId) => {
        recordHistory(getSnapshot());
        const sBoxId = String(targetBoxId);
        setEditableBoxes(prev => prev.filter(b => String(b.id) !== sBoxId));
        setConnections(prevConns => {
            const toRemove = prevConns.filter(c => String(c.from) === sBoxId || String(c.to) === sBoxId);
            const otherSideIds = toRemove.map(c => String(c.from) === sBoxId ? String(c.to) : String(c.from));
            const nextConns = prevConns.filter(c => !toRemove.includes(c));
            if (otherSideIds.length > 0) {
                setSnippets(prevSnips =>
                    prevSnips.filter(s => !(otherSideIds.includes(String(s.id)) && s.type === 'anchor'))
                );
            }
            return nextConns;
        });
        setIsDirty(true);
    }, [recordHistory, getSnapshot]);

    const handleDeleteSnippet = useCallback((targetSnippetId) => {
        recordHistory(getSnapshot());
        const sSnippetId = String(targetSnippetId);
        setSnippets(prev => prev.filter(s => String(s.id) !== sSnippetId));
        setConnections(prevConns =>
            prevConns.filter(c => String(c.from) !== sSnippetId && String(c.to) !== sSnippetId)
        );
        setIsDirty(true);
    }, [recordHistory, getSnapshot]);

    // ── Group handlers ────────────────────────────────────────────────────────

    const handleCreateGroup = useCallback((itemIds) => {
        recordHistory(getSnapshot());
        setGroups(prev => {
            const color = GROUP_PALETTE[prev.length % GROUP_PALETTE.length];
            return [...prev, {
                id: `group-${Date.now()}`,
                name: getCurrentTimestampName(),
                color,
                itemIds: itemIds.map(String),
                collapsed: false,
            }];
        });
        setIsDirty(true);
    }, [recordHistory, getSnapshot]);

    const handleUngroupItems = useCallback((groupId) => {
        recordHistory(getSnapshot());
        setGroups(prev => prev.filter(g => g.id !== groupId));
        setIsDirty(true);
    }, [recordHistory, getSnapshot]);

    const handleToggleGroupCollapse = useCallback((groupId) => {
        setGroups(prev => prev.map(g => g.id === groupId ? { ...g, collapsed: !g.collapsed } : g));
        setIsDirty(true);
    }, []);

    const handleSetGroupColor = useCallback((groupId, color) => {
        setGroups(prev => prev.map(g => g.id === groupId ? { ...g, color } : g));
        setIsDirty(true);
    }, []);

    const handleRenameGroup = useCallback((groupId, name) => {
        setGroups(prev => prev.map(g => g.id === groupId ? { ...g, name } : g));
        setIsDirty(true);
    }, []);

    // ── Memoized context value ────────────────────────────────────────────────
    const value = useMemo(() => ({
        // Canvas data
        snippets, setSnippets,
        editableBoxes, setEditableBoxes,
        connections, setConnections,
        lines, setLines,
        groups, setGroups,
        existingSnippetsMap, setExistingSnippetsMap,
        selectedItem, setSelectedItem,
        lineStartId, setLineStartId,
        // Workspace identity
        pdfId, setPdfId,
        activeWorkspace, setActiveWorkspace,
        workspaces, setWorkspaces,
        pendingSummaryWorkspaceId, setPendingSummaryWorkspaceId,
        pendingSummaryText, setPendingSummaryText,
        // Save state
        isDirty, setIsDirty,
        savingWorkspace, setSavingWorkspace,
        // Stable refs (never cause re-renders)
        canvasRef, viewStateRef, saveRef, pdfRef, pdf2Ref,
        // Undo/redo
        recordHistory, undo, redo, canUndo, canRedo, clearHistory,
        getSnapshot,
        handleUndo, handleRedo,
        // Handlers
        handleDeleteBox, handleDeleteSnippet,
        handleCreateGroup, handleUngroupItems, handleToggleGroupCollapse,
        handleSetGroupColor, handleRenameGroup,
    }), [
        snippets, editableBoxes, connections, lines, groups,
        existingSnippetsMap, selectedItem, lineStartId,
        pdfId, activeWorkspace, workspaces, pendingSummaryWorkspaceId, pendingSummaryText,
        isDirty, savingWorkspace,
        canUndo, canRedo,
        getSnapshot, recordHistory, undo, redo, clearHistory,
        handleUndo, handleRedo,
        handleDeleteBox, handleDeleteSnippet,
        handleCreateGroup, handleUngroupItems, handleToggleGroupCollapse,
        handleSetGroupColor, handleRenameGroup,
    ]);

    return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
};

export const useWorkspace = () => {
    const ctx = useContext(WorkspaceContext);
    if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
    return ctx;
};

export default WorkspaceContext;
