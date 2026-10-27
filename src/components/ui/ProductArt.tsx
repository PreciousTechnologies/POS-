import type { CSSProperties } from "react";
import {
  Apple,
  Baby,
  Coffee,
  CupSoda,
  Milk,
  Package,
  ShoppingBasket,
  SprayCan,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Palette = { Icon: LucideIcon; from: string; to: string; ink: string };

const palettes: Record<string, Palette> = {
  dairy: {
    Icon: Milk,
    from: "rgba(109, 165, 203, 0.28)",
    to: "rgba(186, 220, 238, 0.44)",
    ink: "#3b7397",
  },
  grains: {
    Icon: Wheat,
    from: "rgba(209, 166, 94, 0.28)",
    to: "rgba(242, 218, 171, 0.48)",
    ink: "#9a6a25",
  },
  drinks: {
    Icon: CupSoda,
    from: "rgba(81, 151, 137, 0.24)",
    to: "rgba(176, 220, 207, 0.44)",
    ink: "#337864",
  },
  coffee: {
    Icon: Coffee,
    from: "rgba(139, 92, 59, 0.25)",
    to: "rgba(214, 180, 143, 0.44)",
    ink: "#7a4b2b",
  },
  household: {
    Icon: SprayCan,
    from: "rgba(135, 111, 178, 0.24)",
    to: "rgba(207, 192, 232, 0.44)",
    ink: "#67518e",
  },
  baby: {
    Icon: Baby,
    from: "rgba(194, 120, 144, 0.23)",
    to: "rgba(238, 196, 207, 0.46)",
    ink: "#9a5269",
  },
  produce: {
    Icon: Apple,
    from: "rgba(92, 151, 94, 0.23)",
    to: "rgba(188, 224, 174, 0.46)",
    ink: "#4a7f4d",
  },
  food: {
    Icon: ShoppingBasket,
    from: "rgba(197, 138, 82, 0.24)",
    to: "rgba(238, 208, 168, 0.46)",
    ink: "#96612e",
  },
  default: {
    Icon: Package,
    from: "rgba(111, 74, 156, 0.2)",
    to: "rgba(211, 196, 232, 0.42)",
    ink: "#6f4a9c",
  },
};

function resolvePalette(categoryName: string | undefined) {
  const value = (categoryName ?? "").toLowerCase();
  if (/(dairy|milk|yog|butter|cheese|cream)/.test(value)) return palettes.dairy;
  if (/(bakery|bread|flour|grain|rice|sugar|cereal|pasta)/.test(value)) return palettes.grains;
  if (/(coffee|tea|cocoa)/.test(value)) return palettes.coffee;
  if (/(beverage|drink|soda|juice|water|soft)/.test(value)) return palettes.drinks;
  if (/(house|clean|detergent|soap|sanit|laundry)/.test(value)) return palettes.household;
  if (/(baby|personal|health|beauty|care)/.test(value)) return palettes.baby;
  if (/(produce|fruit|vegetable|fresh|market)/.test(value)) return palettes.produce;
  if (/(food|snack|grocery|spice|oil|sauce)/.test(value)) return palettes.food;
  return palettes.default;
}

export function ProductArt({
  name,
  categoryName,
  className,
  large = false,
  compact = false,
}: {
  name: string;
  categoryName?: string;
  className?: string;
  large?: boolean;
  compact?: boolean;
}) {
  const palette = resolvePalette(categoryName);
  const style = {
    "--art-from": palette.from,
    "--art-to": palette.to,
    "--art-ink": palette.ink,
    ...(compact ? { width: 38, height: 38, aspectRatio: "auto", borderRadius: 11 } : {}),
  } as CSSProperties;
  const Icon = palette.Icon;

  return (
    <div className={cn("product-art", className)} style={style} aria-hidden="true" title={name}>
      <Icon size={compact ? 18 : large ? 42 : 28} strokeWidth={1.45} />
    </div>
  );
}
