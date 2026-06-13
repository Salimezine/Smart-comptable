import { env } from "../../config/env.js";
import { AppError } from "../../utils/errors.js";

interface SubmitInput {
  invoice: {
    invoice_number: string;
    client_name: string;
    client_tax_id: string;
    lines: Array<{
      lineNumber: number;
      description: string;
      quantity: number;
      unitPrice: number;
      taxRate: number;
    }>;
    totals: {
      subtotalHT: { amount: number; currency: string };
      totalTax: { amount: number; currency: string };
      totalTTC: { amount: number; currency: string };
    };
    issue_date: string;
  };
  sellerTaxId: string;
}

export interface SubmitResult {
  teifXml: string;
  documentId: string;
  signatureUrl: string | null;
}

export async function submitToMiddleware(
  input: SubmitInput,
): Promise<SubmitResult> {
  const [y, m, d] = input.invoice.issue_date.split("-");
  const lines = input.invoice.lines.map((l) => ({
    lineNumber: l.lineNumber,
    description: l.description,
    quantity: l.quantity,
    unitPrice: { amount: l.unitPrice, currency: "TND" },
    taxRate: l.taxRate,
  }));

  const payload = {
    data: [
      {
        invoice: {
          header: {
            documentNumber: input.invoice.invoice_number,
            issueDate: input.invoice.issue_date,
            type: "INVOICE",
          },
          seller: {
            identifier: input.sellerTaxId,
            identifierType: "FISCAL_ID",
            name: input.invoice.client_name,
          },
          buyer: {
            identifier: input.invoice.client_tax_id,
            identifierType: input.invoice.client_tax_id.length === 8 ? "CIN" : "FISCAL_ID",
            name: input.invoice.client_name,
          },
          lines,
          totals: {
            subtotalHT: input.invoice.totals.subtotalHT,
            totalTax: input.invoice.totals.totalTax,
            totalTTC: input.invoice.totals.totalTTC,
          },
        },
        pdf: "JVBERi0xLjcNCjEgMCBvYmoNPDwvVHlwZS9DYXRhbG9nL1BhZ2VzIDIgMCBSPj4NZW5kb2JqDTIgMCBvYmoNPDwvVHlwZS9QYWdlcy9LaWRzIFszIDAgUl0vQ291bnQgMT4+DWVuZG9iag0zIDAgb2JqDTw8L1R5cGUvUGFnZS9QYXJlbnQgMiAwIFIvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXT4+DWVuZG9iag0KeHJlZg0KMCA0DQowMDAwMDAwMDAwIDY1NTM1IGYNCjAwMDAwMDAwMDkgMDAwMDAgbiANCjAwMDAwMDAwNTggMDAwMDAgbiANCjAwMDAwMDAxMTcgMDAwMDAgbiANCnRyYWlsZXINCjw8L1NpemUgNC9Sb290IDEgMCBSPj4NCnN0YXJ0eHJlZg0KMTc3DQolRU9G",
      },
    ],
    successUrl: null,
    failureUrl: null,
  };

  const res = await fetch(
    `${env().MIDDLEWARE_URL}/v1/documents/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env().MIDDLEWARE_API_TOKEN}`,
      },
      body: JSON.stringify(payload),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new AppError(
      502,
      "MIDDLEWARE_ERROR",
      `Middleware returned ${res.status}: ${body}`,
    );
  }

  const data = await res.json() as {
    signatureUUID?: string;
    signatureUrl?: string;
    message?: string;
  };

  return {
    teifXml: "",
    documentId: data.signatureUUID ?? "",
    signatureUrl: data.signatureUrl ?? null,
  };
}

export async function getTeifStatus(
  invoiceNumber: string,
): Promise<{ status: string }> {
  const res = await fetch(
    `${env().MIDDLEWARE_URL}/v1/documents/status/${invoiceNumber}`,
    {
      headers: {
        Authorization: `Bearer ${env().MIDDLEWARE_API_TOKEN}`,
      },
    },
  );

  if (!res.ok) {
    throw new AppError(502, "MIDDLEWARE_ERROR", "Failed to fetch TEIF status");
  }

  return res.json() as Promise<{ status: string }>;
}
