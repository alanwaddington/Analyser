import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('echarts', () => ({
	init: vi.fn(),
	connect: vi.fn(),
	disconnect: vi.fn(),
}));

describe('loadECharts', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('loadECharts_firstCall_returnsPromise', async () => {
		const { loadECharts } = await import('./echarts-loader');
		const result = loadECharts();
		expect(result).toBeInstanceOf(Promise);
	});

	it('loadECharts_calledTwice_returnsSamePromiseInstance', async () => {
		const { loadECharts } = await import('./echarts-loader');
		const p1 = loadECharts();
		const p2 = loadECharts();
		expect(p1).toBe(p2);
	});

	it('loadECharts_resolved_hasInitFunction', async () => {
		const { loadECharts } = await import('./echarts-loader');
		const ec = await loadECharts();
		expect(typeof ec.init).toBe('function');
	});

	it('loadECharts_resolved_hasConnectFunction', async () => {
		const { loadECharts } = await import('./echarts-loader');
		const ec = await loadECharts();
		expect(typeof ec.connect).toBe('function');
	});

	it('loadECharts_calledTwice_resolvesToSameModule', async () => {
		const { loadECharts } = await import('./echarts-loader');
		const ec1 = await loadECharts();
		const ec2 = await loadECharts();
		expect(ec1).toBe(ec2);
	});
});
