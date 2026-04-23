import React, { useRef } from 'react';

const ICON_BTN = {
    border: 'none', background: 'transparent', cursor: 'pointer',
    fontSize: 13, padding: '0 2px', color: '#555', lineHeight: 1, pointerEvents: 'all',
};

const GroupLayer = ({ groups, snippets, editableBoxes, onToggleCollapse, onUngroup, onSetColor, onRename, onMoveGroup, getScale }) => {
    const draggingGroup = useRef(null);

    const handleHeaderMouseDown = (e, groupId) => {
        // Only left-click, not on buttons/inputs
        if (e.button !== 0) return;
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
        e.stopPropagation();
        e.preventDefault();

        const scale = getScale ? getScale() : 1;
        let lastX = e.clientX;
        let lastY = e.clientY;
        draggingGroup.current = groupId;

        const onMove = (moveEvent) => {
            if (!draggingGroup.current) return;
            const dx = (moveEvent.clientX - lastX) / scale;
            const dy = (moveEvent.clientY - lastY) / scale;
            lastX = moveEvent.clientX;
            lastY = moveEvent.clientY;
            onMoveGroup(groupId, dx, dy);
        };

        const onUp = () => {
            draggingGroup.current = null;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };

    return (
        <>
            {groups.map(group => {
                const items = [
                    ...snippets.filter(s => group.itemIds.includes(String(s.id)) && s.type !== 'anchor'),
                    ...editableBoxes.filter(b => group.itemIds.includes(String(b.id))),
                ];
                if (items.length === 0) return null;

                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                items.forEach(item => {
                    const x = item.x || 0;
                    const y = item.y || 0;
                    const w = typeof item.width === 'number' ? item.width : 180;
                    const h = typeof item.height === 'number' ? item.height : 120;
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x + w);
                    maxY = Math.max(maxY, y + h);
                });

                const PAD = 16;
                const HEADER_H = 28;

                if (group.collapsed) {
                    return (
                        <div
                            key={group.id}
                            onMouseDown={e => handleHeaderMouseDown(e, group.id)}
                            onClick={() => onToggleCollapse(group.id)}
                            title={`${group.name} — click to expand, drag to move`}
                            style={{
                                position: 'absolute',
                                left: minX - PAD,
                                top: minY - PAD,
                                background: group.color,
                                border: `2px solid ${group.color}`,
                                borderRadius: 20,
                                padding: '5px 14px',
                                cursor: 'grab',
                                zIndex: 15,
                                display: 'flex', alignItems: 'center', gap: 6,
                                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                                fontSize: 12, fontWeight: 600,
                                userSelect: 'none', whiteSpace: 'nowrap',
                            }}
                        >
                            <span>▶</span>
                            <span>{group.name}</span>
                            <span style={{ opacity: 0.6, fontSize: 11, fontWeight: 400 }}>
                                ({items.length} items)
                            </span>
                        </div>
                    );
                }

                return (
                    <div
                        key={group.id}
                        style={{
                            position: 'absolute',
                            left: minX - PAD,
                            top: minY - PAD - HEADER_H,
                            width: maxX - minX + PAD * 2,
                            height: maxY - minY + PAD * 2 + HEADER_H,
                            background: group.color + '28',
                            border: `2px solid ${group.color}`,
                            borderRadius: 12,
                            zIndex: 1,
                            pointerEvents: 'none',
                        }}
                    >
                        {/* Drag handle header */}
                        <div
                            onMouseDown={e => handleHeaderMouseDown(e, group.id)}
                            style={{
                                position: 'absolute',
                                top: 0, left: 0, right: 0,
                                height: HEADER_H,
                                display: 'flex', alignItems: 'center',
                                padding: '0 8px', gap: 4,
                                pointerEvents: 'all',
                                cursor: 'grab',
                                userSelect: 'none',
                            }}
                        >
                            <span style={{ marginRight: 2, opacity: 0.4, fontSize: 11 }}>⠿</span>
                            <span
                                style={{
                                    flex: 1, fontSize: 12, fontWeight: 600, color: '#333',
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}
                                onDoubleClick={e => {
                                    e.stopPropagation();
                                    const name = window.prompt('Rename group:', group.name);
                                    if (name && name.trim()) onRename(group.id, name.trim());
                                }}
                                title="Double-click to rename"
                            >
                                {group.name}
                            </span>
                            <input
                                type="color"
                                value={group.color}
                                onChange={e => onSetColor(group.id, e.target.value)}
                                title="Change group color"
                                style={{ width: 18, height: 18, padding: 0, border: 'none', cursor: 'pointer', borderRadius: 3, pointerEvents: 'all' }}
                            />
                            <button onClick={() => onToggleCollapse(group.id)} title="Collapse group" style={ICON_BTN}>▲</button>
                            <button onClick={() => onUngroup(group.id)} title="Ungroup" style={{ ...ICON_BTN, color: '#e53535' }}>✕</button>
                        </div>
                    </div>
                );
            })}
        </>
    );
};

export default GroupLayer;
