'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
} from 'reactflow';
import 'reactflow/dist/style.css';

import SourceNode from '@/components/nodes/SourceNode';
import ExpenseNode from '@/components/nodes/ExpenseNode';
import Sidebar from '@/components/Sidebar';
import SummarySidebar from '@/components/SummarySidebar';
import ImportModal from '@/components/ImportModal';
import { createSourceNode, createExpenseNode } from '@/utils/nodeFactory';
import { useCanvasFinancials } from '@/hooks/useCanvasFinancials';
import { useSession } from '@/hooks/useSession';
import { syncCanvas } from '@/services/compassApi';
import type { AnyNodeData } from '@/types/nodes';
import type { AccountantAnalysis, SyncStatus } from '@/types/api';

const SYNC_DEBOUNCE_MS = 1500;

const nodeTypes: NodeTypes = {
  source: SourceNode,
  expense: ExpenseNode,
};

const CANVAS_STORAGE_KEY = 'compass_canvas';

const DEFAULT_NODES: Node<AnyNodeData>[] = [
  { id: 'demo-src-1', type: 'source',  position: { x: 160, y: 100 }, data: { label: 'Monthly Sales', value: 8500 } },
  { id: 'demo-exp-1', type: 'expense', position: { x: 160, y: 260 }, data: { label: 'Rent',          value: 2500, category: 'Overhead' } },
  { id: 'demo-exp-2', type: 'expense', position: { x: 160, y: 390 }, data: { label: 'Staff Wages',   value: 3200, category: 'Staff' } },
];
const DEFAULT_EDGES: Edge[] = [];

function loadCanvas(): { nodes: Node<AnyNodeData>[]; edges: Edge[] } {
  try {
    const saved = localStorage.getItem(CANVAS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.nodes?.length) return { nodes: parsed.nodes, edges: parsed.edges ?? [] };
    }
  } catch { /* ignore corrupt storage */ }
  return { nodes: DEFAULT_NODES, edges: DEFAULT_EDGES };
}

const miniMapColor = (node: Node): string => {
  if (node.type === 'source') return '#22c55e';
  if (node.type === 'expense') return '#ef4444';
  return '#71717a';
};

const edgeStrokeForSource = (nodes: Node[], sourceId: string): string => {
  const src = nodes.find((n) => n.id === sourceId);
  if (src?.type === 'source') return '#22c55e';
  if (src?.type === 'expense') return '#ef4444';
  return '#71717a';
};

export default function FinancialSandbox() {
  const initial = loadCanvas();
  const [nodes, setNodes, onNodesChange] = useNodesState<AnyNodeData>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const [rfInstance, setRfInstance]      = useState<ReactFlowInstance | null>(null);
  const [showImport, setShowImport]      = useState(false);

  // Auto-save canvas to localStorage on every change
  useEffect(() => {
    localStorage.setItem(CANVAS_STORAGE_KEY, JSON.stringify({ nodes, edges }));
  }, [nodes, edges]);

  // AI state
  const [aiAnalysis, setAiAnalysis]   = useState<AccountantAnalysis | null>(null);
  const [syncStatus, setSyncStatus]   = useState<SyncStatus>('idle');
  const syncTimerRef                  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Session (localStorage UUID → /session/start)
  const { sessionId, error: sessionError } = useSession();

  // Derived financials (pure client-side, always fast)
  const financials = useCanvasFinancials(nodes);

  // When backend is unreachable on session init, mark error once
  useEffect(() => {
    if (sessionError) setSyncStatus('error');
  }, [sessionError]);

  // Debounced canvas sync → /sandbox/sync → Accountant analysis
  useEffect(() => {
    if (!sessionId || syncStatus === 'error') return;

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(async () => {
      setSyncStatus('syncing');
      try {
        const result = await syncCanvas(sessionId, nodes as unknown[], edges as unknown[]);
        setAiAnalysis(result.analysis);
        setSyncStatus('synced');
      } catch {
        setSyncStatus('error');
      }
    }, SYNC_DEBOUNCE_MS);

    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, sessionId]);

  // Canvas event handlers
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            animated: true,
            type: 'smoothstep',
            style: { stroke: edgeStrokeForSource(nodes, connection.source ?? ''), strokeWidth: 2 },
          },
          eds
        )
      );
    },
    [nodes, setEdges]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!rfInstance) return;
      const type = e.dataTransfer.getData('application/reactflow');
      if (!type) return;
      const position = rfInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setNodes((nds) =>
        nds.concat(type === 'source' ? createSourceNode(position) : createExpenseNode(position))
      );
    },
    [rfInstance, setNodes]
  );

  // Called by ImportModal after successful /import/sheets
  const handleImport = useCallback(
    (importedNodes: Node<AnyNodeData>[], importedEdges: unknown[]) => {
      // Offset imported nodes so they don't stack on top of existing ones
      const offset = { x: 500, y: 100 };
      const positioned = importedNodes.map((n, i) => ({
        ...n,
        position: { x: offset.x + (i % 2) * 220, y: offset.y + Math.floor(i / 2) * 130 },
      }));
      setNodes((nds) => nds.concat(positioned));
      setEdges((eds) => eds.concat(importedEdges as Edge[]));
    },
    [setNodes, setEdges]
  );

  return (
    <div className="flex h-full bg-zinc-950">
      <Sidebar onImportClick={() => setShowImport(true)} />

      <div className="flex-1 h-full" onDrop={onDrop} onDragOver={onDragOver}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setRfInstance}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.4 }}
          deleteKeyCode="Backspace"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#3f3f46" />
          <Controls className="!bg-zinc-800 !border-zinc-700 [&>button]:!bg-zinc-800 [&>button]:!border-zinc-600 [&>button]:!text-zinc-300" />
          <MiniMap
            nodeColor={miniMapColor}
            className="!bg-zinc-900 !border !border-zinc-700"
            maskColor="rgba(9,9,11,0.6)"
          />
        </ReactFlow>
      </div>

      <SummarySidebar
        financials={financials}
        sessionId={sessionId}
        aiAnalysis={aiAnalysis}
        syncStatus={syncStatus}
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
