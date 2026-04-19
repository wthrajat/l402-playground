import './style.css';
import {
  createSession,
  getMockApiResponse,
  type L402Session,
  type DecodedMacaroon,
} from './l402';

const $ = <T extends HTMLElement>(sel: string): T =>
  document.querySelector(sel) as T;

const stepCards = document.querySelectorAll<HTMLElement>('.step-card');
const stepDots = document.querySelectorAll<HTMLElement>('.step-dot');
const progressFill = $<HTMLElement>('#progress-fill');
const flowMsgs = document.querySelectorAll<HTMLElement>('.flow-msg');
const flowExplanation = $<HTMLElement>('#flow-explanation');

const btnSendRequest = $<HTMLButtonElement>('#btn-send-request');
const btnPayInvoice = $<HTMLButtonElement>('#btn-pay-invoice');
const btnAccessResource = $<HTMLButtonElement>('#btn-access-resource');
const btnReset = $<HTMLButtonElement>('#btn-reset');
const tabs = document.querySelectorAll<HTMLElement>('.tab');
const tabContents = document.querySelectorAll<HTMLElement>('.tab-content');


let currentStep = 0;
let session: L402Session | null = null;

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab!;
    tabs.forEach((t) => t.classList.remove('active'));
    tabContents.forEach((tc) => tc.classList.remove('active'));
    tab.classList.add('active');
    $<HTMLElement>(`#tab-${target}`).classList.add('active');
  });
});


function goToStep(step: number) {
  currentStep = step;

  stepCards.forEach((card, i) => {
    card.classList.toggle('active', i === step);
  });

  stepDots.forEach((dot, i) => {
    dot.classList.remove('active', 'completed');
    if (i < step) dot.classList.add('completed');
    if (i === step) dot.classList.add('active');
  });

  const progress = step / (stepDots.length - 1);
  progressFill.style.transform = `scaleX(${progress})`;
}


function activateFlowMsg(index: number) {
  flowMsgs.forEach((msg, i) => {
    msg.classList.remove('active');
    if (i < index) msg.classList.add('done');
    if (i === index) msg.classList.add('active');
  });
}

function updateFlowExplanation(html: string) {
  flowExplanation.innerHTML = `<p>${html}</p>`;
}


function renderMacaroonInspector(decoded: DecodedMacaroon) {
  const inspector = $<HTMLElement>('#macaroon-inspector');
  inspector.innerHTML = `
    <div class="macaroon-decoded">
      <div class="macaroon-field">
        <div class="macaroon-field-label">Version</div>
        <div class="macaroon-field-value">${decoded.version}</div>
      </div>
      <div class="macaroon-field">
        <div class="macaroon-field-label">Location</div>
        <div class="macaroon-field-value">${decoded.location}</div>
      </div>
      <div class="macaroon-field">
        <div class="macaroon-field-label">Identifier (Payment Hash)</div>
        <div class="macaroon-field-value">${decoded.identifier}</div>
      </div>
      <div class="macaroon-field">
        <div class="macaroon-field-label">Caveats</div>
        <div class="caveat-list">
          ${decoded.caveats
      .map(
        (c) => `
            <div class="caveat-item">
              <span class="caveat-icon">🔒</span>
              <span>${c.condition} = ${c.value}</span>
            </div>
          `
      )
      .join('')}
        </div>
      </div>
      <div class="macaroon-field">
        <div class="macaroon-field-label">Signature</div>
        <div class="macaroon-field-value">${decoded.signature}</div>
      </div>
    </div>
  `;
}

function truncate(str: string, len: number): string {
  return str.length > len ? str.substring(0, len) + '…' : str;
}

function highlightJSON(obj: object, indent = 2): string {
  const json = JSON.stringify(obj, null, indent);
  return json
    .replace(
      /"([^"]+)":/g,
      '<span class="json-key">"$1"</span>:'
    )
    .replace(
      /: "([^"]+)"/g,
      ': <span class="json-str">"$1"</span>'
    )
    .replace(
      /: (\d+\.?\d*)/g,
      ': <span class="json-num">$1</span>'
    )
    .replace(
      /: (true|false)/g,
      ': <span class="json-bool">$1</span>'
    );
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));


btnSendRequest.addEventListener('click', async () => {
  btnSendRequest.disabled = true;
  btnSendRequest.innerHTML = `
    <svg class="shimmer" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
    Sending…
  `;

  // Generate the L402 session
  session = await createSession();

  activateFlowMsg(0);
  updateFlowExplanation(
    'Client sends <code>GET /api/v1/bitcoin/analytics</code> to the server…'
  );

  await delay(800);

  activateFlowMsg(1);
  updateFlowExplanation(
    `Server responds with <strong>HTTP 402 Payment Required</strong>. The <code>WWW-Authenticate</code> header contains a Macaroon (auth token) and a Lightning invoice for <strong>${session.invoice.amountSats} sats</strong>.`
  );

  const challengeCode = $<HTMLElement>('#challenge-response');
  challengeCode.innerHTML = `<span class="h-key">WWW-Authenticate</span>: <span class="h-val">L402</span>
  <span class="h-key">macaroon</span>=<span class="h-val">"${truncate(session.macaroon.raw, 60)}"</span>,
  <span class="h-key">invoice</span>=<span class="h-val">"${truncate(session.invoice.bolt11, 60)}"</span>
<span class="h-key">Content-Type</span>: <span class="h-val">application/json</span>
<span class="h-key">X-L402-Amount</span>: <span class="h-val">${session.invoice.amountSats} sats</span>`;

  $<HTMLElement>('#macaroon-preview').textContent = truncate(
    session.macaroon.raw,
    80
  );
  $<HTMLElement>('#invoice-preview').textContent = truncate(
    session.invoice.bolt11,
    80
  );
  $<HTMLElement>('#payment-amount').textContent =
    `${session.invoice.amountSats} sats`;

  renderMacaroonInspector(session.macaroon.decoded);

  await delay(400);

  goToStep(1);
});


btnPayInvoice.addEventListener('click', async () => {
  if (!session) return;

  btnPayInvoice.disabled = true;
  btnPayInvoice.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
    Paying…
  `;

  activateFlowMsg(2);
  updateFlowExplanation(
    'Client pays the Lightning invoice. The payment is settled instantly on the Lightning Network…'
  );

  goToStep(2);

  await delay(1800);

  const paymentAnim = $<HTMLElement>('#payment-animation');
  paymentAnim.classList.add('paid');

  const paymentStatus = $<HTMLElement>('#payment-status');
  paymentStatus.textContent = 'Settled ✓';
  paymentStatus.classList.add('paid');

  $<HTMLElement>('#payment-preimage').textContent = truncate(
    session.paymentProof.preimage,
    40
  );

  updateFlowExplanation(
    `⚡ Payment settled! Preimage received: <code>${truncate(session.paymentProof.preimage, 24)}</code>. This proves payment was made without revealing the payer\u2019s identity.`
  );

  btnAccessResource.disabled = false;
});

btnAccessResource.addEventListener('click', async () => {
  if (!session) return;

  btnAccessResource.disabled = true;
  btnAccessResource.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
    Accessing…
  `;

  activateFlowMsg(3);
  updateFlowExplanation(
    'Client resends the request with the <code>Authorization: L402</code> header containing the macaroon and preimage…'
  );

  await delay(600);

  $<HTMLElement>('#auth-request').innerHTML = `<span class="h-key">Authorization</span>: <span class="h-val">L402 ${truncate(session.macaroon.raw, 30)}:${truncate(session.paymentProof.preimage, 20)}</span>
<span class="h-key">Host</span>: <span class="h-val">data.lightning.services</span>
<span class="h-key">Accept</span>: <span class="h-val">application/json</span>`;

  goToStep(3);

  await delay(600);

  activateFlowMsg(4);

  const mockData = getMockApiResponse();
  $<HTMLElement>('#success-response').innerHTML = highlightJSON(mockData);

  updateFlowExplanation(
    "✅ <strong>Access granted!</strong> The server verified the L402 token cryptographically \u2014 the macaroon\u2019s identifier matches the payment hash of the preimage. No database lookup needed."
  );

  stepDots.forEach((dot) => {
    dot.classList.remove('active');
    dot.classList.add('completed');
  });
});

btnReset.addEventListener('click', () => {
  session = null;
  currentStep = 0;
  goToStep(0);

  btnSendRequest.disabled = false;
  btnSendRequest.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
    Send Request
  `;

  btnPayInvoice.disabled = false;
  btnPayInvoice.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
    Pay Invoice
  `;

  btnAccessResource.disabled = true;
  btnAccessResource.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
    Access Resource
  `;

  flowMsgs.forEach((msg) => {
    msg.classList.remove('active', 'done');
  });

  updateFlowExplanation(
    'Click <strong>"Send Request"</strong> to begin the L402 authentication flow.'
  );

  $<HTMLElement>('#payment-animation').classList.remove('paid');
  $<HTMLElement>('#payment-status').textContent = 'Pending';
  $<HTMLElement>('#payment-status').classList.remove('paid');
  $<HTMLElement>('#payment-preimage').textContent = '—';
  $<HTMLElement>('#macaroon-inspector').innerHTML = `
    <div class="macaroon-empty">
      <div class="empty-icon">🎫</div>
      <p>No macaroon generated yet. Complete Step 2 to inspect the macaroon token.</p>
    </div>
  `;

  tabs.forEach((t) => t.classList.remove('active'));
  tabContents.forEach((tc) => tc.classList.remove('active'));
  tabs[0].classList.add('active');
  tabContents[0].classList.add('active');
});

btnAccessResource.disabled = true;
updateFlowExplanation(
  'Click <strong>"Send Request"</strong> to begin the L402 authentication flow.'
);
