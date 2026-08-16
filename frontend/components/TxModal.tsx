"use client";

type TxModalProps = {
  title?: string;
  rows: { label: string; value: string }[];
  onClose: () => void;
};

export default function TxModal({ title = "Transaction proof", rows, onClose }: TxModalProps) {
  return (
    <div
      className="dialog-backdrop"
      style={{ position: "fixed", inset: 0, zIndex: 50 }}
      onClick={onClose}
    >
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3 className="dialog-title">{title}</h3>
        <div className="dialog-body">
          {rows.map((r) => (
            <p key={r.label} style={{ margin: "0 0 8px" }}>
              <b>{r.label}</b> — {r.value}
            </p>
          ))}
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <a className="btn btn-primary" href="#" onClick={(e) => { e.preventDefault(); onClose(); }}>
            View on Monad Explorer ↗
          </a>
        </div>
      </div>
    </div>
  );
}
