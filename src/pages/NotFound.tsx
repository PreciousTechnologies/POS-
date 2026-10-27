import { useNavigate } from "react-router-dom";
import { ArrowLeft, Compass, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="page-shell">
      <div className="flex min-h-[62vh] flex-col items-center justify-center text-center">
        <div
          className="relative mb-5 grid h-24 w-24 place-items-center rounded-[30px]"
          style={{
            background: "var(--primary-soft)",
            color: "var(--primary)",
            boxShadow: "0 28px 60px -35px var(--primary)",
          }}
        >
          <span className="font-display text-3xl font-bold tracking-tight">404</span>
          <span
            className="absolute -bottom-1.5 -right-1.5 grid h-8 w-8 place-items-center rounded-full"
            style={{ background: "var(--surface-solid)", border: "1px solid var(--border)", color: "var(--text-soft)" }}
          >
            <Compass size={15} />
          </span>
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">This aisle doesn’t exist.</h1>
        <p className="mt-2 max-w-[390px] text-[12px] leading-relaxed muted">
          The page may have moved, or the link is incomplete. Head back to the dashboard and keep the shop moving.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Button onClick={() => navigate("/dashboard")} leftIcon={<LayoutDashboard size={14} />}>
            Go to dashboard
          </Button>
          <Button variant="secondary" onClick={() => navigate(-1)} leftIcon={<ArrowLeft size={14} />}>
            Go back
          </Button>
        </div>
      </div>
    </div>
  );
}
