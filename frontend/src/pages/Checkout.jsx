import React from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";
import { CheckCircle, XCircle } from "@phosphor-icons/react";
import { toast } from "sonner";

export function CheckoutSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const [status, setStatus] = React.useState("checking");
  const [tries, setTries] = React.useState(0);
  const nav = useNavigate();

  React.useEffect(() => {
    if (!sessionId) { setStatus("error"); return; }
    let cancelled = false;
    const poll = async (attempt = 0) => {
      if (cancelled || attempt > 8) return;
      try {
        const { data } = await api.get(`/payments/status/${sessionId}`);
        if (data.payment_status === "paid") {
          setStatus("paid");
          toast.success("Payment successful");
        } else if (data.status === "expired") {
          setStatus("expired");
        } else {
          setTries(attempt + 1);
          setTimeout(() => poll(attempt + 1), 2000);
        }
      } catch {
        setTimeout(() => poll(attempt + 1), 2000);
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [sessionId]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center border border-[#22252A] bg-[#121417] p-12">
        {status === "checking" && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 border-2 border-[#0052FF] border-t-transparent rounded-full animate-spin" />
            <h1 className="font-display text-2xl font-bold mb-2">Verifying Payment</h1>
            <p className="text-[#8F95A3] text-sm">Polling Stripe... ({tries}/8)</p>
          </>
        )}
        {status === "paid" && (
          <>
            <CheckCircle size={64} weight="fill" color="#00E676" className="mx-auto mb-6" />
            <h1 className="font-display text-3xl font-bold mb-3">Payment Successful</h1>
            <p className="text-[#8F95A3] text-sm mb-8">Your transaction is complete. Check your dashboard for details.</p>
            <button onClick={() => nav("/dashboard")} className="btn-primary w-full" data-testid="success-go-dashboard">Go to Dashboard</button>
          </>
        )}
        {(status === "expired" || status === "error") && (
          <>
            <XCircle size={64} weight="fill" color="#FF3B30" className="mx-auto mb-6" />
            <h1 className="font-display text-2xl font-bold mb-2">Payment Failed</h1>
            <Link to="/" className="btn-ghost w-full mt-6">Back to Home</Link>
          </>
        )}
      </div>
    </div>
  );
}

export function CheckoutCancel() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center border border-[#22252A] bg-[#121417] p-12">
        <XCircle size={64} weight="fill" color="#8F95A3" className="mx-auto mb-6" />
        <h1 className="font-display text-2xl font-bold mb-2">Payment Cancelled</h1>
        <p className="text-[#8F95A3] text-sm mb-8">No charges were made.</p>
        <Link to="/" className="btn-primary w-full">Back to Home</Link>
      </div>
    </div>
  );
}
