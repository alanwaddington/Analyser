// @vitest-environment jsdom
/**
 * Component-level tests for ActivityMap.svelte.
 *
 * These tests verify the `onMetricChannelChange` callback behaviour by mounting
 * the component in a jsdom environment with Leaflet fully mocked.  Pure utility
 * functions (positionFromPoints, extractGpsPoints, etc.) are tested in the
 * sibling *.test.ts and *.metricExtraction.test.ts files.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/svelte';
import type { Activity, ChannelKey } from '$lib/types';

// ── Leaflet mock — minimal stubs to prevent import errors in jsdom ──────────
// ActivityMap's onMount does a dynamic `await import('leaflet')` and then calls
// L.map(), L.tileLayer(), L.control.layers(), L.Control.extend(), L.DomUtil,
// L.DomEvent, and registers a ResizeObserver.  We provide a minimal Leaflet
// double that lets the component mount without throwing.

const mockMap = {
	fitBounds: vi.fn(),
	setView: vi.fn(),
	invalidateSize: vi.fn(),
	remove: vi.fn(),
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	on: vi.fn(),
};

// Tile layer stub — addTo is used by ActivityMap to register default layer
const makeTileLayerStub = () => ({ addTo: vi.fn() });

const mockLayersControl = { addTo: vi.fn() };

vi.mock('leaflet', () => {
	// L.Control.extend() creates a Leaflet Control subclass.  We return a class
	// that calls onAdd() (which sets legendControlEl etc. via side-effects) and
	// exposes addTo() as a no-op.
	const controlExtend = (proto: Record<string, unknown>) => {
		return class MockControl {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			constructor(_opts?: any) {}
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			addTo(_map: unknown) {
				// Call onAdd() so the legend DOM refs are initialised — this mirrors
				// Leaflet's own behaviour and prevents "legendControlEl is undefined"
				// guard-clause short-circuits later in tests.
				if (typeof proto.onAdd === 'function') proto.onAdd.call(this);
				return this;
			}
		};
	};

	const L = {
		map: vi.fn(() => mockMap),
		tileLayer: vi.fn(() => makeTileLayerStub()),
		control: {
			layers: vi.fn(() => mockLayersControl),
		},
		Control: { extend: vi.fn(controlExtend) },
		DomUtil: {
			create: vi.fn(
				(
					tag: string,
					className?: string,
					parent?: Element,
				): HTMLElement => {
					const el = document.createElement(tag);
					if (className) el.className = className;
					if (parent) parent.appendChild(el);
					return el;
				},
			),
		},
		DomEvent: {
			disableClickPropagation: vi.fn(),
		},
		latLng: vi.fn((lat: number, lon: number) => ({ lat, lon })),
		latLngBounds: vi.fn(() => ({})),
		polyline: vi.fn(() => ({ addTo: vi.fn(), bindTooltip: vi.fn(), on: vi.fn(), remove: vi.fn() })),
		featureGroup: vi.fn(() => ({ addTo: vi.fn(), bindTooltip: vi.fn(), on: vi.fn(), remove: vi.fn() })),
		circleMarker: vi.fn(() => ({ addTo: vi.fn(), setLatLng: vi.fn(), remove: vi.fn() })),
		canvas: vi.fn(() => ({})),
		svg: vi.fn(() => ({})),
	};

	return { default: L, ...L };
});

// Leaflet also imports its own CSS dynamically — stub to prevent errors.
vi.mock('leaflet/dist/leaflet.css', () => ({}));

// ── Global environment stubs ─────────────────────────────────────────────────

// ResizeObserver is not implemented in jsdom.
class MockResizeObserver {
	observe = vi.fn();
	disconnect = vi.fn();
}

// ── Test helpers ─────────────────────────────────────────────────────────────

function makeActivity(overrides: Partial<Activity> = {}): Activity {
	return {
		id: 'test-1',
		filename: 'test.fit',
		startTime: new Date(),
		totalDistance: 5000,
		totalElapsedTime: 1800,
		records: [],
		laps: [],
		devices: [],
		deviceStreams: [],
		firstGpsFixIndex: null,
		firstGpsMovementIndex: null,
		timerStartTime: null,
		firstIndoorMovementIndex: null,
		firstWorkoutStepTime: null,
		subSport: undefined,
		isIndoor: false,
		anchor: { recordIndex: 0, distanceMetres: 0, elapsedSeconds: 0, timestamp: new Date(0), source: 'fileStart' as const },
		availableChannels: new Set(),
		...overrides,
	};
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ActivityMap — onMetricChannelChange callback', () => {
	beforeEach(() => {
		// Stub ResizeObserver globally for every test.
		vi.stubGlobal('ResizeObserver', MockResizeObserver);

		// Make the component container report non-zero dimensions so
		// updatePickerPosition() sets pickerVisible = true, rendering the
		// Colour-by picker overlay in the DOM.
		vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
			top: 100, right: 500, bottom: 600, left: 0,
			width: 500, height: 500,
			x: 0, y: 100,
			toJSON: () => ({}),
		} as DOMRect);
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it('onMetricChannelChange_onMount_calledWithNull', async () => {
		const onChange = vi.fn();

		render(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(await import('./ActivityMap.svelte')).default as any,
			{
				activities: [],
				hoveredDistance: null,
				availableChannels: ['heartRate' as ChannelKey],
				onMetricChannelChange: onChange,
			},
		);

		// Wait for the async onMount (dynamic leaflet import) to complete and for
		// Svelte effects to flush.
		await waitFor(() => {
			expect(onChange).toHaveBeenCalledWith(null);
		});
	});

	it('onMetricChannelChange_channelSelected_calledWithChannelKey', async () => {
		const onChange = vi.fn();

		render(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(await import('./ActivityMap.svelte')).default as any,
			{
				activities: [makeActivity()],
				hoveredDistance: null,
				availableChannels: ['heartRate' as ChannelKey],
				onMetricChannelChange: onChange,
			},
		);

		// Wait for mount to complete and picker to be visible.
		// getByRole throws if the element is not found, so waitFor retries until
		// the async onMount has finished and set pickerVisible = true.
		await waitFor(() => screen.getByRole('button', { name: /heart rate|none/i }));

		// Open the picker dropdown
		const trigger = screen.getByRole('button', { name: /heart rate|none/i });
		await fireEvent.click(trigger);

		// Click the Heart Rate option
		const hrOption = await screen.findByRole('option', { name: 'Heart Rate' });
		await fireEvent.click(hrOption);

		// After selection, callback must be called with 'heartRate'
		await waitFor(() => {
			expect(onChange).toHaveBeenCalledWith('heartRate');
		});
	});

	it('onMetricChannelChange_noneSelected_calledWithNull', async () => {
		const onChange = vi.fn();

		render(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(await import('./ActivityMap.svelte')).default as any,
			{
				activities: [makeActivity()],
				hoveredDistance: null,
				availableChannels: ['heartRate' as ChannelKey],
				onMetricChannelChange: onChange,
			},
		);

		// Wait for mount, open picker, select Heart Rate
		await waitFor(() => screen.getByRole('button', { name: /heart rate|none/i }));
		await fireEvent.click(screen.getByRole('button', { name: /heart rate|none/i }));
		await fireEvent.click(await screen.findByRole('option', { name: 'Heart Rate' }));
		await waitFor(() => expect(onChange).toHaveBeenCalledWith('heartRate'));

		// Re-open picker and select None
		const trigger = screen.getByRole('button', { name: /heart rate/i });
		await fireEvent.click(trigger);
		const noneOption = await screen.findByRole('option', { name: 'None' });
		await fireEvent.click(noneOption);

		await waitFor(() => {
			const calls = onChange.mock.calls.map(c => c[0]);
			// The last call should be null (deselected)
			expect(calls[calls.length - 1]).toBeNull();
		});
	});

	it('onMetricChannelChange_noCallbackProp_doesNotThrow', async () => {
		// Regression: ActivityMap should function normally when onMetricChannelChange
		// is not provided (all existing callers before this PR didn't pass it).
		await expect(
			(async () => {
				render(
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(await import('./ActivityMap.svelte')).default as any,
					{
						activities: [],
						hoveredDistance: null,
						availableChannels: ['heartRate' as ChannelKey],
					},
				);
				await waitFor(() => expect(mockMap.setView).toHaveBeenCalled());
			})(),
		).resolves.toBeUndefined();
	});
});
