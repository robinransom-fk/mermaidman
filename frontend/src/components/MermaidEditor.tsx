"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactFlow, {
    Node,
    Edge,
    Background,
    BackgroundVariant,
    Controls,
    useNodesState,
    useEdgesState,
    ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useMermaidEngine } from '@/hooks/useMermaidEngine';
import { getLayoutedNodes } from '@/utils/layout';
import {
    createGraphStore,
    moveNode,
    upsertEdgeFromParse,
    upsertNodeFromParse,
    type GraphStore,
    type UID,
} from '@/store/graphStore';

const INITIAL_CODE = `graph TD
A[Start] --> B[Processing]
B --> C[End]
%% @node: A { x: 100, y: 100 }
%% @node: B { x: 300, y: 100 }
%% @node: C { x: 500, y: 100 }
`;

function MermaidEditorContent() {
    const { isReady, parse_mermaidman, update_mermaidman_node } = useMermaidEngine();
    const [code, setCode] = useState(INITIAL_CODE);
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const storeRef = useRef<GraphStore>(createGraphStore());
    const editSourceRef = useRef<'text' | 'graph'>('text');

    // Sync: Text -> GUI
    useEffect(() => {
        if (!isReady) return;
        if (editSourceRef.current === 'graph') {
            editSourceRef.current = 'text';
            return;
        }

        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        timeoutRef.current = setTimeout(() => {
            try {
                const result = parse_mermaidman(code);
                const store = createGraphStore();

                result.nodes.forEach((n: any) => {
                    upsertNodeFromParse(store, {
                        id: n.id,
                        label: n.label,
                        x: n.x,
                        y: n.y,
                        uid: n.uid,
                        meta: n.meta,
                    });
                });

                result.edges.forEach((e: any) => {
                    upsertEdgeFromParse(store, {
                        source: e.source,
                        target: e.target,
                        label: e.label,
                        eid: e.eid,
                        meta: e.meta,
                    });
                });

                storeRef.current = store;

                const flowNodes: Node[] = Object.values(store.nodes).map((n) => {
                    const hasPosition = typeof n.x === 'number' && typeof n.y === 'number';

                    return {
                        id: n.uid,
                        position: { x: hasPosition ? n.x : 0, y: hasPosition ? n.y : 0 },
                        data: { label: n.label || n.mermaidId, hasPosition, mermaidId: n.mermaidId },
                        style: {
                            background: '#fff',
                            border: '1.5px solid #000', // Neobrutalism sharp border
                            borderRadius: '2px',
                            padding: '12px',
                            fontWeight: '600',
                            boxShadow: '4px 4px 0px 0px #000' // Neobrutalism shadow
                        },
                    };
                });

                const flowEdges: Edge[] = Object.values(store.edges).map((e) => ({
                    id: e.eid,
                    source: e.source,
                    target: e.target,
                    label: e.label,
                    type: 'smoothstep',
                    style: { stroke: '#000', strokeWidth: 2 },
                }));

                const layoutedNodes = getLayoutedNodes(flowNodes, flowEdges);

                setNodes(layoutedNodes);
                setEdges(flowEdges);
            } catch (e) {
                console.error("Parse error:", e);
            }
        }, 300);

        return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
    }, [code, isReady, setNodes, setEdges, parse_mermaidman]);

    // Sync: GUI -> Text
    const onNodeDragStop = useCallback((_event: any, node: Node) => {
        if (!isReady) return;

        const store = storeRef.current;
        const uid = node.id as UID;
        moveNode(store, uid, Math.round(node.position.x), Math.round(node.position.y));

        const mermaidId = store.alias.uidToMermaidId[uid] ?? node.data?.mermaidId ?? node.id;
        const newCode = update_mermaidman_node(
            code,
            mermaidId,
            Math.round(node.position.x),
            Math.round(node.position.y)
        );

        editSourceRef.current = 'graph';
        setCode(newCode);
    }, [isReady, code, update_mermaidman_node]);

    if (!isReady) {
        return (
            <div className="flex items-center justify-center h-screen bg-white">
                <div className="animate-pulse font-mono text-lg">Initializing Rust Engine...</div>
            </div>
        );
    }

    return (
        <div className="flex h-screen w-full flex-row overflow-hidden bg-white text-black">
            {/* Left Pane: Editor */}
            <div className="w-1/3 min-w-[350px] border-r-2 border-black flex flex-col">
                <div className="p-3 border-b-2 border-black bg-black text-white font-mono text-xs uppercase tracking-widest flex justify-between items-center">
                    <span>mermaidman.mmd+</span>
                    <span className="bg-green-500 w-2 h-2 rounded-full"></span>
                </div>
                <textarea
                    value={code}
                    onChange={(e) => {
                        editSourceRef.current = 'text';
                        setCode(e.target.value);
                    }}
                    className="flex-1 w-full p-6 font-mono text-sm resize-none outline-none selection:bg-yellow-200"
                    spellCheck={false}
                    placeholder="graph TD..."
                />
                <div className="p-2 border-t-2 border-black text-[10px] font-mono text-slate-500 text-center">
                    DRAG NODES ON RIGHT TO UPDATE COORDINATES
                </div>
            </div>

            {/* Right Pane: Canvas */}
            <div className="flex-1 h-full bg-[#fafafa]">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onNodeDragStop={onNodeDragStop}
                    fitView
                >
                    <Background color="#000" gap={25} size={1} variant={BackgroundVariant.Dots} />
                    <Controls className="!bg-white !border-2 !border-black !shadow-none" />
                </ReactFlow>
            </div>
        </div>
    );
}

export default function MermaidEditor() {
    return (
        <ReactFlowProvider>
            <MermaidEditorContent />
        </ReactFlowProvider>
    );
}
