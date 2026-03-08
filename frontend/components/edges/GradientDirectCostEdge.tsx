'use client';

import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from 'reactflow';
import type { EdgeProps } from 'reactflow';

/**
 * Custom edge component for direct-cost connections.
 * Renders with a gradient stroke from red (expense/source) to green (revenue/target).
 * No label (COGS removed).
 */
export function GradientDirectCostEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  // Generate a unique ID for this edge's gradient
  const gradientId = `gradient-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <>
      {/* SVG defs for gradient — use userSpaceOnUse so gradient coords align with actual path */}
      <defs>
        <linearGradient
          id={gradientId}
          x1={sourceX}
          y1={sourceY}
          x2={targetX}
          y2={targetY}
          gradientUnits="userSpaceOnUse"
        >
          {/* Red at source (expense side) */}
          <stop offset="0%" stopColor="#ef4444" stopOpacity={1} />
          {/* Green at target (revenue side) */}
          <stop offset="100%" stopColor="#22c55e" stopOpacity={1} />
        </linearGradient>
      </defs>

      {/* Edge path with gradient stroke */}
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: `url(#${gradientId})`,
          strokeWidth: 1.5,
        }}
      />
    </>
  );
}
