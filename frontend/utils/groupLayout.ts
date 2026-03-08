/**
 * groupLayout.ts — Smart Grouping utilities for Compass AI canvas.
 */

import type { Node, Edge } from 'reactflow';
import type { AnyNodeData, GroupCategory, GroupNodeData, NodeCategory } from '@/types/nodes';

// ── Dimensions ────────────────────────────────────────────────────────────────
export const GROUP_W          = 320;  // group container width
export const GROUP_HEADER_H     = 56;  // header bar height (always visible)
export const COLLAPSED_GROUP_H = 88;  // Bug 4: height when collapsed (header + summary)
export const CHILD_H          = 96;  // child node rendered height
export const CHILD_GAP        = 8;   // gap between consecutive children
export const CHILD_PAD_X      = 24;  // 24 px left/right inner padding
export const CHILD_PAD_TOP    = 24;  // padding below header before first child
export const CHILD_PAD_BOTTOM = 24;  // padding after last child

// Derived
export const CHILD_W = GROUP_W - CHILD_PAD_X * 2; // 272 px

// Column grid
export const COL1_X  = 60;
export const COL2_X  = COL1_X + GROUP_W + 60;
export const START_Y = 60;
export const ROW_GAP = 40;

// ── Per-bucket config ─────────────────────────────────────────────────────────
interface BucketConfig {
  label: string;
  groupCategory: GroupCategory;
  colorClass: string;
  column: 1 | 2;
}

export const BUCKET_CONFIG: Record<GroupCategory, BucketConfig> = {
  revenue:  { label: 'Revenue',        groupCategory: 'revenue',  colorClass: 'border-emerald-500 text-emerald-400', column: 1 },
  fixed:    { label: 'Fixed Costs',    groupCategory: 'fixed',    colorClass: 'border-violet-500  text-violet-400',  column: 2 },
  variable: { label: 'Variable Costs', groupCategory: 'variable', colorClass: 'border-rose-500    text-rose-400',    column: 1 },
  labor:    { label: 'Labor',          groupCategory: 'labor',    colorClass: 'border-orange-500  text-orange-400',  column: 2 },
};

const EXPENSE_CAT_TO_GROUP: Record<NodeCategory, GroupCategory> = {
  'Physical Storefront':     'fixed',
  'E-Commerce & Online':     'fixed',
  'Marketplace':             'variable',
  'Wholesale & B2B':         'variable',
  'Delivery & Fulfillment':  'variable',
  'Staff & Labour':          'labor',
  'Marketing & Acquisition': 'variable',
  'Payments & Banking':      'variable',
  'Compliance & Admin':      'fixed',
  'Inventory & Suppliers':   'variable',
};

export function bucketForNode(node: Node<AnyNodeData>): GroupCategory {
  if (node.type === 'source') return 'revenue';
  if (node.type === 'expense') {
    const cat = (node.data as { category?: NodeCategory }).category ?? 'Compliance & Admin';
    return EXPENSE_CAT_TO_GROUP[cat];
  }
  return 'variable';
}

/** Compute expanded height for a group with n children */
export function expandedGroupH(childCount: number): number {
  if (childCount === 0) return GROUP_HEADER_H + CHILD_PAD_TOP + CHILD_PAD_BOTTOM;
  return GROUP_HEADER_H + CHILD_PAD_TOP + childCount * (CHILD_H + CHILD_GAP) - CHILD_GAP + CHILD_PAD_BOTTOM;
}

/** Child position relative to its parent group at index i */
export function childRelativePos(index: number): { x: number; y: number } {
  return {
    x: CHILD_PAD_X,
    y: GROUP_HEADER_H + CHILD_PAD_TOP + index * (CHILD_H + CHILD_GAP),
  };
}

// ── buildGroupLayout ──────────────────────────────────────────────────────────

export interface GroupLayout {
  nodes: Node<AnyNodeData>[];
  edges: Edge[];
}

/** 
 * Bento Grid Layout: 
 * Places groups in a balanced 2-column grid, 
 * ensuring no overlaps and consistent spacing.
 */
export function buildGroupLayout(rawNodes: Node<AnyNodeData>[]): GroupLayout {
  const leafNodes = rawNodes.filter((n) => n.type !== 'group');

  const buckets: Record<GroupCategory, Node<AnyNodeData>[]> = {
    revenue: [], fixed: [], variable: [], labor: [],
  };
  for (const node of leafNodes) {
    buckets[bucketForNode(node)].push(node);
  }

  // Bento logic: Column 1 is Revenue + Variable (Sales Flow)
  // Column 2 is Fixed + Labor (Ops Flow)
  const col1Categories: GroupCategory[] = ['revenue', 'variable'];
  const col2Categories: GroupCategory[] = ['fixed',   'labor'];
  
  const groupNodes: Node<AnyNodeData>[] = [];
  const childNodes: Node<AnyNodeData>[] = [];

  const columns = [col1Categories, col2Categories];
  
  columns.forEach((colCats, colIdx) => {
    let currentY = START_Y;
    const x = colIdx === 0 ? COL1_X : COL2_X;

    colCats.forEach((cat) => {
      const cfg      = BUCKET_CONFIG[cat];
      const children = buckets[cat];
      const h        = expandedGroupH(children.length);
      const groupId  = `group-${cat}`;

      groupNodes.push({
        id:       groupId,
        type:     'group',
        position: { x, y: currentY },
        style:    { width: GROUP_W, height: h },
        data: {
          label:         cfg.label,
          groupCategory: cat,
          collapsed:     false,
          colorClass:    cfg.colorClass,
        } as GroupNodeData,
        selectable: true,
        draggable:  true,
      });

      children.forEach((child, i) => {
        childNodes.push({
          ...child,
          parentNode: groupId,
          position:   childRelativePos(i),
          extent:     'parent', // Ensure React Flow helps with containment
          draggable:  true,
          style:      { width: CHILD_W },
          data:       { ...child.data, groupId },
        });
      });

      currentY += h + ROW_GAP;
    });
  });

  return { nodes: [...groupNodes, ...childNodes], edges: [] };
}

// ── rePackGroup ───────────────────────────────────────────────────────────────
/**
 * Re-stacks all children of a group sequentially so they never overlap.
 * Updates the group's height to fit its current child count.
 */
export function rePackGroup(groupId: string, nodes: Node<AnyNodeData>[]): Node<AnyNodeData>[] {
  const group = nodes.find((n) => n.id === groupId);
  if (!group) return nodes;

  const data       = group.data as GroupNodeData;
  const collapsed  = data.collapsed;
  const children   = nodes.filter((n) => n.parentNode === groupId);
  const newHeight  = collapsed ? COLLAPSED_GROUP_H : expandedGroupH(children.length);

  return nodes.map((n) => {
    if (n.id === groupId) {
      return { ...n, style: { ...n.style, width: GROUP_W, height: newHeight } };
    }
    if (n.parentNode === groupId) {
      const idx = children.findIndex((c) => c.id === n.id);
      // Snap to grid-like position
      const targetPos = childRelativePos(idx >= 0 ? idx : 0);
      
      return {
        ...n,
        position: targetPos,
        hidden:   collapsed,
        style:    { ...n.style, width: CHILD_W },
      };
    }
    return n;
  });
}

// ── settleGroupOverlaps ───────────────────────────────────────────────────────
/**
 * After a group is dragged, push any overlapping sibling groups apart.
 * Runs 3 cascade passes so chain-overlaps are fully resolved.
 * Bug 1 fix.
 */
export function settleGroupOverlaps(
  _movedGroupId: string,
  nodes: Node<AnyNodeData>[]
): Node<AnyNodeData>[] {
  let result = nodes;

  for (let pass = 0; pass < 3; pass++) {
    const groups = result.filter((n) => n.type === 'group');

    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const a  = result.find((n) => n.id === groups[i].id)!;
        const b  = result.find((n) => n.id === groups[j].id)!;
        const aH = (a.style?.height as number) ?? 200;
        const bH = (b.style?.height as number) ?? 200;

        // Same-column check: X ranges overlap
        const xOverlap =
          a.position.x < b.position.x + GROUP_W + 20 &&
          a.position.x + GROUP_W + 20 > b.position.x;
        if (!xOverlap) continue;

        // Y overlap including required gap
        const upper  = a.position.y <= b.position.y ? a : b;
        const lower  = a.position.y <= b.position.y ? b : a;
        const upperH = a.position.y <= b.position.y ? aH : bH;
        const requiredY = upper.position.y + upperH + ROW_GAP;

        if (lower.position.y < requiredY) {
          result = result.map((n) =>
            n.id === lower.id
              ? { ...n, position: { ...n.position, y: requiredY } }
              : n
          );
        }
      }
    }
  }

  return result;
}

// ── recalcGroupLayout ─────────────────────────────────────────────────────────
/** Re-pack all groups after a bulk operation (import, initial load). */
export function recalcGroupLayout(nodes: Node<AnyNodeData>[]): Node<AnyNodeData>[] {
  let result = nodes;
  const groupIds = nodes.filter((n) => n.type === 'group').map((n) => n.id);
  for (const gId of groupIds) {
    result = rePackGroup(gId, result);
  }
  return result;
}
