export type MetricSample = {
	value: number;
	label: string;
	bar: number;
};

export type NodeSignals = {
	logs?: string[];
	metrics?: {
		memory?: MetricSample;
		cpu?: MetricSample;
		gc?: MetricSample;
	};
	network?: string[];
	shuffle?: string[];
	errors?: { value: number; label: string };
	sparkui?: string[];
};

export type Hypothesis = {
	title: string;
	content: string;
};

export type RcaNode = {
	id: string;
	x: number;
	y: number;
	label: string;
	reward: number;
	parent: string | null;
	level: number;
	hypothesis: Hypothesis;
	signals: NodeSignals;
	stage: 'selection' | 'expansion' | 'simulation' | 'backpropagation';
	signalsRequired: string[];
	evidencePattern: string;
};

export type RcaEdge = {
	source: RcaNode;
	target: RcaNode;
	id: string;
};

export type TreeData = {
	nodes: RcaNode[];
	edges: RcaEdge[];
	nodeMap: Record<string, RcaNode>;
};

export type AggregatedSignals = {
	logs?: string[][];
	metrics?: Array<NodeSignals['metrics']>;
	network?: string[][];
	shuffle?: string[][];
	errors?: Array<{ value: number; label: string }>;
	sparkui?: string[][];
}; 