import { describe, expect, it } from 'vitest';

import { parseIngestBody } from './ingest';

describe('parseIngestBody', () => {
  it('parses JSON objects', () => {
    const body = JSON.stringify({
      SenderName: 'Asha',
      SenderMobile: '9876543210',
    });
    expect(parseIngestBody(body, 'application/json')).toEqual({
      SenderName: 'Asha',
      SenderMobile: '9876543210',
    });
  });

  it('parses URL-encoded form fields (IndiaMART style)', () => {
    const body =
      'SenderName=Asha+Sharma&SenderMobile=9876543210&SenderCity=Mumbai';
    expect(parseIngestBody(body, 'application/x-www-form-urlencoded')).toEqual({
      SenderName: 'Asha Sharma',
      SenderMobile: '9876543210',
      SenderCity: 'Mumbai',
    });
  });

  it('falls back to form parsing when JSON fails without a content type', () => {
    const body = 'name=Asha&mobile=9876543210';
    expect(parseIngestBody(body, null)).toEqual({
      name: 'Asha',
      mobile: '9876543210',
    });
  });

  it('rejects JSON arrays and primitives', () => {
    expect(parseIngestBody('[1,2,3]', 'application/json')).toBeNull();
    expect(parseIngestBody('"hello"', 'application/json')).toBeNull();
  });

  it('rejects empty and whitespace-only bodies', () => {
    expect(parseIngestBody('', 'application/json')).toBeNull();
    expect(parseIngestBody('   ', 'application/json')).toBeNull();
  });

  it('rejects non-JSON bodies with a JSON content type', () => {
    expect(parseIngestBody('not json at all', 'application/json')).toBeNull();
  });

  it('rejects empty form bodies', () => {
    expect(parseIngestBody('', null)).toBeNull();
  });
});
