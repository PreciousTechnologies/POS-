import type { SaleDetail, Settings } from "./types";
import { escapeHtml, formatDateTime, formatTZS, methodLabel } from "./utils";

export function receiptHtml(sale: SaleDetail, settings: Settings) {
  const payment = sale.payments[0];
  const itemRows = sale.items
    .map(
      (item) => `
        <tr>
          <td class="item-name">${escapeHtml(item.name)}<span class="sku">${escapeHtml(item.sku)}</span></td>
          <td class="qty">${item.qty}</td>
          <td class="amount">${escapeHtml(formatTZS(item.lineTotal))}</td>
        </tr>`,
    )
    .join("");

  const refundRows = sale.refunds
    .map(
      (refund) => `
        <div class="row refund">
          <span>Refund</span>
          <span>-${escapeHtml(formatTZS(refund.amount))}</span>
        </div>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(sale.ref)} · Receipt</title>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    * { box-sizing: border-box; }
    body {
      width: 72mm;
      margin: 0 auto;
      color: #17151d;
      font-family: "Segoe UI", Arial, sans-serif;
      font-size: 10.5px;
      line-height: 1.45;
    }
    h1 { font-size: 15px; letter-spacing: -.02em; margin: 0 0 2px; text-align: center; }
    .muted { color: #6b6677; }
    .center { text-align: center; }
    .rule { border-top: 1px dashed #a9a4b4; margin: 9px 0; }
    .meta { display: grid; gap: 2px; font-size: 10px; }
    .row { display: flex; justify-content: space-between; gap: 12px; }
    .row span:last-child { text-align: right; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .08em; color: #6b6677; padding-bottom: 4px; }
    th:nth-child(2), td.qty { text-align: center; width: 12mm; }
    th:last-child, td.amount { text-align: right; }
    td { padding: 4px 0; vertical-align: top; border-bottom: 1px dotted #ded9e7; }
    .item-name { font-weight: 600; }
    .sku { display: block; font-weight: 400; font-size: 9px; color: #777180; }
    .totals { margin-top: 8px; display: grid; gap: 4px; }
    .totals .grand { font-size: 14px; font-weight: 800; padding-top: 5px; border-top: 1px solid #17151d; }
    .refund { color: #a12929; }
    .badge { margin-top: 9px; padding: 5px 6px; border: 1px dashed #a9a4b4; text-align: center; font-size: 9px; }
    .footer { margin-top: 10px; text-align: center; font-size: 10px; white-space: pre-line; }
    .powered { margin-top: 8px; font-size: 8px; letter-spacing: .08em; text-transform: uppercase; color: #8b8598; }
  </style>
</head>
<body>
  <h1>${escapeHtml(settings.businessName)}</h1>
  <div class="center muted">${escapeHtml(settings.address ?? "Dar es Salaam, Tanzania")}</div>
  <div class="center muted">${escapeHtml(settings.phone ?? "")}${settings.phone && settings.email ? " · " : ""}${escapeHtml(settings.email ?? "")}</div>
  ${settings.tin ? `<div class="center muted">TIN ${escapeHtml(settings.tin)}</div>` : ""}
  <div class="rule"></div>

  <div class="meta">
    <div class="row"><span>Receipt</span><strong>${escapeHtml(sale.ref)}</strong></div>
    <div class="row"><span>Date</span><span>${escapeHtml(formatDateTime(sale.createdAt, settings.timezone))}</span></div>
    <div class="row"><span>Cashier</span><span>${escapeHtml(sale.cashierName)}</span></div>
    <div class="row"><span>Customer</span><span>${escapeHtml(sale.customerName ?? "Walk-in customer")}</span></div>
  </div>

  <div class="rule"></div>
  <table>
    <thead><tr><th>Item</th><th>Qty</th><th>Amount</th></tr></thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${escapeHtml(formatTZS(sale.subtotal))}</span></div>
    ${sale.discount > 0 ? `<div class="row"><span>Discount</span><span>-${escapeHtml(formatTZS(sale.discount))}</span></div>` : ""}
    ${refundRows}
    <div class="row grand"><span>Total</span><span>${escapeHtml(formatTZS(sale.total))}</span></div>
    <div class="row"><span>Paid by</span><span>${escapeHtml(methodLabel(sale.paymentMethod))}</span></div>
    ${sale.paymentMethod === "cash" ? `<div class="row"><span>Cash received</span><span>${escapeHtml(formatTZS(sale.amountReceived))}</span></div><div class="row"><span>Change</span><span>${escapeHtml(formatTZS(sale.changeDue))}</span></div>` : ""}
  </div>

  ${payment?.reference ? `<div class="badge">SIMULATED PAYMENT · ${escapeHtml(payment.reference)}</div>` : ""}
  <div class="badge">DEMO RECEIPT · Not a TRA fiscal receipt</div>

  <div class="footer">${escapeHtml(settings.receiptFooter ?? "Thank you for shopping with us.")}</div>
  <div class="center powered">Powered by Kariakoo POS</div>
  <script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); };</script>
</body>
</html>`;
}

export function printReceipt(sale: SaleDetail, settings: Settings) {
  const popup = window.open("", "_blank", "width=420,height=720");
  if (!popup) return false;
  popup.document.open();
  popup.document.write(receiptHtml(sale, settings));
  popup.document.close();
  return true;
}
