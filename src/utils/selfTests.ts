// --- Minimal self-tests (runtime) ---
export function runSelfTests(opts: {
  categories: string[];
  brands: { name: string }[];
  banners: { title: string; subtitle: string; cta: string }[];
  pricingPlans: { name: string; features: string[]; annualPrice: string; lifetimePrice: string }[];
}) {
  const errors: string[] = [];
  if (!opts.categories.includes("All")) errors.push("categories must include 'All'");
  if (opts.brands.length < 3) errors.push("brands must have at least 3 items");
  if (opts.banners.length < 2) errors.push("banners must have at least 2 items");
  if (opts.pricingPlans.length < 1) errors.push("pricingPlans must have at least 1 plan");
  if (opts.pricingPlans.some((p) => p.features.length === 0)) errors.push("each pricing plan must have features");
  if (opts.pricingPlans.some((p) => !p.annualPrice || !p.lifetimePrice))
    errors.push("pricingPlans must have annualPrice and lifetimePrice");
  if (errors.length) throw new Error(`SelfTests failed: ${errors.join(", ")}`);
}
