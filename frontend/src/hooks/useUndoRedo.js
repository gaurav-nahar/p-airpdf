import { useRef, useState, useCallback } from 'react';

const MAX_HISTORY = 50;

/**
 * Classic two-stack undo/redo.
 *
 * past  = stack of snapshots to restore on undo  (most recent at end)
 * future = stack of snapshots to restore on redo  (next redo at end)
 *
 * Usage:
 *   recordHistory(currentSnapshot)  — call BEFORE making a change
 *   undo(currentSnapshot)           — pass current state so it can be pushed to future
 *   redo(currentSnapshot)           — pass current state so it can be pushed to past
 */
export default function useUndoRedo() {
    const past = useRef([]);
    const future = useRef([]);
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);

    const updateFlags = useCallback(() => {
        setCanUndo(past.current.length > 0);
        setCanRedo(future.current.length > 0);
    }, []);

    // Call BEFORE applying a change — saves current state to undo stack
    const recordHistory = useCallback((currentSnapshot) => {
        past.current.push(currentSnapshot);
        future.current = []; // any new action clears the redo branch
        if (past.current.length > MAX_HISTORY) {
            past.current.shift();
        }
        updateFlags();
    }, [updateFlags]);

    // Returns the previous snapshot to restore, or null if nothing to undo
    // currentSnapshot = the state RIGHT NOW (so redo can come back to it)
    const undo = useCallback((currentSnapshot) => {
        if (past.current.length === 0) return null;
        future.current.push(currentSnapshot);
        const snapshot = past.current.pop();
        updateFlags();
        return snapshot;
    }, [updateFlags]);

    // Returns the next snapshot to restore, or null if nothing to redo
    // currentSnapshot = the state RIGHT NOW (so undo can come back to it)
    const redo = useCallback((currentSnapshot) => {
        if (future.current.length === 0) return null;
        past.current.push(currentSnapshot);
        const snapshot = future.current.pop();
        updateFlags();
        return snapshot;
    }, [updateFlags]);

    const clearHistory = useCallback(() => {
        past.current = [];
        future.current = [];
        updateFlags();
    }, [updateFlags]);

    return { recordHistory, undo, redo, canUndo, canRedo, clearHistory };
}
