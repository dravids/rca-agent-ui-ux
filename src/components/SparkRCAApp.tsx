"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, ChevronRight, CheckCircle, Clock, RotateCcw, Menu, Star } from 'lucide-react';
import type { AggregatedSignals, TreeData, RcaNode } from '@/types/rca';
import { clientLog } from '@/lib/logger';
import { evidencePatterns } from '@/lib/rcaData';

const speedLabels = ['Slow', 'Normal', 'Fast'] as const;
const speedValues = [2000, 1000, 400] as const;

function classNames(...parts: Array<string | false | undefined>) {
	return parts.filter(Boolean).join(' ');
}

const MonitorCard: React.FC<{ 
	id: string; 
	icon: React.ReactNode; 
	title: string; 
	isActive?: unknown; 
	children: React.ReactNode;
	scanningSignalCard?: string | null;
	activeSignalCards?: Set<string>;
	signalEvidence?: Record<string, { quality: 'strong' | 'medium' | 'weak' | 'none'; data: any }>;
	currentlyAnalyzingNode?: RcaNode | null;
}>
	= ({ id, icon, title, isActive, children, scanningSignalCard, activeSignalCards, signalEvidence, currentlyAnalyzingNode }) => {
		const isScanning = scanningSignalCard === id;
		const isActiveCard = activeSignalCards?.has(id) || false;
		const evidence = signalEvidence?.[id];
		const isAnalyzing = currentlyAnalyzingNode?.signalsRequired.includes(id) || false;
		
		return (
			<div className={classNames(
				'monitor-card', 
				isActive || isActiveCard ? 'active' : '',
				isScanning ? 'scanning' : '',
				isAnalyzing ? 'analyzing' : '',
				evidence?.quality && evidence.quality !== 'none' ? `evidence-${evidence.quality}` : ''
			)}>
				<div className="monitor-header">
					<div className={classNames('monitor-icon', id)}>{icon}</div>
					<div className="monitor-title">{title}</div>
					{isScanning && <div className="scanning-indicator">🔍 Analyzing...</div>}
					{evidence && evidence.quality !== 'none' && (
						<div className={`evidence-badge evidence-${evidence.quality}`}>
							{evidence.quality === 'strong' ? '✓' : evidence.quality === 'medium' ? '⚠' : evidence.quality === 'weak' ? '~' : '✗'}
						</div>
					)}
				</div>
				<div className="monitor-content">{children}</div>
				{isAnalyzing && currentlyAnalyzingNode && (
					<div className="analysis-connection">
						<div className="connection-line"></div>
						<div className="connection-label">Analyzing: {currentlyAnalyzingNode.label}</div>
					</div>
				)}
			</div>
		);
	};

function rewardToColor(reward: number): string {
	// Professional blue-to-green gradient (no red)
	const hue = 200 + (reward * 80); // 200 (blue) to 280 (green)
	const saturation = 60 + (reward * 30); // 60% to 90%
	const lightness = 45 + (reward * 25); // 45% to 70%
	return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

export default function SparkRCAApp() {
	const [sidebarExpanded, setSidebarExpanded] = useState(false);
	const [currentMetricTab, setCurrentMetricTab] = useState<'memory' | 'cpu' | 'gc'>('memory');
	const [visitedNodes, setVisitedNodes] = useState<Set<string>>(new Set());
	const [selectedNode, setSelectedNode] = useState<RcaNode | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [speedMode, setSpeedMode] = useState<0 | 1 | 2>(1);
	const [bestPathFound, setBestPathFound] = useState<{ path: RcaNode[]; reward: number } | null>(null);
	const [showingBestPath, setShowingBestPath] = useState(false);
	const [activeStage, setActiveStage] = useState<'selection' | 'expansion' | 'simulation' | 'backpropagation' | null>(null);
	const [currentPath, setCurrentPath] = useState<RcaNode[]>([]);
	const [treeData, setTreeData] = useState<TreeData>({ nodes: [], edges: [], nodeMap: {} as any });
	const [signals, setSignals] = useState<AggregatedSignals>({});

	// Incremental right-panel rendering state
	const [visibleNodeIds, setVisibleNodeIds] = useState<Set<string>>(new Set());
	const [visibleEdgeIds, setVisibleEdgeIds] = useState<Set<string>>(new Set());
	const [thinking, setThinking] = useState<boolean>(false);
	const [ghostChildren, setGhostChildren] = useState<Array<{ id: string; x: number; y: number; label: string; reward: number }>>([]);
	const [animatingEdgeId, setAnimatingEdgeId] = useState<string | null>(null);
	const [edgeDrawProgress, setEdgeDrawProgress] = useState<number>(0);
	const [particleEdgeId, setParticleEdgeId] = useState<string | null>(null);
	const [particleT, setParticleT] = useState<number>(0);
	const [accumulatedHypotheses, setAccumulatedHypotheses] = useState<Array<{ id: string; title: string; content: string }>>([]);
	// Node stats for UCB1
	const [nodeStats, setNodeStats] = useState<Record<string, { visits: number; valueSum: number; ucb: number }>>({});
	// Backprop particles
	const [backpropParticles, setBackpropParticles] = useState<Array<{ edgeId: string; t: number; color: string }>>([]);
	// Phase durations (ms)
	const DUR_SELECTION = 800;
	const DUR_EXPANSION = 1200;
	const DUR_SIMULATION = 1000;
	const DUR_BACKPROP = 800;
	// Level-first exploration state
	const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
	const [levelChildrenQueue, setLevelChildrenQueue] = useState<string[]>([]);
	const [levelExploredRewards, setLevelExploredRewards] = useState<Record<string, number>>({});
	// Step reentrancy and termination
	const [isStepRunning, setIsStepRunning] = useState<boolean>(false);
	const [rootCause, setRootCause] = useState<RcaNode | null>(null);

	// Signal card states and synchronization
	const [activeSignalCards, setActiveSignalCards] = useState<Set<string>>(new Set());
	const [scanningSignalCard, setScanningSignalCard] = useState<string | null>(null);
	const [signalEvidence, setSignalEvidence] = useState<Record<string, { quality: 'strong' | 'medium' | 'weak' | 'none'; data: any }>>({});
	const [currentlyAnalyzingNode, setCurrentlyAnalyzingNode] = useState<RcaNode | null>(null);

	// Tooltip state
	const [hoveredNode, setHoveredNode] = useState<RcaNode | null>(null);
	const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

	const explorationIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const animationSpeed = speedValues[speedMode];

	// MCTS exploration state
	const [explorationPhase, setExplorationPhase] = useState<'expanding' | 'simulating' | 'selecting' | 'idle'>('idle');
	const [currentExpandingNode, setCurrentExpandingNode] = useState<RcaNode | null>(null);
	const [pendingChildren, setPendingChildren] = useState<RcaNode[]>([]);
	const [simulationQueue, setSimulationQueue] = useState<RcaNode[]>([]);
	const [levelResults, setLevelResults] = useState<Record<string, number>>({});

	// Add refs to track state immediately
	const isPlayingRef = useRef(false);
	const simulationQueueRef = useRef<RcaNode[]>([]);
	const visibleNodeIdsRef = useRef<Set<string>>(new Set(['root']));
	const currentNodeIdRef = useRef<string>('root');

	// Add zoom and pan state
	const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
	const [isDragging, setIsDragging] = useState(false);
	const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
	const svgRef = useRef<SVGSVGElement>(null);

	// Add tab state for investigation trail
	const [activeTab, setActiveTab] = useState<'trail' | 'rootcause' | 'solution'>('trail');

	useEffect(() => {
		const load = async () => {
			try {
				const res = await fetch('/api/rca');
				const json = await res.json();
				setTreeData(json.data as TreeData);
				// initialize with root only visible
				const init = new Set<string>(['root']);
				setVisibleNodeIds(init);
				setSelectedNode(json.data.nodeMap['root']);
				setAccumulatedHypotheses([{ id: 'root', title: json.data.nodeMap['root'].hypothesis.title, content: json.data.nodeMap['root'].hypothesis.content }]);
				setCurrentNodeId('root');
				await clientLog({ level: 'info', message: 'Loaded RCA tree data', context: { nodes: json.data.nodes.length } });
			} catch (err) {
				await clientLog({ level: 'error', message: 'Failed to load RCA data', context: { err: String(err) } });
			}
		};
		load();
	}, []);

	// Animate edge drawing with easing
	useEffect(() => {
		if (!animatingEdgeId) return;
		setEdgeDrawProgress(0);
		const start = Date.now();
		const duration = DUR_EXPANSION;
		let raf = 0;
		const tick = () => {
			const elapsed = Date.now() - start;
			const t = Math.min(elapsed / duration, 1);
			// Ease out cubic for smooth animation
			const eased = 1 - Math.pow(1 - t, 3);
			setEdgeDrawProgress(eased);
			if (t >= 1) {
				setAnimatingEdgeId(null);
				return;
			}
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [animatingEdgeId]);

	// Animate particle along selected edge
	useEffect(() => {
		if (!particleEdgeId) return;
		const start = Date.now();
		const duration = DUR_SIMULATION;
		let raf = 0;
		const tick = () => {
			const elapsed = Date.now() - start;
			const t = Math.min(elapsed / duration, 1);
			// Ease in-out for smooth particle movement
			const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
			setParticleT(eased);
			if (t >= 1) {
				setParticleEdgeId(null);
				return;
			}
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [particleEdgeId]);

	// Backprop particle animation with easing
	useEffect(() => {
		if (backpropParticles.length === 0) return;
		let raf = 0;
		const start = Date.now();
		const tick = () => {
			const elapsed = Date.now() - start;
			const t = Math.min(elapsed / DUR_BACKPROP, 1);
			// Ease out for backprop particles
			const eased = 1 - Math.pow(1 - t, 2);
			if (t >= 1) {
				setBackpropParticles([]);
				return;
			}
			setBackpropParticles(prev => prev.map(p => ({ ...p, t: eased })));
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [backpropParticles.length > 0]);

	const computeBreadcrumb = useCallback(() => {
		if (!selectedNode) return 'System Failure Detected';
		const labels: string[] = [];
		let current: RcaNode | null = selectedNode;
		while (current) {
			labels.unshift(current.label === 'Start' ? 'System Failure' : current.label);
			current = (treeData.nodeMap as any)[current.parent as any] || null;
		}
		return labels.join(' → ');
	}, [selectedNode, treeData.nodeMap]);

	const computeUcb1 = useCallback((nodeId: string, totalVisits: number) => {
		const stats = nodeStats[nodeId] || { visits: 0, valueSum: 0, ucb: 0 };
		const visits = Math.max(1, stats.visits);
		const mean = stats.valueSum / visits;
		const c = 1.4;
		const bonus = c * Math.sqrt(Math.log(totalVisits + 1) / visits);
		return mean + bonus;
	}, [nodeStats]);

	const simulateSignalAnalysis = useCallback(async (node: RcaNode) => {
		const signalsToAnalyze = node.signalsRequired || ['logs'];
		const evidenceData = evidencePatterns[node.evidencePattern] || {};
		
		// Dim all cards first
		setActiveSignalCards(new Set());
		
		// Sequential signal analysis
		for (let i = 0; i < signalsToAnalyze.length; i++) {
			const signalType = signalsToAnalyze[i];
			setScanningSignalCard(signalType);
			
			// Wait for scanning animation
			await new Promise(resolve => setTimeout(resolve, 500));
			
			// Update signal data based on evidence pattern
			const evidence = evidenceData[signalType];
			if (evidence) {
				const quality = node.reward > 0.7 ? 'strong' : node.reward > 0.4 ? 'medium' : node.reward > 0.2 ? 'weak' : 'none';
				setSignalEvidence(prev => ({
					...prev,
					[signalType]: { quality, data: evidence }
				}));
				
				// Update signals state for the UI
				setSignals(prev => ({
					...prev,
					[signalType]: Array.isArray(evidence) ? [evidence] : evidence
				}));
			}
			
			setScanningSignalCard(null);
			setActiveSignalCards(prev => new Set(prev).add(signalType));
			
			// Brief pause between signals
			await new Promise(resolve => setTimeout(resolve, 300));
		}
		
		// Show evidence quality indicators
		setTimeout(() => {
			setActiveSignalCards(new Set());
			setScanningSignalCard(null);
		}, 1000);
	}, []);

	const mctsExplore = useCallback(async () => {
		console.log('🚀 mctsExplore called:', { 
			isStepRunning, 
			rootCause, 
			isPlaying, 
			isPlayingRef: isPlayingRef.current,
			queueLength: simulationQueueRef.current.length,
			visibleCount: visibleNodeIdsRef.current.size
		});
		
		if (isStepRunning || rootCause) {
			console.log('🚫 MCTS blocked:', { isStepRunning, rootCause });
			return;
		}
		setIsStepRunning(true);
		
		const { nodes, nodeMap } = treeData;
		if (nodes.length === 0) { 
			console.log('🚫 No nodes available');
			setIsStepRunning(false); 
			return; 
		}

		try {
			const activeNodeId = currentNodeIdRef.current || 'root';
			const activeNode = nodeMap[activeNodeId] || nodes[0];
			
			console.log('🔍 MCTS Step:', { 
				activeNodeId, 
				phase: explorationPhase, 
				queueLength: simulationQueueRef.current.length,
				visibleNodes: visibleNodeIdsRef.current.size 
			});

			const children = nodes.filter(n => n.parent === activeNode.id);
			const unvisited = children.filter(c => !visibleNodeIdsRef.current.has(c.id));
			
			console.log('📊 Analysis:', { 
				totalChildren: children.length, 
				unvisited: unvisited.length,
				currentPhase: explorationPhase,
				queueLength: simulationQueueRef.current.length
			});
			
			// Case 1: Need to expand unvisited children
			if (unvisited.length > 0 && simulationQueueRef.current.length === 0) {
				console.log('🌱 EXPANDING:', unvisited.map(n => n.label));
				setExplorationPhase('expanding');
				setActiveStage('expansion');
				
				// Show ghosts
				setGhostChildren(unvisited.map(child => ({
					id: child.id, x: child.x, y: child.y, label: child.label, reward: child.reward
				})));
				await new Promise(resolve => setTimeout(resolve, 400));
				
				// Materialize children - update both state and ref
				unvisited.forEach(child => {
					setVisibleNodeIds(prev => new Set(prev).add(child.id));
					visibleNodeIdsRef.current.add(child.id);
					setVisibleEdgeIds(prev => new Set(prev).add(`edge-${activeNode.id}-${child.id}`));
				});
				setGhostChildren([]);
				
				// Sort children by reward (highest first) for exploration
				const sortedUnvisited = [...unvisited].sort((a, b) => b.reward - a.reward);
				console.log('📊 Sorted exploration queue by reward:', sortedUnvisited.map(n => `${n.label}(${(n.reward * 100).toFixed(0)}%)`).join(', '));
				
				// Update queue in both state and ref
				setSimulationQueue(sortedUnvisited);
				simulationQueueRef.current = sortedUnvisited;
				setExplorationPhase('simulating');
				
				console.log('✅ Expanded', unvisited.length, 'children, queue now:', simulationQueueRef.current.length);
				setIsStepRunning(false);
				if ((isPlaying || isPlayingRef.current) && !rootCause) {
					setTimeout(() => mctsExplore(), 200);
				}
				return;
			}
			
			// Case 2: Simulate next child in queue
			if (simulationQueueRef.current.length > 0) {
				const nodeToSimulate = simulationQueueRef.current[0];
				console.log('🧪 SIMULATING:', nodeToSimulate.label, `(confidence: ${(nodeToSimulate.reward * 100).toFixed(1)}%)`, 'Queue:', simulationQueueRef.current.length);
				
				setCurrentlyAnalyzingNode(nodeToSimulate);
				setActiveStage('simulation');
				setSelectedNode(nodeToSimulate);
				setParticleEdgeId(`edge-${activeNode.id}-${nodeToSimulate.id}`);
				
				// Quick signal analysis
				const signalsToAnalyze = nodeToSimulate.signalsRequired || ['logs'];
				const evidenceData = evidencePatterns[nodeToSimulate.evidencePattern] || {};
				
				for (const signalType of signalsToAnalyze) {
					setScanningSignalCard(signalType);
					await new Promise(resolve => setTimeout(resolve, 100));
					
					const evidence = evidenceData[signalType];
					if (evidence) {
						const quality = nodeToSimulate.reward > 0.7 ? 'strong' : nodeToSimulate.reward > 0.4 ? 'medium' : 'weak';
						setSignalEvidence(prev => ({ ...prev, [signalType]: { quality, data: evidence } }));
						setSignals(prev => ({ ...prev, [signalType]: Array.isArray(evidence) ? [evidence] : evidence }));
					}
					
					setScanningSignalCard(null);
					setActiveSignalCards(prev => new Set(prev).add(signalType));
					await new Promise(resolve => setTimeout(resolve, 50));
				}
				
				// Record results
				const reward = nodeToSimulate.reward;
				console.log('📈 EVALUATED:', nodeToSimulate.label, `→ ${(reward * 100).toFixed(1)}% confidence`);
				setLevelResults(prev => ({ ...prev, [nodeToSimulate.id]: reward }));
				setNodeStats(prev => {
					const next = { ...prev };
					const s = next[nodeToSimulate.id] || { visits: 0, valueSum: 0, ucb: 0 };
					s.visits += 1;
					s.valueSum += reward;
					next[nodeToSimulate.id] = s;
					return next;
				});
				
				// Backpropagation
				setActiveStage('backpropagation');
				setBackpropParticles([{ 
					edgeId: `edge-${activeNode.id}-${nodeToSimulate.id}`, 
					t: 0, 
					color: reward >= 0.7 ? '#10b981' : reward >= 0.4 ? '#3b82f6' : '#64748b' 
				}]);
				
				setVisitedNodes(prev => new Set(prev).add(nodeToSimulate.id));
				setAccumulatedHypotheses(prev => 
					prev.some(h => h.id === nodeToSimulate.id) ? prev : 
					[...prev, { id: nodeToSimulate.id, title: nodeToSimulate.hypothesis.title, content: nodeToSimulate.hypothesis.content }]
				);
				
				if (!bestPathFound || reward > bestPathFound.reward) {
					// Build complete path from root to current node
					const completePath: RcaNode[] = [];
					let node: RcaNode | null = nodeToSimulate;
					while (node) {
						completePath.unshift(node);
						node = node.parent ? treeData.nodeMap[node.parent] : null;
					}
					setBestPathFound({ path: completePath, reward });
				}
				
				await new Promise(resolve => setTimeout(resolve, 200));
				
				// Remove from queue - update both state and ref
				const newQueue = simulationQueueRef.current.slice(1);
				setSimulationQueue(newQueue);
				simulationQueueRef.current = newQueue;
				console.log('📋 Queue updated:', simulationQueueRef.current.length, 'remaining');
				
				setParticleEdgeId(null);
				setCurrentlyAnalyzingNode(null);
				setActiveSignalCards(new Set());
				
				setIsStepRunning(false);
				if ((isPlaying || isPlayingRef.current) && !rootCause) {
					setTimeout(() => mctsExplore(), 200);
				}
				return;
			}
			
			// Case 3: All children simulated - select best and drill down
			if (children.length > 0 && simulationQueueRef.current.length === 0) {
				console.log('🎯 SELECTION PHASE - Choosing highest confidence path');
				
				if (children.length === 0) {
					console.log('🎉 ROOT CAUSE:', activeNode.label);
					setRootCause(activeNode);
					setIsPlaying(false);
					isPlayingRef.current = false;
					setIsStepRunning(false);
					return;
				}
				
				// Show all evaluated options with their rewards
				console.log('📊 Confidence Comparison:');
				const sortedChildren = [...children].sort((a, b) => {
					const aReward = levelResults[a.id] !== undefined ? levelResults[a.id] : a.reward;
					const bReward = levelResults[b.id] !== undefined ? levelResults[b.id] : b.reward;
					return bReward - aReward;
				});
				sortedChildren.forEach((child, idx) => {
					const reward = levelResults[child.id] !== undefined ? levelResults[child.id] : child.reward;
					const icon = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '  ';
					console.log(`  ${icon} ${child.label}: ${(reward * 100).toFixed(1)}%`);
				});
				
				// Select child with highest reward (confidence)
				const bestChild = sortedChildren[0];
				const selectedReward = levelResults[bestChild.id] !== undefined ? levelResults[bestChild.id] : bestChild.reward;
				console.log(`🚀 SELECTED: ${bestChild.label} (${(selectedReward * 100).toFixed(1)}% - highest confidence)`);
				
				// Visual highlight for selection
				setActiveStage('selection');
				setSelectedNode(bestChild);
				
				// Brief pause to show selection
				await new Promise(resolve => setTimeout(resolve, 400));
				
				// Drill down to selected child
				setCurrentNodeId(bestChild.id);
				currentNodeIdRef.current = bestChild.id;
				setCurrentPath(prev => [...prev, bestChild]);
				
				// Add to investigation trail when drilling down to next level
				setAccumulatedHypotheses(prev => 
					prev.some(h => h.id === bestChild.id) ? prev : 
					[...prev, { id: bestChild.id, title: bestChild.hypothesis.title, content: bestChild.hypothesis.content }]
				);
				
				setLevelResults({});
				setExplorationPhase('idle');
				
				setIsStepRunning(false);
				if ((isPlaying || isPlayingRef.current) && !rootCause) {
					setTimeout(() => mctsExplore(), 200);
				}
				return;
			}
			
			// Case 4: Leaf node - root cause found
			console.log('🎉 LEAF NODE - ROOT CAUSE:', activeNode.label);
			setRootCause(activeNode);
			setIsPlaying(false);
			isPlayingRef.current = false;
			
		} catch (error) {
			console.error('❌ MCTS Error:', error);
		} finally {
			setIsStepRunning(false);
		}
	}, [treeData, currentNodeId, explorationPhase, simulationQueue, levelResults, visibleNodeIds, bestPathFound, currentPath, isStepRunning, rootCause, isPlaying]);

	const showNode = useCallback((node: RcaNode) => {
		setSelectedNode(node);
		const path: RcaNode[] = [];
		let current: RcaNode | null = node;
		while (current) {
			path.unshift(current);
			current = (treeData.nodeMap as any)[current.parent as any] || null;
		}

		const allSignals: AggregatedSignals = {};
		path.forEach(n => {
			Object.entries(n.signals).forEach(([key, value]) => {
				// @ts-expect-error dynamic aggregation keys
				if (!allSignals[key]) allSignals[key] = [];
				// @ts-expect-error dynamic aggregation keys
				allSignals[key].push(value as any);
			});
		});
		setSignals(allSignals);

		if (node.stage) setActiveStage(node.stage);
	}, [treeData.nodeMap]);

	const startAnalysis = async () => {
		if (isPlaying) {
			console.log('⏸️ Stopping analysis');
			setIsPlaying(false);
			isPlayingRef.current = false;
			if (explorationIntervalRef.current) clearInterval(explorationIntervalRef.current);
			return;
		}

		console.log('▶️ Starting automated analysis');
		setIsPlaying(true);
		isPlayingRef.current = true; // Set ref immediately
		setExplorationPhase('idle');
		setIsStepRunning(false); // Ensure we're not blocked
		
		// Use a longer delay to ensure state updates have time to complete
		setTimeout(() => {
			console.log('🎬 Starting mctsExplore with delay, isPlaying should be true now');
			mctsExplore();
		}, 200);

		await clientLog({ level: 'info', message: 'Started automated MCTS analysis', context: { speedMode } });
	};

	const stepAnalysis = async () => {
		if (isPlaying) {
			// Stop auto mode first
			setIsPlaying(false);
			if (explorationIntervalRef.current) clearInterval(explorationIntervalRef.current);
		}
		
		// Single manual step
		await mctsExplore();
		await clientLog({ level: 'info', message: 'Manual MCTS step executed' });
	};

	const showBestPath = () => {
		if (!bestPathFound) return;
		const path = bestPathFound.path;
		if (path.length > 0) {
			// Update current path to highlight the best path
			setCurrentPath(path);
			setShowingBestPath(true);
			// Show the final node in the best path
			showNode(path[path.length - 1]);
			// Auto-hide the banner after 5 seconds
			setTimeout(() => setShowingBestPath(false), 5000);
		}
	};

	const reset = async () => {
		setVisitedNodes(new Set());
		setSelectedNode(treeData.nodeMap['root'] || null);
		setIsPlaying(false);
		isPlayingRef.current = false;
		setBestPathFound(null);
		setShowingBestPath(false);
		setCurrentPath([]);
		setActiveStage(null);
		setSignals({});
		setVisibleNodeIds(new Set(['root']));
		visibleNodeIdsRef.current = new Set(['root']);
		setVisibleEdgeIds(new Set());
		setGhostChildren([]);
		setAnimatingEdgeId(null);
		setParticleEdgeId(null);
		setAccumulatedHypotheses(treeData.nodeMap['root'] ? [{ id: 'root', title: treeData.nodeMap['root'].hypothesis.title, content: treeData.nodeMap['root'].hypothesis.content }] : []);
		setCurrentNodeId('root');
		currentNodeIdRef.current = 'root';
		setLevelChildrenQueue([]);
		setLevelExploredRewards({});
		setNodeStats({});
		setBackpropParticles([]);
		setRootCause(null);
		setIsStepRunning(false);
		setThinking(false);
		setActiveSignalCards(new Set());
		setScanningSignalCard(null);
		setSignalEvidence({});
		setCurrentlyAnalyzingNode(null);
		// Reset MCTS state
		setExplorationPhase('idle');
		setCurrentExpandingNode(null);
		setPendingChildren([]);
		setSimulationQueue([]);
		simulationQueueRef.current = [];
		setLevelResults({});
		if (explorationIntervalRef.current) clearInterval(explorationIntervalRef.current);
		await clientLog({ level: 'info', message: 'Reset MCTS state' });
	};

	const changeSpeed = () => setSpeedMode(prev => ((prev + 1) % 3) as 0 | 1 | 2);

	// Fix signals.metrics handling
	const getMetricValue = useCallback((metricType: 'memory' | 'cpu' | 'gc') => {
		const metricsData = signals.metrics;
		if (!metricsData) return { value: '--', bar: 0 };
		
		// Handle both array and object structures
		let latestMetric;
		if (Array.isArray(metricsData)) {
			latestMetric = metricsData[metricsData.length - 1];
		} else {
			latestMetric = metricsData;
		}
		
		return latestMetric?.[metricType] || { value: '--', bar: 0 };
	}, [signals.metrics]);

	const getErrorValue = useCallback(() => {
		const errorsData = signals.errors;
		if (!errorsData) return { value: 0, label: 'Critical Errors' };
		
		// Handle both array and object structures
		if (Array.isArray(errorsData)) {
			const latestError = errorsData[errorsData.length - 1];
			return latestError || { value: 0, label: 'Critical Errors' };
		} else {
			// If it's an object, return it directly
			return errorsData;
		}
	}, [signals.errors]);

	const handleNodeHover = useCallback((event: React.MouseEvent, node: RcaNode) => {
		// Capture the rect before setTimeout to avoid null event.currentTarget
		const rect = (event.currentTarget as SVGElement).getBoundingClientRect();
		
		// Small delay to prevent rapid flickering
		setTimeout(() => {
			setHoveredNode(node);
			setTooltipPosition({ 
				x: rect.left + rect.width / 2, 
				y: rect.top - 10 
			});
		}, 50);
	}, []);

	const handleNodeLeave = useCallback(() => {
		setHoveredNode(null);
	}, []);

	// Zoom and pan handlers
	const handleWheel = useCallback((e: React.WheelEvent) => {
		e.preventDefault();
		const delta = e.deltaY > 0 ? 0.9 : 1.1;
		const rect = svgRef.current?.getBoundingClientRect();
		if (!rect) return;

		const mouseX = e.clientX - rect.left;
		const mouseY = e.clientY - rect.top;

		setTransform(prev => {
			const newScale = Math.max(0.1, Math.min(3, prev.scale * delta));
			const scaleChange = newScale / prev.scale;
			
			return {
				x: mouseX - (mouseX - prev.x) * scaleChange,
				y: mouseY - (mouseY - prev.y) * scaleChange,
				scale: newScale
			};
		});
	}, []);

	const handleMouseDown = useCallback((e: React.MouseEvent) => {
		if (e.target === svgRef.current) {
			setIsDragging(true);
			setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
		}
	}, [transform]);

	const handleMouseMove = useCallback((e: React.MouseEvent) => {
		if (isDragging) {
			setTransform(prev => ({
				...prev,
				x: e.clientX - dragStart.x,
				y: e.clientY - dragStart.y
			}));
		}
	}, [isDragging, dragStart]);

	const handleMouseUp = useCallback(() => {
		setIsDragging(false);
	}, []);

	// Reset zoom and pan
	const resetView = useCallback(() => {
		setTransform({ x: 0, y: 0, scale: 1 });
	}, []);

	// Update the rewardToColor function to return white for nodes
	const rewardToColor = useCallback((reward: number) => {
		// All nodes are white with different border colors based on reward
		return '#ffffff';
	}, []);

	// Get border color based on reward
	const getBorderColor = useCallback((reward: number) => {
		// Blue to green gradient for borders
		const hue = reward * 120; // 0 = red (0°), 120 = green (120°)
		return `hsl(${hue}, 70%, 50%)`;
	}, []);

	// Generate root cause explanation and timeline
	const generateRootCauseExplanation = useCallback(() => {
		if (!rootCause || !bestPathFound) return null;

		const path = bestPathFound.path;
		const timeline = [];
		
		// Generate timeline based on the investigation path
		timeline.push({
			time: "23:45",
			event: "Production Incident: Job Failure",
			description: "user_analytics_daily_agg job failed after 4h 12m. Stage 3 (SortMergeJoin) failed 4 times with 156 task failures. Critical SLA breach detected.",
			type: "incident"
		});

		timeline.push({
			time: "23:50",
			event: "RCA Investigation Initiated",
			description: "MCTS-based root cause analysis started. Examining logs, metrics, Spark UI, and shuffle statistics across multiple dimensions.",
			type: "analysis"
		});

		if (path.length > 0) {
			timeline.push({
				time: "23:55",
				event: `Level 1 Analysis: ${path[0]?.label}`,
				description: `Identified ${path[0]?.label} as primary investigation vector (${(path[0]?.reward * 100).toFixed(0)}% confidence). Analyzing stage execution patterns and failure modes.`,
				type: "analysis"
			});
		}

		if (path.length > 1) {
			timeline.push({
				time: "00:10",
				event: `Level 2 Deep Dive: ${path[1]?.label}`,
				description: `Focused on ${path[1]?.label}. Analyzing join operation details: 12M×850M rows, 182GB shuffle, task duration variance patterns.`,
				type: "analysis"
			});
		}

		if (path.length > 2) {
			timeline.push({
				time: "00:25",
				event: `Root Cause Identified: ${path[2]?.label}`,
				description: `Data skew root cause confirmed: user_id keys "premium_user_999" (8.4GB) and "bot_crawler_001" (7.9GB) creating 204:1 partition skew. This directly explains all observed symptoms.`,
				type: "discovery"
			});
		}

		if (rootCause.label === 'RCAComplete') {
			timeline.push({
				time: "00:35",
				event: "Analysis: Skew Mechanism",
				description: "Hash partitioning on user_id distributes data unevenly. Power users generate 200x more events than average users. Single partition (127) receives 8.4GB while others get ~42MB.",
				type: "analysis"
			});

			timeline.push({
				time: "00:42",
				event: "Correlation: OOM to Partition Size",
				description: "Executor heap: 6GB. Partition 127: 8.4GB. Single executor cannot hold entire partition in memory during sort-merge join, causing java.lang.OutOfMemoryError.",
				type: "discovery"
			});

			timeline.push({
				time: "00:48",
				event: "RCA Conclusion",
				description: "Root cause confirmed: Data skew on join key creating hot partitions that exceed executor memory, causing OOM errors, task failures, and job failure. Investigation complete.",
				type: "discovery"
			});
		}

		const explanation = {
			title: `Data Skew in SortMergeJoin Operation`,
			summary: rootCause.hypothesis.content,
			impact: "Production ETL pipeline failure (4h 12m with 156 task failures). SLA breach impacting downstream analytics and business reporting. Estimated business impact: $50K in delayed insights and wasted compute resources.",
			mechanism: "Hash partitioning on user_id key creates uneven distribution. Power users with high event counts (8.4GB) are assigned to single partitions, while average users generate only 42MB per partition. Executor memory (6GB) insufficient to process oversized partitions, resulting in OOM.",
			confidence: `${(rootCause.reward * 100).toFixed(0)}%`,
			investigationPath: path.map(n => n.label).join(' → ')
		};

		return { explanation, timeline };
	}, [rootCause, bestPathFound]);

	// Auto-switch to root cause tab when found
	useEffect(() => {
		if (rootCause) {
			setActiveTab('rootcause');
		}
	}, [rootCause]);

	return (
		<div className="spark-rca-container">
			<style>{`/* Modern professional graph visualization */
			* { margin: 0; padding: 0; box-sizing: border-box; }
			.spark-rca-container { 
				font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; 
				background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); 
				height: 100vh; 
				overflow: hidden; 
				position: relative; 
			}
			.top-header { 
				position: fixed; top: 0; left: 0; right: 0; height: 60px; 
				background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(20px); 
				border-bottom: 1px solid rgba(226, 232, 240, 0.8); 
				display: flex; align-items: center; justify-content: space-between; 
				padding: 0 24px; z-index: 100; 
				box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
			}
			.header-left { display: flex; align-items: center; gap: 24px; }
			.menu-btn { 
				width: 40px; height: 40px; border-radius: 12px; 
				background: rgba(248, 250, 252, 0.8); border: 1px solid rgba(226, 232, 240, 0.6); 
				display: flex; align-items: center; justify-content: center; cursor: pointer; 
				transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); color: #64748b;
			}
			.menu-btn:hover { background: rgba(241, 245, 249, 1); color: #475569; transform: scale(1.05); }
			.job-input-group { 
				display: flex; align-items: center; gap: 12px; padding: 8px 16px; 
				background: rgba(248, 250, 252, 0.8); border-radius: 12px; 
				border: 1px solid rgba(226, 232, 240, 0.6); 
			}
			.job-input-label { font-size: 13px; font-weight: 500; color: #64748b; }
			.job-input { 
				background: transparent; border: none; outline: none; 
				font-size: 14px; font-weight: 500; color: #334155; width: 160px; 
			}
			.job-input::placeholder { color: #94a3b8; }
			.mcts-stages { 
				display: flex; gap: 8px; padding: 6px; 
				background: rgba(248, 250, 252, 0.8); border-radius: 12px; 
				border: 1px solid rgba(226, 232, 240, 0.6); 
			}
			.stage { 
				display: flex; align-items: center; gap: 8px; padding: 8px 12px; 
				border-radius: 8px; font-size: 12px; font-weight: 500; color: #64748b; 
				transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
			}
			.stage.active { 
				background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1)); 
				color: #6366f1; border: 1px solid rgba(99, 102, 241, 0.2);
			}
			.stage-dot { 
				width: 8px; height: 8px; border-radius: 50%; background: currentColor; 
				transition: all 0.3s ease;
			}
			.stage.active .stage-dot { animation: stagePulse 2s ease-in-out infinite; }
			@keyframes stagePulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.2); } }
			.sidebar { 
				position: fixed; left: 0; top: 60px; bottom: 0; width: 72px; 
				background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(20px); 
				border-right: 1px solid rgba(226, 232, 240, 0.8); 
				transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1); z-index: 99; overflow: hidden; 
			}
			.sidebar.expanded { width: 280px; }
			.sidebar-item { 
				display: flex; align-items: center; gap: 16px; padding: 16px 20px; 
				cursor: pointer; transition: all 0.2s ease; white-space: nowrap; color: #64748b; 
			}
			.sidebar-item:hover { background: rgba(248, 250, 252, 0.8); color: #475569; }
			.sidebar-icon { width: 20px; height: 20px; flex-shrink: 0; }
			.sidebar-label { font-size: 14px; font-weight: 500; opacity: 0; transition: opacity 0.3s ease; }
			.sidebar.expanded .sidebar-label { opacity: 1; }
			.sidebar-divider { height: 1px; background: rgba(226, 232, 240, 0.6); margin: 8px 20px; }
			.container { 
				display: flex; height: calc(100vh - 60px); gap: 16px; padding: 16px; 
				padding-top: 76px; padding-left: 88px; position: relative; z-index: 1; 
				transition: padding-left 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
			}
			.container.sidebar-expanded { padding-left: 296px; }
			.panel { 
				background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(20px); 
				border: 1px solid rgba(226, 232, 240, 0.8); border-radius: 20px; 
				overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); 
			}
			.left-panel { width: 58%; display: flex; flex-direction: column; padding: 24px; }
			.right-panel { flex: 1; display: flex; flex-direction: column; padding: 24px; position: relative; min-width: 0; }
			.panel-header { margin-bottom: 20px; }
			.panel-title { font-size: 20px; font-weight: 600; color: #1e293b; margin-bottom: 4px; }
			.panel-subtitle { font-size: 14px; color: #64748b; }
			.tree-container { 
				flex: 1; background: rgba(248, 250, 252, 0.5); border-radius: 16px; 
				padding: 20px; position: relative; min-height: 400px; 
				display: flex; align-items: center; justify-content: center; overflow: hidden; 
			}
							.tree-svg { 
					width: 100%; 
					height: 100%; 
					min-width: 1200px; 
					min-height: 800px; 
					display: block; 
					cursor: grab;
				}
				.tree-svg:active { cursor: grabbing; }
			.node-group { 
				cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
				transform-origin: center;
			}
			.node-group:hover .node-circle { 
				stroke-width: 3; 
				filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.3)) drop-shadow(0 4px 12px rgba(0, 0, 0, 0.2)); 
			}
			.node-group:hover .node-label, .node-group:hover .node-reward { 
				fill: #1e293b; font-weight: 600; 
			}
			.node-circle { 
				stroke-width: 2; filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.15)); 
				transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); 
			}
			.node-circle.active { 
				stroke: #f59e0b; stroke-width: 3; 
				filter: drop-shadow(0 0 12px rgba(245, 158, 11, 0.4)) drop-shadow(0 4px 8px rgba(0, 0, 0, 0.15)); 
			}
			.node-circle.breathe { 
				animation: breathe 2.5s ease-in-out infinite; 
				stroke: #6366f1; stroke-width: 3;
			}
			@keyframes breathe { 
				0%, 100% { 
					filter: drop-shadow(0 0 6px rgba(99, 102, 241, 0.4)) drop-shadow(0 4px 8px rgba(0, 0, 0, 0.15)); 
					opacity: 1; 
				} 
				50% { 
					filter: drop-shadow(0 0 12px rgba(99, 102, 241, 0.6)) drop-shadow(0 4px 12px rgba(0, 0, 0, 0.2)); 
					opacity: 0.9; 
				} 
			}
			.dotted-flow { 
				stroke: #3b82f6; 
				stroke-width: 3; 
				stroke-dasharray: 8, 4; 
				animation: dottedFlow 1.5s linear infinite; 
				filter: drop-shadow(0 0 6px rgba(59, 130, 246, 0.4)); 
			}
			@keyframes dottedFlow { 
				0% { stroke-dashoffset: 0; } 
				100% { stroke-dashoffset: -12; } 
			}
			.tooltip { 
				position: fixed; 
				background: rgba(15, 23, 42, 0.95); 
				color: white; 
				padding: 12px 16px; 
				border-radius: 8px; 
				font-size: 12px; 
				pointer-events: none; 
				z-index: 1000; 
				backdrop-filter: blur(10px); 
				box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); 
				transform: translateX(-50%) translateY(-100%); 
				max-width: 250px; 
			}
			.tooltip-title { 
				font-weight: 600; 
				margin-bottom: 4px; 
				color: #e2e8f0; 
			}
			.tooltip-stats { 
				font-size: 11px; 
				color: #cbd5e1; 
				line-height: 1.4; 
			}
			.node-label { 
				font-size: 11px; font-weight: 600; fill: #1e293b; text-anchor: middle; 
				pointer-events: none; font-family: inherit; 
			}
			.node-reward { 
				font-size: 10px; font-weight: 500; fill: #64748b; text-anchor: middle; 
				pointer-events: none; font-family: inherit; 
			}
			.tree-edge { 
				stroke: rgba(100, 116, 139, 0.4); stroke-width: 2; fill: none; 
				transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); 
			}
			.tree-edge.best-path { 
				stroke: #10b981; stroke-width: 4; 
				filter: drop-shadow(0 0 8px rgba(16, 185, 129, 0.4)); 
				animation: pathGlow 2s ease-in-out infinite; 
			}
			@keyframes pathGlow { 
				0%, 100% { opacity: 1; } 
				50% { opacity: 0.7; } 
			}
			.edge-anim { 
				stroke: url(#edgeGradient); stroke-width: 3; 
				filter: drop-shadow(0 0 6px rgba(99, 102, 241, 0.3)); 
			}
			.ghost-node { 
				opacity: 0.3; 
				animation: ghostPulse 2s ease-in-out infinite; 
			}
			@keyframes ghostPulse { 
				0%, 100% { opacity: 0.3; } 
				50% { opacity: 0.6; } 
			}
			.badge { font-size: 9px; font-weight: 600; fill: #475569; font-family: inherit; }
			/* Remove any red particle colors */
			.backprop-particle { 
				filter: drop-shadow(0 0 4px currentColor); 
			}
			.breadcrumb { 
				position: absolute; top: 16px; left: 20px; 
				background: rgba(255, 255, 255, 0.95); padding: 8px 16px; 
				border-radius: 12px; font-size: 12px; color: #475569; font-weight: 500; 
				border: 1px solid rgba(226, 232, 240, 0.8); 
				backdrop-filter: blur(10px); max-width: 400px; 
			}
			.progress { 
				position: absolute; top: 16px; right: 20px; 
				background: rgba(255, 255, 255, 0.95); padding: 8px 16px; 
				border-radius: 12px; font-size: 12px; color: #475569; font-weight: 500; 
				border: 1px solid rgba(226, 232, 240, 0.8); backdrop-filter: blur(10px); 
			}
			.thinking { 
				position: absolute; top: 56px; left: 20px; 
				display: flex; align-items: center; gap: 8px; font-size: 13px; 
				color: #92400e; background: rgba(254, 252, 232, 0.95); 
				padding: 8px 16px; border-radius: 12px; 
				border: 1px solid rgba(251, 191, 36, 0.3); backdrop-filter: blur(10px); 
			}
			.best-path-banner {
				position: absolute; top: 56px; left: 50%; transform: translateX(-50%);
				display: flex; align-items: center; gap: 8px; font-size: 13px;
				color: #065f46; background: rgba(236, 253, 245, 0.95);
				padding: 8px 16px; border-radius: 12px;
				border: 1px solid rgba(16, 185, 129, 0.3); backdrop-filter: blur(10px);
				font-weight: 500; animation: slideDown 0.3s ease;
			}
			@keyframes slideDown {
				from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
				to { opacity: 1; transform: translateX(-50%) translateY(0); }
			}
			.root-banner { 
				position: absolute; top: 56px; left: 20px; right: 20px; 
				background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); 
				color: #065f46; padding: 12px 16px; border-radius: 12px; font-size: 13px; 
				display: flex; justify-content: space-between; align-items: center; 
				backdrop-filter: blur(10px); font-weight: 500; 
			}
			.pulse-dot { 
				width: 8px; height: 8px; border-radius: 50%; background: #f59e0b; 
				animation: pulseDot 1.5s ease-in-out infinite; 
			}
			@keyframes pulseDot { 
				0%, 100% { transform: scale(1); opacity: 1; } 
				50% { transform: scale(1.3); opacity: 0.7; } 
			}
			.hypothesis-panel { 
				margin-top: 20px; padding: 20px; 
				background: rgba(248, 250, 252, 0.8); border: 1px solid rgba(226, 232, 240, 0.8); 
				border-radius: 16px; max-height: 300px; overflow-y: auto; display: flex; flex-direction: column;
			}
			.investigation-tabs {
				display: flex; gap: 8px; margin-bottom: 16px; border-bottom: 1px solid rgba(226, 232, 240, 0.8);
			}
			.tab-btn {
				display: flex; align-items: center; gap: 8px; padding: 8px 16px; border: none;
				background: transparent; color: #64748b; cursor: pointer; border-radius: 8px 8px 0 0;
				transition: all 0.2s ease; font-size: 14px; font-weight: 500;
			}
			.tab-btn:hover { background: rgba(226, 232, 240, 0.5); color: #475569; }
			.tab-btn.active { 
				background: white; color: #6366f1; border-bottom: 2px solid #6366f1; 
				box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
			}
			.tab-content { flex: 1; overflow-y: auto; }
			.hypothesis-title { 
				font-size: 16px; font-weight: 600; color: #1e293b; margin-bottom: 16px; 
				display: flex; align-items: center; gap: 8px; 
			}
			.hypothesis-item { 
				padding: 12px 16px; margin-bottom: 8px; 
				background: rgba(255, 255, 255, 0.8); border-radius: 12px; 
				border-left: 3px solid #6366f1; 
				transition: all 0.2s ease; 
			}
			.hypothesis-item:hover { background: rgba(255, 255, 255, 1); transform: translateX(2px); }
			.hypothesis-item-title { font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 4px; }
			.hypothesis-item-content { font-size: 12px; color: #64748b; line-height: 1.5; }
			.root-cause-summary {
				background: linear-gradient(135deg, #fef3c7 0%, #ecfdf5 100%); 
				border: 1px solid #d97706; border-radius: 12px; padding: 16px; margin-bottom: 20px;
			}
			.rc-header { 
				display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; 
			}
			.rc-header h3 { 
				margin: 0; color: #92400e; font-size: 16px; font-weight: 600; 
			}
			.rc-confidence { 
				background: #10b981; color: white; padding: 4px 8px; border-radius: 6px; 
				font-size: 12px; font-weight: 600; 
			}
			.rc-path, .rc-impact, .rc-solution { 
				margin-bottom: 8px; font-size: 13px; line-height: 1.4; color: #374151; 
			}
			.timeline-section h4 { 
				margin: 0 0 16px 0; color: #1e293b; font-size: 14px; font-weight: 600; 
			}
			.timeline { display: flex; flex-direction: column; gap: 12px; }
			.timeline-item { 
				display: flex; gap: 12px; padding: 12px; border-radius: 8px; 
				background: rgba(255, 255, 255, 0.7); border-left: 3px solid #e5e7eb; 
			}
			.timeline-item.incident { border-left-color: #ef4444; }
			.timeline-item.analysis { border-left-color: #3b82f6; }
			.timeline-item.discovery { border-left-color: #f59e0b; }
			.timeline-item.solution { border-left-color: #10b981; }
			.timeline-item.resolution { border-left-color: #8b5cf6; }
			.timeline-time { 
				min-width: 40px; font-size: 12px; font-weight: 600; 
				color: #6b7280; font-family: monospace; 
			}
			.timeline-content { flex: 1; }
			.timeline-event { 
				font-size: 13px; font-weight: 600; color: #1e293b; margin-bottom: 4px; 
			}
			.timeline-description { 
				font-size: 12px; color: #64748b; line-height: 1.4; 
			}
			.solution-section, .reading-section, .best-practices {
				margin-bottom: 24px;
			}
			.solution-section h4, .reading-section h4, .best-practices h4 {
				margin: 0 0 16px 0; color: #1e293b; font-size: 16px; font-weight: 600;
			}
			.solution-card {
				background: rgba(255, 255, 255, 0.9); border: 1px solid rgba(226, 232, 240, 0.8);
				border-radius: 12px; padding: 16px; margin-bottom: 16px;
				transition: all 0.2s ease;
			}
			.solution-card:hover {
				transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
			}
			.solution-card h5 {
				margin: 0 0 12px 0; color: #6366f1; font-size: 14px; font-weight: 600;
			}
			.solution-card p {
				margin: 8px 0; font-size: 12px; color: #475569; line-height: 1.6;
			}
			.code-block {
				background: #1e293b; color: #e2e8f0; padding: 12px; border-radius: 8px;
				font-family: 'SF Mono', Monaco, Consolas, monospace; font-size: 11px;
				line-height: 1.6; overflow-x: auto; margin: 12px 0;
				white-space: pre; border: 1px solid #334155;
			}
			.reading-list, .practice-list {
				list-style: none; padding: 0; margin: 0;
			}
			.reading-list li, .practice-list li {
				padding: 12px; margin-bottom: 8px; background: rgba(255, 255, 255, 0.8);
				border-radius: 8px; border-left: 3px solid #6366f1; font-size: 12px;
				line-height: 1.6; color: #475569;
			}
			.reading-list li strong, .practice-list li strong {
				color: #1e293b; display: block; margin-bottom: 4px;
			}
			.reading-list a {
				color: #6366f1; text-decoration: none; font-size: 11px;
			}
			.reading-list a:hover {
				text-decoration: underline;
			}
			.control-bar { 
				position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); 
				background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(20px); 
				border: 1px solid rgba(226, 232, 240, 0.8); border-radius: 16px; 
				padding: 8px; display: flex; gap: 8px; z-index: 1000; 
				box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); 
			}
			.glass-btn { 
				padding: 12px 16px; background: rgba(248, 250, 252, 0.8); 
				border: 1px solid rgba(226, 232, 240, 0.6); border-radius: 12px; 
				font-size: 13px; font-weight: 500; color: #334155; cursor: pointer; 
				transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); 
				display: flex; align-items: center; gap: 8px; 
			}
			.glass-btn:hover { 
				background: rgba(241, 245, 249, 1); color: #1e293b; 
				transform: translateY(-1px); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); 
			}
			.glass-btn.primary { 
				background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1)); 
				border-color: rgba(99, 102, 241, 0.3); color: #6366f1; 
			}
			.glass-btn.primary:hover { 
				background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15)); 
				box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15); 
			}
			.tree-legend { 
				position: absolute; bottom: 16px; right: 20px; font-size: 11px; 
				color: #64748b; display: flex; gap: 16px; 
			}
			.legend-item { display: flex; align-items: center; gap: 6px; }
			.legend-circle { width: 12px; height: 12px; border-radius: 50%; }
			.legend-line { width: 16px; height: 3px; border-radius: 2px; }
			.zoom-controls {
				position: absolute; top: 20px; right: 20px; display: flex; gap: 5px; align-items: center;
				background: rgba(255, 255, 255, 0.9); padding: 8px 12px; border-radius: 8px;
				font-size: 12px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
			}
			.zoom-btn {
				width: 28px; height: 28px; border: none; border-radius: 4px; 
				background: #f3f4f6; color: #374151; font-weight: 600; cursor: pointer;
				display: flex; align-items: center; justify-content: center;
				transition: all 0.2s ease;
			}
			.zoom-btn:hover { background: #e5e7eb; }
			.zoom-level { 
				min-width: 40px; text-align: center; font-weight: 500; color: #6b7280; 
			}
			.monitoring-grid { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: repeat(3, 1fr); gap: 16px; flex: 1; min-height: 0; }
			.monitor-card { 
				background: rgba(248, 250, 252, 0.8); border: 1px solid rgba(226, 232, 240, 0.8); 
				border-radius: 16px; padding: 16px; display: flex; flex-direction: column; 
				overflow: hidden; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
			}
			.monitor-card.active { 
				background: rgba(255, 255, 255, 0.95); border-color: rgba(99, 102, 241, 0.4); 
				box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.1), 0 4px 6px -1px rgba(99, 102, 241, 0.1); 
				transform: scale(1.02); 
			}
			.monitor-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
			.monitor-icon { 
				width: 32px; height: 32px; border-radius: 10px; display: flex; 
				align-items: center; justify-content: center; font-size: 16px; 
			}
			.monitor-icon.logs { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
			.monitor-icon.metrics { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
			.monitor-icon.network { background: linear-gradient(135deg, #30cfd0 0%, #330867 100%); }
			.monitor-icon.errors { background: linear-gradient(135deg, #ff6b6b 0%, #c92a2a 100%); }
			.monitor-icon.shuffle { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
			.monitor-icon.sparkui { background: linear-gradient(135deg, #f79f1f 0%, #fd9644 100%); }
			.monitor-title { font-size: 13px; font-weight: 600; color: #334155; text-transform: uppercase; letter-spacing: 0.5px; }
			.monitor-content { flex: 1; overflow-y: auto; min-height: 0; font-size: 12px; color: #64748b; line-height: 1.5; }
			.data-line { 
				padding: 6px 8px; margin-bottom: 4px; background: rgba(255, 255, 255, 0.6); 
				border-radius: 8px; font-family: 'SF Mono', Monaco, monospace; font-size: 11px; 
				transition: all 0.3s ease; 
			}
			.data-line.highlight { 
				background: linear-gradient(90deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.05)); 
				border-left: 3px solid #6366f1; padding-left: 12px; 
				animation: slideIn 0.5s ease; 
			}
			@keyframes slideIn { 
				from { opacity: 0; transform: translateX(-8px); } 
				to { opacity: 1; transform: translateX(0); } 
			}
			.metrics-tabs { 
				display: flex; gap: 4px; margin-bottom: 12px; padding: 4px; 
				background: rgba(226, 232, 240, 0.3); border-radius: 10px; 
			}
			.metric-tab { 
				flex: 1; padding: 6px; font-size: 11px; font-weight: 500; 
				text-align: center; border-radius: 6px; cursor: pointer; 
				color: #64748b; transition: all 0.2s ease; border: none; background: transparent; 
			}
			.metric-tab.active { 
				background: rgba(255, 255, 255, 0.9); color: #6366f1; 
				box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); 
			}
			.metric-value { font-size: 24px; font-weight: 700; color: #1e293b; margin-bottom: 4px; }
			.metric-label { font-size: 12px; color: #64748b; font-weight: 500; }
			.metric-chart { 
				height: 60px; margin-top: 8px; border-radius: 8px; 
				background: rgba(226, 232, 240, 0.3); position: relative; overflow: hidden; 
			}
			.metric-chart-bar { 
				position: absolute; bottom: 0; left: 0; height: 100%; 
				background: linear-gradient(180deg, #6366f1 0%, #4f46e5 100%); 
				transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1); 
				border-radius: 0 0 8px 8px; 
			}
			.metric-chart-bar.cpu { background: linear-gradient(180deg, #3b82f6 0%, #2563eb 100%); }
			.metric-chart-bar.gc { background: linear-gradient(180deg, #f59e0b 0%, #d97706 100%); }
			.monitor-card.scanning { 
				animation: scanPulse 1.5s ease-in-out infinite; 
				border: 2px solid #f59e0b; 
				box-shadow: 0 0 20px rgba(245, 158, 11, 0.3); 
			}
			@keyframes scanPulse { 
				0%, 100% { border-color: #f59e0b; box-shadow: 0 0 20px rgba(245, 158, 11, 0.3); } 
				50% { border-color: #fbbf24; box-shadow: 0 0 30px rgba(251, 191, 36, 0.5); } 
			}
			.monitor-card.analyzing { 
				border: 2px solid #6366f1; 
				background: rgba(99, 102, 241, 0.05); 
			}
			.monitor-card.evidence-strong { 
				border-left: 4px solid #10b981; 
				background: linear-gradient(90deg, rgba(16, 185, 129, 0.1), transparent); 
			}
			.monitor-card.evidence-medium { 
				border-left: 4px solid #f59e0b; 
				background: linear-gradient(90deg, rgba(245, 158, 11, 0.1), transparent); 
			}
			.monitor-card.evidence-weak { 
				border-left: 4px solid #6b7280; 
				background: linear-gradient(90deg, rgba(107, 114, 128, 0.1), transparent); 
			}
			.scanning-indicator { 
				font-size: 10px; 
				color: #f59e0b; 
				font-weight: 600; 
				animation: scanText 1s ease-in-out infinite; 
			}
			@keyframes scanText { 
				0%, 100% { opacity: 1; } 
				50% { opacity: 0.5; } 
			}
			.evidence-badge { 
				width: 20px; 
				height: 20px; 
				border-radius: 50%; 
				display: flex; 
				align-items: center; 
				justify-content: center; 
				font-size: 12px; 
				font-weight: bold; 
				color: white; 
			}
			.evidence-badge.evidence-strong { background: #10b981; }
			.evidence-badge.evidence-medium { background: #f59e0b; }
			.evidence-badge.evidence-weak { background: #6b7280; }
			.analysis-connection { 
				position: absolute; 
				top: 50%; 
				right: -20px; 
				transform: translateY(-50%); 
				display: flex; 
				align-items: center; 
				gap: 8px; 
			}
			.connection-line { 
				width: 40px; 
				height: 2px; 
				background: linear-gradient(90deg, #6366f1, transparent); 
				animation: connectionPulse 1.5s ease-in-out infinite; 
			}
			@keyframes connectionPulse { 
				0%, 100% { opacity: 0.3; } 
				50% { opacity: 1; } 
			}
			.connection-label { 
				font-size: 10px; 
				color: #6366f1; 
				font-weight: 500; 
				white-space: nowrap; 
				background: rgba(255, 255, 255, 0.9); 
				padding: 2px 6px; 
				border-radius: 4px; 
			}
			`}</style>

			<div className="top-header">
				<div className="header-left">
					<div className="menu-btn" onClick={() => setSidebarExpanded(!sidebarExpanded)}>
						<Menu size={20} />
					</div>
					<div className="job-input-group">
						<span className="job-input-label">Job ID:</span>
						<input type="text" className="job-input" placeholder="spark-job-2024-001" />
					</div>
				</div>
				<div className="mcts-stages">
					<div className={classNames('stage', activeStage === 'selection' && 'active')}>
						<span className="stage-dot"></span><span>Selection</span>
					</div>
					<div className={classNames('stage', activeStage === 'expansion' && 'active')}>
						<span className="stage-dot"></span><span>Expansion</span>
					</div>
					<div className={classNames('stage', activeStage === 'simulation' && 'active')}>
						<span className="stage-dot"></span><span>Simulation</span>
					</div>
					<div className={classNames('stage', activeStage === 'backpropagation' && 'active')}>
						<span className="stage-dot"></span><span>Backpropagation</span>
					</div>
				</div>
			</div>

			<div className={classNames('sidebar', sidebarExpanded && 'expanded')}>
				<div className="sidebar-item">
					<svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
						<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
						<line x1="9" y1="9" x2="15" y2="9"></line>
						<line x1="9" y1="15" x2="15" y2="15"></line>
					</svg>
					<span className="sidebar-label">Current Analysis</span>
				</div>
				<div className="sidebar-item">
					<svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
						<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
					</svg>
					<span className="sidebar-label">Live Monitoring</span>
				</div>
				<div className="sidebar-divider"></div>
				<div className="sidebar-item">
					<svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
						<circle cx="12" cy="12" r="3"></circle>
						<path d="M12 1v6m0 6v6m4.22-13.22l4.24 4.24M1.54 1.54l4.24 4.24M20.46 20.46l-4.24-4.24M1.54 20.46l4.24-4.24"></path>
					</svg>
					<span className="sidebar-label">Past RCAs</span>
				</div>
				<div className="sidebar-item">
					<svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
						<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
						<polyline points="14 2 14 8 20 8"></polyline>
					</svg>
					<span className="sidebar-label">Reports</span>
				</div>
			</div>

			<div className={classNames('container', sidebarExpanded && 'sidebar-expanded')}>
				<div className="panel left-panel">
					<div className="panel-header">
						<h1 className="panel-title">Signal Analysis Dashboard</h1>
						<p className="panel-subtitle">Real-time monitoring across multiple dimensions</p>
					</div>
					<div className="monitoring-grid">
						<MonitorCard 
							id="logs" 
							icon="📋" 
							title="Spark Logs" 
							isActive={signals.logs}
							scanningSignalCard={scanningSignalCard}
							activeSignalCards={activeSignalCards}
							signalEvidence={signalEvidence}
							currentlyAnalyzingNode={currentlyAnalyzingNode}
						>
							{signals.logs ? signals.logs.flat().map((line, i) => (
								<div key={i} className="data-line highlight">{line}</div>
							)) : <div className="data-line">Waiting for analysis...</div>}
						</MonitorCard>
						<MonitorCard 
							id="metrics" 
							icon="📊" 
							title="System Metrics" 
							isActive={signals.metrics}
							scanningSignalCard={scanningSignalCard}
							activeSignalCards={activeSignalCards}
							signalEvidence={signalEvidence}
							currentlyAnalyzingNode={currentlyAnalyzingNode}
						>
							<div className="metrics-tabs">
								{(['memory','cpu','gc'] as const).map(tab => (
									<button key={tab} className={classNames('metric-tab', currentMetricTab === tab && 'active')} onClick={() => setCurrentMetricTab(tab)}>
										{tab.toUpperCase()}
									</button>
								))}
							</div>
							{currentMetricTab === 'memory' && (
								<div>
									<div className="metric-value">{getMetricValue('memory').value}%</div>
									<div className="metric-label">Memory Usage</div>
									<div className="metric-chart"><div className="metric-chart-bar" style={{ width: `${getMetricValue('memory').bar}%` }} /></div>
								</div>
							)}
							{currentMetricTab === 'cpu' && (
								<div>
									<div className="metric-value">{getMetricValue('cpu').value}%</div>
									<div className="metric-label">CPU Usage</div>
									<div className="metric-chart"><div className="metric-chart-bar cpu" style={{ width: `${getMetricValue('cpu').bar}%` }} /></div>
								</div>
							)}
							{currentMetricTab === 'gc' && (
								<div>
									<div className="metric-value">{getMetricValue('gc').value}%</div>
									<div className="metric-label">GC Overhead</div>
									<div className="metric-chart"><div className="metric-chart-bar gc" style={{ width: `${getMetricValue('gc').bar}%` }} /></div>
								</div>
							)}
						</MonitorCard>
						<MonitorCard 
							id="network" 
							icon="🌐" 
							title="Network I/O" 
							isActive={signals.network}
							scanningSignalCard={scanningSignalCard}
							activeSignalCards={activeSignalCards}
							signalEvidence={signalEvidence}
							currentlyAnalyzingNode={currentlyAnalyzingNode}
						>
							{signals.network ? signals.network.flat().map((line, i) => (
								<div key={i} className="data-line highlight">{line}</div>
							)) : <div className="data-line">Network stats pending...</div>}
						</MonitorCard>
						<MonitorCard 
							id="errors" 
							icon="⚠️" 
							title="Error Summary" 
							isActive={signals.errors}
							scanningSignalCard={scanningSignalCard}
							activeSignalCards={activeSignalCards}
							signalEvidence={signalEvidence}
							currentlyAnalyzingNode={currentlyAnalyzingNode}
						>
							{(() => {
								const errorValue = getErrorValue();
								return (
									<>
										<div className="metric-value">{errorValue.value}</div>
										<div className="metric-label">{errorValue.label}</div>
									</>
								);
							})()}
						</MonitorCard>
						<MonitorCard 
							id="shuffle" 
							icon="🔀" 
							title="Shuffle Stats" 
							isActive={signals.shuffle}
							scanningSignalCard={scanningSignalCard}
							activeSignalCards={activeSignalCards}
							signalEvidence={signalEvidence}
							currentlyAnalyzingNode={currentlyAnalyzingNode}
						>
							{signals.shuffle ? signals.shuffle.flat().map((line, i) => (
								<div key={i} className="data-line highlight">{line}</div>
							)) : <div className="data-line">Shuffle data pending...</div>}
						</MonitorCard>
						<MonitorCard 
							id="sparkui" 
							icon="⚡" 
							title="Spark UI" 
							isActive={signals.sparkui}
							scanningSignalCard={scanningSignalCard}
							activeSignalCards={activeSignalCards}
							signalEvidence={signalEvidence}
							currentlyAnalyzingNode={currentlyAnalyzingNode}
						>
							{signals.sparkui ? signals.sparkui.flat().map((line, i) => (
								<div key={i} className="data-line highlight">{line}</div>
							)) : <div className="data-line">Spark UI data pending...</div>}
						</MonitorCard>
					</div>
				</div>

				<div className="panel right-panel">
					<div className="panel-header">
						<h1 className="panel-title">MCTS Exploration Tree</h1>
						<p className="panel-subtitle">Watch AI detective methodically investigate system failure</p>
					</div>
					<div className="tree-container">
						<div className="breadcrumb">{computeBreadcrumb()}</div>
						<div className="progress"><strong>Explored:</strong> {visibleNodeIds.size} / {treeData.nodes.length}</div>
						{thinking && (<div className="thinking"><div className="pulse-dot"></div> Analyzing hypothesis...</div>)}
						{showingBestPath && bestPathFound && (
							<div className="best-path-banner">
								<Star size={16} color="#10b981" fill="#10b981" />
								<span>Best Path Highlighted (Reward: {(bestPathFound.reward * 100).toFixed(1)}%)</span>
							</div>
						)}

						<svg className="tree-svg" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMin meet" ref={svgRef} onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
							<defs>
								<linearGradient id="edgeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
									<stop offset="0%" style={{ stopColor: '#6366f1', stopOpacity: 0.8 }} />
									<stop offset="100%" style={{ stopColor: '#8b5cf6', stopOpacity: 0.6 }} />
								</linearGradient>
								<filter id="glow">
									<feGaussianBlur stdDeviation="3" result="coloredBlur"/>
									<feMerge> 
										<feMergeNode in="coloredBlur"/>
										<feMergeNode in="SourceGraphic"/>
									</feMerge>
								</filter>
							</defs>
							<g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
							{treeData.edges.filter(e => visibleEdgeIds.has(e.id)).map(edge => {
								const isBest = bestPathFound?.path.some((n, i) => i > 0 && bestPathFound.path[i - 1].id === edge.source.id && n.id === edge.target.id);
								const isAnimating = animatingEdgeId === edge.id;
								const isExploring = particleEdgeId === edge.id;
								const pathD = `M ${edge.source.x} ${edge.source.y + 18} L ${edge.target.x} ${edge.target.y - 18}`;
								
								return (
									<g key={edge.id}>
										{/* Base edge */}
										<path d={pathD} 
											className={classNames(
												'tree-edge', 
												isBest && 'best-path'
											)} />
										
										{/* Animated drawing edge */}
										{isAnimating && (
											<path d={pathD} 
												className="edge-anim"
												style={{ 
													strokeDasharray: Math.hypot(edge.target.x - edge.source.x, edge.target.y - edge.source.y - 36),
													strokeDashoffset: Math.hypot(edge.target.x - edge.source.x, edge.target.y - edge.source.y - 36) * (1 - edgeDrawProgress)
												}} />
										)}
										
										{/* Flowing exploration line */}
										{isExploring && (
											<path d={pathD} className="dotted-flow" />
										)}
										
										{/* Backprop particles only */}
										{backpropParticles.filter(p => p.edgeId === edge.id).map((p, idx) => (
											<circle key={idx} r="3" fill={p.color} 
												cx={edge.target.x + (edge.source.x - edge.target.x) * p.t} 
												cy={edge.target.y - 18 + (edge.source.y - edge.target.y + 36) * p.t} 
												opacity={0.7} className="backprop-particle" />
										))}
									</g>
								);
							})}
							{treeData.nodes.filter(n => visibleNodeIds.has(n.id)).map(node => {
								const isLeaf = treeData.nodes.filter(n => n.parent === node.id).length === 0;
								const isRootCause = rootCause?.id === node.id;
								const stats = nodeStats[node.id];
								return (
									<g key={node.id} className="node-group" transform={`translate(${node.x}, ${node.y})`} 
										onClick={() => showNode(node)}
										onMouseEnter={(e) => handleNodeHover(e, node)}
										onMouseLeave={handleNodeLeave}>
										<circle r="18" 
											className={classNames(
												'node-circle', 
												selectedNode?.id === node.id && 'active', 
												currentPath.includes(node) && 'breathe'
											)} 
											fill="#ffffff" 
											stroke={isRootCause ? '#10b981' : getBorderColor(node.reward)} 
											strokeWidth={isRootCause ? 3 : 2} />
										{isRootCause && <Star size={12} x={-6} y={-6} fill="#fbbf24" stroke="#f59e0b" strokeWidth={1} />}
										<text y="-6" className="node-label" textAnchor="middle">{node.label}</text>
										<text y="6" className="node-reward" textAnchor="middle">{(node.reward * 100).toFixed(0)}%</text>
									</g>
								);
							})}
							{/* ghost candidates */}
							{ghostChildren.map(g => (
								<g key={g.id} className="node-group ghost-node" transform={`translate(${g.x}, ${g.y})`}>
									<circle r="16" className="node-circle" fill={rewardToColor(g.reward)} stroke="#94a3b8" strokeWidth={2} strokeDasharray="4,2" />
									<text y="-6" className="node-label" textAnchor="middle" opacity="0.7">{g.label}</text>
									<text y="6" className="badge" textAnchor="middle">{(g.reward * 100).toFixed(0)}%</text>
								</g>
							))}
							</g>
						</svg>
						<div className="tree-legend">
							<div className="legend-item"><div className="legend-circle" style={{ background: '#f59e0b', border: `2px solid ${getBorderColor(1)}` }} /> <span>Active</span></div>
							<div className="legend-item"><div className="legend-circle" style={{ background: '#e5e7eb', border: `1px dashed ${getBorderColor(0.5)}` }} /> <span>Exploring</span></div>
							<div className="legend-item"><div className="legend-line" style={{ background: '#10b981' }} /> <span>Best Path</span></div>
							<div className="legend-item"><Star size={12} color="#fbbf24" /> <span>Root Cause</span></div>
						</div>
						<div className="zoom-controls">
							<button className="zoom-btn" onClick={() => setTransform(prev => ({ ...prev, scale: Math.min(3, prev.scale * 1.2) }))}>+</button>
							<span className="zoom-level">{Math.round(transform.scale * 100)}%</span>
							<button className="zoom-btn" onClick={() => setTransform(prev => ({ ...prev, scale: Math.max(0.1, prev.scale * 0.8) }))}>-</button>
							<button className="zoom-btn" onClick={resetView}>⌂</button>
						</div>
					</div>
					<div className="hypothesis-panel">
						<div className="investigation-tabs">
							<button 
								className={`tab-btn ${activeTab === 'trail' ? 'active' : ''}`}
								onClick={() => setActiveTab('trail')}
							>
								<CheckCircle size={16} />
								<span>Investigation Trail</span>
							</button>
							{rootCause && (
								<>
									<button 
										className={`tab-btn ${activeTab === 'rootcause' ? 'active' : ''}`}
										onClick={() => setActiveTab('rootcause')}
									>
										<Star size={16} />
										<span>Root Cause Analysis</span>
									</button>
									<button 
										className={`tab-btn ${activeTab === 'solution' ? 'active' : ''}`}
										onClick={() => setActiveTab('solution')}
									>
										<ChevronRight size={16} />
										<span>Possible Solutions</span>
									</button>
								</>
							)}
						</div>

						{activeTab === 'trail' && (
							<div className="tab-content">
								{accumulatedHypotheses.map(h => (
									<div key={h.id} className="hypothesis-item">
										<div className="hypothesis-item-title">{h.title}</div>
										<div className="hypothesis-item-content">{h.content}</div>
									</div>
								))}
							</div>
						)}

						{activeTab === 'rootcause' && rootCause && (() => {
							const rcData = generateRootCauseExplanation();
							if (!rcData) return null;
							const { explanation, timeline } = rcData;

							return (
								<div className="tab-content">
									<div className="root-cause-summary">
										<div className="rc-header">
											<h3>{explanation.title}</h3>
											<div className="rc-confidence">Confidence: {explanation.confidence}</div>
										</div>
										<div className="rc-path">
											<strong>Investigation Path:</strong> {explanation.investigationPath}
										</div>
										<div className="rc-impact">
											<strong>Impact:</strong> {explanation.impact}
										</div>
										<div className="rc-solution">
											<strong>Failure Mechanism:</strong> {explanation.mechanism}
										</div>
									</div>

									<div className="timeline-section">
										<h4>Investigation Timeline</h4>
										<div className="timeline">
											{timeline.map((event, idx) => (
												<div key={idx} className={`timeline-item ${event.type}`}>
													<div className="timeline-time">{event.time}</div>
													<div className="timeline-content">
														<div className="timeline-event">{event.event}</div>
														<div className="timeline-description">{event.description}</div>
													</div>
												</div>
											))}
										</div>
									</div>
								</div>
							);
						})()}

						{activeTab === 'solution' && rootCause && (
							<div className="tab-content">
								<div className="solution-section">
									<h4>💡 Recommended Solutions</h4>
									
									<div className="solution-card">
										<h5>1. Key Salting (Recommended)</h5>
										<p><strong>Approach:</strong> Add random salt suffix to skewed keys to distribute them across multiple partitions.</p>
										<div className="code-block">
											{`// Scala/Spark implementation
val saltFactor = 10
val saltedDF = df
  .withColumn("salt", 
    when(col("user_id").isin("premium_user_999", "bot_crawler_001"),
         (rand() * saltFactor).cast("int"))
    .otherwise(lit(0)))
  .withColumn("salted_key", concat(col("user_id"), lit("_"), col("salt")))

// Join on salted key instead
leftDF.join(rightDF.repartition(col("salted_key")), "salted_key")`}
										</div>
										<p><strong>Expected Impact:</strong> Reduces max partition from 8.4GB to 840MB. Task duration variance from 42x to ~3x.</p>
									</div>

									<div className="solution-card">
										<h5>2. Adaptive Query Execution (AQE)</h5>
										<p><strong>Approach:</strong> Enable Spark 3.x Adaptive Query Execution to automatically handle skew.</p>
										<div className="code-block">
											{`spark.conf.set("spark.sql.adaptive.enabled", "true")
spark.conf.set("spark.sql.adaptive.skewJoin.enabled", "true")
spark.conf.set("spark.sql.adaptive.skewJoin.skewedPartitionFactor", "5")
spark.conf.set("spark.sql.adaptive.skewJoin.skewedPartitionThresholdInBytes", "256MB")`}
										</div>
										<p><strong>Expected Impact:</strong> Spark automatically detects and splits skewed partitions at runtime.</p>
									</div>

									<div className="solution-card">
										<h5>3. Isolated Processing</h5>
										<p><strong>Approach:</strong> Filter out power users and process them separately with different strategy.</p>
										<div className="code-block">
											{`val powerUsers = Seq("premium_user_999", "bot_crawler_001")
val normalUsers = events.filter(!col("user_id").isin(powerUsers: _*))
val powerUserData = events.filter(col("user_id").isin(powerUsers: _*))

// Process normal users with standard join
val normalResult = normalUsers.join(users, "user_id")

// Process power users with broadcast or sampling
val powerResult = powerUserData.join(broadcast(users), "user_id")
  .sample(0.05) // 5% sample for power users

normalResult.union(powerResult)`}
										</div>
										<p><strong>Expected Impact:</strong> Prevents power users from affecting overall job performance.</p>
									</div>

									<div className="solution-card">
										<h5>4. Increase Executor Memory (Temporary)</h5>
										<p><strong>Approach:</strong> Increase executor heap to handle larger partitions.</p>
										<div className="code-block">
											{`spark.conf.set("spark.executor.memory", "12g")  // Double from 6g
spark.conf.set("spark.executor.memoryOverhead", "2g")  // Increase overhead`}
										</div>
										<p><strong>Expected Impact:</strong> Temporary mitigation. Still inefficient due to skew, but prevents OOM.</p>
										<p><strong>Note:</strong> Not recommended as long-term solution. Increases cost and doesn't address root cause.</p>
									</div>
								</div>

								<div className="reading-section">
									<h4>📚 Further Reading</h4>
									<ul className="reading-list">
										<li>
											<strong>Databricks: Skew Handling</strong><br />
											<a href="https://www.databricks.com/blog/2020/05/29/adaptive-query-execution-speeding-up-spark-sql-at-runtime.html" target="_blank" rel="noopener noreferrer">
												Adaptive Query Execution: Speeding Up Spark SQL at Runtime
											</a>
										</li>
										<li>
											<strong>Apache Spark Documentation</strong><br />
											<a href="https://spark.apache.org/docs/latest/sql-performance-tuning.html#other-configuration-options" target="_blank" rel="noopener noreferrer">
												Performance Tuning - Skew Join Optimization
											</a>
										</li>
										<li>
											<strong>Netflix Tech Blog</strong><br />
											<a href="https://netflixtechblog.com/scaling-time-series-data-storage-part-i-ec2b6d44ba39" target="_blank" rel="noopener noreferrer">
												Handling Data Skew in Large-Scale Processing
											</a>
										</li>
										<li>
											<strong>Spark: The Definitive Guide</strong><br />
											Chapter 19: Performance Tuning (O'Reilly, 2018) - Section on handling skewed data
										</li>
										<li>
											<strong>Research Paper</strong><br />
											"SkewTune: Mitigating Skew in MapReduce Applications" (SIGMOD 2012)
										</li>
									</ul>
								</div>

								<div className="best-practices">
									<h4>✅ Best Practices</h4>
									<ul className="practice-list">
										<li><strong>Monitor Partition Sizes:</strong> Set up alerts when max/avg partition ratio exceeds 10:1</li>
										<li><strong>Profile Join Keys:</strong> Analyze key distribution before implementing large joins</li>
										<li><strong>Use AQE by Default:</strong> Enable Adaptive Query Execution in production</li>
										<li><strong>Test with Production Data:</strong> Sample-based testing may miss skew patterns</li>
										<li><strong>Document Power Users:</strong> Maintain list of known high-volume entities for special handling</li>
									</ul>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>

			{hoveredNode && (
				<div className="tooltip" style={{ left: tooltipPosition.x, top: tooltipPosition.y }}>
					<div className="tooltip-title">{hoveredNode.hypothesis.title}</div>
					<div className="tooltip-stats">
						<div>Confidence: {(hoveredNode.reward * 100).toFixed(1)}%</div>
						<div>Level: {hoveredNode.level}</div>
						{nodeStats[hoveredNode.id] && (
							<div>Visits: {nodeStats[hoveredNode.id].visits}</div>
						)}
						<div>Signals: {hoveredNode.signalsRequired.join(', ')}</div>
					</div>
				</div>
			)}

			<div className="control-bar">
				<button className="glass-btn primary" onClick={startAnalysis}>
					{isPlaying ? <Pause size={16} /> : <Play size={16} />}
					<span>{isPlaying ? 'Investigating...' : visibleNodeIds.size > 1 ? 'Resume Analysis' : 'Start Investigation'}</span>
				</button>
				<button className="glass-btn" onClick={stepAnalysis}><ChevronRight size={16} /><span>Next Step</span></button>
				<button className="glass-btn" onClick={showBestPath}><CheckCircle size={16} /><span>Best Path</span></button>
				<button className="glass-btn" onClick={changeSpeed}><Clock size={16} /><span>Speed: {speedLabels[speedMode]}</span></button>
				<button className="glass-btn" onClick={reset}><RotateCcw size={16} /><span>Reset</span></button>
			</div>
		</div>
	);
} 