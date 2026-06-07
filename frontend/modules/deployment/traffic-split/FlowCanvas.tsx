'use client';

import { useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { UserNode }         from './nodes/UserNode';
import { LoadBalancerNode } from './nodes/LoadBalancerNode';
import { ServerNode }       from './nodes/ServerNode';
import { PacketEdge }       from './edges/PacketEdge';
import type { VersionMetrics } from './types';

const NODE_TYPES = { user: UserNode, lb: LoadBalancerNode, server: ServerNode };
const EDGE_TYPES = { packet: PacketEdge };

interface FlowCanvasProps {
  v1Traffic:  number;
  v1Degraded: boolean;
  v2Degraded: boolean;
  metrics:    { v1: VersionMetrics; v2: VersionMetrics };
}

function buildNodes(
  metrics: FlowCanvasProps['metrics'],
  v1Degraded: boolean,
  v2Degraded: boolean
): Node[] {
  const totalRps = metrics.v1.rps + metrics.v2.rps;
  return [
    {
      id: 'users',
      type: 'user',
      position: { x: 200, y: 10 },
      data: { rps: totalRps },
      draggable: false,
    },
    {
      id: 'lb',
      type: 'lb',
      position: { x: 195, y: 160 },
      data: { rps: totalRps },
      draggable: false,
    },
    {
      id: 'v1',
      type: 'server',
      position: { x: 40, y: 360 },
      data: {
        version: 'v1',
        label: 'v1  STABLE',
        degraded: v1Degraded,
        status: metrics.v1.status,
        p50: metrics.v1.p50,
        errorRate: metrics.v1.errorRate,
      },
      draggable: false,
    },
    {
      id: 'v2',
      type: 'server',
      position: { x: 360, y: 360 },
      data: {
        version: 'v2',
        label: 'v2  CANARY',
        degraded: v2Degraded,
        status: metrics.v2.status,
        p50: metrics.v2.p50,
        errorRate: metrics.v2.errorRate,
      },
      draggable: false,
    },
  ];
}

function buildEdges(
  v1Traffic: number,
  v1Degraded: boolean,
  v2Degraded: boolean,
  metrics: FlowCanvasProps['metrics']
): Edge[] {
  return [
    {
      id: 'users-lb',
      source: 'users', target: 'lb',
      type: 'packet',
      data: { version: 'v1', trafficPct: 100, degraded: false, errorRate: 0 },
    },
    {
      id: 'lb-v1',
      source: 'lb', sourceHandle: 'left',
      target: 'v1',
      type: 'packet',
      data: { version: 'v1', trafficPct: v1Traffic, degraded: v1Degraded, errorRate: metrics.v1.errorRate },
    },
    {
      id: 'lb-v2',
      source: 'lb', sourceHandle: 'right',
      target: 'v2',
      type: 'packet',
      data: { version: 'v2', trafficPct: 100 - v1Traffic, degraded: v2Degraded, errorRate: metrics.v2.errorRate },
    },
  ];
}

export function FlowCanvas({ v1Traffic, v1Degraded, v2Degraded, metrics }: FlowCanvasProps) {
  const initNodes = useMemo(() => buildNodes(metrics, v1Degraded, v2Degraded), []);
  const initEdges = useMemo(() => buildEdges(v1Traffic, v1Degraded, v2Degraded, metrics), []);

  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges);

  useEffect(() => {
    setNodes(buildNodes(metrics, v1Degraded, v2Degraded));
  }, [metrics, v1Degraded, v2Degraded, setNodes]);

  useEffect(() => {
    setEdges(buildEdges(v1Traffic, v1Degraded, v2Degraded, metrics));
  }, [v1Traffic, v1Degraded, v2Degraded, metrics, setEdges]);

  return (
    <div className="h-[540px] w-full rounded-xl overflow-hidden border border-slate-800 bg-[#030b18]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        colorMode="dark"
        proOptions={{ hideAttribution: true }}
      >
        <Background
          color="#0f2040"
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1.2}
        />
      </ReactFlow>
    </div>
  );
}
