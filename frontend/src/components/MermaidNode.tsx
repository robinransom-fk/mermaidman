
import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card } from '@/components/radical-ai-studio-kit/radical-ai-studio-kit/ui/Card';
import { Badge } from '@/components/radical-ai-studio-kit/radical-ai-studio-kit/ui/Badge';
import { Input } from '@/components/radical-ai-studio-kit/radical-ai-studio-kit/ui/Input';
import { Button } from '@/components/radical-ai-studio-kit/radical-ai-studio-kit/ui/Button';
import { Textarea } from '@/components/radical-ai-studio-kit/radical-ai-studio-kit/ui/Textarea';
import { cn } from '@/lib/utils';
import { type NodeMeta, type DiagramMeta, type CodeMeta, type MediaMeta, type MermaidNodeData } from '@/types/mermaid';


export function MermaidNode({ data, selected }: NodeProps<MermaidNodeData>) {
    const kind = data.kind ?? (typeof data.meta?.kind === 'string' ? data.meta?.kind : undefined);
    const hasDiagram = Boolean(data.meta?.diagram && typeof data.meta.diagram === 'object');
    const codePreview = data.codePreview;
    const childItems = data.childItems ?? [];
    const childCount = data.childCount ?? childItems.length;

    // Use a refined palette for "Whiteboard" aesthetic
    const isSpecialKind = kind && ['note', 'diagram', 'code', 'text', 'image', 'embed'].includes(kind);

    return (
        <div className="relative group">
            <Handle
                type="target"
                position={Position.Left}
                className="!h-2.5 !w-2.5 !rounded-full !border-2 !border-primary !bg-white transition-opacity opacity-0 group-hover:opacity-100"
            />
            <Handle
                type="source"
                position={Position.Right}
                className="!h-2.5 !w-2.5 !rounded-full !border-2 !border-primary !bg-white transition-opacity opacity-0 group-hover:opacity-100"
            />
            <Card
                padding="none"
                className={cn(
                    "min-w-[180px] max-w-[320px] transition-shadow duration-200",
                    // Glassmorphism and specialized styles based on kind
                    kind === 'note' ? "bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800" :
                        kind === 'code' ? "bg-slate-900 text-slate-50 border-slate-700" :
                            kind === 'markdown' ? "bg-white border-border/60" :
                                kind === 'media' ? "bg-transparent border-none shadow-none" :
                                    kind === 'oembed' ? "bg-transparent border-none shadow-none" :
                                        kind === 'text' ? "bg-white border-border/60" :
                                            kind === 'image' ? "bg-transparent border-none shadow-none" :
                                                kind === 'embed' ? "bg-transparent border-none shadow-none" :
                                                    "bg-card/80 backdrop-blur-md",

                    // Selection State
                    selected
                        ? "shadow-[0_0_0_2px_rgba(59,130,246,0.6)] shadow-blue-500/20"
                        : "shadow-sm hover:shadow-md border-border/60"
                )}
            >
                {/* Node Header - Hidden for purely visual nodes like media unless selected */}
                {(!['media', 'oembed', 'image', 'embed'].includes(kind ?? '') || selected) && (
                    <div className={cn(
                        "px-4 py-3 flex items-start justify-between gap-3",
                        kind === 'code' ? "border-b border-slate-800" : "border-b border-border/40",
                        (kind === 'media' || kind === 'oembed' || kind === 'image' || kind === 'embed') && "bg-background/80 backdrop-blur-sm rounded-t-lg border-b"
                    )}>
                        <div className="font-semibold text-sm leading-tight tracking-tight break-words max-w-full">
                            {data.label}
                        </div>
                        {isSpecialKind && (
                            <Badge
                                variant={kind === 'code' ? "solid" : "outline"}
                                color={kind === 'note' ? "yellow" : kind === 'code' ? "gray" : kind === 'text' ? "black" : kind === 'image' ? "purple" : kind === 'embed' ? "blue" : "blue"}
                                size="sm"
                                className="text-[10px] uppercase tracking-wider font-bold h-5 px-1.5"
                            >
                                {kind}
                            </Badge>
                        )}
                    </div>
                )}

                {/* Content Body */}
                <div className="p-1">
                    {/* Markup content */}
                    {kind === 'markdown' && data.meta?.markdown && (
                        <div className="px-4 py-3 text-xs leading-relaxed opacity-90 prose prose-xs dark:prose-invert max-w-none whitespace-pre-wrap">
                            {data.meta.markdown}
                        </div>
                    )}

                    {/* Media content */}
                    {kind === 'media' && (data.meta?.media as MediaMeta | undefined)?.src && (
                        <div className="overflow-hidden rounded-md">
                            <img
                                src={(data.meta.media as MediaMeta).src}
                                alt={(data.meta.media as MediaMeta).alt || data.label}
                                className="w-full h-auto object-cover max-h-[300px]"
                            />
                        </div>
                    )}

                    {/* Embed content */}
                    {kind === 'oembed' && (data.meta?.media as MediaMeta | undefined)?.src && (
                        <div className="overflow-hidden rounded-md w-[300px] h-[170px] bg-black">
                            <iframe
                                src={(data.meta.media as MediaMeta).src}
                                title={data.label}
                                className="w-full h-full border-0"
                                allowFullScreen
                            />
                        </div>
                    )}

                    {/* Text content */}
                    {kind === 'text' && data.meta?.markdown && (
                        <div className="px-4 py-3 text-xs leading-relaxed opacity-90 prose prose-xs dark:prose-invert max-w-none whitespace-pre-wrap">
                            {data.meta.markdown}
                        </div>
                    )}

                    {/* Image content */}
                    {kind === 'image' && (data.meta?.media as MediaMeta | undefined)?.src && (
                        <div className="overflow-hidden rounded-md">
                            <img
                                src={(data.meta.media as MediaMeta).src}
                                alt={(data.meta.media as MediaMeta).alt || data.label}
                                className="w-full h-auto object-cover max-h-[300px]"
                            />
                        </div>
                    )}

                    {/* Embed content */}
                    {kind === 'embed' && (data.meta?.media as MediaMeta | undefined)?.src && (
                        <div className="overflow-hidden rounded-md w-[300px] h-[170px] bg-black">
                            <iframe
                                src={(data.meta.media as MediaMeta).src}
                                title={data.label}
                                className="w-full h-full border-0"
                                allowFullScreen
                            />
                        </div>
                    )}

                    {/* Diagram Preview */}
                    {data.diagramPreview && (
                        <div className="mx-3 my-2 border border-border/50 bg-muted/30 rounded-md p-2 flex flex-col items-center justify-center gap-1.5 text-center">
                            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Nested System</div>
                            <div className="text-xs font-semibold text-foreground">{data.diagramPreview}</div>
                            {childItems.length > 0 && (
                                <div className="flex flex-wrap gap-1 justify-center mt-1">
                                    {childItems.map((item) => (
                                        <div key={item} className="px-1.5 py-0.5 bg-background rounded text-[10px] border border-border/50 text-muted-foreground">
                                            {item}
                                        </div>
                                    ))}
                                    {childCount > childItems.length && (
                                        <div className="px-1.5 py-0.5 text-[10px] text-muted-foreground italic">
                                            +{childCount - childItems.length}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Code Preview - Simplified for Card */}
                    {codePreview && (
                        <div className="mx-3 my-2 rounded-md bg-black/50 p-2 font-mono text-[10px] text-green-300 overflow-x-auto">
                            <pre>{codePreview}</pre>
                        </div>
                    )}

                    {/* Actions - appear on hover or selection */}
                    {(kind === 'diagram' || hasDiagram) && (selected) && (
                        <div className="px-3 pb-3 pt-1 flex gap-2 justify-end animate-in fade-in duration-200">
                            <Button
                                size="sm"
                                variant="solid"
                                color="blue"
                                className="h-7 text-xs"
                                onClick={(e) => { e.stopPropagation(); data.onOpenNested?.(); }}
                            >
                                Open
                            </Button>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}
