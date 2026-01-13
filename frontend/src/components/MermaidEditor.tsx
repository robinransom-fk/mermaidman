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
import { Badge } from '@/components/radical-ai-studio-kit/radical-ai-studio-kit/ui/Badge';
import { Breadcrumbs, type BreadcrumbItem } from '@/components/radical-ai-studio-kit/radical-ai-studio-kit/ui/Breadcrumbs';
import { Button } from '@/components/radical-ai-studio-kit/radical-ai-studio-kit/ui/Button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/radical-ai-studio-kit/radical-ai-studio-kit/ui/Card';
import { Divider } from '@/components/radical-ai-studio-kit/radical-ai-studio-kit/ui/Divider';
import { Input } from '@/components/radical-ai-studio-kit/radical-ai-studio-kit/ui/Input';
import { Textarea } from '@/components/radical-ai-studio-kit/radical-ai-studio-kit/ui/Textarea';
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
    childItems?: string[];
    childCount?: number;
    onMetaChange?: (patch: Record<string, unknown>) => void;
    onOpenNested?: () => void;
    onCreateNested?: () => void;
};

function MermaidNode({ data, selected }: NodeProps<MermaidNodeData>) {
    const kind = data.kind ?? (typeof data.meta?.kind === 'string' ? data.meta?.kind : undefined);
    const hasDiagram = Boolean(data.meta?.diagram && typeof data.meta.diagram === 'object');
    const codePreview = data.codePreview;
    const childItems = data.childItems ?? [];
    const childCount = data.childCount ?? childItems.length;

    return (
        <div className="relative">
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
            <Card
                padding="sm"
                shadow={selected ? "lg" : "sm"}
                className={cn(
                    "min-w-[160px] max-w-[260px] bg-card",
                    selected ? "ring-2 ring-black ring-offset-2" : "ring-0"
                )}
            >
                <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-black">{data.label}</div>
                    {kind && (
                        <Badge variant="outline" color="gray" size="sm">
                            {kind}
                        </Badge>
                    )}
                </div>
                {data.diagramPreview && (
                    <div className="mt-2 border-2 border-border bg-muted px-2 py-1 text-[10px] uppercase tracking-wide">
                        {data.diagramPreview}
                    </div>
                )}
                {childItems.length > 0 && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                        {childItems.map((item) => (
                            <div
                                key={item}
                                className="border-2 border-border bg-card px-1.5 py-1 text-[10px] font-bold uppercase tracking-wide"
                            >
                                {item}
                            </div>
                        ))}
                        {childCount > childItems.length && (
                            <div className="border-2 border-border bg-muted px-1.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                                +{childCount - childItems.length} more
                            </div>
                        )}
                    </div>
                )}
                {codePreview && (
                    <pre className="mt-2 max-h-28 overflow-hidden whitespace-pre-wrap border-2 border-border bg-black px-2 py-1 text-[10px] text-green-200">
                        {codePreview}
                    </pre>
                )}
                {hasDiagram && (
                    <div className="mt-2 text-[9px] uppercase tracking-widest text-muted-foreground">
                        Double-click to open
                    </div>
                )}
                <div className="mt-3 space-y-2">
                    <label className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
                        Kind
                    </label>
                    <select
                        value={kind ?? ''}
                        onChange={(e) => {
                            const value = e.target.value || undefined;
                            data.onMetaChange?.({ kind: value });
                        }}
                        className="h-9 w-full border-3 border-border bg-card px-2 text-[10px] font-bold"
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
                {(kind === 'diagram' || hasDiagram) && (
                    <div className="mt-3 space-y-2">
                        <Input
                            value={(data.meta?.diagram as DiagramMeta | undefined)?.title ?? ''}
                            onChange={(e) => data.onMetaChange?.({ diagram: { title: e.target.value } })}
                            size="sm"
                            placeholder="Diagram title"
                        />
                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                size="sm"
                                variant="solid"
                                color="black"
                                onClick={() => data.onOpenNested?.()}
                                disabled={!data.meta?.diagram}
                            >
                                Open
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                color="black"
                                onClick={() => data.onCreateNested?.()}
                            >
                                Create
                            </Button>
                        </div>
                    </div>
                )}
                {(kind === 'code' || data.meta?.code) && (
                    <div className="mt-3 space-y-2">
                        <Input
                            value={(data.meta?.code as CodeMeta | undefined)?.language ?? ''}
                            onChange={(e) =>
                                data.onMetaChange?.({
                                    kind: 'code',
                                    code: { language: e.target.value },
                                })
                            }
                            size="sm"
                            placeholder="language"
                        />
                        <Textarea
                            value={(data.meta?.code as CodeMeta | undefined)?.content ?? ''}
                            onChange={(e) =>
                                data.onMetaChange?.({
                                    kind: 'code',
                                    code: { content: e.target.value },
                                })
                            }
                            className="min-h-[90px] text-[10px] font-mono"
                            placeholder="code..."
                        />
                    </div>
                )}
            </Card>
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
                    let childItems: string[] | undefined;
                    let childCount: number | undefined;

                    if (diagramSource) {
                        if (parse_mermaidman) {
                            try {
                                const nested = parse_mermaidman(diagramSource) as any;
                                const nodeCount = Array.isArray(nested?.nodes) ? nested.nodes.length : 0;
                                const edgeCount = Array.isArray(nested?.edges) ? nested.edges.length : 0;
                                diagramPreview = `${nodeCount} nodes, ${edgeCount} edges`;
                                if (Array.isArray(nested?.nodes)) {
                                    childCount = nested.nodes.length;
                                    childItems = nested.nodes
                                        .slice(0, 4)
                                        .map((child: { label?: string; id?: string }) => child.label || child.id)
                                        .filter(Boolean);
                                }
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
                            childItems,
                            childCount,
                            onMetaChange: (patch: Record<string, unknown>) =>
                                applyNodePatch(n.mermaidId, patch),
                            onOpenNested: () =>
                                openNestedDiagram(n.label || n.mermaidId, n.mermaidId, diagram),
                            onCreateNested: () =>
                                createAndOpenNestedDiagram(n.label || n.mermaidId, n.mermaidId),
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

    const navigateToBreadcrumb = useCallback((index: number) => {
        if (index < 0 || index >= breadcrumbs.length - 1) return;
        let nextCode = code;
        let nextParentNodeId = currentParentNodeId;
        let nextTitle = currentTitle;
        let nextStack = [...diagramStack];

        while (nextStack.length > index) {
            const parent = nextStack[nextStack.length - 1];
            if (!nextParentNodeId) break;
            nextCode = upsertNodeDirective(parent.code, nextParentNodeId, {
                diagram: { mermaidman: nextCode },
            });
            nextParentNodeId = parent.parentNodeId;
            nextTitle = parent.title;
            nextStack = nextStack.slice(0, -1);
        }

        setDiagramStack(nextStack);
        setCurrentTitle(nextTitle);
        setCurrentParentNodeId(nextParentNodeId);
        setSelectedNodeId(null);
        setCode(nextCode);
    }, [breadcrumbs.length, code, currentParentNodeId, currentTitle, diagramStack]);

    const openNestedDiagram = useCallback(
        (nodeLabel: string | undefined, mermaidId: string, diagram?: DiagramMeta) => {
            if (!diagram?.mermaidman) return;

            const title = diagram.title || nodeLabel || mermaidId || 'Nested';
            setDiagramStack((prev) => [
                ...prev,
                { title: currentTitle, code, parentNodeId: currentParentNodeId },
            ]);
            setCurrentTitle(title);
            setCurrentParentNodeId(mermaidId);
            setSelectedNodeId(null);
            setCode(diagram.mermaidman);
        },
        [code, currentTitle, currentParentNodeId]
    );

    const createAndOpenNestedDiagram = useCallback(
        (nodeLabel: string | undefined, mermaidId: string) => {
            const title = nodeLabel || mermaidId;
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
        },
        [code, currentTitle, currentParentNodeId]
    );

    const navigateUp = useCallback(() => {
        if (diagramStack.length === 0) return;
        navigateToBreadcrumb(diagramStack.length - 1);
    }, [diagramStack.length, navigateToBreadcrumb]);

    const applyNodePatch = useCallback((mermaidId: string, patch: Record<string, unknown>) => {
        editSourceRef.current = 'text';
        setCode((prev) => upsertNodeDirective(prev, mermaidId, patch));
    }, []);

    const updateSelectedNodeMeta = useCallback(
        (patch: Record<string, unknown>) => {
            if (!selectedNode) return;
            const mermaidId = selectedNode.data?.mermaidId ?? selectedNode.id;
            applyNodePatch(mermaidId, patch);
        },
        [selectedNode, applyNodePatch]
    );

    const selectedMeta = (selectedNode?.data?.meta ?? {}) as NodeMeta;
    const selectedKind =
        typeof selectedMeta.kind === 'string' ? selectedMeta.kind : selectedNode?.data?.kind;
    const selectedDiagram = selectedMeta.diagram as DiagramMeta | undefined;
    const selectedCode = selectedMeta.code as CodeMeta | undefined;

    const breadcrumbItems = useMemo<BreadcrumbItem[]>(
        () =>
            breadcrumbs.map((label, index) => ({
                label,
                onClick: index < breadcrumbs.length - 1 ? () => navigateToBreadcrumb(index) : undefined,
            })),
        [breadcrumbs, navigateToBreadcrumb]
    );

    if (!isReady) {
        return (
            <div className="flex items-center justify-center h-screen bg-white">
                <div className="animate-pulse font-mono text-lg">Initializing Rust Engine...</div>
            </div>
        );
    }

    const canNavigateUp = diagramStack.length > 0;

    return (
        <div className="flex h-screen w-full flex-col overflow-hidden text-black">
            <div className="flex items-center justify-between border-b-3 border-border bg-card px-4 py-3">
                <div className="flex items-center gap-3">
                    <Button
                        type="button"
                        onClick={navigateUp}
                        disabled={!canNavigateUp}
                        size="sm"
                        variant="solid"
                        color="black"
                    >
                        Back
                    </Button>
                    <Breadcrumbs items={breadcrumbItems} className="text-sm" />
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" color="gray" size="sm">
                        {canNavigateUp ? "Nested diagram" : "Root diagram"}
                    </Badge>
                    <Badge variant="solid" color="blue" size="sm">
                        Engine ready
                    </Badge>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Left Pane: Editor */}
                <div className="w-1/3 min-w-[360px] border-r-3 border-border bg-muted p-4 flex flex-col gap-4">
                    <Card padding="none" shadow="sm" className="flex flex-1 flex-col overflow-hidden">
                        <CardHeader className="border-b-3 border-border bg-primary text-primary-foreground px-4 py-3">
                            <div className="flex items-center justify-between gap-2">
                                <div className="text-xs font-mono uppercase tracking-widest">
                                    {currentTitle}.mmd+
                                </div>
                                <Badge variant="outline" color="yellow" size="sm">
                                    live
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 p-0 pt-0">
                            <textarea
                                value={code}
                                onChange={(e) => {
                                    editSourceRef.current = 'text';
                                    setCode(e.target.value);
                                }}
                                className="h-full w-full resize-none bg-transparent p-4 font-mono text-sm outline-none selection:bg-yellow-200"
                                spellCheck={false}
                                placeholder="graph TD..."
                            />
                        </CardContent>
                        <div className="border-t-3 border-border px-3 py-2 text-center text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                            Drag nodes on the right to update coordinates.
                        </div>
                    </Card>

                    <Card padding="none" shadow="sm" className="overflow-hidden">
                        <CardHeader className="border-b-3 border-border px-4 py-3">
                            <CardTitle className="text-base">Node Inspector</CardTitle>
                            <CardDescription>
                                {selectedNode
                                    ? "Tune metadata for the selected node."
                                    : "Select a node to edit metadata or open nested diagrams."}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 p-4 pt-4">
                            {selectedNode ? (
                                <>
                                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                                        <span>Mermaid ID</span>
                                        <span className="truncate text-foreground">
                                            {selectedNode.data?.mermaidId}
                                        </span>
                                        <span>UID</span>
                                        <span className="truncate text-foreground">{selectedNode.id}</span>
                                    </div>
                                    <Divider label="Meta" />
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                                            Kind
                                        </label>
                                        <select
                                            value={selectedKind ?? ''}
                                            onChange={(e) => {
                                                const value = e.target.value || undefined;
                                                updateSelectedNodeMeta({ kind: value });
                                            }}
                                            className="h-11 w-full border-3 border-border bg-card px-3 text-xs font-mono font-bold"
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
                                        <>
                                            <Divider label="Nested Diagram" />
                                            <Input
                                                label="Diagram Title"
                                                value={selectedDiagram?.title ?? ''}
                                                onChange={(e) =>
                                                    updateSelectedNodeMeta({ diagram: { title: e.target.value } })
                                                }
                                                size="sm"
                                            />
                                            <div className="flex flex-wrap gap-2">
                                                <Button
                                                    type="button"
                                                    onClick={() =>
                                                        selectedDiagram?.mermaidman &&
                                                        openNestedDiagram(
                                                            selectedNode.data?.label,
                                                            selectedNode.data?.mermaidId ?? selectedNode.id,
                                                            selectedDiagram
                                                        )
                                                    }
                                                    disabled={!selectedDiagram?.mermaidman}
                                                    size="sm"
                                                    variant="solid"
                                                    color="black"
                                                >
                                                    Open
                                                </Button>
                                                <Button
                                                    type="button"
                                                    onClick={() =>
                                                        createAndOpenNestedDiagram(
                                                            selectedNode.data?.label,
                                                            selectedNode.data?.mermaidId ?? selectedNode.id
                                                        )
                                                    }
                                                    size="sm"
                                                    variant="outline"
                                                    color="black"
                                                >
                                                    Create + Open
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                    {(selectedKind === 'code' || selectedCode?.content || selectedCode?.language) && (
                                        <>
                                            <Divider label="Code Node" />
                                            <Input
                                                label="Code Language"
                                                value={selectedCode?.language ?? ''}
                                                onChange={(e) =>
                                                    updateSelectedNodeMeta({
                                                        kind: 'code',
                                                        code: { language: e.target.value },
                                                    })
                                                }
                                                size="sm"
                                            />
                                            <Textarea
                                                label="Code Content"
                                                value={selectedCode?.content ?? ''}
                                                onChange={(e) =>
                                                    updateSelectedNodeMeta({
                                                        kind: 'code',
                                                        code: { content: e.target.value },
                                                    })
                                                }
                                                className="min-h-[120px] text-xs font-mono"
                                                placeholder="Paste code..."
                                            />
                                        </>
                                    )}
                                </>
                            ) : null}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Pane: Canvas */}
                <div className="flex-1 h-full bg-card">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        nodeTypes={NODE_TYPES}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onNodeDragStop={onNodeDragStop}
                        onNodeClick={(_event, node) => setSelectedNodeId(node.id)}
                        onNodeDoubleClick={(_event, node) => {
                            const data = (node as Node<MermaidNodeData>).data;
                            if (data?.meta?.diagram) {
                                openNestedDiagram(data.label, data.mermaidId, data.meta.diagram as DiagramMeta);
                            }
                        }}
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
