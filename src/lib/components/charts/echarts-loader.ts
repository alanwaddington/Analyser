import type * as EChartsNamespace from 'echarts';

export type EChartsModule = typeof EChartsNamespace;

let cached: Promise<EChartsModule> | null = null;

export function loadECharts(): Promise<EChartsModule> {
	if (!cached) {
		cached = import('echarts') as Promise<EChartsModule>;
	}
	return cached;
}
