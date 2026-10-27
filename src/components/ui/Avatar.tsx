import { cn, initials } from "@/lib/utils";

export function Avatar({
  name,
  className,
  size = "md",
}: {
  name: string | null | undefined;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span
      className={cn("avatar", size === "sm" && "avatar-sm", size === "lg" && "avatar-lg", className)}
      aria-hidden="true"
      title={name ?? undefined}
    >
      {initials(name)}
    </span>
  );
}
