// ─── Liquid type definitions ──────────────────────────────────────────────────
// `factor` is the hydration effectiveness (0–1). A factor of 0.7 for coffee
// means 8 fl oz of coffee counts as 5.6 fl oz toward the daily water goal.

export interface LiquidType {
  id: string;
  label: string;
  factor: number;
  icon: string; // Ionicons icon name
  color: string; // accent hex used for chips and badges
}

export const LIQUID_TYPES: LiquidType[] = [
  { id: "water",   label: "Water",        factor: 1.0,  icon: "water-outline",     color: "#0EA5E9" },
  { id: "tea",     label: "Tea",          factor: 0.9,  icon: "leaf-outline",      color: "#10B981" },
  { id: "coffee",  label: "Coffee",       factor: 0.7,  icon: "cafe-outline",      color: "#92400E" },
  { id: "juice",   label: "Juice",        factor: 0.85, icon: "nutrition-outline", color: "#F59E0B" },
  { id: "sports",  label: "Sports Drink", factor: 0.9,  icon: "flash-outline",     color: "#8B5CF6" },
  { id: "soda",    label: "Soda",         factor: 0.8,  icon: "beer-outline",      color: "#6366F1" },
  { id: "alcohol", label: "Alcohol",      factor: 0.0,  icon: "wine-outline",      color: "#EF4444" },
];

/** Returns the LiquidType for a given id, falling back to water if not found. */
export function getLiquidType(id?: string): LiquidType {
  return LIQUID_TYPES.find((t) => t.id === id) ?? LIQUID_TYPES[0];
}

/** Computes effective hydration oz for a given raw amount and liquid type id. */
export function effectiveOz(amountOz: number, liquidTypeId?: string): number {
  return amountOz * getLiquidType(liquidTypeId).factor;
}
