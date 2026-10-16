import React, { useState } from "react";
import { send } from "../api";
export function GrowthSandboxCheckout({
  order,
  readiness,
  busy,
  action,
}: {
  order: any;
  readiness: any;
  busy: boolean;
  action: (fn: () => Promise<any>, message?: string) => Promise<void>;
}) {
  const [confirmed, setConfirmed] = useState(false),
    [provider, setProvider] = useState("SQUAD"),
    [checkout, setCheckout] = useState("");
  const providers = readiness?.providers,
    configured = providers?.[provider]?.configured;
  if (order.status !== "ACCEPTED" && !order.sandboxPayments?.length)
    return null;
  return (
    <details className="gx-panel">
      <summary>Sandbox payment testing — no live funding</summary>
      <p>
        Optional integration testing only. Use only payment-provider test
        details. A verified sandbox payment does not add cash, pay workers, or
        start a campaign. Never use a real card here.
      </p>
      {order.status === "ACCEPTED" && (
        <>
          <div className="gx-field">
            <label htmlFor="growth-sandbox-provider">Sandbox provider</label>
            <select
              id="growth-sandbox-provider"
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value);
                setConfirmed(false);
                setCheckout("");
              }}
            >
              <option value="SQUAD">Squad — primary</option>
              <option value="KORA">Kora — backup after reconciliation</option>
            </select>
          </div>
          {!configured ? (
            <p className="gx-muted">
              This provider’s sandbox credentials are not configured. Live keys
              are not accepted.
            </p>
          ) : (
            <>
              <label className="gx-check">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                I understand this is a sandbox test, not a real payment or
                campaign purchase.
              </label>
              <button
                className="gx-button secondary"
                disabled={busy || !confirmed}
                onClick={() =>
                  action(async () => {
                    const result = await send(
                      `/growth/${order.id}/sandbox-checkout`,
                      { provider, confirmSandbox: true },
                    );
                    setCheckout(result.checkoutUrl);
                  }, "Sandbox checkout created. No live funds moved.")
                }
              >
                Create sandbox checkout
              </button>
            </>
          )}
          {checkout && (
            <p>
              <a
                className="gx-button secondary"
                href={checkout}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open provider’s sandbox checkout
              </a>
            </p>
          )}
        </>
      )}
      {order.sandboxPayments?.map((payment: any) => (
        <div className="gx-post" key={payment.reference}>
          <strong>
            {payment.provider} sandbox · {payment.status.toLowerCase()}
          </strong>
          <p className="gx-muted">Reference: {payment.reference}</p>
          <button
            className="gx-button secondary small"
            disabled={busy}
            onClick={() =>
              action(async () => {
                const result = await send(
                  `/growth-payments/${payment.reference}/verify`,
                  {},
                );
                if (result.status !== "VERIFIED")
                  throw Error(
                    `Sandbox verification result: ${result.status.toLowerCase()}. No live funds moved.`,
                  );
              }, "Sandbox payment verified. This does not fund or start live work.")
            }
          >
            Verify test payment with provider
          </button>
        </div>
      ))}
    </details>
  );
}
