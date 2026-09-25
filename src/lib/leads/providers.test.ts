import { describe, expect, it } from 'vitest';

import { hasLeadIdentity, normalizeProviderPayload } from './providers';

describe('indiamart normalizer', () => {
  it('maps IndiaMART field names', () => {
    const lead = normalizeProviderPayload('indiamart', {
      SENDERNAME: 'Ravi Kumar',
      MOB: '9876543210',
      SENDEREMAIL: 'ravi@example.com',
      ENQ_CITY: 'Jaipur',
      ENQ_PRODUCT: 'Cotton Saree',
      ENQ_MESSAGE: 'Need 50 pieces, wholesale rate?',
    });
    expect(lead.name).toBe('Ravi Kumar');
    expect(lead.phone).toBe('9876543210');
    expect(lead.email).toBe('ravi@example.com');
    expect(lead.city).toBe('Jaipur');
    expect(lead.message).toBe('Cotton Saree: Need 50 pieces, wholesale rate?');
    expect(hasLeadIdentity(lead)).toBe(true);
  });
});

describe('justdial normalizer', () => {
  it('maps JustDial field names', () => {
    const lead = normalizeProviderPayload('justdial', {
      name: 'Priya Sharma',
      mobile: '+91-98765 43210',
      city: 'Mumbai',
      requirement: 'AC repair, split 1.5 ton',
    });
    expect(lead.name).toBe('Priya Sharma');
    expect(lead.phone).toBe('+91-98765 43210');
    expect(lead.city).toBe('Mumbai');
    expect(lead.message).toBe('AC repair, split 1.5 ton');
  });
});

describe('google_ads normalizer', () => {
  it('maps the flattened Zapier-style shape', () => {
    const lead = normalizeProviderPayload('google_ads', {
      full_name: 'Amit Verma',
      phone_number: '9812345678',
      email: 'amit@example.com',
      city: 'Delhi',
    });
    expect(lead.name).toBe('Amit Verma');
    expect(lead.phone).toBe('9812345678');
  });

  it('maps the native user_column_data shape and keeps custom answers', () => {
    const lead = normalizeProviderPayload('google_ads', {
      lead_id: 'abc123',
      user_column_data: [
        { column_name: 'Full name', string_value: 'Neha Gupta' },
        { column_name: 'Phone number', string_value: '9988776655' },
        {
          column_name: 'What service do you need?',
          string_value: 'Deep cleaning',
        },
      ],
    });
    expect(lead.name).toBe('Neha Gupta');
    expect(lead.phone).toBe('9988776655');
    expect(lead.message).toContain('Deep cleaning');
    expect(lead.message).not.toContain('abc123');
  });
});

describe('meta normalizer', () => {
  it('maps enriched field_data', () => {
    const lead = normalizeProviderPayload('meta', {
      field_data: [
        { name: 'full_name', values: ['Karan Mehta'] },
        { name: 'phone_number', values: ['+919876543210'] },
        { name: 'email', values: ['karan@example.com'] },
        { name: 'city', values: ['Pune'] },
        { name: 'budget', values: ['Under 50k'] },
      ],
    });
    expect(lead.name).toBe('Karan Mehta');
    expect(lead.phone).toBe('+919876543210');
    expect(lead.message).toBe('Under 50k');
  });

  it('returns an empty lead for a bare webhook ping (IDs only)', () => {
    const lead = normalizeProviderPayload('meta', {
      leadgen_id: '123',
      form_id: '456',
      page_id: '789',
    });
    expect(hasLeadIdentity(lead)).toBe(false);
  });
});

describe('webhook normalizer', () => {
  it('maps the documented contract', () => {
    const lead = normalizeProviderPayload('webhook', {
      name: 'Sana',
      phone: '9876543210',
      message: 'Interested in franchise',
    });
    expect(lead.name).toBe('Sana');
    expect(lead.phone).toBe('9876543210');
    expect(lead.message).toBe('Interested in franchise');
  });

  it('applies field_mapping renames', () => {
    const lead = normalizeProviderPayload(
      'webhook',
      { buyer_name: 'Rohan', customer_mobile: '9811111111' },
      { name: 'buyer_name', phone: 'customer_mobile' }
    );
    expect(lead.name).toBe('Rohan');
    expect(lead.phone).toBe('9811111111');
  });

  it('does not overwrite a directly-provided field with a mapping', () => {
    const lead = normalizeProviderPayload(
      'webhook',
      { name: 'Direct', buyer_name: 'Mapped' },
      { name: 'buyer_name' }
    );
    expect(lead.name).toBe('Direct');
  });
});
