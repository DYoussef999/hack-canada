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
  type EdgeTypes,
  type ReactFlowInstance,
  type NodeDragHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';

import SourceNode  from '@/components/nodes/SourceNode';
import ExpenseNode from '@/components/nodes/ExpenseNode';
import { GradientDirectCostEdge } from '@/components/edges/GradientDirectCostEdge';
import Sidebar        from '@/components/Sidebar';
import SummarySidebar from '@/components/SummarySidebar';
import ImportModal    from '@/components/ImportModal';

import { createSourceNode, createExpenseNode } from '@/utils/nodeFactory';
import { useCanvasFinancials } from '@/hooks/useCanvasFinancials';
import { useSession }          from '@/hooks/useSession';
import { syncCanvas, syncCanvasGemini, autoWireNodes } from '@/services/compassApi';
import type { AnyNodeData } from '@/types/nodes';
import type { AccountantAnalysis, FinancialHealthReport, SyncStatus } from '@/types/api';

// ── Edge helpers ──────────────────────────────────────────────────────────────

/**
 * Returns 'direct-cost' when an expense node is connected directly to a revenue node.
 */
function classifyEdge(
  connection: Connection,
  nodes: Node<AnyNodeData>[]
): 'direct-cost' | 'general' {
  const src = nodes.find((n) => n.id === connection.source);
  const tgt = nodes.find((n) => n.id === connection.target);
  if (!src || !tgt) return 'general';

  const srcIsExpense = src.type === 'expense';
  const tgtIsRevenue = tgt.type === 'source';

  return srcIsExpense && tgtIsRevenue ? 'direct-cost' : 'general';
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SYNC_DEBOUNCE_MS  = 1500;
const CANVAS_STORAGE_KEY = 'ploutos_canvas_v3';

const nodeTypes: NodeTypes = {
  source:  SourceNode,
  expense: ExpenseNode,
};

const edgeTypes: EdgeTypes = {
  'gradient-direct-cost': GradientDirectCostEdge,
};

// ── Default seeded state ──────────────────────────────────────────────────────

const SEED_NODES: Node<AnyNodeData>[] = [
  // ── Revenue ──────────────────────────────────────────────────────────────────
  { id: 'seed-src-1', type: 'source',  position: { x: 100, y: 100 }, data: { label: 'Product Sales',    value: 8500 } },
  { id: 'seed-src-2', type: 'source',  position: { x: 100, y: 240 }, data: { label: 'Service Revenue',  value: 3200 } },
  // ── Staff & Labour ────────────────────────────────────────────────────────────
  { id: 'seed-exp-1', type: 'expense', position: { x: 400, y: 100 }, data: { label: 'Staff Wages',      value: 3200, category: 'Staff & Labour'    } },
  { id: 'seed-exp-2', type: 'expense', position: { x: 400, y: 240 }, data: { label: 'Owner Draw',       value: 2000, category: 'Staff & Labour'    } },
  // ── Fixed Costs (Storefront & Admin) ──────────────────────────────────────────
  { id: 'seed-exp-3', type: 'expense', position: { x: 700, y: 100 }, data: { label: 'Rent',             value: 2500, category: 'Physical Storefront' } },
  { id: 'seed-exp-4', type: 'expense', position: { x: 700, y: 240 }, data: { label: 'Utilities',        value: 380,  category: 'Compliance & Admin' } },
  // ── Variable Costs ────────────────────────────────────────────────────────────
  { id: 'seed-exp-5', type: 'expense', position: { x: 1000, y: 100 }, data: { label: 'Shipping',         value: 650,  category: 'Delivery & Fulfillment'     } },
  { id: 'seed-exp-6', type: 'expense', position: { x: 1000, y: 240 }, data: { label: 'Marketing',        value: 800,  category: 'Marketing & Acquisition'     } },
  { id: 'seed-exp-7', type: 'expense', position: { x: 1300, y: 100 }, data: { label: 'Inventory / COGS', value: 1200, category: 'Inventory & Suppliers'     } },
];

// ── localStorage helpers ──────────────────────────────────────────────────────

function loadCanvas(): { nodes: Node<AnyNodeData>[]; edges: Edge[] } {
  try {
    const saved = localStorage.getItem(CANVAS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.nodes?.length) {
        // Filter out group nodes and any nodes with parentNode references
        const filteredNodes = parsed.nodes.filter((n: Node<AnyNodeData>) => 
          n.type !== 'group' && !n.parentNode
        );
        if (filteredNodes.length) {
          return { nodes: filteredNodes, edges: parsed.edges ?? [] };
        }
      }
    }
  } catch { /* ignore corrupt storage */ }

  // First load — use seed data
  return { nodes: SEED_NODES, edges: [] };
}

// ── Minimap / edge helpers ────────────────────────────────────────────────────

const miniMapColor = (node: Node): string => {
  if (node.type === 'source')  return '#10b981'; // emerald-500
  if (node.type === 'expense') return '#f43f5e'; // rose-500
  return '#475569';
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function FinancialSandbox() {
  const initial = loadCanvas();
  const [nodes, setNodes, onNodesChange] = useNodesState<AnyNodeData>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const [rfInstance, setRfInstance]      = useState<ReactFlowInstance | null>(null);
  const [showImport, setShowImport]      = useState(false);
  const [autoWiring, setAutoWiring]      = useState(false);
  const [sidebarWidth, setSidebarWidth]  = useState(288);
  const isDragging   = useRef(false);
  const dragStartX   = useRef(0);
  const dragStartW   = useRef(0);
  const draggedNodeId = useRef<string | null>(null);

  // AI state
  const [aiAnalysis, setAiAnalysis]   = useState<AccountantAnalysis | null>(null);
  const [geminiReport, setGeminiReport] = useState<FinancialHealthReport | null>(null);
  const [syncStatus, setSyncStatus]   = useState<SyncStatus>('idle');
  const syncTimerRef                = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Node selection state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const { sessionId, session, error: sessionError } = useSession();
  const financials = useCanvasFinancials(nodes, edges);

  // Helper to find all nodes connected to a given node (recursively)
  const getConnectedNodeIds = useCallback(
    (nodeId: string): Set<string> => {
      const connected = new Set<string>();
      const visited = new Set<string>();
      
      const traverse = (id: string) => {
        if (visited.has(id)) return;
        visited.add(id);
        
        edges.forEach((edge) => {
          if (edge.source === id) {
            connected.add(edge.target);
            traverse(edge.target);
          }
          if (edge.target === id) {
            connected.add(edge.source);
            traverse(edge.source);
          }
        });
      };
      
      traverse(nodeId);
      return connected;
    },
    [edges]
  );



  // ── Auto-save ──────────────────────────────────────────────────────────────
  useEffect(() => {
    // Filter out group nodes before saving (only save source/expense nodes)
    const nodesToSave = nodes.filter(n => n.type !== 'group' && !n.parentNode);
    localStorage.setItem(CANVAS_STORAGE_KEY, JSON.stringify({ nodes: nodesToSave, edges }));
  }, [nodes, edges]);

  // ── Session error → mark offline ──────────────────────────────────────────
  useEffect(() => {
    if (sessionError) setSyncStatus('error');
  }, [sessionError]);



  // ── Debounced AI canvas sync ───────────────────────────────────────────────
  useEffect(() => {
    // Wait for session to be fully created on backend (not just sessionId)
    if (!sessionId || !session) return;
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
      } else if (backboardResult.status === 'rejected') {
        console.error('Backboard sync failed:', backboardResult.reason);
      }
      
      if (geminiResult.status === 'fulfilled') {
        console.log('Gemini sync successful:', geminiResult.value);
        setGeminiReport(geminiResult.value);
        geminiOk = true;
      } else if (geminiResult.status === 'rejected') {
        console.error('Gemini sync failed:', geminiResult.reason);
      }

      setSyncStatus(backboardOk || geminiOk ? 'synced' : 'error');
    }, SYNC_DEBOUNCE_MS);

    return () => { if (syncTimerRef.current) clearTimeout(syncTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, sessionId, session]);

  // ── onConnect ─────────────────────────────────────────────────────────────
  const onConnect = useCallback(
    (connection: Connection) => {
      const edgeType = classifyEdge(connection, nodes);
      const edgeProps: Partial<Edge> =
        edgeType === 'direct-cost'
          ? {
              type: 'gradient-direct-cost',
              animated: false,
              data: { edgeType: 'direct-cost' },
            }
          : {
              type: 'smoothstep',
              animated: false,
              style: { stroke: '#334155', strokeWidth: 1, strokeDasharray: '4 3' },
              data: { edgeType: 'general' },
            };

      setEdges((eds) => {
        // If creating a direct-cost edge, remove any existing edges from the same source handle
        // This ensures expenses only have 1 outgoing wire
        let filtered = eds;
        if (edgeType === 'direct-cost') {
          filtered = eds.filter((e) => !(
            e.source === connection.source &&
            e.sourceHandle === connection.sourceHandle &&
            (e.data as any)?.edgeType === 'direct-cost'
          ));
        }
        return addEdge({ ...connection, ...edgeProps }, filtered);
      });
    },
    [setEdges, nodes]
  );

  // ── Node click → select and highlight ──────────────────────────────────────
  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node<AnyNodeData>) => {
      event.stopPropagation();
      setSelectedNodeId(node.id);
    },
    []
  );

  // ── Canvas click → deselect ───────────────────────────────────────────────
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // ── Node drag start → track which node is being dragged ──────────────────
  const onNodeDragStart = useCallback(
    (event: React.MouseEvent, node: Node<AnyNodeData>) => {
      draggedNodeId.current = node.id;
    },
    []
  );

  // ── Node drag stop → merge revenue nodes if dropped on another ──────────────
  const onNodeDragStop = useCallback(
    (event: React.MouseEvent, draggedNode: Node<AnyNodeData>) => {
      if (draggedNode.type !== 'source') {
        draggedNodeId.current = null;
        return; // Only merge revenue nodes
      }

      const draggedNodeBox = {
        x0: draggedNode.position.x,
        x1: draggedNode.position.x + 190, // Approximate width
        y0: draggedNode.position.y,
        y1: draggedNode.position.y + 100, // Approximate height
      };

      // Find if dropped on another revenue node (collision detection)
      const targetNode = nodes.find((n) => {
        if (n.type !== 'source' || n.id === draggedNode.id) return false;

        const targetBox = {
          x0: n.position.x,
          x1: n.position.x + 190,
          y0: n.position.y,
          y1: n.position.y + 100,
        };

        // Simple AABB collision
        return !(
          draggedNodeBox.x1 < targetBox.x0 ||
          draggedNodeBox.x0 > targetBox.x1 ||
          draggedNodeBox.y1 < targetBox.y0 ||
          draggedNodeBox.y0 > targetBox.y1
        );
      });

      if (!targetNode) {
        draggedNodeId.current = null;
        return;
      }

      // Merge: combine values and names
      const draggedData = draggedNode.data as any;
      const targetData = targetNode.data as any;
      
      const draggedValue = draggedData.value || 0;
      const targetValue = targetData.value || 0;
      const draggedLabel = draggedData.label || 'Revenue';
      const targetLabel = targetData.label || 'Revenue';

      // Determine which is larger and which is smaller
      const isTargetLarger = targetValue >= draggedValue;
      const largerNode = isTargetLarger ? targetNode : draggedNode;
      const smallerNode = isTargetLarger ? draggedNode : targetNode;
      const largerData = isTargetLarger ? targetData : draggedData;
      const smallerData = isTargetLarger ? draggedData : targetData;
      const largerLabel = isTargetLarger ? targetLabel : draggedLabel;
      const smallerLabel = isTargetLarger ? draggedLabel : targetLabel;

      // Create merged node
      const mergedNode: Node<AnyNodeData> = {
        ...largerNode,
        data: {
          ...largerData,
          value: largerData.value + smallerData.value,
          label: `${largerLabel} + ${smallerLabel}`,
        },
      };

      // Update nodes: replace larger with merged, remove smaller
      setNodes((nds) =>
        nds
          .map((n) => (n.id === largerNode.id ? mergedNode : n))
          .filter((n) => n.id !== smallerNode.id)
      );

      // Update edges: redirect any edges from smaller node to merged node
      setEdges((eds) =>
        eds.map((edge) => {
          if (edge.target === smallerNode.id) {
            return { ...edge, target: largerNode.id };
          }
          if (edge.source === smallerNode.id) {
            return { ...edge, source: largerNode.id };
          }
          return edge;
        })
      );

      console.log(
        `[MergeRevenue] Merged "${smallerLabel}" ($${smallerData.value}) into "${largerLabel}" ($${largerData.value})`,
        `New total: $${largerData.value + smallerData.value}`
      );

      draggedNodeId.current = null;
    },
    [nodes, setNodes, setEdges]
  );

  // ── Edge right-click → delete ──────────────────────────────────────────────
  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      setEdges((eds) => eds.filter((e) => e.id !== edge.id));
    },
    [setEdges]
  );

  // ── Drag-over (allow drop) ────────────────────────────────────────────────
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  // ── Drop from sidebar → create free-floating node ────────────────────────
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!rfInstance) return;
      const dragData = e.dataTransfer.getData('application/reactflow');
      if (!dragData) return;

      // Parse drag data: either "source" or "expense:Category Name"
      const [type, ...categoryParts] = dragData.split(':');
      const category = categoryParts.length > 0 ? categoryParts.join(':') : undefined;

      const dropPos  = rfInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const newNode  = type === 'source'
        ? createSourceNode(dropPos)
        : createExpenseNode(dropPos, undefined, category as any);

      setNodes((nds) => nds.concat(newNode as Node<AnyNodeData>));
    },
    [rfInstance, setNodes]
  );



  // ── Import CSV → add imported nodes freely ────────────────────────────────
  const handleImport = useCallback(
    (importedNodes: Node<AnyNodeData>[], importedEdges: unknown[]) => {
      setNodes((existing) => [...existing, ...importedNodes]);
      setEdges((eds) => eds.concat(importedEdges as Edge[]));
    },
    [setNodes, setEdges]
  );

  // ── Auto-wire unconnected expenses to revenue nodes ────────────────────────
  const handleAutoWire = useCallback(async () => {
    setAutoWiring(true);
    try {
      // Get all revenue nodes
      const revenueNodes = nodes.filter(n => n.type === 'source');
      console.log('[AutoWire] Found revenue nodes:', revenueNodes.length);
      if (revenueNodes.length === 0) {
        console.warn('[AutoWire] No revenue nodes to wire to');
        setAutoWiring(false);
        return;
      }

      // Find expense nodes that don't have any direct-cost connection to revenue
      const expenseNodesWithConnections = new Set<string>();
      edges.forEach(edge => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        if (sourceNode?.type === 'expense' && (edge.data as any)?.edgeType === 'direct-cost') {
          expenseNodesWithConnections.add(edge.source);
        }
      });

      const unconnectedExpenses = nodes.filter(
        n => n.type === 'expense' && !expenseNodesWithConnections.has(n.id)
      );

      console.log('[AutoWire] Found unconnected expenses:', unconnectedExpenses.length);
      if (unconnectedExpenses.length === 0) {
        console.warn('[AutoWire] All expenses are already wired');
        setAutoWiring(false);
        return;
      }

      // Prepare node data for API
      const revenueNodeData = revenueNodes.map(n => ({
        id: n.id,
        label: (n.data as any).label || `Revenue ${n.id}`,
        type: n.type as string,
      }));

      const expenseNodeData = unconnectedExpenses.map(n => ({
        id: n.id,
        label: (n.data as any).label || `Expense ${n.id}`,
        type: n.type as string,
        category: (n.data as any).category,
      }));

      console.log('[AutoWire] Requesting mappings from API...');
      console.log('[AutoWire] Revenue nodes:', revenueNodeData);
      console.log('[AutoWire] Expense nodes:', expenseNodeData);

      // Call API to get wiring suggestions
      const result = await autoWireNodes(revenueNodeData, expenseNodeData);
      console.log('[AutoWire] Full API response:', result);
      console.log('[AutoWire] Mappings array:', result.mappings);
      console.log('[AutoWire] Mappings length:', result.mappings?.length);

      if (!result.mappings || result.mappings.length === 0) {
        console.warn('[AutoWire] No mappings returned from API');
        console.log('[AutoWire] Response keys:', Object.keys(result));
        setAutoWiring(false);
        return;
      }

      // Create edges from the mappings
      setEdges((eds) => {
        const newEdges = result.mappings.map(mapping => {
          const edge: Edge = {
            id: `${mapping.source}-${mapping.target}-auto`,
            source: mapping.source,
            target: mapping.target,
            type: 'gradient-direct-cost',
            animated: false,
            data: { edgeType: 'direct-cost' },
          };
          console.log('[AutoWire] Creating edge:', edge);
          return edge;
        });
        console.log('[AutoWire] Total edges to add:', newEdges.length);
        return [...eds, ...newEdges];
      });

      // After wiring, find revenue nodes without incoming connections and merge them
      setEdges((currentEdges) => {
        setNodes((currentNodes) => {
          // Find which revenue nodes have incoming direct-cost edges
          const revenueWithConnections = new Set<string>();
          currentEdges.forEach(edge => {
            const target = currentNodes.find(n => n.id === edge.target);
            if (target?.type === 'source' && (edge.data as any)?.edgeType === 'direct-cost') {
              revenueWithConnections.add(edge.target);
            }
          });

          const allRevenueNodes = currentNodes.filter(n => n.type === 'source');
          const unconnectedRevenues = allRevenueNodes.filter(n => !revenueWithConnections.has(n.id));

          console.log('[AutoWire] Revenue nodes with connections:', revenueWithConnections.size);
          console.log('[AutoWire] Unconnected revenue nodes:', unconnectedRevenues.length);

          if (unconnectedRevenues.length === 0) {
            console.log('[AutoWire] All revenue nodes have incoming connections');
            return currentNodes;
          }

          // Helper: calculate semantic similarity (simple string matching)
          const calculateSimilarity = (str1: string, str2: string): number => {
            const s1 = str1.toLowerCase();
            const s2 = str2.toLowerCase();
            if (s1 === s2) return 100;
            
            // Check for substring matches
            if (s1.includes(s2) || s2.includes(s1)) return 80;
            
            // Check for keyword overlap
            const words1 = s1.split(/\s+/);
            const words2 = s2.split(/\s+/);
            const commonWords = words1.filter(w => words2.includes(w)).length;
            if (commonWords > 0) return 60 + (commonWords * 10);
            
            return 0;
          };

          // Map of unconnected node IDs to their merge targets
          const mergeMap = new Map<string, string>();

          // For each unconnected revenue, find the best match among connected revenues
          unconnectedRevenues.forEach((unconnectedNode) => {
            const unconnectedData = unconnectedNode.data as any;
            const unconnectedLabel = unconnectedData.label || 'Revenue';

            // Find best match among connected revenues
            let bestMatch: Node<AnyNodeData> | null = null;
            let bestScore = 0;

            allRevenueNodes.forEach((connectedNode) => {
              if (connectedNode.id === unconnectedNode.id || !revenueWithConnections.has(connectedNode.id)) return;
              
              const connectedData = connectedNode.data as any;
              const connectedLabel = connectedData.label || 'Revenue';
              const similarity = calculateSimilarity(unconnectedLabel, connectedLabel);

              if (similarity > bestScore) {
                bestScore = similarity;
                bestMatch = connectedNode;
              }
            });

            if (bestMatch) {
              const matched = bestMatch as Node<AnyNodeData>;
              console.log(
                `[AutoWire] Merging unconnected revenue "${unconnectedLabel}" (${bestScore}% match) into "${(matched.data as any).label}"`
              );
              mergeMap.set(unconnectedNode.id, matched.id);
            }
          });

          // Update connected revenue nodes with merged data
          const updatedNodes = currentNodes.map(node => {
            if (node.type !== 'source') return node;

            // Check if any unconnected revenues are merging into this one
            let totalMergedValue = (node.data as any).value || 0;
            let mergedLabels = [(node.data as any).label || 'Revenue'];

            unconnectedRevenues.forEach((unconnected) => {
              if (mergeMap.get(unconnected.id) === node.id) {
                const unconnectedData = unconnected.data as any;
                totalMergedValue += unconnectedData.value || 0;
                mergedLabels.push(unconnectedData.label || 'Revenue');
              }
            });

            if (mergedLabels.length > 1) {
              // This node received merges
              return {
                ...node,
                data: {
                  ...(node.data as any),
                  value: totalMergedValue,
                  label: mergedLabels.join(' + '),
                },
              };
            }

            return node;
          });

          // Remove unconnected revenue nodes (they've been merged)
          const finalNodes = updatedNodes.filter(n => {
            if (n.type !== 'source') return true;
            return !mergeMap.has(n.id); // Keep if not being merged away
          });

          console.log(`[AutoWire] ✓ Merged ${mergeMap.size} unconnected revenue nodes`);
          return finalNodes;
        });

        return currentEdges;
      });

      console.log(`[AutoWire] ✓ Auto-wired ${result.mappings.length} expenses`);
    } catch (error) {
      console.error('[AutoWire] ✗ Error:', error);
    } finally {
      setAutoWiring(false);
    }
  }, [nodes, edges, setEdges, setNodes]);

  // ── Organize nodes into columns by category ────────────────────────────────────
  const handleOrganizeNodes = useCallback(() => {
    setNodes((allNodes) => {
      // Group nodes by type and category
      const groups: Record<string, Node<AnyNodeData>[]> = {};
      
      // Expense nodes grouped by category
      allNodes.filter(n => n.type === 'expense').forEach(node => {
        const category = (node.data as any).category || 'Unknown';
        if (!groups[category]) groups[category] = [];
        groups[category].push(node);
      });
      
      // Revenue nodes in last group (rightmost)
      groups['__revenue'] = allNodes.filter(n => n.type === 'source');

      // Node dimensions and visual constants
      const NODE_WIDTH = 190;  // Fixed width for all nodes
      const NODE_HEIGHT = 160;
      const ROW_GAP = -15;
      const MARGIN_X = 100;
      const MARGIN_Y = 100;
      const BASE_COLUMN_GAP = 80; // Gap after the widest element in column

      // Sort each group by value descending (biggest first)
      Object.keys(groups).forEach(key => {
        groups[key].sort((a, b) => {
          const valA = (a.data as any).value || 0;
          const valB = (b.data as any).value || 0;
          return valB - valA; // Descending
        });
      });

      // Get sorted group keys: expenses only
      const groupKeys = Object.keys(groups).filter(k => k !== '__revenue');
      const revenueNodes = groups['__revenue'];

      // Calculate max width per column (all nodes same fixed width)
      const columnWidths: Record<number, number> = {};
      groupKeys.forEach((key, groupIndex) => {
        columnWidths[groupIndex] = NODE_WIDTH;
      });

      // Calculate revenue column width (fixed)
      const revenueColumnWidth = NODE_WIDTH;

      // Calculate the tallest column height
      let maxColumnHeight = 0;
      groupKeys.forEach(key => {
        const itemCount = groups[key].length;
        const columnHeight = itemCount * NODE_HEIGHT + (itemCount - 1) * ROW_GAP;
        maxColumnHeight = Math.max(maxColumnHeight, columnHeight);
      });

      // Calculate cumulative X positions accounting for column widths
      const columnStartX: Record<number, number> = {};
      let currentX = MARGIN_X;
      groupKeys.forEach((_, groupIndex) => {
        columnStartX[groupIndex] = currentX;
        currentX += columnWidths[groupIndex] + BASE_COLUMN_GAP;
      });
      const revenueStartX = currentX;

      const organized = allNodes.map(node => {
        // Check if this is a revenue node
        if (node.type === 'source') {
          // Find index in revenue group
          const indexInGroup = revenueNodes.findIndex(n => n.id === node.id);
          if (indexInGroup === -1) return node;

          // Position revenues in a row below all expense columns
          const revenueRowY = MARGIN_Y + maxColumnHeight + 50;
          
          // Use fixed node width for all revenues
          const revenueTotalWidth = revenueNodes.length * NODE_WIDTH + (revenueNodes.length - 1) * BASE_COLUMN_GAP;
          
          // Center the entire revenue row
          const revenueRowStartX = MARGIN_X + (currentX - MARGIN_X - revenueTotalWidth) / 2;
          const revenueX = revenueRowStartX + indexInGroup * (NODE_WIDTH + BASE_COLUMN_GAP);

          return {
            ...node,
            position: { x: revenueX, y: revenueRowY },
          };
        }

        // Handle expense nodes
        let groupIndex = -1;
        let indexInGroup = -1;
        
        for (let i = 0; i < groupKeys.length; i++) {
          const key = groupKeys[i];
          const idx = groups[key].findIndex(n => n.id === node.id);
          if (idx !== -1) {
            groupIndex = i;
            indexInGroup = idx;
            break;
          }
        }

        if (groupIndex === -1) return node;

        // Calculate X position (left to right by group, all nodes same width)
        const colX = columnStartX[groupIndex];

        // Calculate Y position: stack nodes vertically with proper spacing
        const groupNodes = groupKeys[groupIndex] ? groups[groupKeys[groupIndex]] : [];
        let cumulativeY = MARGIN_Y;
        
        for (let i = 0; i < indexInGroup; i++) {
          cumulativeY += NODE_HEIGHT + ROW_GAP;
        }

        return {
          ...node,
          position: { x: colX, y: cumulativeY },
        };
      });

      return organized;
    });
  }, [setNodes]);

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

  // ── No collision handling; organize feature manages layout ──────────────────

  return (
    <div className="flex h-full relative" style={{ background: '#e5e0d8' }}>
      <Sidebar onImportClick={() => setShowImport(true)} onCleanupClick={handleOrganizeNodes} onAutoWireClick={handleAutoWire} isAutoWiring={autoWiring} />

      <div className="flex-1 h-full" onDrop={onDrop} onDragOver={onDragOver}>
        <ReactFlow
          nodes={nodes.map((node) => ({
            ...node,
            data: {
              ...node.data,
              isSelected: node.id === selectedNodeId,
              isConnected: selectedNodeId ? getConnectedNodeIds(selectedNodeId).has(node.id) : false,
            },
          }))
          }
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onNodeDragStart={onNodeDragStart}
          onNodeDragStop={onNodeDragStop}
          onPaneClick={onPaneClick}
          onEdgeContextMenu={onEdgeContextMenu}
          onInit={setRfInstance}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
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
