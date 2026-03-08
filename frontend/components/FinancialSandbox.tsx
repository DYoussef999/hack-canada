'use client';

import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  type ReactFlowInstance,
  type NodeDragHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';

import SourceNode  from '@/components/nodes/SourceNode';
import ExpenseNode from '@/components/nodes/ExpenseNode';
import GroupNode   from '@/components/nodes/GroupNode';
import Sidebar        from '@/components/Sidebar';
import SummarySidebar from '@/components/SummarySidebar';
import ImportModal    from '@/components/ImportModal';

import { createSourceNode, createExpenseNode } from '@/utils/nodeFactory';
import {
  buildGroupLayout,
  bucketForNode,
  childRelativePos,
  expandedGroupH,
  GROUP_W,
  GROUP_HEADER_H,
  COLLAPSED_GROUP_H,
  recalcGroupLayout,
  rePackGroup,
  settleGroupOverlaps,
} from '@/utils/groupLayout';
import { useCanvasFinancials } from '@/hooks/useCanvasFinancials';
import { useSession }          from '@/hooks/useSession';
import { syncCanvas, syncCanvasGemini } from '@/services/compassApi';
import type { AnyNodeData, GroupNodeData } from '@/types/nodes';
import type { AccountantAnalysis, FinancialHealthReport, SyncStatus } from '@/types/api';

// ── Edge helpers ──────────────────────────────────────────────────────────────

/**
 * Returns 'direct-cost' when an expense node/group is connected to a revenue
 * node/group — these edges are rendered differently and drive segment margin calc.
 */
function classifyEdge(
  connection: Connection,
  nodes: Node<AnyNodeData>[]
): 'direct-cost' | 'general' {
  const src = nodes.find((n) => n.id === connection.source);
  const tgt = nodes.find((n) => n.id === connection.target);
  if (!src || !tgt) return 'general';

  const srcIsExpense =
    src.type === 'expense' ||
    (src.type === 'group' && (src.data as GroupNodeData).groupCategory !== 'revenue');

  const tgtIsRevenue =
    tgt.type === 'source' ||
    (tgt.type === 'group' && (tgt.data as GroupNodeData).groupCategory === 'revenue');

  return srcIsExpense && tgtIsRevenue ? 'direct-cost' : 'general';
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SYNC_DEBOUNCE_MS  = 1500;
const CANVAS_STORAGE_KEY = 'ploutos_canvas_v3';

const nodeTypes: NodeTypes = {
  source:  SourceNode,
  expense: ExpenseNode,
  group:   GroupNode,
};

// ── Default seeded state ──────────────────────────────────────────────────────

const SEED_NODES: Node<AnyNodeData>[] = [
  // ── Revenue ──────────────────────────────────────────────────────────────────
  { id: 'seed-src-1', type: 'source',  position: { x: 0, y: 0 }, data: { label: 'Product Sales',    value: 8500 } },
  { id: 'seed-src-2', type: 'source',  position: { x: 0, y: 0 }, data: { label: 'Service Revenue',  value: 3200 } },
  // ── Labor (Staff) ─────────────────────────────────────────────────────────────
  { id: 'seed-exp-1', type: 'expense', position: { x: 0, y: 0 }, data: { label: 'Staff Wages',      value: 3200, category: 'Staff'    } },
  { id: 'seed-exp-2', type: 'expense', position: { x: 0, y: 0 }, data: { label: 'Owner Draw',       value: 2000, category: 'Staff'    } },
  // ── Fixed Costs (Overhead) ────────────────────────────────────────────────────
  { id: 'seed-exp-3', type: 'expense', position: { x: 0, y: 0 }, data: { label: 'Rent',             value: 2500, category: 'Overhead' } },
  { id: 'seed-exp-4', type: 'expense', position: { x: 0, y: 0 }, data: { label: 'Utilities',        value: 380,  category: 'Overhead' } },
  // ── Variable Costs (OpEx) ─────────────────────────────────────────────────────
  { id: 'seed-exp-5', type: 'expense', position: { x: 0, y: 0 }, data: { label: 'Shipping',         value: 650,  category: 'OpEx'     } },
  { id: 'seed-exp-6', type: 'expense', position: { x: 0, y: 0 }, data: { label: 'Marketing',        value: 800,  category: 'OpEx'     } },
  { id: 'seed-exp-7', type: 'expense', position: { x: 0, y: 0 }, data: { label: 'Inventory / COGS', value: 1200, category: 'OpEx'     } },
];

// ── localStorage helpers ──────────────────────────────────────────────────────

function loadCanvas(): { nodes: Node<AnyNodeData>[]; edges: Edge[] } {
  try {
    const saved = localStorage.getItem(CANVAS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.nodes?.length) {
        const raw = parsed.nodes as Node<AnyNodeData>[];
        const existingIds = new Set<string>(raw.map((n) => n.id));

        // Strip parentNode refs to groups that no longer exist — prevents the
        // "Parent node X not found" React Flow crash on stale localStorage.
        const sanitized = raw.map((n) => {
          if (n.parentNode && !existingIds.has(n.parentNode)) {
            return {
              ...n,
              parentNode: undefined,
              extent: undefined,
              data: { ...n.data, groupId: undefined },
            } as Node<AnyNodeData>;
          }
          return n;
        });

        return { nodes: sanitized, edges: parsed.edges ?? [] };
      }
    }
  } catch { /* ignore corrupt storage */ }

  // First load — build grouped layout from seed data
  const { nodes, edges } = buildGroupLayout(SEED_NODES);
  return { nodes, edges };
}

// ── Minimap / edge helpers ────────────────────────────────────────────────────

const miniMapColor = (node: Node): string => {
  if (node.type === 'source')  return '#10b981'; // emerald-500
  if (node.type === 'expense') return '#f43f5e'; // rose-500
  if (node.type === 'group')   return '#1e293b'; // slate-800
  return '#475569';
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function FinancialSandbox() {
  const initial = loadCanvas();
  const [nodes, setNodes, onNodesChange] = useNodesState<AnyNodeData>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const [rfInstance, setRfInstance]      = useState<ReactFlowInstance | null>(null);
  const [showImport, setShowImport]      = useState(false);
  const [sidebarWidth, setSidebarWidth]  = useState(288);
  const isDragging   = useRef(false);
  const dragStartX   = useRef(0);
  const dragStartW   = useRef(0);

  // AI state
  const [aiAnalysis, setAiAnalysis]   = useState<AccountantAnalysis | null>(null);
  const [geminiReport, setGeminiReport] = useState<FinancialHealthReport | null>(null);
  const [syncStatus, setSyncStatus]   = useState<SyncStatus>('idle');
  const syncTimerRef                = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { sessionId, error: sessionError } = useSession();
  const financials = useCanvasFinancials(nodes, edges);

  // ── Auto-save ──────────────────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem(CANVAS_STORAGE_KEY, JSON.stringify({ nodes, edges }));
  }, [nodes, edges]);

  // ── Session error → mark offline ──────────────────────────────────────────
  useEffect(() => {
    if (sessionError) setSyncStatus('error');
  }, [sessionError]);

  // ── Auto-remove empty groups + heal orphaned children ─────────────────────
  useEffect(() => {
    const allIds    = new Set(nodes.map((n) => n.id));
    const groupIds  = new Set(nodes.filter((n) => n.type === 'group').map((n) => n.id));
    const occupied  = new Set(
      nodes.filter((n) => n.parentNode && groupIds.has(n.parentNode)).map((n) => n.parentNode!)
    );
    const emptyIds  = Array.from(groupIds).filter((id) => !occupied.has(id));
    const hasOrphans = nodes.some((n) => n.parentNode && !allIds.has(n.parentNode));

    if (emptyIds.length === 0 && !hasOrphans) return;

    setNodes((nds) => {
      const currentIds = new Set(nds.map((n) => n.id));
      return nds
        .filter((n) => !emptyIds.includes(n.id))
        .map((n) => {
          if (n.parentNode && !currentIds.has(n.parentNode)) {
            // Orphaned child — clear parent ref so React Flow doesn't crash
            return { ...n, parentNode: undefined, extent: undefined,
              data: { ...n.data, groupId: undefined } } as Node<AnyNodeData>;
          }
          return n;
        });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  // ── Debounced AI canvas sync ───────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    
    syncTimerRef.current = setTimeout(async () => {
      setSyncStatus('syncing');
      
      // Filter out group nodes — the Accountant agents only care about 
      // nodes with financial values (source/expense).
      const financialNodes = nodes.filter(n => n.type === 'source' || n.type === 'expense');
      
      const [backboardResult, geminiResult] = await Promise.allSettled([
        syncCanvas(sessionId, financialNodes as unknown[], edges as unknown[], financials.segments as unknown[]),
        syncCanvasGemini(financialNodes as unknown[], edges as unknown[]),
      ]);

      let backboardOk = false;
      let geminiOk    = false;

      if (backboardResult.status === 'fulfilled') {
        setAiAnalysis(backboardResult.value.analysis);
        backboardOk = true;
      }
      
      if (geminiResult.status === 'fulfilled') {
        setGeminiReport(geminiResult.value);
        geminiOk = true;
      }

      setSyncStatus(backboardOk || geminiOk ? 'synced' : 'error');
    }, SYNC_DEBOUNCE_MS);

    return () => { if (syncTimerRef.current) clearTimeout(syncTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, sessionId]);

  // ── onConnect ─────────────────────────────────────────────────────────────
  const onConnect = useCallback(
    (connection: Connection) => {
      const edgeType = classifyEdge(connection, nodes);
      const edgeProps: Partial<Edge> =
        edgeType === 'direct-cost'
          ? {
              type: 'smoothstep',
              animated: false,
              style: { stroke: '#f59e0b', strokeWidth: 1.5 },
              label: 'COGS',
              labelStyle: { fontSize: 9, fill: '#f59e0b', fontWeight: 600, fontFamily: 'inherit' },
              labelBgStyle: { fill: '#0f172a', fillOpacity: 0.85 },
              labelBgPadding: [3, 5] as [number, number],
              data: { edgeType: 'direct-cost' },
            }
          : {
              type: 'smoothstep',
              animated: false,
              style: { stroke: '#334155', strokeWidth: 1, strokeDasharray: '4 3' },
              data: { edgeType: 'general' },
            };

      setEdges((eds) => addEdge({ ...connection, ...edgeProps }, eds));
    },
    [setEdges, nodes]
  );

  // ── Drag-over (allow drop) ────────────────────────────────────────────────
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  // ── Drop from sidebar → assign to correct group ───────────────────────────
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!rfInstance) return;
      const type = e.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const dropPos  = rfInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const newNode  = type === 'source'
        ? createSourceNode(dropPos)
        : createExpenseNode(dropPos);

      // Find the matching group
      const category    = bucketForNode(newNode as Node<AnyNodeData>);
      const groupId     = `group-${category}`;

      setNodes((nds) => {
        const group    = nds.find((n) => n.id === groupId);
        if (!group) {
          // No group exists — add as standalone
          return nds.concat(newNode as Node<AnyNodeData>);
        }
        const siblings  = nds.filter((n) => n.parentNode === groupId);
        const childPos  = childRelativePos(siblings.length);
        const newHeight = expandedGroupH(siblings.length + 1);

        const assignedNode: Node<AnyNodeData> = {
          ...newNode as Node<AnyNodeData>,
          parentNode: groupId,
          position:   childPos,
          data: { ...newNode.data, groupId },
        };

        return [
          ...nds.map((n) =>
            n.id === groupId
              ? { ...n, style: { ...n.style, height: newHeight } }
              : n
          ),
          assignedNode,
        ];
      });
    },
    [rfInstance, setNodes]
  );

  // ── Drag-stop: Re-entry, Containment, and Overlap Settlement ───────────────
  const onNodeDragStop: NodeDragHandler = useCallback(
    (_, node) => {
      if (!node) return; // Add null check to prevent crash

      // 1. Group-to-Group overlap settlement
      if (node.type === 'group') {
        setNodes((nds) => settleGroupOverlaps(node.id, nds));
        return;
      }

      // 2. Re-entry Logic: dropping a standalone node into a group
      if (!node.parentNode) {
        setNodes((nds) => {
          const groups = nds.filter((n) => n.type === 'group');
          // Find if node was dropped over any group
          const targetGroup = groups.find((g) => {
            const gW = (g.style?.width as number) ?? GROUP_W;
            const gH = (g.style?.height as number) ?? COLLAPSED_GROUP_H;
            return (
              node.position.x >= g.position.x &&
              node.position.x <= g.position.x + gW &&
              node.position.y >= g.position.y &&
              node.position.y <= g.position.y + gH
            );
          });

          if (targetGroup) {
            const siblings = nds.filter((n) => n.parentNode === targetGroup.id);
            const updated = nds.map((n) => {
              if (n.id !== node.id) return n;
              return {
                ...n,
                parentNode: targetGroup.id,
                position: childRelativePos(siblings.length),
                data: { ...n.data, isolated: false, groupId: targetGroup.id, manualGroup: true },
              };
            });
            return rePackGroup(targetGroup.id, updated);
          }
          return nds;
        });
        return;
      }

      // 3. Containment Logic: snap child to inner edge if falling out
      setNodes((nds) => {
        const parent = nds.find((n) => n.id === node.parentNode);
        if (!parent) return nds;

        const parentW = (parent.style?.width  as number) ?? GROUP_W;
        const parentH = (parent.style?.height as number) ?? COLLAPSED_GROUP_H;
        
        const OUT_MARGIN = 40;
        const isOutside  =
          node.position.x < -OUT_MARGIN ||
          node.position.x > parentW - 60 ||
          node.position.y < -OUT_MARGIN ||
          node.position.y > parentH - 20;

        if (isOutside) {
          // Dragged out — promote to standalone
          const absX = parent.position.x + node.position.x;
          const absY = parent.position.y + node.position.y;
          let updated = nds.map((n) => {
            if (n.id !== node.id) return n;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { parentNode, ...rest } = n as Node<AnyNodeData>;
            return {
              ...rest,
              position: { x: absX, y: absY },
              data: { ...n.data, isolated: true, groupId: undefined, manualGroup: true },
            } as Node<AnyNodeData>;
          });
          return recalcGroupLayout(updated);
        } else {
          // Stayed inside — just re-stack to keep it tidy
          return rePackGroup(parent.id, nds);
        }
      });
    },
    [setNodes]
  );

  // ── Import CSV → group all imported nodes ─────────────────────────────────
  const handleImport = useCallback(
    (importedNodes: Node<AnyNodeData>[], importedEdges: unknown[]) => {
      setNodes((existing) => {
        // Strip old group nodes and re-build with merged children
        const existingLeafs = existing.filter((n) => n.type !== 'group' && !(n.data as { isolated?: boolean }).isolated);
        const { nodes: newLayout } = buildGroupLayout([...existingLeafs, ...importedNodes]);
        return newLayout;
      });
      setEdges((eds) => eds.concat(importedEdges as Edge[]));
    },
    [setNodes, setEdges]
  );

  const onResizeMouseDown = useCallback((e: ReactMouseEvent) => {
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartW.current = sidebarWidth;

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = dragStartX.current - ev.clientX;
      setSidebarWidth(Math.max(220, Math.min(520, dragStartW.current + delta)));
    };
    const onUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [sidebarWidth]);

  return (
    <div className="flex h-full relative" style={{ background: '#e5e0d8' }}>
      <Sidebar onImportClick={() => setShowImport(true)} />

      <div className="flex-1 h-full" onDrop={onDrop} onDragOver={onDragOver}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setRfInstance}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          snapToGrid={true}
          snapGrid={[20, 20]}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          deleteKeyCode="Backspace"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="#a8a096" />
          <Controls className="!bg-white !border-[var(--forest-rim)] [&>button]:!bg-white [&>button]:!border-[var(--forest-rim)] [&>button]:!text-[var(--moss)]" />
          <MiniMap
            nodeColor={miniMapColor}
            className="!bg-white !border !border-[var(--forest-rim)]"
            maskColor="rgba(250,248,244,0.7)"
          />
        </ReactFlow>
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={onResizeMouseDown}
        className="group relative w-3 h-full shrink-0 cursor-col-resize flex items-center justify-center transition-colors hover:bg-[var(--sage)]/10"
        style={{ background: 'var(--forest-rim)', borderLeft: '1px solid var(--forest-rim)', borderRight: '1px solid var(--forest-rim)' }}
      >
        {/* Grip dots */}
        <div className="flex flex-col gap-[3px] opacity-40 group-hover:opacity-100 transition-opacity">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-[3px] h-[3px] rounded-full" style={{ background: 'var(--forest)' }} />
          ))}
        </div>
      </div>

      <SummarySidebar
        financials={financials}
        sessionId={sessionId}
        aiAnalysis={aiAnalysis}
        geminiReport={geminiReport}
        syncStatus={syncStatus}
        width={sidebarWidth}
      />

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImport={handleImport}
        />
      )}
    </div>
  );
}
