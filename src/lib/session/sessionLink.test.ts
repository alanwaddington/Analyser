import { describe, it, expect } from 'vitest';
import { encodeSessionLink, decodeSessionLink } from './sessionLink';
import type { SessionLinkPayload } from './sessionLink';

const EMPTY_PAYLOAD: SessionLinkPayload = {};

const FULL_PAYLOAD: SessionLinkPayload = {
	d: ['ant:12345', 'serial:98765', 'device:garmin:fenix', 'type:120'],
	c: ['heartRate', 'power', 'cadence', 'speed'],
	s: 10,
	x: 'distance',
	m: 'compare',
	t: 'charts',
	zs: true,
	wkg: false,
	mc: 'gradient',
};

describe('encodeSessionLink', () => {
	it('encodeSessionLink_emptyPayload_returnsNonEmptyString', () => {
		const result = encodeSessionLink(EMPTY_PAYLOAD);
		expect(typeof result).toBe('string');
		expect(result.length).toBeGreaterThan(0);
	});

	it('encodeSessionLink_emptyPayload_encodesToLessThan10Chars', () => {
		const result = encodeSessionLink(EMPTY_PAYLOAD);
		expect(result.length).toBeLessThan(10);
	});

	it('encodeSessionLink_typicalPayload_encodesToLessThan400Chars', () => {
		// 2 files, 6 devices, standard channels — well within the 2048-char URL limit
		const payload: SessionLinkPayload = {
			d: [
				'ant:11111', 'ant:22222', 'ant:33333',
				'serial:44444', 'serial:55555', 'device:garmin:fenix7',
			],
			c: ['heartRate', 'power', 'cadence', 'speed', 'altitude', 'temperature'],
			s: 10,
			x: 'distance',
			m: 'compare',
			t: 'charts',
		};
		const result = encodeSessionLink(payload);
		expect(result.length).toBeLessThan(400);
	});

	it('encodeSessionLink_outputIsUrlSafeBase64_noStandardBase64Chars', () => {
		// URL-safe base64 must not contain + / or = chars
		const result = encodeSessionLink(FULL_PAYLOAD);
		expect(result).not.toMatch(/[+/=]/);
	});
});

describe('decodeSessionLink', () => {
	it('decodeSessionLink_encodedEmptyPayload_roundtrips', () => {
		const encoded = encodeSessionLink(EMPTY_PAYLOAD);
		const result = decodeSessionLink(encoded);
		expect(result).toEqual(EMPTY_PAYLOAD);
	});

	it('decodeSessionLink_encodedFullPayload_roundtrips', () => {
		const encoded = encodeSessionLink(FULL_PAYLOAD);
		const result = decodeSessionLink(encoded);
		expect(result).toEqual(FULL_PAYLOAD);
	});

	it('decodeSessionLink_emptyString_returnsNull', () => {
		expect(decodeSessionLink('')).toBeNull();
	});

	it('decodeSessionLink_nonBase64String_returnsNull', () => {
		expect(decodeSessionLink('not-valid-base64!!!')).toBeNull();
	});

	it('decodeSessionLink_truncatedBase64_returnsNull', () => {
		const encoded = encodeSessionLink(FULL_PAYLOAD);
		// Truncate to cause invalid JSON after decoding
		expect(decodeSessionLink(encoded.slice(0, 5))).toBeNull();
	});

	it('decodeSessionLink_validBase64ButInvalidJSON_returnsNull', () => {
		// base64url of 'not json'
		const invalid = btoa('not json').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
		expect(decodeSessionLink(invalid)).toBeNull();
	});

	it('decodeSessionLink_jsonArray_returnsNull', () => {
		const encoded = btoa('[1,2,3]').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
		expect(decodeSessionLink(encoded)).toBeNull();
	});

	it('decodeSessionLink_jsonNull_returnsNull', () => {
		const encoded = btoa('null').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
		expect(decodeSessionLink(encoded)).toBeNull();
	});

	it('decodeSessionLink_unknownKeys_silentlyIgnored', () => {
		const withUnknown = { ...FULL_PAYLOAD, futureField: 'future-value', anotherNew: 42 };
		const encoded = btoa(JSON.stringify(withUnknown)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
		const result = decodeSessionLink(encoded);
		// Unknown keys are not present in result (AC-12: silently ignored)
		expect(result).not.toHaveProperty('futureField');
		expect(result).not.toHaveProperty('anotherNew');
		// Known fields are still restored
		expect(result?.d).toEqual(FULL_PAYLOAD.d);
		expect(result?.s).toBe(FULL_PAYLOAD.s);
	});

	it('decodeSessionLink_invalidFieldType_s_fieldDropped', () => {
		const raw = { ...FULL_PAYLOAD, s: 'ten' }; // s must be a number
		const encoded = btoa(JSON.stringify(raw)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
		const result = decodeSessionLink(encoded);
		expect(result?.s).toBeUndefined();
		// Other valid fields still present
		expect(result?.d).toEqual(FULL_PAYLOAD.d);
	});

	it('decodeSessionLink_invalidXAxisMode_fieldDropped', () => {
		const raw = { x: 'altitude' }; // only 'time' | 'distance' are valid
		const encoded = btoa(JSON.stringify(raw)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
		const result = decodeSessionLink(encoded);
		expect(result?.x).toBeUndefined();
	});

	it('decodeSessionLink_invalidMode_fieldDropped', () => {
		const raw = { m: 'invalid-mode' };
		const encoded = btoa(JSON.stringify(raw)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
		const result = decodeSessionLink(encoded);
		expect(result?.m).toBeUndefined();
	});

	it('decodeSessionLink_invalidDArray_fieldDropped', () => {
		const raw = { d: [123, 'valid', true] }; // d must be string[]
		const encoded = btoa(JSON.stringify(raw)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
		const result = decodeSessionLink(encoded);
		expect(result?.d).toBeUndefined();
	});

	it('decodeSessionLink_partialPayload_onlyKnownValidFieldsRestored', () => {
		const partial = { s: 15, x: 'time' as const };
		const encoded = encodeSessionLink(partial);
		const result = decodeSessionLink(encoded);
		expect(result).toEqual({ s: 15, x: 'time' });
	});
});
