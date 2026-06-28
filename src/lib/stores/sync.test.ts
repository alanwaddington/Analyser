import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — set up before any imports
// ---------------------------------------------------------------------------

// localStorage mock — same pattern as deviceLabels.test.ts
const localStorageMock = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: vi.fn((key: string): string | null => store[key] ?? null),
		setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
		removeItem: vi.fn((key: string) => { delete store[key]; }),
		clear: vi.fn(() => { store = {}; }),
	};
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// fetch mock — global for all tests
const mockFetch = vi.fn();
Object.defineProperty(globalThis, 'fetch', { value: mockFetch, writable: true });

// crypto.randomUUID mock
const MOCK_UUID = 'efbe6aac-3910-4b87-8c03-eeb9ea6f0276';
const MOCK_UUID_2 = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
Object.defineProperty(globalThis, 'crypto', {
	value: { randomUUID: vi.fn().mockReturnValue(MOCK_UUID) },
	writable: true,
});

// ---------------------------------------------------------------------------
// Mutable imports — reset module between tests
// ---------------------------------------------------------------------------

let deriveShortCode: (uuid: string) => string;
let initSync: () => Promise<(() => void) | undefined>;
let pushLabels: (uuid: string, shortCode: string) => Promise<void>;
let pullLabels: (uuid: string) => Promise<void>;
let resolveCode: (code: string) => Promise<string>;
let adoptSyncIdentity: (uuid: string) => Promise<void>;
let resetSyncIdentity: () => Promise<void>;
let getSyncStatus: () => import('./sync.ts').SyncStatus;

// deviceLabels module is also reset so the hook is cleared between tests
let setDeviceLabel: (key: string, label: string) => void;
let getAllLabels: () => Record<string, string>;

function resetFetch() {
	(mockFetch as Mock).mockReset();
	// Default: return 500 so retry calls get a defined response (not undefined)
	(mockFetch as Mock).mockResolvedValue(new Response('{}', { status: 500 }));
}

function mockFetchOk(body: unknown) {
	(mockFetch as Mock).mockResolvedValueOnce(
		new Response(JSON.stringify(body), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		}),
	);
}

function mockFetch404() {
	(mockFetch as Mock).mockResolvedValueOnce(new Response('{}', { status: 404 }));
}

function mockFetch500() {
	(mockFetch as Mock).mockResolvedValueOnce(new Response('{}', { status: 500 }));
}

function mockFetchNetworkError() {
	(mockFetch as Mock).mockRejectedValueOnce(new TypeError('Failed to fetch'));
}

beforeEach(async () => {
	vi.resetModules();
	localStorageMock.clear();
	resetFetch();
	// Reset call history and return value for crypto.randomUUID between tests
	(crypto.randomUUID as Mock).mockReset();
	(crypto.randomUUID as Mock).mockReturnValue(MOCK_UUID);

	const dlMod = await import('./deviceLabels.ts');
	setDeviceLabel = dlMod.setDeviceLabel;
	getAllLabels = dlMod.getAllLabels;

	const syncMod = await import('./sync.ts');
	deriveShortCode = syncMod.deriveShortCode;
	initSync = syncMod.initSync;
	pushLabels = syncMod.pushLabels;
	pullLabels = syncMod.pullLabels;
	resolveCode = syncMod.resolveCode;
	adoptSyncIdentity = syncMod.adoptSyncIdentity;
	resetSyncIdentity = syncMod.resetSyncIdentity;
	getSyncStatus = syncMod.getSyncStatus;

	// Use instant sleep so retry delays don't block existing tests
	const { _setSleepFn } = await import('$lib/utils/fetchWithRetry');
	_setSleepFn(() => Promise.resolve());
});

// Expected short code for MOCK_UUID
// hex: efbe6aac391047878c03eeb9ea6f0276 → BigInt → base36 uppercase, first 8 chars
function expectedShortCode(uuid: string): string {
	const hex = uuid.replace(/-/g, '');
	const n = BigInt('0x' + hex);
	const raw = n.toString(36).toUpperCase().padStart(8, '0').slice(0, 8);
	return `${raw.slice(0, 3)}-${raw.slice(3)}`;
}

const MOCK_SHORT_CODE = expectedShortCode(MOCK_UUID);
const MOCK_SHORT_CODE_2 = expectedShortCode(MOCK_UUID_2);

// ---------------------------------------------------------------------------
// deriveShortCode
// ---------------------------------------------------------------------------

describe('deriveShortCode', () => {
	it('deriveShortCode_knownUuid_returnsExpectedFormat', () => {
		const code = deriveShortCode(MOCK_UUID);
		// Format: 3 chars + dash + 5 chars
		expect(code).toMatch(/^[A-Z0-9]{3}-[A-Z0-9]{5}$/);
	});

	it('deriveShortCode_sameUuid_returnsSameCode', () => {
		expect(deriveShortCode(MOCK_UUID)).toBe(deriveShortCode(MOCK_UUID));
	});

	it('deriveShortCode_differentUuids_differentCodes', () => {
		expect(deriveShortCode(MOCK_UUID)).not.toBe(deriveShortCode(MOCK_UUID_2));
	});

	it('deriveShortCode_allZeroUuid_returnsValidFormat', () => {
		const code = deriveShortCode('00000000-0000-0000-0000-000000000001');
		expect(code).toMatch(/^[A-Z0-9]{3}-[A-Z0-9]{5}$/);
	});
});

// ---------------------------------------------------------------------------
// initSync — first visit (no UUID in localStorage)
// ---------------------------------------------------------------------------

describe('initSync — first visit', () => {
	it('initSync_noExistingUuid_generatesUuidAndStoresInLocalStorage', async () => {
		mockFetchOk({ ok: true }); // push call

		await initSync();

		expect(localStorageMock.getItem('analyser-sync-id')).toBe(MOCK_UUID);
	});

	it('initSync_noExistingUuid_storesShortCodeInLocalStorage', async () => {
		mockFetchOk({ ok: true });

		await initSync();

		expect(localStorageMock.getItem('analyser-sync-code')).toBe(MOCK_SHORT_CODE);
	});

	it('initSync_noExistingUuid_callsPushLabels', async () => {
		mockFetchOk({ ok: true });

		await initSync();

		expect(mockFetch).toHaveBeenCalledWith(
			`/api/labels/${MOCK_UUID}`,
			expect.objectContaining({ method: 'PUT' }),
		);
	});

	it('initSync_noExistingUuid_updatesStatusWithUuidAndCode', async () => {
		mockFetchOk({ ok: true });

		await initSync();

		const status = getSyncStatus();
		expect(status.uuid).toBe(MOCK_UUID);
		expect(status.shortCode).toBe(MOCK_SHORT_CODE);
	});

	it('initSync_noExistingUuid_pushIncludesExistingLocalLabels', async () => {
		setDeviceLabel('ant:42', 'Polar H10');
		mockFetchOk({ ok: true });

		await initSync();

		const callBody = JSON.parse((mockFetch as Mock).mock.calls[0][1].body as string);
		expect(callBody.labels).toEqual({ 'ant:42': 'Polar H10' });
	});
});

// ---------------------------------------------------------------------------
// initSync — returning visit (UUID exists in localStorage)
// ---------------------------------------------------------------------------

describe('initSync — returning visit', () => {
	beforeEach(() => {
		localStorageMock.setItem('analyser-sync-id', MOCK_UUID);
		localStorageMock.setItem('analyser-sync-code', MOCK_SHORT_CODE);
	});

	it('initSync_existingUuid_doesNotGenerateNewUuid', async () => {
		mockFetchOk({ labels: {} }); // pull call

		await initSync();

		expect(crypto.randomUUID).not.toHaveBeenCalled();
	});

	it('initSync_existingUuid_callsPullLabels', async () => {
		mockFetchOk({ labels: {} });

		await initSync();

		expect(mockFetch).toHaveBeenCalledWith(`/api/labels/${MOCK_UUID}`);
	});

	it('initSync_existingUuid_remoteLabelsOverwriteLocalStorage', async () => {
		setDeviceLabel('ant:42', 'Old Local Name');
		mockFetchOk({ labels: { 'ant:42': 'Remote Name', 'serial:999': 'Watch' } });

		await initSync();

		const { getDeviceLabel } = await import('./deviceLabels.ts');
		expect(getDeviceLabel('ant:42')).toBe('Remote Name');
		expect(getDeviceLabel('serial:999')).toBe('Watch');
	});

	it('initSync_existingUuid_missingShortCode_derivesAndStores', async () => {
		localStorageMock.removeItem('analyser-sync-code');
		mockFetchOk({ labels: {} });

		await initSync();

		expect(localStorageMock.getItem('analyser-sync-code')).toBe(MOCK_SHORT_CODE);
	});
});

// ---------------------------------------------------------------------------
// initSync — hook registration
// ---------------------------------------------------------------------------

describe('initSync — onLabelChange hook', () => {
	it('initSync_registersHook_labelChangeTriggersPush', async () => {
		localStorageMock.setItem('analyser-sync-id', MOCK_UUID);
		localStorageMock.setItem('analyser-sync-code', MOCK_SHORT_CODE);
		mockFetchOk({ labels: {} }); // pull

		await initSync();
		resetFetch();
		mockFetchOk({ ok: true }); // push triggered by label change

		setDeviceLabel('ant:42', 'My HRM');

		// Allow microtask queue to flush (fire-and-forget push)
		await new Promise((r) => setTimeout(r, 0));

		expect(mockFetch).toHaveBeenCalledWith(
			`/api/labels/${MOCK_UUID}`,
			expect.objectContaining({ method: 'PUT' }),
		);
	});

	it('initSync_calledTwice_secondCallIsNoop', async () => {
		localStorageMock.setItem('analyser-sync-id', MOCK_UUID);
		localStorageMock.setItem('analyser-sync-code', MOCK_SHORT_CODE);
		mockFetchOk({ labels: {} }); // pull for first call

		await initSync();
		const secondResult = await initSync(); // no mock needed — should not fetch

		expect(mockFetch).toHaveBeenCalledTimes(1);
		expect(secondResult).toBeUndefined();
	});

	it('initSync_cleanup_resetsAndAllowsReinit', async () => {
		localStorageMock.setItem('analyser-sync-id', MOCK_UUID);
		localStorageMock.setItem('analyser-sync-code', MOCK_SHORT_CODE);
		mockFetchOk({ labels: {} }); // pull for first call

		const cleanup = await initSync();
		expect(cleanup).toBeTypeOf('function');

		cleanup!();

		// After cleanup, a second initSync should run fresh
		mockFetchOk({ labels: {} }); // pull for second call
		await initSync();

		expect(mockFetch).toHaveBeenCalledTimes(2);
	});
});

// ---------------------------------------------------------------------------
// pushLabels
// ---------------------------------------------------------------------------

describe('pushLabels', () => {
	it('pushLabels_success_updates200AndSetsLastSynced', async () => {
		setDeviceLabel('ant:42', 'Polar H10');
		mockFetchOk({ ok: true });

		await pushLabels(MOCK_UUID, MOCK_SHORT_CODE);

		const status = getSyncStatus();
		expect(status.lastSynced).not.toBeNull();
		expect(status.error).toBeNull();
	});

	it('pushLabels_success_sendsFullLabelMap', async () => {
		setDeviceLabel('ant:42', 'Polar H10');
		setDeviceLabel('serial:999', 'Watch');
		mockFetchOk({ ok: true });

		await pushLabels(MOCK_UUID, MOCK_SHORT_CODE);

		const callBody = JSON.parse((mockFetch as Mock).mock.calls[0][1].body as string);
		expect(callBody.labels).toEqual({ 'ant:42': 'Polar H10', 'serial:999': 'Watch' });
		expect(callBody.shortCode).toBe(MOCK_SHORT_CODE);
	});

	it('pushLabels_storesLastSyncedTimestampInLocalStorage', async () => {
		mockFetchOk({ ok: true });

		await pushLabels(MOCK_UUID, MOCK_SHORT_CODE);

		const ts = localStorageMock.getItem('analyser-sync-ts');
		expect(ts).not.toBeNull();
		expect(new Date(ts!).getTime()).toBeGreaterThan(0);
	});

	it('pushLabels_non200Response_setsErrorState', async () => {
		mockFetch500();

		await pushLabels(MOCK_UUID, MOCK_SHORT_CODE);

		const status = getSyncStatus();
		expect(status.error).not.toBeNull();
	});

	it('pushLabels_networkError_setsErrorState', async () => {
		mockFetchNetworkError();

		await pushLabels(MOCK_UUID, MOCK_SHORT_CODE);

		const status = getSyncStatus();
		expect(status.error).not.toBeNull();
	});

	it('pushLabels_networkError_doesNotThrow', async () => {
		mockFetchNetworkError();

		await expect(pushLabels(MOCK_UUID, MOCK_SHORT_CODE)).resolves.toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// pullLabels
// ---------------------------------------------------------------------------

describe('pullLabels', () => {
	it('pullLabels_success_replacesLocalLabels', async () => {
		setDeviceLabel('ant:42', 'Old Name');
		mockFetchOk({ labels: { 'ant:42': 'Remote Name', 'serial:999': 'Watch' } });

		await pullLabels(MOCK_UUID);

		const { getDeviceLabel } = await import('./deviceLabels.ts');
		expect(getDeviceLabel('ant:42')).toBe('Remote Name');
		expect(getDeviceLabel('serial:999')).toBe('Watch');
	});

	it('pullLabels_success_updatesLastSynced', async () => {
		mockFetchOk({ labels: {} });

		await pullLabels(MOCK_UUID);

		const status = getSyncStatus();
		expect(status.lastSynced).not.toBeNull();
		expect(status.error).toBeNull();
	});

	it('pullLabels_404_gracefullyIgnores', async () => {
		mockFetch404();

		await pullLabels(MOCK_UUID);

		// No error set — 404 means no remote data yet
		const status = getSyncStatus();
		expect(status.error).toBeNull();
	});

	it('pullLabels_networkError_setsErrorState', async () => {
		mockFetchNetworkError();

		await pullLabels(MOCK_UUID);

		const status = getSyncStatus();
		expect(status.error).not.toBeNull();
	});

	it('pullLabels_networkError_doesNotThrow', async () => {
		mockFetchNetworkError();

		await expect(pullLabels(MOCK_UUID)).resolves.toBeUndefined();
	});

	it('pullLabels_serverError_setsErrorState', async () => {
		mockFetch500();

		await pullLabels(MOCK_UUID);

		const status = getSyncStatus();
		expect(status.error).not.toBeNull();
	});
});

// ---------------------------------------------------------------------------
// resolveCode
// ---------------------------------------------------------------------------

describe('resolveCode', () => {
	it('resolveCode_validCode_returnsUuid', async () => {
		mockFetchOk({ uuid: MOCK_UUID });

		const result = await resolveCode(MOCK_SHORT_CODE);

		expect(result).toBe(MOCK_UUID);
		expect(mockFetch).toHaveBeenCalledWith(`/api/labels/resolve/${MOCK_SHORT_CODE}`);
	});

	it('resolveCode_unknownCode_throwsCodeNotFound', async () => {
		mockFetch404();

		await expect(resolveCode(MOCK_SHORT_CODE)).rejects.toThrow('Code not found');
	});

	it('resolveCode_serverError_throws', async () => {
		mockFetch500();

		await expect(resolveCode(MOCK_SHORT_CODE)).rejects.toThrow();
	});
});

// ---------------------------------------------------------------------------
// adoptSyncIdentity
// ---------------------------------------------------------------------------

describe('adoptSyncIdentity', () => {
	it('adoptSyncIdentity_storesUuidInLocalStorage', async () => {
		mockFetchOk({ labels: { 'ant:42': 'My HRM' } });

		await adoptSyncIdentity(MOCK_UUID_2);

		expect(localStorageMock.getItem('analyser-sync-id')).toBe(MOCK_UUID_2);
	});

	it('adoptSyncIdentity_storesShortCodeInLocalStorage', async () => {
		mockFetchOk({ labels: {} });

		await adoptSyncIdentity(MOCK_UUID_2);

		expect(localStorageMock.getItem('analyser-sync-code')).toBe(MOCK_SHORT_CODE_2);
	});

	it('adoptSyncIdentity_pullsLabelsFromRemote', async () => {
		mockFetchOk({ labels: { 'ant:42': 'Remote HRM' } });

		await adoptSyncIdentity(MOCK_UUID_2);

		const { getDeviceLabel } = await import('./deviceLabels.ts');
		expect(getDeviceLabel('ant:42')).toBe('Remote HRM');
	});

	it('adoptSyncIdentity_updatesStatus', async () => {
		mockFetchOk({ labels: {} });

		await adoptSyncIdentity(MOCK_UUID_2);

		const status = getSyncStatus();
		expect(status.uuid).toBe(MOCK_UUID_2);
		expect(status.shortCode).toBe(MOCK_SHORT_CODE_2);
	});
});

// ---------------------------------------------------------------------------
// resetSyncIdentity
// ---------------------------------------------------------------------------

describe('resetSyncIdentity', () => {
	beforeEach(() => {
		localStorageMock.setItem('analyser-sync-id', MOCK_UUID);
		localStorageMock.setItem('analyser-sync-code', MOCK_SHORT_CODE);
		localStorageMock.setItem('analyser-sync-ts', '2026-01-01T00:00:00.000Z');
	});

	it('resetSyncIdentity_generatesNewUuid', async () => {
		(crypto.randomUUID as Mock).mockReturnValueOnce(MOCK_UUID_2);
		mockFetchOk({ ok: true }); // push

		await resetSyncIdentity();

		expect(localStorageMock.getItem('analyser-sync-id')).toBe(MOCK_UUID_2);
	});

	it('resetSyncIdentity_storesNewShortCode', async () => {
		(crypto.randomUUID as Mock).mockReturnValueOnce(MOCK_UUID_2);
		mockFetchOk({ ok: true });

		await resetSyncIdentity();

		expect(localStorageMock.getItem('analyser-sync-code')).toBe(MOCK_SHORT_CODE_2);
	});

	it('resetSyncIdentity_clearsLastSynced', async () => {
		(crypto.randomUUID as Mock).mockReturnValueOnce(MOCK_UUID_2);
		mockFetchOk({ ok: true });

		await resetSyncIdentity();

		// lastSynced is cleared before push — then re-set on push success
		// Either way, the old timestamp should be gone
		expect(localStorageMock.getItem('analyser-sync-ts')).not.toBe('2026-01-01T00:00:00.000Z');
	});

	it('resetSyncIdentity_pushesCurrentLabelsUnderNewIdentity', async () => {
		setDeviceLabel('ant:42', 'My HRM');
		(crypto.randomUUID as Mock).mockReturnValueOnce(MOCK_UUID_2);
		mockFetchOk({ ok: true }); // DELETE old UUID (fire-and-forget)
		mockFetchOk({ ok: true }); // PUT new UUID (push)

		await resetSyncIdentity();

		// calls[0] = DELETE to old UUID; calls[1] = PUT to new UUID
		const callArgs = (mockFetch as Mock).mock.calls[1];
		expect(callArgs[0]).toBe(`/api/labels/${MOCK_UUID_2}`);
		const body = JSON.parse(callArgs[1].body as string);
		expect(body.labels).toEqual({ 'ant:42': 'My HRM' });
	});

	it('resetSyncIdentity_updatesStatusWithNewIdentity', async () => {
		(crypto.randomUUID as Mock).mockReturnValueOnce(MOCK_UUID_2);
		mockFetchOk({ ok: true });

		await resetSyncIdentity();

		const status = getSyncStatus();
		expect(status.uuid).toBe(MOCK_UUID_2);
		expect(status.shortCode).toBe(MOCK_SHORT_CODE_2);
	});
});

// ---------------------------------------------------------------------------
// getSyncStatus
// ---------------------------------------------------------------------------

describe('getSyncStatus', () => {
	it('getSyncStatus_initial_returnsNullFields', () => {
		const status = getSyncStatus();
		expect(status.uuid).toBeNull();
		expect(status.shortCode).toBeNull();
		expect(status.lastSynced).toBeNull();
		expect(status.error).toBeNull();
	});

	it('getSyncStatus_initial_syncingIsFalse', () => {
		const status = getSyncStatus();
		expect(status.syncing).toBe(false);
	});

	it('getSyncStatus_afterPushSuccess_hasLastSynced', async () => {
		mockFetchOk({ ok: true });
		await pushLabels(MOCK_UUID, MOCK_SHORT_CODE);

		const status = getSyncStatus();
		expect(status.lastSynced).not.toBeNull();
		expect(status.error).toBeNull();
	});

	it('getSyncStatus_afterNetworkError_hasError', async () => {
		mockFetchNetworkError();
		await pushLabels(MOCK_UUID, MOCK_SHORT_CODE);

		const status = getSyncStatus();
		expect(status.error).not.toBeNull();
	});

	it('getSyncStatus_afterPushSuccess_syncingIsFalse', async () => {
		mockFetchOk({ ok: true });
		await pushLabels(MOCK_UUID, MOCK_SHORT_CODE);

		expect(getSyncStatus().syncing).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// pushLabels — retry behaviour
// ---------------------------------------------------------------------------

describe('pushLabels — retry', () => {
	it('pushLabels_transientThenSuccess_retriesAndSyncs', async () => {
		mockFetch500(); // first attempt fails
		mockFetchOk({ ok: true }); // retry succeeds

		await pushLabels(MOCK_UUID, MOCK_SHORT_CODE);

		const status = getSyncStatus();
		expect(status.lastSynced).not.toBeNull();
		expect(status.error).toBeNull();
		expect((mockFetch as Mock).mock.calls.length).toBeGreaterThanOrEqual(2);
	});

	it('pushLabels_allRetriesFail_setsError', async () => {
		// All 4 attempts (1 initial + 3 retries) fail via default 500 mock
		await pushLabels(MOCK_UUID, MOCK_SHORT_CODE);

		expect(getSyncStatus().error).not.toBeNull();
		expect((mockFetch as Mock).mock.calls.length).toBe(4);
	});

	it('pushLabels_networkErrorThenSuccess_retriesAndSyncs', async () => {
		mockFetchNetworkError(); // first attempt throws
		mockFetchOk({ ok: true }); // retry succeeds

		await pushLabels(MOCK_UUID, MOCK_SHORT_CODE);

		expect(getSyncStatus().lastSynced).not.toBeNull();
		expect(getSyncStatus().error).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// pullLabels — retry behaviour
// ---------------------------------------------------------------------------

describe('pullLabels — retry', () => {
	it('pullLabels_transientThenSuccess_retriesAndSyncs', async () => {
		mockFetch500(); // first attempt fails
		mockFetchOk({ labels: { 'ant:99': 'My HRM' } }); // retry succeeds

		await pullLabels(MOCK_UUID);

		expect(getSyncStatus().lastSynced).not.toBeNull();
		expect(getSyncStatus().error).toBeNull();
		expect((mockFetch as Mock).mock.calls.length).toBeGreaterThanOrEqual(2);
	});

	it('pullLabels_404_doesNotRetry', async () => {
		// 404 is a non-retryable response for pullLabels (silently ignored)
		mockFetch404();

		await pullLabels(MOCK_UUID);

		// No retry — 404 is not retryable per fetchWithRetry
		expect((mockFetch as Mock).mock.calls.length).toBe(1);
		expect(getSyncStatus().error).toBeNull();
	});

	it('pullLabels_allRetriesFail_setsError', async () => {
		// All 4 attempts fail via default 500 mock
		await pullLabels(MOCK_UUID);

		expect(getSyncStatus().error).not.toBeNull();
		expect((mockFetch as Mock).mock.calls.length).toBe(4);
	});
});

// ---------------------------------------------------------------------------
// resolveCode — retry behaviour
// ---------------------------------------------------------------------------

describe('resolveCode — retry', () => {
	it('resolveCode_transientThenSuccess_retriesAndReturnsUuid', async () => {
		mockFetch500(); // first attempt fails
		mockFetchOk({ uuid: MOCK_UUID }); // retry succeeds

		const result = await resolveCode(MOCK_SHORT_CODE);

		expect(result).toBe(MOCK_UUID);
		expect((mockFetch as Mock).mock.calls.length).toBeGreaterThanOrEqual(2);
	});

	it('resolveCode_400_doesNotRetry', async () => {
		(mockFetch as Mock).mockResolvedValueOnce(
			new Response('{}', { status: 400 }),
		);

		await expect(resolveCode(MOCK_SHORT_CODE)).rejects.toThrow();
		expect((mockFetch as Mock).mock.calls.length).toBe(1);
	});

	it('resolveCode_404_doesNotRetry', async () => {
		mockFetch404();

		await expect(resolveCode(MOCK_SHORT_CODE)).rejects.toThrow('Code not found');
		expect((mockFetch as Mock).mock.calls.length).toBe(1);
	});
});
