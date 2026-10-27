import { Printer } from "lucide-react";
import { toast } from "sonner";
import type { SaleDetail, Settings } from "@/lib/types";
import { formatDateTime, formatTZS, methodLabel } from "@/lib/utils";
import { printReceipt } from "@/lib/receipt";
import { Modal } from "./Modal";
import { Button } from "./Button";

export function ReceiptPreview({ sale, settings }: { sale: SaleDetail; settings: Settings }) {
  const payment = sale.payments[0];
  return (
    <div className="receipt-preview">
      <div className="receipt-center" style={{ fontSize: 13, fontWeight: 700 }}>
        {settings.businessName}
      </div>
      <div className="receipt-center receipt-muted">{settings.address ?? "Dar es Salaam, Tanzania"}</div>
      {settings.phone && <div className="receipt-center receipt-muted">{settings.phone}</div>}
      {settings.tin && <div className="receipt-center receipt-muted">TIN {settings.tin}</div>}
      <div className="receipt-rule" />
      <div className="receipt-row">
        <span className="receipt-muted">Receipt</span>
        <span>{sale.ref}</span>
      </div>
      <div className="receipt-row">
        <span className="receipt-muted">Date</span>
        <span>{formatDateTime(sale.createdAt, settings.timezone)}</span>
      </div>
      <div className="receipt-row">
        <span className="receipt-muted">Cashier</span>
        <span>{sale.cashierName}</span>
      </div>
      <div className="receipt-row">
        <span className="receipt-muted">Customer</span>
        <span>{sale.customerName ?? "Walk-in customer"}</span>
      </div>
      <div className="receipt-rule" />
      {sale.items.map((item) => (
        <div key={item.id} style={{ marginBottom: 5 }}>
          <div>{item.name}</div>
          <div className="receipt-row receipt-muted">
            <span>
              {item.qty} × {formatTZS(item.unitPrice)}
            </span>
            <span style={{ color: "#17131d" }}>{formatTZS(item.lineTotal)}</span>
          </div>
        </div>
      ))}
      <div className="receipt-rule" />
      <div className="receipt-row">
        <span className="receipt-muted">Subtotal</span>
        <span>{formatTZS(sale.subtotal)}</span>
      </div>
      {sale.discount > 0 && (
        <div className="receipt-row">
          <span className="receipt-muted">Discount</span>
          <span>-{formatTZS(sale.discount)}</span>
        </div>
      )}
      {sale.refunds.map((refund) => (
        <div className="receipt-row" key={refund.id} style={{ color: "#a12929" }}>
          <span>Refund</span>
          <span>-{formatTZS(refund.amount)}</span>
        </div>
      ))}
      <div className="receipt-row receipt-total">
        <span>Total</span>
        <span>{formatTZS(sale.total)}</span>
      </div>
      <div className="receipt-row">
        <span className="receipt-muted">Paid by</span>
        <span>{methodLabel(sale.paymentMethod)}</span>
      </div>
      {sale.paymentMethod === "cash" && (
        <>
          <div className="receipt-row">
            <span className="receipt-muted">Cash received</span>
            <span>{formatTZS(sale.amountReceived)}</span>
          </div>
          <div className="receipt-row">
            <span className="receipt-muted">Change</span>
            <span>{formatTZS(sale.changeDue)}</span>
          </div>
        </>
      )}
      {payment?.reference && (
        <>
          <div className="receipt-rule" />
          <div className="receipt-center receipt-muted">SIMULATED · {payment.reference}</div>
        </>
      )}
      <div className="receipt-rule" />
      <div className="receipt-center receipt-muted" style={{ fontSize: 9 }}>
        DEMO RECEIPT · Not a TRA fiscal receipt
      </div>
      <div className="receipt-center" style={{ marginTop: 9, whiteSpace: "pre-line" }}>
        {settings.receiptFooter ?? "Thank you for shopping with us."}
      </div>
    </div>
  );
}

export function ReceiptModal({
  open,
  onClose,
  sale,
  settings,
}: {
  open: boolean;
  onClose: () => void;
  sale: SaleDetail | null;
  settings: Settings;
}) {
  if (!sale) return null;

  const handlePrint = () => {
    if (!printReceipt(sale, settings)) {
      toast.error("The print window was blocked. Allow pop-ups for this site and try again.");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Sale receipt"
      description={`${sale.ref} · ${formatTZS(sale.total)}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handlePrint} leftIcon={<Printer size={14} />}>
            Print receipt
          </Button>
        </>
      }
    >
      <ReceiptPreview sale={sale} settings={settings} />
    </Modal>
  );
}
