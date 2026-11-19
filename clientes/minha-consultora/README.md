# Minha Consultora
New isolated consultant storefront and order management app inside LT Soluções. Source path: clientes/minha-consultora/. Backend: lt-beauty in the existing LT Supabase project. Other applications and their data are unchanged.

## Owner workflow
Activate the prepared owner login, then configure her name, phone, maximum installments (1–24), minimum installment value, payment methods and cycle validity. Initial installment limit is one; the consultant chooses her own limit.
The NOV/DEZ 2026 catalog is preloaded as drafts. Review product/variant, exact price and source page before publishing. A reviewed variant activates its parent product. Kits require an explicit fulfillment choice: buy as a complete kit or link each component to an exact catalog variant.
Conditional promotions require an explicit qualifying variant and discounted price; one discount per qualifying unit.
Create customer records with name, phone and delivery details. Copy/share each individual catalog link. Each customer link reveals only that customer's order history.
Select received orders to prepare a consolidated purchase batch. A batch marks those orders as ordered and prevents double purchasing. Record quantities actually received, allocate within received stock to individual clients, and then mark deliveries.
Mark installment receipts separately; existing orders preserve the agreed terms and prices.
The app records order/payment agreements. It does not charge cards, process Pix or place orders on the Mary Kay website.

## PDF import
The supplied 72-page catalog is identified by SHA-256 and has an audited deterministic seed: 182 parent products, 336 variants and 34 kits, all drafts. Current media includes 30 verified product photos (some shared color-family photos marked illustrative) and 61 source-page previews. Official SKUs are absent and were not invented.
Other PDFs are read in the browser with PDF.js 4.10.38 from a pinned CDN path. Native text coordinates generate conservative draft candidates; a rendered source preview is saved for review. This is not a universal autonomous OCR/vision importer. Ambiguous shades, split-page associations, promotions and images require checking. Unknown/scanned layouts may require manual product entry. No extracted candidate is automatically published.
Imports are resumable by source hash and saved pages. Exact normalized identity matches stage revised values as unpublished drafts while preserving historical order snapshots; uncertain matches remain separate drafts.

## Security and notifications
Private service-only RLS tables; anonymous/authenticated direct table grants revoked. PBKDF2-SHA256 passwords (150k iterations), hashed expiring sessions, one-use owner setup, server-side capability checks for customer links, login/request rate limits, server-recalculated amounts and compare-and-swap state updates. Customer links are private capabilities and should not be posted publicly.
No server keys are included in static assets. Imported/catalog images are public media; customer records and orders are private.
Web Push uses web-push@3.6.7 and service-only VAPID configuration. Enable on each supported device using the UI. Without active browser permission/subscription, orders remain visible in the polling dashboard. Browser/device delivery still needs device verification.
The app needs internet to submit customer orders and synchronize management data. A saved cart persists in the customer's browser if connectivity fails.

## Validation
node tests.mjs: exact variants, installment cents, idempotency, immutable ordered identities/terms, batch membership, receipt/allocation limits and delivery checks.
integration-tests.mjs: supply a disposable test account setup object on stdin. Tested live Edge/DB: setup once, login/logout, private state, client isolation, three clients, idempotency, exact 3+1 purchase list, batch once, partial receipt, allocations, delivery, receipt marks and VAPID public key.
Do not commit any provisioning tokens, credentials or temporary test customer links.
Physical device push, actual client use and manual source/catalog approval remain owner acceptance steps.

