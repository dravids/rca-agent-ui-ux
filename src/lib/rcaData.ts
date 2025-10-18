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
	
	// Level 4: Root cause confirmation
	'PartitionAnalysis': ['shuffle', 'sparkui', 'logs'],
	'KeyDistribution': ['sparkui', 'logs', 'shuffle'],
	'TaskTimeline': ['sparkui', 'logs'],
	'MemoryFootprint': ['logs', 'metrics'],
	'ShuffleMetrics': ['shuffle', 'sparkui'],
	'PowerUserProfile': ['shuffle', 'sparkui', 'logs'],
	'DataVolume': ['shuffle', 'logs'],
	'PartitionMapping': ['logs', 'sparkui'],
	'ComparativeAnalysis': ['shuffle', 'sparkui'],
	'PythonWorkerTrace': ['logs', 'metrics'],
	'UDFCodeReview': ['logs', 'sparkui'],
	'WorkerHeapDump': ['logs', 'metrics'],
	'ObjectRetention': ['logs', 'metrics'],
	'OffHeapAnalysis': ['logs', 'metrics'],
	'GCBehavior': ['logs', 'metrics'],
	'NativeMemory': ['logs', 'metrics'],
	'NetworkLatency': ['network', 'logs'],
	'BlockTransfer': ['shuffle', 'sparkui'],
	'SocketConfig': ['network', 'logs'],
	
	// Level 5: Symptom correlation
	'SkewToOOM': ['logs', 'metrics', 'sparkui'],
	'SkewToStraggler': ['sparkui', 'logs'],
	'SkewToRetries': ['logs', 'errors'],
	'CascadeEffect': ['sparkui', 'logs'],
	'LeakToOOM': ['logs', 'metrics'],
	'WorkerCrash': ['logs', 'errors'],
	'BatchGrowth': ['logs', 'metrics'],
	'UserBehavior': ['shuffle', 'sparkui'],
	'VolumeCorrelation': ['shuffle', 'logs'],
	'HashCollision': ['logs', 'sparkui'],
	'MemoryBreakdown': ['logs', 'metrics'],
	'YARNKillPattern': ['logs', 'errors'],
	'OverheadInsufficient': ['logs', 'metrics'],
	'LatencySpikes': ['network', 'logs'],
	'BlockFetchDelay': ['shuffle', 'sparkui'],
	'RetryAmplification': ['logs', 'errors'],
	
	// Level 6: RCA conclusion
	'RCAComplete': ['logs', 'sparkui', 'metrics', 'errors', 'shuffle'],
	'FailureChain': ['logs', 'sparkui', 'metrics']
};

// Evidence patterns for realistic signal updates
const evidencePatterns: Record<string, Record<string, any>> = {
	'JobFailure': {
		logs: ['23:45:12 ERROR Job aborted: Stage 3 failed after 4 attempts', '23:45:15 ERROR Total task failures: 156/200 tasks', '23:45:18 WARN SLA breach: ETL job exceeded 3h limit (actual: 4h 12m)'],
		metrics: { memory: { value: 95, label: 'Memory', bar: 95 }, cpu: { value: 78, label: 'CPU', bar: 78 } },
		sparkui: ['Application: user_analytics_daily_agg', 'Failed stages: Stage 3 (join), Stage 4 (write)', 'Duration: 4h 12m 34s', 'Failed tasks: 156', 'Data processed: 2.3TB input'],
		errors: { value: 15, label: 'Critical Errors' }
	},
	'StageFailures': {
		sparkui: ['Stage 3: SortMergeJoin (users×events) - 4 failures', 'Stage 4: ShuffleMapStage - timeout', 'Stage 5: ResultStage - incomplete'],
		logs: ['23:42:08 ERROR Stage 3 (attempt 1) failed: Task 127 lost', '23:42:45 ERROR Stage 3 (attempt 2) failed: Container killed by YARN', '23:43:22 ERROR Stage 3 (attempt 3) failed: ExecutorLostFailure', '23:44:01 ERROR Stage 3 (attempt 4) failed: FetchFailure'],
		errors: { value: 8, label: 'Stage Failures' }
	},
	'MemoryAlerts': {
		logs: ['23:41:30 WARN Executor 12: GC overhead limit exceeded (98% time in GC)', '23:42:15 ERROR Executor 15: java.lang.OutOfMemoryError: Java heap space', '23:42:45 ERROR Container container_1234_0015 killed by YARN (memory exceeded)', '23:43:10 WARN Driver: Broadcast timeout, executor unresponsive'],
		metrics: { memory: { value: 98, label: 'Memory', bar: 98 }, gc: { value: 45, label: 'GC %', bar: 45 } },
		errors: { value: 12, label: 'OOM Events' }
	},
	'JoinStage': {
		sparkui: ['Stage 3: SortMergeJoin at analytics.scala:245', 'Join type: Inner join on user_id', 'Left table: users (12M rows, 2.4GB)', 'Right table: events (850M rows, 180GB)', 'Shuffle read: 182.4GB', 'Shuffle write: 165.8GB'],
		logs: ['23:40:05 INFO Exchange hashpartitioning(user_id#42, 200)', '23:40:08 INFO SortMergeJoin selected over BroadcastHashJoin', '23:41:45 WARN Tasks taking >10min: 15 tasks on partition range 120-135'],
		shuffle: ['Total shuffle: 182.4GB read, 165.8GB write', 'Spill (memory): 87.3GB', 'Spill (disk): 45.2GB']
	},
	'ExecutorOOM': {
		logs: ['23:42:15 ERROR ExecutorRunner: java.lang.OutOfMemoryError: Java heap space', '23:42:15 ERROR at scala.collection.mutable.ArrayBuffer.ensureSize', '23:42:15 ERROR at org.apache.spark.sql.execution.joins.SortMergeJoin', '23:42:16 INFO Lost executor 15: Container killed by YARN', '23:42:16 WARN TaskSetManager: Lost task 127.0 in stage 3.0 (ExecutorLost)'],
		metrics: { memory: { value: 100, label: 'Memory', bar: 100 } },
		errors: { value: 8, label: 'Executor OOMs' }
	},
	'SkewedJoin': {
		shuffle: ['Partition 127: 8.4GB (user_id: "premium_user_999")', 'Partition 128: 7.9GB (user_id: "bot_crawler_001")', 'Partitions 0-120: avg 42MB', 'Partitions 129-199: avg 38MB', 'Max/avg ratio: 204:1 - EXTREME SKEW'],
		sparkui: ['Task 127.0: 3h 45m (stragggler)', 'Task 128.0: 3h 12m (straggler)', 'Other tasks: avg 6.5 minutes', 'Median task time: 5m 23s', 'Max task time: 3h 45m (42x median)'],
		logs: ['23:41:00 WARN Partition skew detected on user_id key', '23:41:30 INFO Key "premium_user_999" accounts for 8.2M rows (82% of partition)', '23:42:00 WARN Task 127 processing single key with 8.4GB data']
	},
	'UDFMemoryLeak': {
		logs: ['23:40:30 WARN PythonRunner: Python worker memory increasing (2GB→4GB→6GB)', '23:41:15 ERROR Python worker process crashed with OOM', '23:41:45 WARN UDF "parse_json_array" causing memory accumulation', '23:42:00 INFO Restarting Python worker (attempt 3/3)'],
		metrics: { memory: { value: 99, label: 'Memory', bar: 99 } },
		errors: { value: 6, label: 'UDF Errors' }
	},
	'SaltingKeys': {
		sparkui: ['Applied salt factor: 10x to skewed keys', 'Partition distribution: 127→1270 partitions', 'Max partition: 8.4GB→840MB (10x reduction)', 'Task duration variance: 42x→3.2x'],
		logs: ['00:15:30 INFO Applying salting to keys: [premium_user_999, bot_crawler_001]', '00:15:45 INFO Exploded skewed partitions using random salt (0-9)', '00:16:00 INFO Join performance improved: 3h 45m→35m (6.4x faster)']
	},
	'TestRun': {
		logs: ['00:20:00 INFO Starting test run on 10% sample data (180GB→18GB)', '00:45:30 INFO All stages completed successfully', '00:45:35 INFO Memory usage stable: peak 72%, no OOM', '00:45:40 INFO Task duration variance: 3.1x (within acceptable range)'],
		sparkui: ['Test job: user_analytics_daily_agg_test_20240118', 'Duration: 25m 40s', 'Stages: 5/5 succeeded', 'Tasks: 200/200 completed', 'Data processed: 18GB', 'Shuffle: 16.2GB'],
		metrics: { memory: { value: 65, label: 'Memory', bar: 65 } }
	},
	'RCAComplete': {
		logs: ['═══ ROOT CAUSE ANALYSIS COMPLETE ═══', 'Problem: Extreme data skew (204:1) on user_id join key', 'Impact: 156/200 task failures, 3h 45m stragglers, executor OOM', 'Root Cause: Power users premium_user_999 (8.4GB) & bot_crawler_001 (7.9GB)', 'Mechanism: Hash partitioning on skewed key creates hot partitions', 'Executor unable to hold 8.4GB in 6GB heap → OOM', 'Task 127 processes 200x more data than Task 0-120 → straggler', '═══ RCA INVESTIGATION CONCLUDED ═══'],
		sparkui: ['Data distribution analysis:', 'Partition 127: 8.4GB (204x average)', 'Partition 128: 7.9GB (192x average)', 'Partitions 0-120: 42MB average', 'Partitions 129-199: 38MB average', 'Skew ratio: 204:1 (critical)', 'Task 127 duration: 3h 45m (42x median)'],
		metrics: { memory: { value: 95, label: 'Memory', bar: 95 }, cpu: { value: 78, label: 'CPU', bar: 78 } },
		errors: { value: 15, label: 'Critical Errors' },
		shuffle: ['Partition size analysis complete', 'Hot partition identified: 127', 'Skew confirmed as root cause']
	}
};

// Generate realistic hypotheses for each node based on context
function getHypothesisForNode(label: string, parentLabel: string): { title: string; content: string } {
	const hypotheses: Record<string, { title: string; content: string }> = {
		'StageFailures': { title: 'Stage-Level Failure Analysis', content: 'Stage 3 (SortMergeJoin on user_id) failed 4 times. Examining stage execution logs, shuffle metrics, and task failures to identify if this is a data issue, resource issue, or configuration problem.' },
		'MemoryAlerts': { title: 'Memory Pressure Investigation', content: 'Multiple OOM errors detected across executors. Analyzing heap usage patterns, GC behavior, and container memory limits. Checking if memory spikes correlate with specific data partitions.' },
		'NetworkTimeout': { title: 'Network Connectivity Analysis', content: 'Investigating network-related timeouts during shuffle operations. Checking for cross-rack communication issues, network congestion, or slow disk I/O on shuffle service nodes.' },
		'DataQuality': { title: 'Data Quality Assessment', content: 'Analyzing input data for schema changes, corrupt records, or unexpected null values that could cause processing failures. Checking data volumes and distribution patterns.' },
		'ShuffleErrors': { title: 'Shuffle Operation Failures', content: 'Examining shuffle read/write failures. Investigating fetch failures, block manager issues, and disk spill problems during the sort-merge join operation.' },
		'TaskRetries': { title: 'Task Retry Pattern Analysis', content: 'Analyzing why 156/200 tasks failed and required retries. Checking if failures are concentrated on specific executors or data partitions, indicating a systematic issue.' },
		'ClusterHealth': { title: 'Cluster Resource Health Check', content: 'Assessing overall cluster health: CPU utilization, disk space, network bandwidth, and YARN container availability. Checking for resource contention or node failures.' },
		
		'JoinStage': { title: 'Join Operation Deep Dive', content: 'Stage 3 performs SortMergeJoin on user_id between users table (12M rows, 2.4GB) and events table (850M rows, 180GB). Analyzing join strategy, shuffle patterns, and partition behavior during this critical operation.' },
		'AggregateStage': { title: 'Aggregation Stage Analysis', content: 'Post-join aggregation showing signs of strain. Investigating groupBy operations, potential key cardinality issues, and combiner effectiveness in reducing shuffle data.' },
		'WriteStage': { title: 'Output Write Analysis', content: 'Final stage writing results to HDFS/S3. Checking for write bottlenecks, committer performance, and output partition strategies that might be causing delays.' },
		'ReadStage': { title: 'Data Source Read Analysis', content: 'Initial data ingestion stage performance. Analyzing partition pruning effectiveness, file format efficiency (Parquet/ORC), and potential data locality issues.' },
		'WindowStage': { title: 'Window Function Investigation', content: 'Window operations showing memory pressure. Analyzing partition key distribution for window functions and checking if unbounded windows are causing memory accumulation.' },
		'BroadcastStage': { title: 'Broadcast Join Analysis', content: 'Examining broadcast timeout issues. Checking if broadcast table size exceeds threshold, causing fallback to sort-merge join, or if driver-executor communication is slow.' },
		
		'ExecutorOOM': { title: 'Executor Out-of-Memory Root Cause', content: 'Java heap space exhausted in executor 15 during SortMergeJoin. Stack trace points to ArrayBuffer expansion during join buffer accumulation. Likely processing oversized partition.' },
		'DriverOOM': { title: 'Driver Memory Pressure', content: 'Driver showing memory pressure during result collection or broadcast variable creation. Analyzing collect() operations and broadcast table sizes.' },
		'OffHeapMemory': { title: 'Off-Heap Memory Analysis', content: 'Direct memory buffer overflow detected. Investigating netty buffers for shuffle operations and memory-mapped file usage exceeding configured limits.' },
		'YarnContainerKilled': { title: 'YARN Container Kill Investigation', content: 'Container killed by YARN ResourceManager due to exceeding memory limits. Analyzing physical vs virtual memory usage and container overhead settings.' },
		'PythonWorkerOOM': { title: 'Python UDF Memory Issue', content: 'PySpark worker processes crashing with OOM. Investigating Python-side memory accumulation in UDFs, potentially due to non-serializable objects or memory leaks.' },
		
		'FetchFailures': { title: 'Shuffle Fetch Failure Analysis', content: 'Tasks failing to fetch shuffle blocks from remote executors. Investigating shuffle service availability, network timeouts, and block manager health.' },
		'ShuffleSpill': { title: 'Excessive Shuffle Spill Investigation', content: '87.3GB memory spill and 45.2GB disk spill detected. Analyzing why shuffle data exceeds executor memory, causing performance degradation from disk I/O.' },
		'MapOutputLost': { title: 'Map Output Tracking Issues', content: 'Map output location information lost, causing stage recomputation. Investigating executor failures, block manager crashes, or metadata service issues.' },
		'BlockManagerLost': { title: 'Block Manager Failure Analysis', content: 'Block Manager disconnected from driver during shuffle. Investigating heartbeat timeouts, network partitions, or executor process crashes.' },
		
		'SchemaEvolution': { title: 'Schema Change Detection', content: 'Potential schema evolution in source data causing processing failures. Checking for new columns, type changes, or missing required fields.' },
		'DataSkew': { title: 'Data Skew Root Cause', content: 'Extreme partition skew detected: partition 127 has 8.4GB while average is 42MB (204:1 ratio). Key "premium_user_999" accounts for 82% of data in this partition. This is causing task straggling and memory pressure.' },
		'CorruptRecords': { title: 'Corrupt Record Analysis', content: 'Malformed or corrupt records in input data. Analyzing record parsing errors and checking badRecordsPath for problematic data patterns.' },
		
		'SkewedJoin': { title: 'CONFIRMED: Join Data Skew', content: 'Root cause identified: Extreme data skew on join key "user_id". Two problematic keys: "premium_user_999" (8.4GB, 8.2M rows) and "bot_crawler_001" (7.9GB). These power users/bots generate 204x more events than average users, causing partition 127 to take 3h 45m while others complete in 6 minutes. This explains executor OOM and task failures.' },
		'CartesianProduct': { title: 'Accidental Cartesian Join Check', content: 'Investigating if join condition is missing or incorrect, causing unintentional cartesian product that would explode data volume.' },
		'BroadcastTimeout': { title: 'Broadcast Hash Join Timeout', content: 'Broadcast join timing out due to large dimension table. Analyzing if table exceeds spark.sql.autoBroadcastJoinThreshold or network is slow.' },
		'JoinKeyMismatch': { title: 'Join Key Type Mismatch', content: 'Checking for implicit type casting in join condition that could cause performance degradation or incorrect results.' },
		'SortMergeOOM': { title: 'Sort-Merge Buffer Overflow', content: 'Sort buffers during merge join exceeding available memory. Analyzing if sort.spill.enabled is working correctly and buffer sizing.' },
		
		'HeapConfig': { title: 'Executor Heap Configuration', content: 'Executor memory configuration may be insufficient. Current: spark.executor.memory. Analyzing if heap size is adequate for partition sizes being processed.' },
		'MemoryFraction': { title: 'Memory Fraction Tuning', content: 'Investigating spark.memory.fraction and spark.memory.storageFraction settings. Imbalance between execution and storage memory could be starving join operations.' },
		'CacheOverflow': { title: 'Cache Eviction Issues', content: 'Too much data cached causing memory pressure. Analyzing persist() calls and cache eviction policies affecting available execution memory.' },
		'UDFMemoryLeak': { title: 'UDF Memory Leak Detected', content: 'Python UDF "parse_json_array" causing memory accumulation. Python worker memory grew from 2GB→6GB before crash. Likely holding references or not releasing resources.' },
		'CollectLarge': { title: 'Large Dataset Collection', content: 'collect() or similar action trying to bring large result set to driver. Analyzing if unnecessary data collection is causing driver memory spike.' },
		'AccumulatorLeak': { title: 'Accumulator Memory Leak', content: 'Accumulators growing unexpectedly large (2GB). Checking if accumulator usage is excessive or holding large objects.' },
		
		'HotPartition': { title: 'Hot Partition Identified', content: 'Partition 127 is a hot partition containing single user "premium_user_999" with 8.4GB of event data. This power user generates 204x more data than average, creating extreme processing skew.' },
		'TimestampSkew': { title: 'Temporal Data Skew', content: 'Time-based partitioning showing skew. Certain hours (e.g., midnight rollover) have significantly more data, causing uneven partition sizes.' },
		'UserIdSkew': { title: 'User ID Distribution Skew', content: 'User ID key distribution is heavily skewed. A few power users or bot accounts generate disproportionate data volumes compared to typical users.' },
		'NullKeySkew': { title: 'Null Key Skew Issue', content: 'Large number of null values in join key being hashed to same partition, creating artificial skew. Analyzing null handling strategy.' },
		
		'NetworkPartition': { title: 'Network Partition Event', content: 'Network split detected between rack groups. Investigating if network partition is causing shuffle block unavailability and task failures.' },
		'DiskFailure': { title: 'Local Disk Failure', content: 'Disk I/O errors on executor nodes. Checking if failed disks are preventing shuffle spill or block storage, causing task failures.' },
		'ShuffleServiceDown': { title: 'External Shuffle Service Failure', content: 'External shuffle service unavailable or crashed. Analyzing if dynamic allocation is working correctly without shuffle service.' },
		'ConnectionTimeout': { title: 'Shuffle Connection Timeout', content: 'Shuffle fetch connections timing out. Current timeout: spark.shuffle.io.connectionTimeout. May need adjustment for large shuffle blocks.' },
		
		'MemoryOverhead': { title: 'Insufficient Memory Overhead', content: 'Container overhead too small for actual off-heap requirements. spark.executor.memoryOverhead needs increase to accommodate netty buffers and native memory.' },
		'VirtualMemory': { title: 'Virtual Memory Limit Exceeded', content: 'YARN killing containers due to virtual memory exceeding limits. Analyzing if vmem-pmem ratio is too strict for this workload.' },
		'ContainerPreemption': { title: 'Resource Preemption', content: 'Containers being preempted by YARN scheduler due to resource contention. Investigating cluster-wide resource allocation and queue priorities.' },
		
		'SaltingKeys': { title: 'SOLUTION: Salting Join Keys', content: 'Applying salting technique to skewed keys "premium_user_999" and "bot_crawler_001". Adding random salt (0-9) explodes these keys across 10 partitions each, reducing max partition from 8.4GB to 840MB. Expected to eliminate stragglers and OOM errors.' },
		'AdaptiveExecution': { title: 'SOLUTION: Enable Adaptive Query Execution', content: 'Enabling Adaptive Query Execution (AQE) with spark.sql.adaptive.enabled=true. AQE will dynamically coalesce shuffle partitions and optimize skewed joins at runtime.' },
		'SkewJoinHint': { title: 'SOLUTION: Skew Join Optimization Hint', content: 'Using Spark 3.x skew join hints to handle known skewed keys. Spark will split skewed partitions automatically during join execution.' },
		'PreAggregate': { title: 'SOLUTION: Pre-Aggregation Strategy', content: 'Adding pre-aggregation step before join to reduce data volume from events table. Aggregating by (user_id, date) before joining with user dimension.' },
		'BroadcastSmaller': { title: 'SOLUTION: Broadcast Join Optimization', content: 'Attempting to broadcast smaller users table (2.4GB) if within threshold, avoiding expensive shuffle. Requires driver memory increase.' },
		
		'FixUDFCode': { title: 'SOLUTION: Fix UDF Memory Leak', content: 'Identified memory leak in "parse_json_array" UDF. Refactored to release Python objects after processing and avoid holding global references. Memory usage now stable.' },
		'ReplaceWithSQL': { title: 'SOLUTION: Replace UDF with Native SQL', content: 'Replacing Python UDF with native Spark SQL function. Built-in get_json_object() avoids Python worker overhead and memory issues.' },
		'BatchProcessing': { title: 'SOLUTION: Batch Size Reduction', content: 'Reducing batch size for Python worker processing to prevent memory accumulation. Setting spark.python.worker.memory to lower threshold.' },
		'IncreaseMemory': { title: 'SOLUTION: Increase Executor Memory', content: 'Temporary mitigation: increasing spark.executor.memory to handle larger partitions until proper repartitioning is implemented.' },
		
		'Repartition': { title: 'SOLUTION: Repartition by Composite Key', content: 'Repartitioning by composite key (user_id, date) instead of just user_id. This distributes power user data across more partitions while maintaining data locality for join.' },
		'CustomPartitioner': { title: 'SOLUTION: Custom Partitioner', content: 'Implementing custom partitioner that detects and splits known power users. Custom hash function ensures problematic keys are evenly distributed.' },
		'FilterSplit': { title: 'SOLUTION: Filter and Process Separately', content: 'Separating power users into different code path with special handling. Processing normal users with efficient join, power users with broadcast or different strategy.' },
		'SampleReduce': { title: 'SOLUTION: Sample-based Processing', content: 'For power users, sampling event data before aggregation. Business accepts 5% sample for users with >1M events to maintain SLA.' },
		
		'IncreaseOverhead': { title: 'SOLUTION: Increase Container Overhead', content: 'Increasing spark.executor.memoryOverhead from 384MB to 1GB to accommodate off-heap memory needs for shuffle operations and native libraries.' },
		'TuneGC': { title: 'SOLUTION: GC Tuning', content: 'Switching to G1GC with optimized settings: -XX:+UseG1GC -XX:MaxGCPauseMillis=200. Reduces GC overhead from 45% to 15%, freeing memory for processing.' },
		'ReduceParallelism': { title: 'SOLUTION: Reduce Parallelism', content: 'Reducing spark.executor.cores to decrease concurrent tasks per executor, giving each task more memory. Trading parallelism for memory headroom.' },
		
		'TestRun': { title: 'VALIDATION: Test Run with Salting', content: 'Running test on 10% sample (18GB) with salting applied. All stages completed in 25m 40s with stable memory (peak 72%). Task variance reduced to 3.1x. Ready for production deployment.' },
		'PerfValidation': { title: 'VALIDATION: Performance Benchmarking', content: 'Comparing before/after performance. Original: 4h+ with failures. With salting: 2h 5m with zero failures. 2x speedup and stability achieved.' },
		'MonitorSkew': { title: 'VALIDATION: Skew Monitoring', content: 'Verifying partition balance post-fix. Max partition reduced from 8.4GB to 840MB. Task duration variance acceptable at 3.2x (down from 42x).' },
		'ProductionDeploy': { title: 'VALIDATION: Production Readiness', content: 'All validation tests passed. Preparing for production deployment with monitoring and rollback plan in place.' },
		
		'MemoryProfile': { title: 'VALIDATION: Memory Profiling', content: 'Memory profiling shows stable heap usage at 55% peak after UDF fix. No memory leaks detected over 2-hour test run. GC overhead reduced to normal levels.' },
		'StressTest': { title: 'VALIDATION: Stress Testing', content: 'Ran with 10x data volume (23TB) to validate scalability. Job completed in 18h with same memory characteristics. Solution scales linearly.' },
		'Rollback': { title: 'VALIDATION: Rollback Plan Ready', content: 'Documented rollback procedure. Can revert to previous version within 15 minutes if issues arise. Original code maintained in separate branch.' },
		
		'PartitionBalance': { title: 'VALIDATION: Partition Balance Verified', content: 'All partitions now within acceptable size range: min 28MB, max 120MB, avg 42MB. Task duration variance: 3.1x (excellent). Join performance optimal.' },
		'ShuffleReduction': { title: 'VALIDATION: Shuffle Optimization', content: 'Shuffle metrics improved: read 182GB→109GB (40% reduction through pre-aggregation), write 165GB→98GB. Spill reduced from 87GB to 12GB.' },
		'EndToEndTest': { title: 'VALIDATION: End-to-End Testing', content: 'Full pipeline test with production-scale data completed successfully. All downstream systems validated. Data quality checks passed.' },
		
		'ContainerStable': { title: 'VALIDATION: Container Stability', content: 'Zero container kills after overhead increase. All executors maintained healthy memory usage between 60-75%. YARN resource manager shows no issues.' },
		'ResourceUtilization': { title: 'VALIDATION: Resource Efficiency', content: 'Cluster resource utilization optimized at 78% average. Good balance between throughput and stability. No resource wastage detected.' },
		'CostAnalysis': { title: 'VALIDATION: Cost Impact Assessment', content: 'Memory overhead increase adds 8% to compute costs. However, 50% reduction in runtime and elimination of reruns results in net 35% cost savings.' },
		
		'TimeoutStable': { title: 'VALIDATION: Network Timeout Resolution', content: 'After increasing shuffle.io.timeout to 180s, zero timeout errors observed. All shuffle fetches completing successfully under new limit.' },
		'NetworkMonitor': { title: 'VALIDATION: Network Monitoring', content: 'Network metrics stable throughout test runs. Shuffle fetch times within expected range. No packet loss or connection failures detected.' },
		'LatencyImproved': { title: 'VALIDATION: Latency Optimization', content: 'P99 shuffle fetch latency reduced from 145s to 42s through timeout tuning and network optimization. Stage completion more predictable.' },
		
		// Level 4: Root Cause Confirmation
		'PartitionAnalysis': { title: 'Deep Dive: Partition Size Distribution', content: 'Analyzing partition 127 in detail. This partition contains 8.4GB of data while the average partition size is only 42MB. Examining why hash partitioning created this extreme imbalance and how it relates to the join key distribution.' },
		'KeyDistribution': { title: 'Join Key Cardinality Analysis', content: 'Examining user_id key distribution across the 850M event records. Analyzing frequency distribution to identify if specific keys are causing the imbalance. Looking for power users or outliers in the data.' },
		'TaskTimeline': { title: 'Task Execution Timeline Analysis', content: 'Analyzing task execution timeline shows Task 127 started at same time as others but took 3h 45m while most completed in ~6 minutes. This 42x variance indicates processing bottleneck, not scheduling or resource issues.' },
		'MemoryFootprint': { title: 'Per-Partition Memory Consumption', content: 'Analyzing memory footprint during sort-merge join. Partition 127 requires loading 8.4GB into executor memory (configured at 6GB heap). This explains why Task 127 consistently fails with OOM.' },
		'ShuffleMetrics': { title: 'Shuffle Stage Metrics Analysis', content: 'Examining shuffle read/write patterns for Stage 3. Total shuffle: 182GB read, 165GB write. However, distribution is highly uneven with partition 127 accounting for 4.6% of shuffle data in a single task.' },
		'PowerUserProfile': { title: 'Power User Identification', content: 'Identified user_id "premium_user_999" with 8.2M events (8.4GB). This is 200x more than average user (41K events/42MB). Premium subscription tier with unlimited usage explains high event volume.' },
		'DataVolume': { title: 'Single-User Data Volume Analysis', content: 'User premium_user_999 generated 8.4GB of events in single day. Analysis shows continuous high-frequency activity pattern: 95 events/second sustained over 24 hours. Legitimate usage but creates processing challenge.' },
		'PartitionMapping': { title: 'Hash Partitioning Logic Analysis', content: 'Hash function: hash(user_id) % 200 partitions. User premium_user_999 hashes to partition 127. All 8.2M events for this user assigned to single partition. Hash collision not the issue – deterministic assignment is.' },
		'ComparativeAnalysis': { title: 'Partition Size Comparison', content: 'Comparative analysis confirms extreme outlier: Partition 127: 8.4GB (204x average), Partition 128: 7.9GB (192x), Partitions 0-126: 28-48MB range, Partitions 129-199: 32-51MB range. Two partitions account for 9% of total data.' },
		
		// Level 5: Symptom Correlation
		'SkewToOOM': { title: 'Correlation: Data Skew → OOM Errors', content: 'Direct causation established: Partition 127 (8.4GB) exceeds executor heap (6GB) by 40%. Executor must load entire partition for sort-merge join. Insufficient memory causes java.lang.OutOfMemoryError. Strong correlation (r=1.0) between partition size and OOM probability.' },
		'SkewToStraggler': { title: 'Correlation: Data Skew → Task Stragglers', content: 'Linear correlation confirmed: 204x data volume → 42x execution time (r=0.98). Task 127 processes 8.4GB in 3h 45m. Other tasks process ~42MB in ~6 min. Processing rate consistent at ~640MB/min. Straggling is data-driven, not resource-constrained.' },
		'SkewToRetries': { title: 'Correlation: Data Skew → Task Failures', content: 'Hot partition causes task failures through OOM. Task 127 attempted 4 times, failed all attempts. Each OOM triggers executor loss, causing task retry. Stage retry limit (4) exceeded, leading to stage failure. 156 failed tasks traced to partition 127-128 OOM errors.' },
		'CascadeEffect': { title: 'Failure Cascade Pattern', content: 'Stage 3 failure cascades to dependent stages. Stage 4 (aggregate) cannot proceed without Stage 3 completion. Stage 5 (write) blocked on Stage 4. Single partition failure (127) causes complete job failure. No fault tolerance for hot partition scenario.' },
		'UserBehavior': { title: 'Power User Behavior Pattern Analysis', content: 'User premium_user_999 behavior: API-driven automated system, not human user. Continuous 24/7 activity generating 95 events/sec. Pattern consistent with data pipeline or monitoring system. Legitimate usage but architectural challenge for batch processing.' },
		'VolumeCorrelation': { title: 'Volume-to-Failure Correlation', content: 'Statistical analysis shows strong correlation (r=0.94) between user event count and task failure probability. Users with >1M events/day cause 87% of task failures. Volume threshold identified: >5M events reliably triggers OOM on standard executor config (6GB heap).' },
		'HashCollision': { title: 'Hash Function Distribution Analysis', content: 'Hash function analysis: Standard Java hashCode() with modulo 200. Distribution quality tested on user_ids: Chi-square test shows good uniformity (p=0.89). Problem is NOT hash collisions. Problem is input data distribution (real power users exist).' },
		
		// Level 6: RCA Conclusion
		'RCAComplete': { title: '✅ ROOT CAUSE IDENTIFIED: Data Skew on Join Key', content: 'Root Cause Analysis Complete: The production failure was caused by extreme data skew (204:1 ratio) on the user_id join key in Stage 3. Power users "premium_user_999" (8.4GB, 8.2M events) and "bot_crawler_001" (7.9GB, 7.5M events) created hot partitions 200x larger than average (42MB). This skew explains all observed symptoms: executor OOM errors (Java heap space exhausted), task straggling (partition 127 took 3h 45m vs 5m median for others), YARN container kills (memory limits exceeded), and cascading stage failures. The imbalanced data distribution forced single executors to process 200x more data than others, exceeding available memory and causing the job to fail repeatedly.' },
		'FailureChain': { title: 'Complete Failure Chain Documented', content: 'Full causation chain mapped: (1) Power users generate 200x more events → (2) Hash partitioning assigns all events to single partition → (3) Partition 127 contains 8.4GB (42MB average) → (4) Sort-merge join loads partition into executor memory → (5) 8.4GB exceeds 6GB heap limit → (6) OOM error throws exception → (7) Executor crashes, lost by driver → (8) Task 127 retries (4 attempts) → (9) All retries fail with OOM → (10) Stage 3 fails after retry limit → (11) Dependent stages (4,5) cannot proceed → (12) Job fails completely. Root cause: data skew. Proximate cause: insufficient memory. Ultimate cause: architectural assumption that all users generate similar data volumes.' },
		'ContinueMonitoring': { title: 'MONITORING: Ongoing Observation', content: 'Production deployment active with enhanced monitoring. Tracking partition sizes, task durations, and memory usage for 24h to ensure sustained stability.' },
		'ExtendedTesting': { title: 'VALIDATION: Extended Testing Period', content: 'Running additional validation cycles over 7 days to ensure solution handles all data patterns including weekend spikes and monthly rollups.' },
		'MonitorBalance': { title: 'MONITORING: Partition Balance Tracking', content: 'Continuous monitoring of partition distribution. Alerting configured if max/avg partition ratio exceeds 10:1 threshold.' },
		'ResourceOptimization': { title: 'OPTIMIZATION: Resource Fine-tuning', content: 'Fine-tuning resource allocation based on production metrics. Potential to reduce executor memory by 10% while maintaining performance.' }
	};
	
	return hypotheses[label] || { 
		title: `${label} Investigation`, 
		content: `Analyzing ${label} to determine its role in the job failure. Examining logs, metrics, and Spark UI for relevant evidence.` 
	};
}

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
			title: 'Spark Job Failure: user_analytics_daily_agg',
			content: 'Production ETL job failed after 4h 12m. Stage 3 (SortMergeJoin on user_id) failed 4 times with 156 task failures. Processing 2.3TB of user events data for daily aggregation. Critical SLA breach impacting downstream reporting systems.'
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

	// Level 4: Root Cause Confirmation (deeper analysis)
	const level4Categories: Record<string, any[]> = {
		'SkewedJoin': [
			{ label: 'PartitionAnalysis', reward: 0.93, signals: { sparkui: ['Analyzing partition 127 in detail'], shuffle: ['Partition size distribution'] }},
			{ label: 'KeyDistribution', reward: 0.89, signals: { sparkui: ['Analyzing join key cardinality'], logs: ['Key frequency analysis'] }},
			{ label: 'TaskTimeline', reward: 0.86, signals: { sparkui: ['Task execution timeline'], logs: ['Straggler task patterns'] }},
			{ label: 'MemoryFootprint', reward: 0.78, signals: { logs: ['Memory consumption per partition'], metrics: { memory: { value: 98, label: 'Memory', bar: 98 }}}},
			{ label: 'ShuffleMetrics', reward: 0.71, signals: { shuffle: ['Shuffle read/write patterns'], sparkui: ['Shuffle stage analysis'] }}
		],
		'UDFMemoryLeak': [
			{ label: 'PythonWorkerTrace', reward: 0.94, signals: { logs: ['Python worker memory trace'], metrics: { memory: { value: 92, label: 'Memory', bar: 92 }}}},
			{ label: 'UDFCodeReview', reward: 0.87, signals: { logs: ['UDF source code analysis'], sparkui: ['UDF execution stats'] }},
			{ label: 'WorkerHeapDump', reward: 0.76, signals: { logs: ['Heap dump analysis'], metrics: { memory: { value: 88, label: 'Memory', bar: 88 }}}},
			{ label: 'ObjectRetention', reward: 0.69, signals: { logs: ['Object retention graph'], metrics: { memory: { value: 85, label: 'Memory', bar: 85 }}}}
		],
		'HotPartition': [
			{ label: 'PowerUserProfile', reward: 0.91, signals: { shuffle: ['User: premium_user_999'], sparkui: ['Event count: 8.2M'] }},
			{ label: 'DataVolume', reward: 0.88, signals: { shuffle: ['Single user: 8.4GB'], logs: ['Data volume analysis'] }},
			{ label: 'PartitionMapping', reward: 0.82, signals: { logs: ['Hash(user_id) → partition'], sparkui: ['Partition assignment'] }},
			{ label: 'ComparativeAnalysis', reward: 0.74, signals: { shuffle: ['8.4GB vs 42MB average'], sparkui: ['204:1 ratio confirmed'] }}
		],
		'MemoryOverhead': [
			{ label: 'OffHeapAnalysis', reward: 0.92, signals: { logs: ['Off-heap usage tracking'], metrics: { memory: { value: 88, label: 'Off-heap', bar: 88 }}}},
			{ label: 'GCBehavior', reward: 0.84, signals: { logs: ['GC pause analysis'], metrics: { gc: { value: 42, label: 'GC %', bar: 42 }}}},
			{ label: 'NativeMemory', reward: 0.71, signals: { logs: ['Native memory allocation'], metrics: { memory: { value: 85, label: 'Memory', bar: 85 }}}}
		],
		'ConnectionTimeout': [
			{ label: 'NetworkLatency', reward: 0.83, signals: { network: ['Latency measurements'], logs: ['Network trace'] }},
			{ label: 'BlockTransfer', reward: 0.76, signals: { shuffle: ['Shuffle block transfer rate'], sparkui: ['Transfer metrics'] }},
			{ label: 'SocketConfig', reward: 0.68, signals: { network: ['Socket buffer analysis'], logs: ['Network configuration'] }}
		]
	};

	// Level 5: Symptom Correlation (linking symptoms to root cause)
	const level5Categories: Record<string, any[]> = {
		'PartitionAnalysis': [
			{ label: 'SkewToOOM', reward: 0.96, signals: { logs: ['8.4GB partition → 6GB heap = OOM'], metrics: { memory: { value: 98, label: 'Memory', bar: 98 }}}},
			{ label: 'SkewToStraggler', reward: 0.91, signals: { sparkui: ['204x data → 42x duration'], logs: ['Linear correlation confirmed'] }},
			{ label: 'SkewToRetries', reward: 0.88, signals: { logs: ['Hot partition causes task failures'], errors: { value: 12, label: 'Failed Tasks' }}},
			{ label: 'CascadeEffect', reward: 0.85, signals: { sparkui: ['Stage retry cascade'], logs: ['Failure propagation pattern'] }}
		],
		'PythonWorkerTrace': [
			{ label: 'LeakToOOM', reward: 0.95, signals: { logs: ['Memory leak → OOM correlation'], metrics: { memory: { value: 99, label: 'Memory', bar: 99 }}}},
			{ label: 'WorkerCrash', reward: 0.92, signals: { logs: ['Worker crash pattern'], errors: { value: 8, label: 'Worker Crashes' }}},
			{ label: 'BatchGrowth', reward: 0.78, signals: { logs: ['Memory grows per batch'], metrics: { memory: { value: 90, label: 'Memory', bar: 90 }}}}
		],
		'PowerUserProfile': [
			{ label: 'UserBehavior', reward: 0.93, signals: { shuffle: ['Power user event patterns'], sparkui: ['Activity analysis'] }},
			{ label: 'VolumeCorrelation', reward: 0.89, signals: { shuffle: ['Volume vs failures'], logs: ['Strong correlation (r=0.94)'] }},
			{ label: 'HashCollision', reward: 0.87, signals: { logs: ['Hash function analysis'], sparkui: ['Partition assignment logic'] }}
		],
		'OffHeapAnalysis': [
			{ label: 'MemoryBreakdown', reward: 0.94, signals: { logs: ['Heap + off-heap > container'], metrics: { memory: { value: 96, label: 'Total Memory', bar: 96 }}}},
			{ label: 'YARNKillPattern', reward: 0.86, signals: { logs: ['Container kill correlation'], errors: { value: 5, label: 'Container Kills' }}},
			{ label: 'OverheadInsufficient', reward: 0.72, signals: { logs: ['Overhead calculation'], metrics: { memory: { value: 88, label: 'Overhead', bar: 88 }}}}
		],
		'NetworkLatency': [
			{ label: 'LatencySpikes', reward: 0.89, signals: { network: ['Latency spike patterns'], logs: ['Timeout correlation'] }},
			{ label: 'BlockFetchDelay', reward: 0.84, signals: { shuffle: ['Fetch delay analysis'], sparkui: ['Network wait time'] }},
			{ label: 'RetryAmplification', reward: 0.78, signals: { logs: ['Retry storm pattern'], errors: { value: 15, label: 'Retries' }}}
		]
	};

	// Level 6: RCA Conclusion (final analysis summary)
	const level6Categories: Record<string, any[]> = {
		'SkewToOOM': [
			{ label: 'RCAComplete', reward: 0.98, signals: { logs: ['RCA CONCLUDED'], sparkui: ['Root cause confirmed'], errors: { value: 15, label: 'All Errors Explained' }}},
			{ label: 'FailureChain', reward: 0.91, signals: { logs: ['Complete failure chain mapped'], sparkui: ['Skew→OOM→Fail→Cascade'] }}
		],
		'LeakToOOM': [
			{ label: 'RCAComplete', reward: 0.97, signals: { logs: ['UDF leak root cause confirmed'], metrics: { memory: { value: 99, label: 'Memory', bar: 99 }}}},
			{ label: 'FailureChain', reward: 0.88, signals: { logs: ['Leak→Worker OOM→Task fail'], sparkui: ['Full chain documented'] }}
		],
		'UserBehavior': [
			{ label: 'RCAComplete', reward: 0.96, signals: { logs: ['Power user root cause confirmed'], shuffle: ['Data skew proven'] }},
			{ label: 'FailureChain', reward: 0.89, signals: { logs: ['Power user→Skew→Hot partition→OOM'], sparkui: ['Complete analysis'] }}
		],
		'MemoryBreakdown': [
			{ label: 'RCAComplete', reward: 0.95, signals: { logs: ['Memory overhead root cause confirmed'], errors: { value: 5, label: 'Container Kills Explained' }}},
			{ label: 'FailureChain', reward: 0.87, signals: { logs: ['Insufficient overhead→Kill→Fail'], metrics: { memory: { value: 96, label: 'Memory', bar: 96 }}}}
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

				const hypothesisContent = getHypothesisForNode(category.label, parentNode.label);
				
				const node: RcaNode = {
					id: `n${++nodeId}`,
					x: xPosition,
					y: 30 + (level + 1) * 130,
					label: category.label,
					reward: randomReward,
					parent: parentNode.id,
					level: level + 1,
					hypothesis: {
						title: hypothesisContent.title,
						content: hypothesisContent.content
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