import React, { useMemo, useState } from 'react';

import type { TaskGraph, TaskNode } from '../../../features/agent-orchestrator';

// ── Layout constants ──────────────────────────────────────────

const NODE_WIDTH = 200;
const NODE_HEIGHT = 72;
const LAYER_GAP_X = 60;
const ROW_GAP_Y = 24;
const PADDING = 40;
const SVG_MIN_WIDTH = 600;
const SVG_MIN_HEIGHT = 400;

// ── Status colors ─────────────────────────────────────────────

const STATUS_COLORS: Record<TaskNode['status'], { bg: string; border: string; text: string; dot: string }> = {
  pending:   { bg: 'var(--color-surface, #1e1e2e)', border: 'var(--color-border, #45475a)', text: 'var(--color-secondary, #6c7086)', dot: '#6c7086' },
  running:   { bg: 'var(--color-surface, #1e1e2e)', border: '#f59e0b', text: '#f59e0b', dot: '#f59e0b' },
  completed: { bg: 'var(--color-surface, #1e1e2e)', border: '#10b981', text: '#10b981', dot: '#10b981' },
  failed:    { bg: 'var(--color-surface, #1e1e2e)', border: '#ef4444', text: '#ef4444', dot: '#ef4444' },
  cancelled: { bg: 'var(--color-surface, #1e1e2e)', border: '#6b7280', text: '#6b7280', dot: '#6b7280' },
  skipped:   { bg: 'var(--color-surface, #1e1e2e)', border: '#8b5cf6', text: '#8b5cf6', dot: '#8b5cf6' },
};

// ── Layout algorithm (Sugiyama-style layer assignment) ───────

interface NodePosition {
  id: string;
  x: number;
  y: number;
  layer: number;
}

function computeLayout(nodes: TaskNode[]): { positions: Map<string, NodePosition>; width: number; height: number } {
  if (nodes.length === 0) {
    return { positions: new Map(), width: SVG_MIN_WIDTH, height: SVG_MIN_HEIGHT };
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const layers = new Map<string, number>();

  // Topological layer assignment
  function getLayer(id: string): number {
    if (layers.has(id)) {
      return layers.get(id)!;
    }
    const node = nodeMap.get(id);
    if (!node || node.dependsOn.length === 0) {
      layers.set(id, 0);
      return 0;
    }
    let maxDepLayer = 0;
    for (const dep of node.dependsOn) {
      if (nodeMap.has(dep)) {
        maxDepLayer = Math.max(maxDepLayer, getLayer(dep) + 1);
      }
    }
    layers.set(id, maxDepLayer);
    return maxDepLayer;
  }

  for (const node of nodes) {
    getLayer(node.id);
  }

  // Group by layer
  const byLayer = new Map<number, string[]>();
  let maxLayer = 0;
  for (const [id, layer] of layers) {
    if (!byLayer.has(layer)) {
      byLayer.set(layer, []);
    }
    byLayer.get(layer)!.push(id);
    maxLayer = Math.max(maxLayer, layer);
  }

  // Assign positions
  const positions = new Map<string, NodePosition>();
  let totalHeight = 0;

  for (let layer = 0; layer <= maxLayer; layer++) {
    const ids = byLayer.get(layer) ?? [];
    const layerHeight = ids.length * (NODE_HEIGHT + ROW_GAP_Y) - ROW_GAP_Y;
    totalHeight = Math.max(totalHeight, layerHeight);

    for (let i = 0; i < ids.length; i++) {
      positions.set(ids[i], {
        id: ids[i],
        x: layer * (NODE_WIDTH + LAYER_GAP_X),
        y: i * (NODE_HEIGHT + ROW_GAP_Y),
        layer,
      });
    }
  }

  const svgWidth = Math.max(SVG_MIN_WIDTH, (maxLayer + 1) * (NODE_WIDTH + LAYER_GAP_X) - LAYER_GAP_X + PADDING * 2);
  const svgHeight = Math.max(SVG_MIN_HEIGHT, totalHeight + PADDING * 2);

  return { positions, width: svgWidth, height: svgHeight };
}

// ── Edge path builder ─────────────────────────────────────────

function buildEdgePath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): string {
  const startX = fromX + NODE_WIDTH;
  const startY = fromY + NODE_HEIGHT / 2;
  const endX = toX;
  const endY = toY + NODE_HEIGHT / 2;
  const midX = (startX + endX) / 2;

  return `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
}

// ── Component ─────────────────────────────────────────────────

interface DagVisualizerProps {
  graph: TaskGraph;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onRetryNode?: (nodeId: string) => void;
  onCancelNode?: (nodeId: string) => void;
}

const DagVisualizer: React.FC<DagVisualizerProps> = ({
  graph,
  selectedNodeId,
  onSelectNode,
}) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const { positions } = useMemo(
    () => computeLayout(graph.nodes),
    [graph.nodes],
  );

  const nodeMap = useMemo(
    () => new Map(graph.nodes.map((n) => [n.id, n])),
    [graph.nodes],
  );

  // Build edges from dependsOn relationships
  const edges = useMemo(() => {
    const result: { from: string; to: string }[] = [];
    for (const node of graph.nodes) {
      for (const dep of node.dependsOn) {
        result.push({ from: dep, to: node.id });
      }
    }
    return result;
  }, [graph.nodes]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.max(0.3, Math.min(2, z + delta)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    // Only start drag on the background, not on nodes
    if ((e.target as SVGElement).closest('.dag-node')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const zoomIn = () => setZoom((z) => Math.min(2, z + 0.15));
  const zoomOut = () => setZoom((z) => Math.max(0.3, z - 0.15));
  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const truncateLabel = (text: string, maxLen: number) =>
    text.length > maxLen ? text.slice(0, maxLen - 1) + '\u2026' : text;

  return (
    <div className="relative flex-1 min-h-0 overflow-hidden rounded-lg border border-border bg-surface">
      {/* Zoom controls */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 shadow-sm">
        <button
          type="button"
          onClick={zoomOut}
          className="h-7 w-7 inline-flex items-center justify-center rounded text-secondary hover:bg-surface-raised hover:text-foreground text-sm font-bold"
        >
          -
        </button>
        <span className="w-12 text-center text-xs text-secondary tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={zoomIn}
          className="h-7 w-7 inline-flex items-center justify-center rounded text-secondary hover:bg-surface-raised hover:text-foreground text-sm font-bold"
        >
          +
        </button>
        <button
          type="button"
          onClick={resetView}
          className="h-7 px-2 inline-flex items-center justify-center rounded text-xs text-secondary hover:bg-surface-raised hover:text-foreground"
        >
          Fit
        </button>
      </div>

      {/* Legend */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-1.5 shadow-sm">
        {(['pending', 'running', 'completed', 'failed'] as const).map((status) => (
          <div key={status} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: STATUS_COLORS[status].dot }}
            />
            <span className="text-[11px] text-secondary capitalize">{status}</span>
          </div>
        ))}
      </div>

      {/* SVG canvas */}
      <svg
        className="h-full w-full"
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <g transform={`translate(${PADDING + pan.x}, ${PADDING + pan.y}) scale(${zoom})`}>
          {/* Edges */}
          {edges.map((edge) => {
            const from = positions.get(edge.from);
            const to = positions.get(edge.to);
            if (!from || !to) return null;

            const toNode = nodeMap.get(edge.to);
            const isHighlight =
              (selectedNodeId === edge.from || selectedNodeId === edge.to);

            return (
              <path
                key={`${edge.from}->${edge.to}`}
                d={buildEdgePath(from.x, from.y, to.x, to.y)}
                fill="none"
                stroke={isHighlight ? '#3b82f6' : 'var(--color-border, #45475a)'}
                strokeWidth={isHighlight ? 2 : 1.5}
                strokeDasharray={toNode?.status === 'pending' ? '6,4' : undefined}
                opacity={isHighlight ? 1 : 0.6}
              />
            );
          })}

          {/* Nodes */}
          {graph.nodes.map((node) => {
            const pos = positions.get(node.id);
            if (!pos) return null;

            const colors = STATUS_COLORS[node.status];
            const isSelected = selectedNodeId === node.id;

            return (
              <g
                key={node.id}
                className="dag-node"
                transform={`translate(${pos.x}, ${pos.y})`}
                onClick={() => onSelectNode(isSelected ? null : node.id)}
                style={{ cursor: 'pointer' }}
              >
                {/* Selection highlight ring */}
                {isSelected && (
                  <rect
                    x={-3}
                    y={-3}
                    width={NODE_WIDTH + 6}
                    height={NODE_HEIGHT + 6}
                    rx={10}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    opacity={0.6}
                  />
                )}

                {/* Node body */}
                <rect
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx={8}
                  fill={colors.bg}
                  stroke={colors.border}
                  strokeWidth={isSelected ? 2 : 1}
                />

                {/* Status dot */}
                <circle
                  cx={16}
                  cy={16}
                  r={5}
                  fill={colors.dot}
                />

                {/* Node ID */}
                <text
                  x={28}
                  y={20}
                  className="select-none"
                  fill="var(--color-foreground, #cdd6f4)"
                  fontSize={12}
                  fontWeight={600}
                >
                  {truncateLabel(node.id, 18)}
                </text>

                {/* Engine label */}
                <text
                  x={16}
                  y={38}
                  className="select-none"
                  fill="var(--color-secondary, #6c7086)"
                  fontSize={10}
                >
                  {node.agentEngine}
                </text>

                {/* Prompt preview */}
                <text
                  x={16}
                  y={56}
                  className="select-none"
                  fill="var(--color-secondary, #6c7086)"
                  fontSize={10}
                >
                  {truncateLabel(node.prompt.split('\n')[0], 24)}
                </text>

                {/* Running pulse animation */}
                {node.status === 'running' && (
                  <rect
                    width={NODE_WIDTH}
                    height={NODE_HEIGHT}
                    rx={8}
                    fill="none"
                    stroke={colors.border}
                    strokeWidth={2}
                    opacity={0.5}
                  >
                    <animate
                      attributeName="opacity"
                      values="0.5;0.1;0.5"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </rect>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};

export default DagVisualizer;
