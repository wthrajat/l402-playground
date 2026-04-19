// L402 Protocol Simulation Engine
// Generates realistic-looking macaroons, invoices, and preimages — all in-browser

// ===== Utility functions =====

function randomHex(bytes: number): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ===== Macaroon =====

export interface MacaroonCaveat {
  condition: string;
  value: string;
}

export interface DecodedMacaroon {
  version: number;
  location: string;
  identifier: string;
  caveats: MacaroonCaveat[];
  signature: string;
}

export function createMacaroon(paymentHash: string): {
  raw: string;
  decoded: DecodedMacaroon;
} {
  const expiry = new Date(Date.now() + 3600 * 1000); // 1 hour from now

  const decoded: DecodedMacaroon = {
    version: 2,
    location: 'https://data.lightning.services',
    identifier: paymentHash,
    caveats: [
      { condition: 'service', value: 'bitcoin-analytics' },
      { condition: 'tier', value: 'standard' },
      { condition: 'capabilities', value: 'read' },
      {
        condition: 'expiry',
        value: expiry.toISOString(),
      },
    ],
    signature: randomHex(32),
  };

  // Create a base64 "raw" representation
  const raw = btoa(JSON.stringify(decoded));

  return { raw, decoded };
}

// ===== Lightning Invoice =====

export interface InvoiceData {
  bolt11: string;
  amountSats: number;
  description: string;
  expiry: number;
  timestamp: number;
}

export function generateInvoice(): InvoiceData {
  const amountSats = randomInt(50, 500);

  // Generate a realistic-looking bolt11 invoice
  // Real format: lnbc<amount><multiplier>1<bech32data><checksum>
  const amountPart =
    amountSats >= 1000
      ? `${(amountSats / 1000).toFixed(0)}m`
      : `${amountSats * 10}n`;
  const dataPart = randomHex(140);

  // Build something that looks convincingly like a bolt11 invoice
  const bolt11 = `lnbc${amountPart}1pn${dataPart.substring(0, 240)}`;

  return {
    bolt11,
    amountSats,
    description: 'L402: bitcoin-analytics/standard',
    expiry: 3600,
    timestamp: Math.floor(Date.now() / 1000),
  };
}

// ===== Preimage & Payment Hash =====

export interface PaymentProof {
  preimage: string;
  paymentHash: string;
}

export async function generatePaymentProof(): Promise<PaymentProof> {
  const preimage = randomHex(32);
  const paymentHash = await sha256Hex(preimage);
  return { preimage, paymentHash };
}

// ===== L402 Session =====

export interface L402Session {
  paymentProof: PaymentProof;
  macaroon: { raw: string; decoded: DecodedMacaroon };
  invoice: InvoiceData;
  l402Token: string;
}

export async function createSession(): Promise<L402Session> {
  const paymentProof = await generatePaymentProof();
  const macaroon = createMacaroon(paymentProof.paymentHash);
  const invoice = generateInvoice();
  const l402Token = `${macaroon.raw}:${paymentProof.preimage}`;

  return {
    paymentProof,
    macaroon,
    invoice,
    l402Token,
  };
}

// ===== Mock API Response =====

export function getMockApiResponse(): object {
  return {
    status: 'success',
    data: {
      bitcoin: {
        price_usd: 104283.42,
        change_24h: 2.34,
        market_cap: '2.07T',
        volume_24h: '38.2B',
        hash_rate: '812.4 EH/s',
        difficulty: '119.12T',
        block_height: 893421,
        mempool_size: 14823,
      },
      lightning: {
        capacity_btc: 6842.31,
        num_channels: 68421,
        num_nodes: 15832,
        avg_fee_rate: 0.000012,
      },
      timestamp: new Date().toISOString(),
      powered_by: 'L402 Protocol',
    },
  };
}
