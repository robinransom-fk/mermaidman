"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import ReactFlow, {
    Node,
    Edge,
    Background,
    BackgroundVariant,
    Controls,
    Handle,
    Position,
    type NodeProps,
    useNodesState,
    useEdgesState,
    ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useMermaidEngine } from '@/hooks/useMermaidEngine';
import { getLayoutedNodes } from '@/utils/layout';
import { upsertNodeDirective } from '@/utils/mermaidman';
import { cn } from '@/utils/cn';
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

type DiagramMeta = {
    title?: string;
    mermaidman?: string;
};

type CodeMeta = {
    language?: string;
    content?: string;
};

type NodeMeta = {
    kind?: string;
    diagram?: DiagramMeta;
    code?: CodeMeta;
    [key: string]: unknown;
};

type MermaidNodeData = {
    label: string;
    mermaidId: string;
    hasPosition: boolean;
    meta?: NodeMeta;
    kind?: string;
    diagramPreview?: string;
    codePreview?: string;
};

function MermaidNode({ data, selected }: NodeProps<MermaidNodeData>) {
    const kind = data.kind ?? (typeof data.meta?.kind === 'string' ? data.meta?.kind : undefined);
    const hasDiagram = Boolean(data.meta?.diagram && typeof data.meta.diagram === 'object');
    const codePreview = data.codePreview;

    return (
        <div
            className={cn(
                "relative min-w-[140px] max-w-[260px] border-2 border-black bg-white p-3 shadow-[4px_4px_0px_0px_#000]",
                selected ? "ring-2 ring-black ring-offset-2" : "ring-0"
            )}
        >
            <Handle
                type="target"
                position={Position.Left}
                className="!h-2 !w-2 !rounded-none !border-2 !border-black !bg-white"
            />
            <Handle
                type="source"
                position={Position.Right}
                className="!h-2 !w-2 !rounded-none !border-2 !border-black !bg-black"
            />
            <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">{data.label}</div>
                {kind && (
                    <span className="rounded border border-black px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest">
                        {kind}
                    </span>
                )}
            </div>
            {data.diagramPreview && (
                <div className="mt-2 border border-black bg-yellow-50 px-2 py-1 text-[10px] uppercase tracking-wide">
                    {data.diagramPreview}
                </div>
            )}
            {codePreview && (
                <pre className="mt-2 max-h-28 overflow-hidden whitespace-pre-wrap rounded border border-black bg-black px-2 py-1 text-[10px] text-green-200">
                    {codePreview}
                </pre>
            )}
            {hasDiagram && (
                <div className="mt-2 text-[9px] uppercase tracking-widest text-slate-500">
                    Double-click to open
                </div>
            )}
        </div>
    );
}

const NODE_TYPES = { mermaidNode: MermaidNode };

function MermaidEditorContent() {
    const { isReady, parse_mermaidman } = useMermaidEngine();
    const [code, setCode] = useState(INITIAL_CODE);
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const storeRef = useRef<GraphStore>(createGraphStore());
    const editSourceRef = useRef<'text' | 'graph'>('text');
    const [diagramStack, setDiagramStack] = useState<
        { title: string; code: string; parentNodeId?: string }[]
    >([]);
    const [currentTitle, setCurrentTitle] = useState('Main');
    const [currentParentNodeId, setCurrentParentNodeId] = useState<string | undefined>(undefined);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const selectedNode = useMemo(
        () => nodes.find((node) => node.id === selectedNodeId) as Node<MermaidNodeData> | undefined,
        [nodes, selectedNodeId]
    );

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

                const flowNodes: Node<MermaidNodeData>[] = Object.values(store.nodes).map((n) => {
                    const hasPosition = typeof n.x === 'number' && typeof n.y === 'number';
                    const meta = (n.meta ?? {}) as NodeMeta;
                    const kind = typeof meta.kind === 'string' ? meta.kind : undefined;
                    const diagram = meta.diagram as DiagramMeta | undefined;
                    const diagramSource =
                        diagram && typeof diagram.mermaidman === 'string' ? diagram.mermaidman : undefined;
                    let diagramPreview: string | undefined;

                    if (diagramSource) {
                        if (parse_mermaidman) {
                            try {
                                const nested = parse_mermaidman(diagramSource) as any;
                                const nodeCount = Array.isArray(nested?.nodes) ? nested.nodes.length : 0;
                                const edgeCount = Array.isArray(nested?.edges) ? nested.edges.length : 0;
                                diagramPreview = `${nodeCount} nodes, ${edgeCount} edges`;
                            } catch {
                                diagramPreview = 'Nested diagram';
                            }
                        } else {
                            diagramPreview = 'Nested diagram';
                        }
                    }

                    const code = meta.code as CodeMeta | undefined;
                    const codePreview =
                        typeof code?.content === 'string'
                            ? code.content.split('\n').slice(0, 6).join('\n')
                            : undefined;

                    return {
                        id: n.uid,
                        type: 'mermaidNode',
                        position: { x: hasPosition ? n.x : 0, y: hasPosition ? n.y : 0 },
                        data: {
                            label: n.label || n.mermaidId,
                            hasPosition,
                            mermaidId: n.mermaidId,
                            meta,
                            kind,
                            diagramPreview,
                            codePreview,
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
        const newCode = upsertNodeDirective(code, mermaidId, {
            x: Math.round(node.position.x),
            y: Math.round(node.position.y),
        });

        editSourceRef.current = 'graph';
        setCode(newCode);
    }, [isReady, code]);

    const breadcrumbs = useMemo(
        () => [...diagramStack.map((entry) => entry.title), currentTitle],
        [diagramStack, currentTitle]
    );

    const openNestedDiagram = useCallback((node: Node<MermaidNodeData>) => {
        const meta = node.data?.meta;
        const diagram = meta?.diagram as DiagramMeta | undefined;
        if (!diagram?.mermaidman) return;

        const title = diagram.title || node.data?.label || node.data?.mermaidId || 'Nested';
        setDiagramStack((prev) => [
            ...prev,
            { title: currentTitle, code, parentNodeId: currentParentNodeId },
        ]);
        setCurrentTitle(title);
        setCurrentParentNodeId(node.data?.mermaidId ?? node.id);
        setSelectedNodeId(null);
        setCode(diagram.mermaidman);
    }, [code, currentTitle, currentParentNodeId]);

    const createAndOpenNestedDiagram = useCallback((node: Node<MermaidNodeData>) => {
        const mermaidId = node.data?.mermaidId ?? node.id;
        const title = node.data?.label || mermaidId;
        const seedDiagram = `graph TD\nA[${title}]\n`;
        const updatedParent = upsertNodeDirective(code, mermaidId, {
            kind: 'diagram',
            diagram: { title, mermaidman: seedDiagram },
        });

        setDiagramStack((prev) => [
            ...prev,
            { title: currentTitle, code: updatedParent, parentNodeId: currentParentNodeId },
        ]);
        setCurrentTitle(title);
        setCurrentParentNodeId(mermaidId);
        setSelectedNodeId(null);
        setCode(seedDiagram);
    }, [code, currentTitle, currentParentNodeId]);

    const navigateUp = useCallback(() => {
        if (diagramStack.length === 0 || !currentParentNodeId) return;
        const parent = diagramStack[diagramStack.length - 1];
        const updatedParentCode = upsertNodeDirective(parent.code, currentParentNodeId, {
            diagram: { mermaidman: code },
        });
        setDiagramStack((prev) => prev.slice(0, -1));
        setCurrentTitle(parent.title);
        setCurrentParentNodeId(parent.parentNodeId);
        setSelectedNodeId(null);
        setCode(updatedParentCode);
    }, [diagramStack, currentParentNodeId, code]);

    const updateSelectedNodeMeta = useCallback((patch: Record<string, unknown>) => {
        if (!selectedNode) return;
        const mermaidId = selectedNode.data?.mermaidId ?? selectedNode.id;
        const updated = upsertNodeDirective(code, mermaidId, patch);
        editSourceRef.current = 'text';
        setCode(updated);
    }, [selectedNode, code]);

    const selectedMeta = (selectedNode?.data?.meta ?? {}) as NodeMeta;
    const selectedKind =
        typeof selectedMeta.kind === 'string' ? selectedMeta.kind : selectedNode?.data?.kind;
    const selectedDiagram = selectedMeta.diagram as DiagramMeta | undefined;
    const selectedCode = selectedMeta.code as CodeMeta | undefined;

    if (!isReady) {
        return (
            <div className="flex items-center justify-center h-screen bg-white">
                <div className="animate-pulse font-mono text-lg">Initializing Rust Engine...</div>
            </div>
        );
    }

    const canNavigateUp = diagramStack.length > 0;

    return (
        <div className="flex h-screen w-full flex-col overflow-hidden bg-white text-black">
            <div className="flex items-center justify-between border-b-2 border-black bg-white px-4 py-2">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={navigateUp}
                        disabled={!canNavigateUp}
                        className={cn(
                            "border-2 border-black px-2 py-1 text-[10px] font-mono uppercase tracking-widest",
                            canNavigateUp ? "bg-black text-white" : "cursor-not-allowed bg-white text-slate-400"
                        )}
                    >
                        Back
                    </button>
                    <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest">
                        {breadcrumbs.map((crumb, index) => (
                            <span
                                key={`${crumb}-${index}`}
                                className={index === breadcrumbs.length - 1 ? "text-black" : "text-slate-500"}
                            >
                                {crumb}
                                {index < breadcrumbs.length - 1 ? " /" : ""}
                            </span>
                        ))}
                    </div>
                </div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                    {canNavigateUp ? "Nested diagram" : "Root diagram"}
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Left Pane: Editor */}
                <div className="w-1/3 min-w-[360px] border-r-2 border-black flex flex-col bg-white">
                    <div className="p-3 border-b-2 border-black bg-black text-white font-mono text-xs uppercase tracking-widest flex justify-between items-center">
                        <span>{currentTitle}.mmd+</span>
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
                    <div className="border-t-2 border-black bg-white">
                        <div className="px-3 py-2 border-b-2 border-black bg-black text-white text-[10px] font-mono uppercase tracking-widest">
                            Node Inspector
                        </div>
                        {selectedNode ? (
                            <div className="p-3 text-xs">
                                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono uppercase tracking-widest text-slate-500">
                                    <span>Mermaid ID</span>
                                    <span className="truncate text-black">{selectedNode.data?.mermaidId}</span>
                                    <span>UID</span>
                                    <span className="truncate text-black">{selectedNode.id}</span>
                                </div>
                                <div className="mt-3">
                                    <label className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                                        Kind
                                    </label>
                                    <select
                                        value={selectedKind ?? ''}
                                        onChange={(e) => {
                                            const value = e.target.value || undefined;
                                            updateSelectedNodeMeta({ kind: value });
                                        }}
                                        className="mt-1 w-full border-2 border-black bg-white px-2 py-1 text-xs font-mono"
                                    >
                                        <option value="">(unset)</option>
                                        <option value="card">card</option>
                                        <option value="note">note</option>
                                        <option value="code">code</option>
                                        <option value="media">media</option>
                                        <option value="diagram">diagram</option>
                                        <option value="markdown">markdown</option>
                                        <option value="oembed">oembed</option>
                                    </select>
                                </div>
                                {(selectedKind === 'diagram' || selectedDiagram?.mermaidman) && (
                                    <div className="mt-4 border-t-2 border-black pt-3">
                                        <label className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                                            Diagram Title
                                        </label>
                                        <input
                                            value={selectedDiagram?.title ?? ''}
                                            onChange={(e) =>
                                                updateSelectedNodeMeta({ diagram: { title: e.target.value } })
                                            }
                                            className="mt-1 w-full border-2 border-black bg-white px-2 py-1 text-xs font-mono"
                                            placeholder="Subflow"
                                        />
                                        <div className="mt-2 flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    selectedDiagram?.mermaidman && openNestedDiagram(selectedNode)
                                                }
                                                disabled={!selectedDiagram?.mermaidman}
                                                className={cn(
                                                    "border-2 border-black px-2 py-1 text-[10px] font-mono uppercase tracking-widest",
                                                    selectedDiagram?.mermaidman
                                                        ? "bg-black text-white"
                                                        : "cursor-not-allowed bg-white text-slate-400"
                                                )}
                                            >
                                                Open
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => createAndOpenNestedDiagram(selectedNode)}
                                                className="border-2 border-black bg-white px-2 py-1 text-[10px] font-mono uppercase tracking-widest"
                                            >
                                                Create + Open
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {(selectedKind === 'code' || selectedCode?.content || selectedCode?.language) && (
                                    <div className="mt-4 border-t-2 border-black pt-3">
                                        <label className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                                            Code Language
                                        </label>
                                        <input
                                            value={selectedCode?.language ?? ''}
                                            onChange={(e) =>
                                                updateSelectedNodeMeta({
                                                    kind: 'code',
                                                    code: { language: e.target.value },
                                                })
                                            }
                                            className="mt-1 w-full border-2 border-black bg-white px-2 py-1 text-xs font-mono"
                                            placeholder="auto"
                                        />
                                        <label className="mt-3 block text-[10px] font-mono uppercase tracking-widest text-slate-500">
                                            Code Content
                                        </label>
                                        <textarea
                                            value={selectedCode?.content ?? ''}
                                            onChange={(e) =>
                                                updateSelectedNodeMeta({
                                                    kind: 'code',
                                                    code: { content: e.target.value },
                                                })
                                            }
                                            rows={4}
                                            className="mt-1 w-full resize-none border-2 border-black bg-white px-2 py-1 text-xs font-mono"
                                            placeholder="Paste code..."
                                        />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="p-3 text-[10px] font-mono uppercase tracking-widest text-slate-500">
                                Select a node to edit metadata or open nested diagrams.
                            </div>
                        )}
                    </div>
                    <div className="p-2 border-t-2 border-black text-[10px] font-mono text-slate-500 text-center">
                        Drag nodes on the right to update coordinates.
                    </div>
                </div>

                {/* Right Pane: Canvas */}
                <div className="flex-1 h-full bg-[#fafafa]">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        nodeTypes={NODE_TYPES}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onNodeDragStop={onNodeDragStop}
                        onNodeClick={(_event, node) => setSelectedNodeId(node.id)}
                        onNodeDoubleClick={(_event, node) => openNestedDiagram(node as Node<MermaidNodeData>)}
                        onPaneClick={() => setSelectedNodeId(null)}
                        fitView
                    >
                        <Background color="#000" gap={25} size={1} variant={BackgroundVariant.Dots} />
                        <Controls className="!bg-white !border-2 !border-black !shadow-none" />
                    </ReactFlow>
                </div>
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
