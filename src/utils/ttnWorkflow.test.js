import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sendToTTN, downloadTTNXml, handleTTNResponse, confirmTTNTransmission } from './ttnWorkflow.js';
import { createPieceComptable } from './pieceComptable.js';
import { downloadTEIFXML } from './teifGenerator.js';

vi.mock('./pieceComptable.js', () => ({
  createPieceComptable: vi.fn(() => Promise.resolve({ id: 'piece-default' })),
  savePieceToJournal: vi.fn(() => Promise.resolve()),
}));

vi.mock('./stockManager.js', () => ({
  updateStockFromInvoice: vi.fn(() => Promise.resolve()),
}));

vi.mock('./teifGenerator.js', () => ({
  downloadTEIFXML: vi.fn(),
}));

const FAKE_XML = '<Invoice><cbc:ID>FAC-001</cbc:ID></Invoice>';

beforeEach(() => {
  createPieceComptable.mockImplementation((inv, ttnId) => Promise.resolve({ id: `piece-${ttnId}` }));
  vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  vi.stubGlobal('CustomEvent', vi.fn(function CustomEvent(type, opts) { return { type, ...opts }; }));
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('sendToTTN', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('returns accepted in dev mode with ttnId', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const p = sendToTTN(FAKE_XML, { ttnMode: 'dev' });
    vi.advanceTimersByTime(1500);
    const r = await p;
    expect(r.status).toBe('accepted');
    expect(r.ttnId).toMatch(/^TTN-/);
    expect(r._simulated).toBe(true);
  });

  it('returns rejected in dev mode when random < 0.05', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01);
    const p = sendToTTN(FAKE_XML, { ttnMode: 'dev' });
    vi.advanceTimersByTime(1500);
    const r = await p;
    expect(r.status).toBe('rejected');
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('returns error when exception is thrown', async () => {
    vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('boom'); });
    const p = sendToTTN(FAKE_XML, { ttnMode: 'dev' });
    vi.advanceTimersByTime(1500);
    const r = await p;
    expect(r.status).toBe('error');
  });

  it('returns manual in production mode', async () => {
    const r = await sendToTTN(FAKE_XML, { ttnMode: 'production', invoiceId: 'FAC-001' });
    expect(r.status).toBe('manual');
    expect(r.xml).toBe(FAKE_XML);
    expect(r.portalUrl).toBe('https://www.efatoora.tn');
  });

  it('supports sandbox mode like dev', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const p = sendToTTN(FAKE_XML, { ttnMode: 'sandbox' });
    vi.advanceTimersByTime(1500);
    const r = await p;
    expect(r.status).toBe('accepted');
  });
});

describe('downloadTTNXml', () => {
  it('calls downloadTEIFXML when response has xml', () => {
    downloadTTNXml({ xml: FAKE_XML, invoiceId: 'FAC-001' });
    expect(downloadTEIFXML).toHaveBeenCalledOnce();
    expect(downloadTEIFXML).toHaveBeenCalledWith(FAKE_XML, 'FAC-001');
  });

  it('does nothing when response has no xml', () => {
    downloadTTNXml({ invoiceId: 'FAC-001' });
    expect(downloadTEIFXML).not.toHaveBeenCalled();
  });
});

describe('handleTTNResponse', () => {
  let invoice;
  beforeEach(() => {
    invoice = { id: 'FAC-001', lignes: [] };
  });

  it('rejects null params', async () => {
    expect((await handleTTNResponse(null, {})).success).toBe(false);
    expect((await handleTTNResponse({}, null)).success).toBe(false);
  });

  it('handles accepted status', async () => {
    const r = await handleTTNResponse(invoice, { status: 'accepted', ttnId: 'TTN-2026-ABC123', timestamp: '2026-01-01' });
    expect(r.success).toBe(true);
    expect(r.ttnId).toBe('TTN-2026-ABC123');
    expect(invoice.statut).toBe('validee_teif');
    expect(invoice.ttnId).toBe('TTN-2026-ABC123');
  });

  it('handles rejected status with error mapping', async () => {
    const r = await handleTTNResponse(invoice, { status: 'rejected', errors: ['ERR_MF_INVALID'], timestamp: '2026-01-01' });
    expect(r.success).toBe(false);
    expect(invoice.statut).toBe('teif_rejete');
    expect(invoice.ttnErrors).toBeDefined();
  });

  it('handles pending status', async () => {
    const r = await handleTTNResponse(invoice, { status: 'pending' });
    expect(r.success).toBeNull();
    expect(r.message).toContain('En attente');
  });

  it('handles manual status', async () => {
    const r = await handleTTNResponse(invoice, { status: 'manual', message: 'XML', portalUrl: 'https://efatoora.tn', instructions: [], xml: FAKE_XML });
    expect(r.success).toBeNull();
    expect(r.status).toBe('manual');
  });

  it('handles unknown status', async () => {
    const r = await handleTTNResponse(invoice, { status: 'weird' });
    expect(r.success).toBe(false);
    expect(r.errors[0]).toContain('Statut TTN inconnu');
  });

  it('handles exceptions', async () => {
    createPieceComptable.mockRejectedValue(new Error('Création échouée'));
    const r = await handleTTNResponse(invoice, { status: 'accepted', ttnId: 'TTN-001', timestamp: '2026-01-01' });
    expect(r.success).toBe(false);
    expect(r.errors[0]).toContain('Création échouée');
  });
});

describe('confirmTTNTransmission', () => {
  it('rejects null invoice', async () => {
    const r = await confirmTTNTransmission(null);
    expect(r.success).toBe(false);
  });

  it('creates piece and updates stock', async () => {
    const invoice = { id: 'FAC-001', lignes: [] };
    const r = await confirmTTNTransmission(invoice, 'TTN-2026-MANUAL');
    expect(r.success).toBe(true);
    expect(r.ttnId).toBe('TTN-2026-MANUAL');
    expect(invoice.statut).toBe('validee_teif');
  });

  it('generates ttnId when not provided', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01'));
    const invoice = { id: 'FAC-002', lignes: [] };
    const r = await confirmTTNTransmission(invoice);
    expect(r.success).toBe(true);
    expect(r.ttnId).toMatch(/^TTN-/);
  });
});
