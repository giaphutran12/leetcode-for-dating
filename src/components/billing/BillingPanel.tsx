"use client";

import { CreditCard, Lightning } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { BrandButton, BrandKicker } from "@/design-system";
import {
  createBillingPortal,
  createCheckout,
  loadBillingStatus,
  type BillingPlan,
} from "../../api/billingClient";

type Status = Awaited<ReturnType<typeof loadBillingStatus>>;

export function BillingPanel() {
  const [status, setStatus] = useState<Status>();
  const [working, setWorking] = useState<BillingPlan | "portal">();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void loadBillingStatus().then((next) => {
      if (active) setStatus(next);
    });
    return () => {
      active = false;
    };
  }, []);

  async function checkout(plan: BillingPlan) {
    setError(undefined);
    setWorking(plan);
    const result = await createCheckout(plan);
    if (!result.ok) {
      setError(result.message);
      setWorking(undefined);
      return;
    }
    window.location.assign(result.url);
  }

  async function openPortal() {
    setError(undefined);
    setWorking("portal");
    const result = await createBillingPortal();
    if (!result.ok) {
      setError(result.message);
      setWorking(undefined);
      return;
    }
    window.location.assign(result.url);
  }

  return (
    <section aria-labelledby="billing-title">
      <BrandKicker>RizzCode Pro</BrandKicker>
      <h2 id="billing-title">
        {status?.ok && status.accessLevel === "admin"
          ? "Admin access is active."
          : status?.ok && status.paid
            ? "Your plan is active."
            : "Keep training."}
      </h2>
      {!status ? (
        <p role="status">Checking your practice access…</p>
      ) : !status.ok ? (
        <p className="rizz-auth__error" role="alert">
          {status.message}
        </p>
      ) : status.accessLevel === "admin" ? (
        <p>Full guided practice is unlocked for this account.</p>
      ) : status.paid ? (
        <>
          <p>
            Standard guided practice is active
            {status.cancelAtPeriodEnd
              ? " until the end of your current billing period."
              : "."}
          </p>
          <div className="rizz-account__actions">
            <BrandButton
              intent="secondary"
              type="button"
              onClick={openPortal}
              disabled={Boolean(working)}
            >
              <CreditCard size={18} />
              {working === "portal" ? "Opening…" : "Manage billing"}
            </BrandButton>
          </div>
        </>
      ) : (
        <>
          <p>
            {status.freeCreditsRemaining === 0
              ? "0 free unique practices left. Subscribe to keep training."
              : `${status.freeCreditsRemaining} free unique practice${status.freeCreditsRemaining === 1 ? "" : "s"} left. Subscribe when the free reps are done.`}
          </p>
          <div className="rizz-account__actions">
            <BrandButton
              intent="lime"
              type="button"
              onClick={() => checkout("monthly")}
              disabled={Boolean(working)}
            >
              <Lightning size={18} weight="fill" />
              {working === "monthly"
                ? "Opening…"
                : `${status.plans.monthly.displayPrice} monthly`}
            </BrandButton>
            <BrandButton
              intent="secondary"
              type="button"
              onClick={() => checkout("annual")}
              disabled={Boolean(working)}
            >
              <CreditCard size={18} />
              {working === "annual"
                ? "Opening…"
                : `${status.plans.annual.displayPrice} yearly`}
            </BrandButton>
          </div>
        </>
      )}
      {error && (
        <p className="rizz-auth__error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
