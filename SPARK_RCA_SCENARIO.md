# Apache Spark RCA Scenario: Data Skew in Join Operation

## Overview
This UI now displays a realistic, production-level Apache Spark debugging scenario based on one of the most common and complex issues in big data processing: **Extreme Data Skew in Large-Scale Join Operations**.

## Problem Statement

### The Failure
- **Job**: `user_analytics_daily_agg` - Daily ETL pipeline
- **Status**: Failed after 4h 12m (SLA: 3 hours)
- **Data Volume**: 2.3TB input data
- **Failed Stage**: Stage 3 (SortMergeJoin on `user_id`)
- **Task Failures**: 156 out of 200 tasks failed

### Business Impact
Production analytics pipeline failure affecting downstream reporting systems and business intelligence dashboards.

## Root Cause: Data Skew

### The Problem
**Extreme partition skew on join key "user_id":**

- **Partition 127**: 8.4GB (user_id: "premium_user_999" with 8.2M events)
- **Partition 128**: 7.9GB (user_id: "bot_crawler_001" with 7.5M events)
- **Other partitions**: Average 42MB
- **Skew ratio**: 204:1 (extreme)

### Symptoms
1. **Task Straggling**: Task 127 took 3h 45m while median task completed in 5m 23s (42x difference)
2. **Memory Exhaustion**: Executor OOM errors due to single partition exceeding executor heap
3. **Container Kills**: YARN killed containers processing hot partitions
4. **Cascade Failures**: Failed tasks caused stage retries, leading to job failure

## Technical Details

### Join Operation
```
Stage 3: SortMergeJoin at analytics.scala:245
- Left table: users (12M rows, 2.4GB)
- Right table: events (850M rows, 180GB)
- Join key: user_id
- Join type: Inner
- Shuffle read: 182.4GB
- Shuffle write: 165.8GB
```

### Error Patterns
```
23:42:15 ERROR ExecutorRunner: java.lang.OutOfMemoryError: Java heap space
23:42:15 ERROR at scala.collection.mutable.ArrayBuffer.ensureSize
23:42:15 ERROR at org.apache.spark.sql.execution.joins.SortMergeJoin
23:42:16 INFO Lost executor 15: Container killed by YARN
23:42:16 WARN TaskSetManager: Lost task 127.0 in stage 3.0 (ExecutorLost)
```

## Solution: Key Salting Strategy

### Approach
Applied **salting technique** to problematic keys:
1. Identified skewed keys: "premium_user_999", "bot_crawler_001"
2. Added random salt (0-9) to these keys
3. Exploded hot partitions across 10 smaller partitions each

### Results
- **Max partition size**: 8.4GB → 840MB (10x reduction)
- **Task duration variance**: 42x → 3.2x
- **Job duration**: 4h+ (with failures) → 2h 5m (success)
- **Task failures**: 156 → 0
- **OOM errors**: 12 → 0

### Implementation
```scala
// Detect and salt skewed keys
val saltedDF = df
  .withColumn("salt", 
    when(col("user_id").isin("premium_user_999", "bot_crawler_001"), 
         (rand() * 10).cast("int"))
    .otherwise(lit(0)))
  .withColumn("salted_key", concat(col("user_id"), lit("_"), col("salt")))
```

## Investigation Trail (MCTS Path)

The AI follows this investigation path through the decision tree:

1. **JobFailure** → Initial incident detection (23:45)
2. **StageFailures** → Focus on Stage 3 failures (23:55 - reward: 0.82)
3. **JoinStage** → Deep dive into SortMergeJoin operation (00:10 - reward: 0.78)
4. **SkewedJoin** → Identify data skew root cause (00:25 - reward: 0.91)
5. **SaltingKeys** → Analyze skew mechanism (00:35 - reward: 0.93)
6. **TestRun** → Correlation analysis (00:42 - reward: 0.96)
7. **DeployProduction** → ROOT CAUSE CONFIRMED (00:48 - reward: 0.98)

**Note**: The final node serves as the comprehensive RCA conclusion that includes:
- Confirmed root cause: Data skew on join key
- Detailed failure mechanism explanation
- Complete investigation timeline (6 phases)
- Root cause correlation to symptoms

## UI Tabs

### Investigation Trail Tab
Shows the breadcrumb trail of hypotheses explored during the MCTS investigation.

### Root Cause Analysis Tab
Appears when investigation is complete. Contains:
- **Root Cause Summary**: Title, confidence, investigation path
- **Impact Analysis**: Business and technical impact
- **Failure Mechanism**: Technical explanation of why the failure occurred
- **Investigation Timeline**: 6-phase timeline showing:
  - 23:45 - Production incident detected
  - 23:50 - RCA investigation initiated
  - 23:55 - Level 1 analysis (StageFailures)
  - 00:10 - Level 2 deep dive (JoinStage)
  - 00:25 - Root cause identified (SkewedJoin)
  - 00:35 - Skew mechanism analyzed
  - 00:42 - OOM-to-partition correlation
  - 00:48 - RCA conclusion

### Possible Solutions Tab
Appears when root cause is confirmed. Provides:
1. **Recommended Solutions** (4 approaches):
   - Key Salting (with Scala code example)
   - Adaptive Query Execution (AQE configuration)
   - Isolated Processing (separate handling for power users)
   - Increase Executor Memory (temporary mitigation)

2. **Further Reading**: 
   - Databricks blog posts
   - Apache Spark documentation
   - Netflix Tech Blog articles
   - O'Reilly book references
   - Research papers

3. **Best Practices**:
   - Monitoring recommendations
   - Profiling strategies
   - Testing approaches
   - Documentation guidelines

## Realistic Elements

### Log Messages
- Timestamped logs with realistic Spark error patterns
- Actual Java stack traces from OOM errors
- YARN container kill messages
- Task retry and failure logs

### Metrics
- Realistic shuffle sizes (182GB read, 165GB write)
- Memory utilization patterns (65-100%)
- GC overhead percentages
- Task duration distributions

### Spark UI Data
- Application names and IDs
- Stage numbers and retry attempts
- Task counts and failure rates
- Duration measurements
- Partition size distributions

### Signal Evidence
Each node displays authentic data from:
- **Spark Logs**: Timestamped error and warning messages
- **System Metrics**: Memory, CPU, GC overhead with charts
- **Network I/O**: Shuffle fetch statistics
- **Error Summary**: Categorized error counts
- **Shuffle Stats**: Partition size distributions, spill metrics
- **Spark UI**: Stage details, task metrics, job timeline

## Why This Scenario?

This represents a **real production problem** that:
1. Is extremely common in big data processing (data skew affects 60%+ of production Spark jobs)
2. Requires systematic debugging across multiple signals
3. Has clear symptoms, root cause, and solution
4. Demonstrates MCTS effectively navigating complexity
5. Shows realistic Spark internals and debugging techniques
6. Illustrates production-quality RCA with validation and deployment

## Learning Value

Users can observe:
- How to identify data skew from logs and metrics
- Correlation between partition size and task duration
- Memory pressure patterns in Spark executors
- Effective mitigation strategies (salting, AQE, repartitioning)
- Proper validation before production deployment
- End-to-end RCA methodology

---

**Note**: All node labels, rewards, and tree structure remain unchanged. Only the hypothesis content and signal data have been updated to reflect this realistic scenario.

