import type { TreeData, RcaNode } from '@/types/rca';

// Signal requirements for different node types
const signalMappings: Record<string, string[]> = {
	'JobFailure': ['logs', 'metrics', 'sparkui', 'errors'],
	'StageFailures': ['sparkui', 'logs', 'errors'],
	'MemoryAlerts': ['logs', 'metrics', 'errors'],
	'NetworkTimeout': ['network', 'logs', 'metrics'],
	'DataQuality': ['logs', 'sparkui', 'shuffle'],
	'ShuffleErrors': ['shuffle', 'sparkui', 'logs'],
	'TaskRetries': ['sparkui', 'logs', 'metrics'],
	'ClusterHealth': ['metrics', 'network', 'logs'],
	
	// Level 2 nodes
	'JoinStage': ['sparkui', 'logs', 'shuffle'],
	'ExecutorOOM': ['logs', 'metrics', 'errors'],
	'FetchFailures': ['shuffle', 'network', 'logs'],
	'DataSkew': ['shuffle', 'sparkui', 'logs'],
	'YarnContainerKilled': ['logs', 'metrics', 'errors'],
	
	// Level 3 nodes
	'SkewedJoin': ['shuffle', 'sparkui', 'logs'],
	'UDFMemoryLeak': ['logs', 'metrics', 'errors'],
	'HotPartition': ['shuffle', 'sparkui', 'logs'],
	'MemoryOverhead': ['logs', 'metrics', 'errors'],
	'ConnectionTimeout': ['network', 'logs', 'sparkui'],
	
	// Solutions
	'SaltingKeys': ['sparkui', 'logs'],
	'FixUDFCode': ['logs', 'metrics'],
	'Repartition': ['shuffle', 'sparkui'],
	'IncreaseOverhead': ['logs', 'metrics'],
	'IncreaseTimeout': ['network', 'logs'],
	
	// Verifications
	'TestRun': ['logs', 'sparkui', 'metrics'],
	'MemoryProfile': ['logs', 'metrics'],
	'PartitionBalance': ['shuffle', 'sparkui'],
	'ContainerStable': ['logs', 'metrics'],
	'DeployProduction': ['logs', 'sparkui', 'metrics', 'errors']
};

// Evidence patterns for realistic signal updates
const evidencePatterns: Record<string, Record<string, any>> = {
	'JobFailure': {
		logs: ['CRITICAL: ETL Pipeline Failed', 'Multiple stage failures detected', '3-hour SLA breach'],
		metrics: { memory: { value: 95, label: 'Memory', bar: 95 }, cpu: { value: 78, label: 'CPU', bar: 78 } },
		sparkui: ['Failed stages: 5', 'Total duration: 4.2h', 'Tasks failed: 234'],
		errors: { value: 15, label: 'Critical Errors' }
	},
	'StageFailures': {
		sparkui: ['Stage 23 failed 3 times', 'Stage 45 timeout', 'Stage 67 OOM'],
		logs: ['Multiple stages showing errors', 'Stage retry limit exceeded'],
		errors: { value: 8, label: 'Stage Failures' }
	},
	'MemoryAlerts': {
		logs: ['OOM warnings detected', 'Executor heap exhausted', 'Container killed by YARN'],
		metrics: { memory: { value: 98, label: 'Memory', bar: 98 }, gc: { value: 45, label: 'GC %', bar: 45 } },
		errors: { value: 12, label: 'OOM Events' }
	},
	'JoinStage': {
		sparkui: ['Stage 23 consistently fails', 'Join operation timeout', 'Shuffle read: 500GB'],
		logs: ['Join stage failure', 'Hash join converted to sort merge'],
		shuffle: ['Shuffle spill: 200GB', 'Fetch failures: 45']
	},
	'ExecutorOOM': {
		logs: ['Executor heap exhausted', 'java.lang.OutOfMemoryError', 'Executor lost due to OOM'],
		metrics: { memory: { value: 100, label: 'Memory', bar: 100 } },
		errors: { value: 8, label: 'Executor OOMs' }
	},
	'SkewedJoin': {
		shuffle: ['Partition 127: 10GB', 'Other partitions: 50MB avg', 'Max partition 200x larger'],
		sparkui: ['Task duration variance: 50x', 'Stragglers: 15 tasks', 'One key has 80% of data'],
		logs: ['Extreme data skew detected', 'Join key distribution highly skewed']
	},
	'UDFMemoryLeak': {
		logs: ['Custom UDF memory leak', 'Memory usage increasing per batch', 'Python worker OOM'],
		metrics: { memory: { value: 99, label: 'Memory', bar: 99 } },
		errors: { value: 6, label: 'UDF Errors' }
	},
	'SaltingKeys': {
		sparkui: ['Partition distribution improved', 'Max partition size reduced', 'Task duration variance: 2x'],
		logs: ['Salting strategy applied', 'Join performance improved 3x']
	},
	'TestRun': {
		logs: ['Test on sample data - SUCCESS', 'Memory usage stable', 'No OOM errors'],
		sparkui: ['Test duration: 45min', 'All stages completed', 'Performance improved 3x'],
		metrics: { memory: { value: 65, label: 'Memory', bar: 65 } }
	},
	'DeployProduction': {
		logs: ['Production deployment successful', 'Pipeline running normally', 'SLA met: 2.1h'],
		sparkui: ['All stages healthy', 'No failed tasks', 'Optimal resource usage'],
		metrics: { memory: { value: 70, label: 'Memory', bar: 70 }, cpu: { value: 55, label: 'CPU', bar: 55 } },
		errors: { value: 0, label: 'Errors' }
	}
};

export function generateLargeTree(): TreeData {
	const nodes: RcaNode[] = [];
	const nodeMap: Record<string, RcaNode> = {};
	let nodeId = 0;

	// Root node
	nodes.push({
		id: 'root',
		x: 450,
		y: 30,
		label: 'JobFailure',
		reward: 0.0,
		parent: null,
		level: 0,
		hypothesis: {
			title: 'Critical: ETL Pipeline Failed',
			content: 'Multiple stages showing errors, 3-hour SLA breach'
		},
		signals: {},
		stage: 'selection',
		signalsRequired: signalMappings['JobFailure'] || [],
		evidencePattern: 'JobFailure'
	});
	nodeMap['root'] = nodes[0];

	// Level 1: Initial Investigation Vectors (7 nodes)
	const level1Categories = [
		{ label: 'StageFailures', reward: 0.82, signals: { sparkui: ['Multiple stages failing'], errors: { value: 8, label: 'Stage Failures' }}},
		{ label: 'MemoryAlerts', reward: 0.75, signals: { logs: ['OOM warnings'], metrics: { memory: { value: 95, label: 'Memory %', bar: 95 }}}},
		{ label: 'NetworkTimeout', reward: 0.45, signals: { network: ['Cross-DC latency: 250ms', 'Timeout errors'] }},
		{ label: 'DataQuality', reward: 0.68, signals: { logs: ['Null records spike'], sparkui: ['Data quality issues'] }},
		{ label: 'ShuffleErrors', reward: 0.71, signals: { shuffle: ['Shuffle fetch failures', 'Spill: 200GB'] }},
		{ label: 'TaskRetries', reward: 0.63, signals: { sparkui: ['Excessive retries: 234'], logs: ['Task retry limit exceeded'] }},
		{ label: 'ClusterHealth', reward: 0.38, signals: { metrics: { cpu: { value: 45, label: 'CPU', bar: 45 }}, network: ['Node failures: 2'] }}
	];

	// Level 2: Deep Dive Analysis (Variable children per parent)
	const level2Categories: Record<string, any[]> = {
		'StageFailures': [
			{ label: 'JoinStage', reward: 0.78, signals: { sparkui: ['Stage 23 consistently fails'], shuffle: ['Join shuffle: 500GB'] }},
			{ label: 'AggregateStage', reward: 0.69, signals: { sparkui: ['GroupBy timeout'], logs: ['Aggregate stage OOM'] }},
			{ label: 'WriteStage', reward: 0.44, signals: { logs: ['HDFS write errors'], sparkui: ['Write stage failures'] }},
			{ label: 'ReadStage', reward: 0.51, signals: { logs: ['Source partition missing'], sparkui: ['Read stage timeout'] }},
			{ label: 'WindowStage', reward: 0.73, signals: { logs: ['Window function OOM'], sparkui: ['Window stage memory'] }},
			{ label: 'BroadcastStage', reward: 0.65, signals: { sparkui: ['Broadcast timeout'], logs: ['Broadcast stage failure'] }}
		],
		'MemoryAlerts': [
			{ label: 'ExecutorOOM', reward: 0.88, signals: { logs: ['Executor heap exhausted'], errors: { value: 8, label: 'Executor OOMs' }}},
			{ label: 'DriverOOM', reward: 0.42, signals: { logs: ['Driver memory pressure'], metrics: { memory: { value: 85, label: 'Driver Memory', bar: 85 }}}},
			{ label: 'OffHeapMemory', reward: 0.67, signals: { logs: ['Direct memory overflow'], metrics: { memory: { value: 90, label: 'Off-heap', bar: 90 }}}},
			{ label: 'YarnContainerKilled', reward: 0.76, signals: { logs: ['Container exceeded limits'], errors: { value: 5, label: 'Container Kills' }}},
			{ label: 'PythonWorkerOOM', reward: 0.58, signals: { logs: ['PySpark memory issue'], errors: { value: 3, label: 'Python OOMs' }}}
		],
		'ShuffleErrors': [
			{ label: 'FetchFailures', reward: 0.83, signals: { shuffle: ['Shuffle fetch failed'], network: ['Fetch timeout'] }},
			{ label: 'ShuffleSpill', reward: 0.77, signals: { shuffle: ['Excessive disk spill: 500GB'], logs: ['Spill to disk'] }},
			{ label: 'MapOutputLost', reward: 0.71, signals: { shuffle: ['Map output tracker issues'], sparkui: ['Output lost'] }},
			{ label: 'BlockManagerLost', reward: 0.62, signals: { logs: ['Block manager disconnected'], network: ['Connection lost'] }}
		],
		'DataQuality': [
			{ label: 'SchemaEvolution', reward: 0.72, signals: { logs: ['New columns detected'], sparkui: ['Schema mismatch'] }},
			{ label: 'DataSkew', reward: 0.85, signals: { shuffle: ['Extreme partition skew'], sparkui: ['Skew detected'] }},
			{ label: 'CorruptRecords', reward: 0.48, signals: { logs: ['Malformed JSON'], sparkui: ['Corrupt records: 1.2%'] }}
		],
		'TaskRetries': [
			{ label: 'SpeculativeExecution', reward: 0.54, signals: { sparkui: ['Too many speculative tasks'], logs: ['Speculation enabled'] }},
			{ label: 'FlakyExecutors', reward: 0.61, signals: { logs: ['Specific nodes failing'], metrics: { cpu: { value: 95, label: 'CPU', bar: 95 }}}},
			{ label: 'TaskSerialization', reward: 0.39, signals: { logs: ['Serialization errors'], sparkui: ['Task serialization failed'] }}
		]
	};

	// Level 3: Root Cause Identification
	const level3Categories: Record<string, any[]> = {
		'JoinStage': [
			{ label: 'SkewedJoin', reward: 0.91, signals: { shuffle: ['One key has 80% of data'], sparkui: ['Task variance: 50x'] }},
			{ label: 'CartesianProduct', reward: 0.35, signals: { sparkui: ['Accidental cartesian'], logs: ['Massive join output'] }},
			{ label: 'BroadcastTimeout', reward: 0.68, signals: { sparkui: ['Large broadcast table'], logs: ['Broadcast timeout'] }},
			{ label: 'JoinKeyMismatch', reward: 0.42, signals: { logs: ['Data type mismatch'], sparkui: ['Join key issues'] }},
			{ label: 'SortMergeOOM', reward: 0.76, signals: { logs: ['Sort buffer overflow'], metrics: { memory: { value: 98, label: 'Sort Memory', bar: 98 }}}}
		],
		'ExecutorOOM': [
			{ label: 'HeapConfig', reward: 0.79, signals: { logs: ['executor.memory too low'], metrics: { memory: { value: 100, label: 'Heap', bar: 100 }}}},
			{ label: 'MemoryFraction', reward: 0.83, signals: { logs: ['spark.memory.fraction'], sparkui: ['Memory config issue'] }},
			{ label: 'CacheOverflow', reward: 0.71, signals: { sparkui: ['Too much cached'], logs: ['Cache eviction failed'] }},
			{ label: 'UDFMemoryLeak', reward: 0.86, signals: { logs: ['Custom UDF leak'], errors: { value: 6, label: 'UDF Errors' }}},
			{ label: 'CollectLarge', reward: 0.64, signals: { logs: ['collect() on large dataset'], sparkui: ['Driver memory spike'] }},
			{ label: 'AccumulatorLeak', reward: 0.52, signals: { logs: ['Accumulator memory'], sparkui: ['Accumulator size: 2GB'] }}
		],
		'DataSkew': [
			{ label: 'HotPartition', reward: 0.89, signals: { shuffle: ['Partition 127 has 10GB'], sparkui: ['Hot partition detected'] }},
			{ label: 'TimestampSkew', reward: 0.76, signals: { shuffle: ['Hour 00 has 50% data'], logs: ['Temporal skew'] }},
			{ label: 'UserIdSkew', reward: 0.82, signals: { shuffle: ['Power users skew'], sparkui: ['User distribution skewed'] }},
			{ label: 'NullKeySkew', reward: 0.71, signals: { shuffle: ['Nulls in join key'], logs: ['Null key handling'] }}
		],
		'FetchFailures': [
			{ label: 'NetworkPartition', reward: 0.45, signals: { network: ['Network split'], logs: ['Network partition detected'] }},
			{ label: 'DiskFailure', reward: 0.68, signals: { logs: ['Local disk errors'], metrics: { cpu: { value: 80, label: 'I/O Wait', bar: 80 }}}},
			{ label: 'ShuffleServiceDown', reward: 0.73, signals: { logs: ['External shuffle service'], network: ['Service unavailable'] }},
			{ label: 'ConnectionTimeout', reward: 0.81, signals: { network: ['Timeout settings'], logs: ['Connection timeout'] }}
		],
		'YarnContainerKilled': [
			{ label: 'MemoryOverhead', reward: 0.88, signals: { logs: ['overhead too small'], errors: { value: 5, label: 'Container Kills' }}},
			{ label: 'VirtualMemory', reward: 0.62, signals: { logs: ['vmem-pmem ratio'], metrics: { memory: { value: 95, label: 'Virtual Memory', bar: 95 }}}},
			{ label: 'ContainerPreemption', reward: 0.41, signals: { logs: ['Resource contention'], metrics: { cpu: { value: 90, label: 'CPU', bar: 90 }}}}
		]
	};

	// Level 4: Solution Strategies
	const level4Categories: Record<string, any[]> = {
		'SkewedJoin': [
			{ label: 'SaltingKeys', reward: 0.93, signals: { sparkui: ['Salt strategy'], logs: ['Add random salt to keys'] }},
			{ label: 'AdaptiveExecution', reward: 0.89, signals: { sparkui: ['Enable AQE'], logs: ['Adaptive query execution'] }},
			{ label: 'SkewJoinHint', reward: 0.86, signals: { sparkui: ['Use skew join hints'], logs: ['Join hint applied'] }},
			{ label: 'PreAggregate', reward: 0.78, signals: { sparkui: ['Aggregate before join'], logs: ['Pre-aggregation strategy'] }},
			{ label: 'BroadcastSmaller', reward: 0.71, signals: { sparkui: ['Broadcast if possible'], logs: ['Broadcast join optimization'] }}
		],
		'UDFMemoryLeak': [
			{ label: 'FixUDFCode', reward: 0.94, signals: { logs: ['Fix memory leak in UDF'], metrics: { memory: { value: 60, label: 'Memory', bar: 60 }}}},
			{ label: 'ReplaceWithSQL', reward: 0.87, signals: { logs: ['Use native SQL functions'], sparkui: ['SQL optimization'] }},
			{ label: 'BatchProcessing', reward: 0.76, signals: { logs: ['Process in smaller batches'], sparkui: ['Batch size optimization'] }},
			{ label: 'IncreaseMemory', reward: 0.69, signals: { logs: ['Temporary memory increase'], metrics: { memory: { value: 80, label: 'Memory', bar: 80 }}}}
		],
		'HotPartition': [
			{ label: 'Repartition', reward: 0.91, signals: { shuffle: ['repartition(1000)'], sparkui: ['Partition rebalancing'] }},
			{ label: 'CustomPartitioner', reward: 0.88, signals: { shuffle: ['Hash on composite key'], logs: ['Custom partitioner'] }},
			{ label: 'FilterSplit', reward: 0.82, signals: { logs: ['Split hot partition logic'], sparkui: ['Filter optimization'] }},
			{ label: 'SampleReduce', reward: 0.74, signals: { logs: ['Sample before processing'], sparkui: ['Sampling strategy'] }}
		],
		'MemoryOverhead': [
			{ label: 'IncreaseOverhead', reward: 0.92, signals: { logs: ['overhead to 1GB'], metrics: { memory: { value: 75, label: 'Overhead', bar: 75 }}}},
			{ label: 'TuneGC', reward: 0.84, signals: { logs: ['G1GC with tuning'], metrics: { gc: { value: 25, label: 'GC %', bar: 25 }}}},
			{ label: 'ReduceParallelism', reward: 0.71, signals: { logs: ['Fewer concurrent tasks'], sparkui: ['Parallelism reduced'] }}
		],
		'ConnectionTimeout': [
			{ label: 'IncreaseTimeout', reward: 0.83, signals: { network: ['shuffle.io.timeout'], logs: ['Timeout increased'] }},
			{ label: 'ReducePartitions', reward: 0.76, signals: { shuffle: ['Fewer shuffle partitions'], sparkui: ['Partition optimization'] }},
			{ label: 'OptimizeNetwork', reward: 0.68, signals: { network: ['Network buffer tuning'], logs: ['Network optimization'] }}
		]
	};

	// Level 5: Verification & Monitoring
	const level5Categories: Record<string, any[]> = {
		'SaltingKeys': [
			{ label: 'TestRun', reward: 0.96, signals: { logs: ['Test on sample data - SUCCESS'], sparkui: ['Performance improved 3x'] }},
			{ label: 'PerfValidation', reward: 0.91, signals: { sparkui: ['Performance improved 3x'], metrics: { cpu: { value: 45, label: 'CPU', bar: 45 }}}},
			{ label: 'MonitorSkew', reward: 0.88, signals: { shuffle: ['Skew eliminated'], sparkui: ['Balanced partitions'] }},
			{ label: 'ProductionDeploy', reward: 0.85, signals: { logs: ['Deploy with monitoring'], sparkui: ['Production ready'] }}
		],
		'FixUDFCode': [
			{ label: 'MemoryProfile', reward: 0.95, signals: { logs: ['Memory stable'], metrics: { memory: { value: 55, label: 'Memory', bar: 55 }}}},
			{ label: 'StressTest', reward: 0.92, signals: { logs: ['10x load test passed'], sparkui: ['Stress test successful'] }},
			{ label: 'Rollback', reward: 0.78, signals: { logs: ['Rollback plan ready'], sparkui: ['Rollback available'] }}
		],
		'Repartition': [
			{ label: 'PartitionBalance', reward: 0.93, signals: { shuffle: ['All partitions <100MB'], sparkui: ['Balanced distribution'] }},
			{ label: 'ShuffleReduction', reward: 0.89, signals: { shuffle: ['Shuffle reduced 60%'], sparkui: ['Shuffle optimization'] }},
			{ label: 'EndToEndTest', reward: 0.87, signals: { logs: ['Full pipeline success'], sparkui: ['E2E test passed'] }}
		],
		'IncreaseOverhead': [
			{ label: 'ContainerStable', reward: 0.94, signals: { logs: ['No more kills'], errors: { value: 0, label: 'Container Kills' }}},
			{ label: 'ResourceUtilization', reward: 0.86, signals: { metrics: { memory: { value: 80, label: 'Utilization', bar: 80 }}, logs: ['80% utilization'] }},
			{ label: 'CostAnalysis', reward: 0.72, signals: { logs: ['20% cost increase'], sparkui: ['Cost analysis complete'] }}
		],
		'IncreaseTimeout': [
			{ label: 'TimeoutStable', reward: 0.89, signals: { network: ['No timeout errors'], logs: ['Connection stable'] }},
			{ label: 'NetworkMonitor', reward: 0.84, signals: { network: ['Network monitoring'], logs: ['Network stable'] }},
			{ label: 'LatencyImproved', reward: 0.78, signals: { network: ['Latency reduced'], metrics: { cpu: { value: 40, label: 'Network Wait', bar: 40 }}}}
		]
	};

	// Level 6: Final Deployment
	const level6Categories: Record<string, any[]> = {
		'TestRun': [
			{ label: 'DeployProduction', reward: 0.98, signals: { logs: ['ROOT CAUSE FIXED!'], sparkui: ['Production success'], errors: { value: 0, label: 'Errors' }}},
			{ label: 'ContinueMonitoring', reward: 0.91, signals: { logs: ['Monitor for 24h'], sparkui: ['Monitoring active'] }}
		],
		'MemoryProfile': [
			{ label: 'DeployProduction', reward: 0.97, signals: { logs: ['Memory leak fixed!'], metrics: { memory: { value: 50, label: 'Memory', bar: 50 }}}},
			{ label: 'ExtendedTesting', reward: 0.88, signals: { logs: ['Extended testing'], sparkui: ['Long-term validation'] }}
		],
		'PartitionBalance': [
			{ label: 'DeployProduction', reward: 0.96, signals: { logs: ['Skew issue resolved!'], shuffle: ['Perfect balance'], sparkui: ['Production ready'] }},
			{ label: 'MonitorBalance', reward: 0.89, signals: { shuffle: ['Monitor partition balance'], sparkui: ['Balance monitoring'] }}
		],
		'ContainerStable': [
			{ label: 'DeployProduction', reward: 0.95, signals: { logs: ['Container issues fixed!'], errors: { value: 0, label: 'Container Kills' }}},
			{ label: 'ResourceOptimization', reward: 0.87, signals: { logs: ['Optimize resources'], metrics: { memory: { value: 75, label: 'Memory', bar: 75 }}}}
		]
	};

	// Helper function to estimate text width
	const estimateTextWidth = (text: string): number => {
		// Rough estimation: 6px per character for the font size used
		return Math.max(80, text.length * 7 + 40); // Minimum 80px, plus padding
	};

	// Helper function to detect and resolve overlaps while maintaining parent-child grouping
	const resolveOverlaps = (nodes: RcaNode[], level: number): void => {
		const levelNodes = nodes.filter(n => n.level === level);
		if (levelNodes.length <= 1) return;

		// Group nodes by their parent
		const parentGroups = new Map<string, RcaNode[]>();
		levelNodes.forEach(node => {
			const parentId = node.parent || 'root';
			if (!parentGroups.has(parentId)) {
				parentGroups.set(parentId, []);
			}
			parentGroups.get(parentId)!.push(node);
		});

		// Resolve overlaps within each parent group first
		parentGroups.forEach((siblings, parentId) => {
			if (siblings.length <= 1) return;
			
			// Sort siblings by x position
			siblings.sort((a, b) => a.x - b.x);
			
			// Resolve overlaps within the sibling group
			for (let i = 1; i < siblings.length; i++) {
				const current = siblings[i];
				const previous = siblings[i - 1];
				
				const prevWidth = estimateTextWidth(previous.label);
				const currWidth = estimateTextWidth(current.label);
				const minDistance = Math.max(prevWidth, currWidth) / 2 + 30; // Half width each + padding
				
				const actualDistance = current.x - previous.x;
				
				if (actualDistance < minDistance) {
					// Adjust positions symmetrically around parent center
					const parent = nodes.find(n => n.id === parentId);
					if (parent) {
						redistributeSiblings(siblings, parent.x);
					}
					break; // Redistribution handles all siblings at once
				}
			}
		});

		// Resolve overlaps between different parent groups
		const sortedGroups = Array.from(parentGroups.entries()).sort((a, b) => {
			const aMinX = Math.min(...a[1].map(n => n.x));
			const bMinX = Math.min(...b[1].map(n => n.x));
			return aMinX - bMinX;
		});

		for (let i = 1; i < sortedGroups.length; i++) {
			const currentGroup = sortedGroups[i][1];
			const previousGroup = sortedGroups[i - 1][1];
			
			const currentMinX = Math.min(...currentGroup.map(n => n.x));
			const previousMaxX = Math.max(...previousGroup.map(n => n.x));
			
			const prevRightmostNode = previousGroup.find(n => n.x === previousMaxX)!;
			const currLeftmostNode = currentGroup.find(n => n.x === currentMinX)!;
			
			const prevWidth = estimateTextWidth(prevRightmostNode.label);
			const currWidth = estimateTextWidth(currLeftmostNode.label);
			const minDistance = prevWidth / 2 + currWidth / 2 + 40; // Half widths + padding
			
			const actualDistance = currentMinX - previousMaxX;
			
			if (actualDistance < minDistance) {
				// Move the entire current group to the right
				const shiftAmount = minDistance - actualDistance;
				currentGroup.forEach(node => {
					node.x = Math.min(1150, node.x + shiftAmount);
				});
			}
		}
	};

	// Helper function to redistribute siblings symmetrically around parent
	const redistributeSiblings = (siblings: RcaNode[], parentX: number): void => {
		if (siblings.length <= 1) return;

		const totalWidth = siblings.reduce((sum, node) => sum + estimateTextWidth(node.label), 0);
		const spacing = Math.max(100, totalWidth / siblings.length + 20);
		
		if (siblings.length === 2) {
			// Two children: one left, one right
			const offset = spacing / 2;
			siblings[0].x = Math.max(50, parentX - offset);
			siblings[1].x = Math.min(1150, parentX + offset);
		} else {
			// Multiple children: distribute symmetrically
			const totalSpread = (siblings.length - 1) * spacing;
			const startX = parentX - totalSpread / 2;
			
			siblings.forEach((node, idx) => {
				node.x = Math.max(50, Math.min(1150, startX + idx * spacing));
			});
		}
	};

	// Helper function for simple overlap resolution (less complex, but still effective)
	const simpleOverlapResolution = (nodes: RcaNode[], level: number): void => {
		const levelNodes = nodes.filter(n => n.level === level);
		if (levelNodes.length <= 1) return;

		// Group nodes by their parent
		const parentGroups = new Map<string, RcaNode[]>();
		levelNodes.forEach(node => {
			const parentId = node.parent || 'root';
			if (!parentGroups.has(parentId)) {
				parentGroups.set(parentId, []);
			}
			parentGroups.get(parentId)!.push(node);
		});

		// Resolve overlaps within each parent group first
		parentGroups.forEach((siblings, parentId) => {
			if (siblings.length <= 1) return;
			
			// Sort siblings by x position
			siblings.sort((a, b) => a.x - b.x);
			
			// Resolve overlaps within the sibling group
			for (let i = 1; i < siblings.length; i++) {
				const current = siblings[i];
				const previous = siblings[i - 1];
				
				const prevWidth = estimateTextWidth(previous.label);
				const currWidth = estimateTextWidth(current.label);
				const minDistance = Math.max(prevWidth, currWidth) / 2 + 30; // Half width each + padding
				
				const actualDistance = current.x - previous.x;
				
				if (actualDistance < minDistance) {
					// Adjust positions symmetrically around parent center
					const parent = nodes.find(n => n.id === parentId);
					if (parent) {
						redistributeSiblings(siblings, parent.x);
					}
					break; // Redistribution handles all siblings at once
				}
			}
		});

		// Resolve overlaps between different parent groups
		const sortedGroups = Array.from(parentGroups.entries()).sort((a, b) => {
			const aMinX = Math.min(...a[1].map(n => n.x));
			const bMinX = Math.min(...b[1].map(n => n.x));
			return aMinX - bMinX;
		});

		for (let i = 1; i < sortedGroups.length; i++) {
			const currentGroup = sortedGroups[i][1];
			const previousGroup = sortedGroups[i - 1][1];
			
			const currentMinX = Math.min(...currentGroup.map(n => n.x));
			const previousMaxX = Math.max(...previousGroup.map(n => n.x));
			
			const prevRightmostNode = previousGroup.find(n => n.x === previousMaxX)!;
			const currLeftmostNode = currentGroup.find(n => n.x === currentMinX)!;
			
			const prevWidth = estimateTextWidth(prevRightmostNode.label);
			const currWidth = estimateTextWidth(currLeftmostNode.label);
			const minDistance = prevWidth / 2 + currWidth / 2 + 40; // Half widths + padding
			
			const actualDistance = currentMinX - previousMaxX;
			
			if (actualDistance < minDistance) {
				// Move the entire current group to the right
				const shiftAmount = minDistance - actualDistance;
				currentGroup.forEach(node => {
					node.x = Math.min(1150, node.x + shiftAmount);
				});
			}
		}
	};

	// Helper function to resolve overlaps between different parent groups
	const resolveInterGroupOverlaps = (nodes: RcaNode[], level: number): void => {
		const levelNodes = nodes.filter(n => n.level === level);
		if (levelNodes.length <= 1) return;

		// Group nodes by their parent
		const parentGroups = new Map<string, RcaNode[]>();
		levelNodes.forEach(node => {
			const parentId = node.parent || 'root';
			if (!parentGroups.has(parentId)) {
				parentGroups.set(parentId, []);
			}
			parentGroups.get(parentId)!.push(node);
		});

		// Sort groups by their minimum x-coordinate
		const sortedGroups = Array.from(parentGroups.entries()).sort((a, b) => {
			const aMinX = Math.min(...a[1].map(n => n.x));
			const bMinX = Math.min(...b[1].map(n => n.x));
			return aMinX - bMinX;
		});

		for (let i = 1; i < sortedGroups.length; i++) {
			const currentGroup = sortedGroups[i][1];
			const previousGroup = sortedGroups[i - 1][1];
			
			const currentMinX = Math.min(...currentGroup.map(n => n.x));
			const previousMaxX = Math.max(...previousGroup.map(n => n.x));
			
			const prevRightmostNode = previousGroup.find(n => n.x === previousMaxX)!;
			const currLeftmostNode = currentGroup.find(n => n.x === currentMinX)!;
			
			const prevWidth = estimateTextWidth(prevRightmostNode.label);
			const currWidth = estimateTextWidth(currLeftmostNode.label);
			const minDistance = prevWidth / 2 + currWidth / 2 + 40; // Half widths + padding
			
			const actualDistance = currentMinX - previousMaxX;
			
			if (actualDistance < minDistance) {
				// Move the entire current group to the right
				const shiftAmount = minDistance - actualDistance;
				currentGroup.forEach(node => {
					node.x = Math.min(1150, node.x + shiftAmount);
				});
			}
		}
	};

	// Build the tree level by level
	const allLevelCategories = [level1Categories, level2Categories, level3Categories, level4Categories, level5Categories, level6Categories];
	let currentLevelNodes: RcaNode[] = [nodes[0]];

	for (let level = 0; level < allLevelCategories.length; level++) {
		const nextLevelNodes: RcaNode[] = [];
		
		// First pass: collect all children for this level
		const parentChildrenMap = new Map<string, any[]>();
		currentLevelNodes.forEach((parentNode) => {
			let categories: any[];
			
			if (level === 0) {
				categories = level1Categories;
			} else {
				const levelCats = allLevelCategories[level] as Record<string, any[]>;
				categories = levelCats[parentNode.label] || [];
			}
			
			if (categories.length > 0) {
				parentChildrenMap.set(parentNode.id, categories);
			}
		});



		// Second pass: position children with proper left-right distribution
		currentLevelNodes.forEach((parentNode, parentIdx) => {
			const categories = parentChildrenMap.get(parentNode.id);
			if (!categories || categories.length === 0) return;

			const childCount = categories.length;
			
			// Position children symmetrically around parent - SIMPLE APPROACH
			categories.forEach((category: any, childIdx: number) => {
				let xPosition: number;
				
				if (childCount === 1) {
					xPosition = parentNode.x;
				} else if (childCount === 2) {
					xPosition = parentNode.x + (childIdx === 0 ? -120 : 120);
				} else if (childCount === 3) {
					xPosition = parentNode.x + (childIdx === 0 ? -150 : childIdx === 1 ? 0 : 150);
				} else if (childCount === 4) {
					xPosition = parentNode.x + (childIdx === 0 ? -180 : childIdx === 1 ? -60 : childIdx === 2 ? 60 : 180);
				} else if (childCount === 5) {
					xPosition = parentNode.x + (childIdx === 0 ? -200 : childIdx === 1 ? -100 : childIdx === 2 ? 0 : childIdx === 3 ? 100 : 200);
				} else { // 6+ children
					const spacing = 100;
					const totalWidth = (childCount - 1) * spacing;
					const startX = parentNode.x - totalWidth / 2;
					xPosition = startX + childIdx * spacing;
				}
				
				// Clamp to SVG bounds
				xPosition = Math.max(50, Math.min(1150, xPosition));
				
				const randomReward = Math.max(0, Math.min(1, category.reward + (Math.random() - 0.5) * 0.08));

				const node: RcaNode = {
					id: `n${++nodeId}`,
					x: xPosition,
					y: 30 + (level + 1) * 130,
					label: category.label,
					reward: randomReward,
					parent: parentNode.id,
					level: level + 1,
					hypothesis: {
						title: `${category.label} Analysis`,
						content: `Investigating ${String(category.label).toLowerCase()} related issues`
					},
					signals: category.signals || {},
					stage: level < 2 ? 'expansion' : level < 4 ? 'simulation' : 'backpropagation',
					signalsRequired: signalMappings[category.label] || ['logs'],
					evidencePattern: category.label
				};

				nodes.push(node);
				nodeMap[node.id] = node;
				nextLevelNodes.push(node);
			});
		});

		// Third pass: resolve any overlaps for this level (SIMPLE VERSION)
		if (nextLevelNodes.length > 0) {
			// Only resolve overlaps between different parent groups, not within groups
			resolveInterGroupOverlaps(nodes, level + 1);
	
		}

		currentLevelNodes = nextLevelNodes;
	}

	const edges = nodes
		.filter(n => n.parent)
		.map(n => ({
			source: nodeMap[n.parent as string],
			target: n,
			id: `edge-${n.parent}-${n.id}`
		}));

	return { nodes, edges, nodeMap };
}

export { evidencePatterns }; 