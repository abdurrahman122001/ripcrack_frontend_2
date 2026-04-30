import React, { useEffect, useMemo, useRef, useState } from "react";

// Premium light UI demo (multi-page) — canvas preview
// Pages: Home / Shop / Product / Account / Checkout / Contact / Pricing / Attention Fraud
// Notes:
// - No online payment (orders are requested; admin confirms via email)
// - Manual brand carousel under navbar + auto-moving brand strip
// - Fraud cards expand on click + reporting + "Report fraud" form
// - Banners rotate every 3 seconds
// - All blue accents removed (emerald/slate only)

// --- Minimal self-tests (runtime) ---
function runSelfTests(opts: {
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
  if (opts.pricingPlans.some((p) => p.features.length === 0))
    errors.push("each pricing plan must have features");
  if (opts.pricingPlans.some((p) => !p.annualPrice || !p.lifetimePrice))
    errors.push("pricingPlans must have annualPrice and lifetimePrice");
  if (errors.length) throw new Error(`SelfTests failed: ${errors.join(", ")}`);
}

type Page =
  | "home"
  | "shop"
  | "product"
  | "account"
  | "checkout"
  | "contact"
  | "pricing"
  | "fraud";

type PurchaseTerm = "annual" | "lifetime";

type Brand = {
  name: string;
  // SVG as JSX — replace placeholders with real SVG logos anytime.
  svg?: React.ReactNode;
};

type ProductT = {
  id: number;
  title: string;
  category: string;
  badge: string;
  price: string;
  views: number;
  sold: number;
};

type FraudItem = {
  name: string;
  handle: string;
  platform: "Telegram" | "WhatsApp" | "Email" | "Other";
  note: string;
  reports: number;
};

export default function LightCatalogDemo() {
  const [page, setPage] = useState<Page>("home");
  const [lang, setLang] = useState<"EN" | "RU" | "IT" | "AR">("EN");
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedProductId, setSelectedProductId] = useState(1);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [bannerIdx, setBannerIdx] = useState(0);

  // Request options
  const [selectedType, setSelectedType] = useState<"Standard" | "Pro">("Standard");
  const [purchaseTerm, setPurchaseTerm] = useState<PurchaseTerm>("lifetime");

  // Pricing view toggle
  const [pricingTerm, setPricingTerm] = useState<PurchaseTerm>("lifetime");

  const categories = useMemo(
    () => ["All", "Design", "Security", "Marketing", "Automation", "AI Tools"],
    []
  );

  const products = useMemo<ProductT[]>(() => {
    return Array.from({ length: 18 }).map((_, i) => {
      const cat = categories[(i % (categories.length - 1)) + 1];
      return {
        id: i + 1,
        title: `Product ${i + 1}`,
        category: cat,
        badge: i % 7 === 0 ? "Hot" : i % 5 === 0 ? "New" : "",
        price: i % 4 === 0 ? "From $49" : "Price on request",
        views: 200 + i * 37,
        sold: 15 + i * 3,
      };
    });
  }, [categories]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedCategory === "All" || p.category === selectedCategory;
      const matchQ = !query || p.title.toLowerCase().includes(query.toLowerCase());
      return matchCat && matchQ;
    });
  }, [products, query, selectedCategory]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) || products[0],
    [products, selectedProductId]
  );

  // Increment view count on product open (demo only)
  const [productStats, setProductStats] = useState<Record<number, { views: number; sold: number }>>(
    {}
  );
  useEffect(() => {
    // initialize stats from products once
    const init: Record<number, { views: number; sold: number }> = {};
    for (const p of products) init[p.id] = { views: p.views, sold: p.sold };
    setProductStats(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (page !== "product") return;
    setProductStats((prev) => {
      const cur = prev[selectedProductId];
      if (!cur) return prev;
      return { ...prev, [selectedProductId]: { ...cur, views: cur.views + 1 } };
    });
  }, [page, selectedProductId]);

  const testimonials = useMemo(
    () => [
      {
        name: "Sabele Perfetti",
        role: "Founder & CEO (Italy)",
        text:
          "The platform is fast and clean. The email-order flow is perfect for our process.",
        initials: "SP",
      },
      {
        name: "Kamizono Suzuka",
        role: "Graphic Designer (Korea)",
        text:
          "Great support and simple checkout without payment. Easy to use on mobile too.",
        initials: "KS",
      },
      {
        name: "Dasa Tampubolon",
        role: "Founder (Indonesia)",
        text:
          "We love the multilingual UI and the chatbot. Orders arrive instantly by email.",
        initials: "DT",
      },
    ],
    []
  );

  // ✅ Brands we sell (with SVG option)
  const brands = useMemo<Brand[]>(
    () => [
      {
        name: "Gerber",
        svg: (
          <svg viewBox="0 0 120 32" className="h-6 w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="1" width="118" height="30" rx="8" stroke="currentColor" />
            <path d="M26 22c-6 0-10-3.8-10-9s4-9 10-9c3 0 5.6 1 7.4 2.8l-2.5 2.3C29.7 7.7 28 7 26 7c-3.9 0-6.3 2.4-6.3 6 0 3.6 2.4 6 6.3 6 2.9 0 4.5-1.2 5.3-2.2v-1.4H26v-3.1h9v5.5C33.6 20.3 30.6 22 26 22Z" fill="currentColor" />
            <path d="M43 21V5h6.9c3.7 0 6 2 6 5.1 0 2-1 3.6-2.7 4.4l3.1 6.5h-4l-2.6-5.7H47V21h-4Zm4-9h2.5c1.6 0 2.5-.8 2.5-2 0-1.3-.9-2-2.5-2H47v4Z" fill="currentColor" />
            <path d="M60 21V5h11v3.2h-7v3.1h6.4v3.1H64V17h7.2v4H60Z" fill="currentColor" />
          </svg>
        ),
      },
      { name: "Maxima" },
      { name: "OKI" },
      { name: "Roland" },
      { name: "ENCAD" },
      { name: "Jetrix" },
      { name: "Xerox" },
    ],
    []
  );

  // Fraud list + report counts
  const initialFraudList = useMemo<FraudItem[]>(
    () => [
      {
        name: "John Doe",
        handle: "@fake_support",
        platform: "Telegram",
        note: "Impersonating support and requesting prepayment.",
        reports: 50,
      },
      {
        name: "RipCrack Support 2",
        handle: "support-ripcrack.com",
        platform: "Email",
        note: "Fake email domain asking for crypto payments.",
        reports: 12,
      },
      {
        name: "WhatsApp Agent",
        handle: "+000 000 0000",
        platform: "WhatsApp",
        note: "Claims to be official, sends phishing links.",
        reports: 7,
      },
    ],
    []
  );
  const [fraudItems, setFraudItems] = useState<FraudItem[]>(initialFraudList);

  // "Report fraud" form state
  const [fraudForm, setFraudForm] = useState({
    name: "",
    platform: "Telegram" as FraudItem["platform"],
    handle: "",
    details: "",
    evidenceLink: "",
  });
  const [fraudFormSent, setFraudFormSent] = useState(false);

  // Pricing packages (site-aligned, no blue) — includes Annual + Lifetime pricing
  const pricingPlans = useMemo(
    () => [
      {
        name: "Cadlink Pack",
        tagline: "Great for production",
        lifetimePrice: "$450",
        annualPrice: "$99/yr",
        popular: false,
        features: [
          "Cadlink Digital Factory 10.1",
          "Maintop 5.3",
          "Adobe Photoshop 2022",
          "Adobe Illustrator 2022",
          "CorelDraw 2021",
          "24/7 Support",
        ],
        cta: "Request",
      },
      {
        name: "SAi Pack",
        tagline: "Best value",
        lifetimePrice: "$250",
        annualPrice: "$79/yr",
        popular: true,
        features: [
          "Flexi (PhotoPrint)",
          "EnRoute 7",
          "Adobe Photoshop 2022",
          "Adobe Illustrator 2022",
          "CorelDraw 2021",
          "24/7 Support",
        ],
        cta: "Select",
      },
      {
        name: "ONYX Pack",
        tagline: "Premium",
        lifetimePrice: "$490",
        annualPrice: "$119/yr",
        popular: false,
        features: [
          "ONYX",
          "Maintop 5.3",
          "Adobe Photoshop 2022",
          "Adobe Illustrator 2022",
          "CorelDraw 2021",
          "24/7 Support",
        ],
        cta: "Select",
      },
    ],
    []
  );

  const banners = useMemo(
    () => [
      { title: "Seasonal bundle", subtitle: "Limited-time offer", cta: "Shop now" },
      { title: "Support 24/7", subtitle: "Chat + WhatsApp", cta: "Contact" },
      { title: "Email orders", subtitle: "No payment gateway", cta: "Request" },
    ],
    []
  );

  useEffect(() => {
    runSelfTests({ categories, brands, banners, pricingPlans });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setInterval(() => setBannerIdx((x) => (x + 1) % banners.length), 3000);
    return () => clearInterval(t);
  }, [banners.length]);

  const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`}>{children}</div>
  );

  const SectionTitle = ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div className="mb-6">
      <div className="text-2xl font-semibold text-slate-900">{title}</div>
      {subtitle ? <div className="text-slate-600 mt-1">{subtitle}</div> : null}
    </div>
  );

  const Pill = ({ active, children, onClick }: { active?: boolean; children: React.ReactNode; onClick?: () => void }) => (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm border transition ${
        active
          ? "bg-emerald-600 text-white border-emerald-600"
          : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );

  const NavLink = ({ id, label }: { id: Page; label: string }) => (
    <button
      onClick={() => setPage(id)}
      className={`text-sm px-2 py-1 rounded-md transition ${
        page === id ? "text-emerald-700" : "text-slate-700 hover:text-slate-900"
      }`}
    >
      {label}
    </button>
  );

  function BrandChip({ b }: { b: Brand }) {
    return (
      <div className="h-11 w-40 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center px-3 text-slate-700">
        {b.svg ? <div className="text-slate-700">{b.svg}</div> : <div className="text-sm font-semibold text-slate-600">{b.name}</div>}
      </div>
    );
  }

  const ProductCard = ({ p }: { p: ProductT }) => {
    const stats = productStats[p.id] || { views: p.views, sold: p.sold };
    return (
      <div className="group">
        <Card className="overflow-hidden">
          <div className="relative">
            <div className="h-36 bg-gradient-to-br from-slate-100 to-slate-200" />
            {p.badge ? (
              <div className="absolute top-3 left-3 text-xs font-medium bg-emerald-600 text-white px-2 py-1 rounded-full">
                {p.badge}
              </div>
            ) : null}
            <div className="absolute top-3 right-3 flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition">
              <button className="h-9 w-9 rounded-full bg-white border border-slate-200 shadow-sm hover:bg-slate-50" title="Wishlist">
                ❤
              </button>
              <button className="h-9 w-9 rounded-full bg-white border border-slate-200 shadow-sm hover:bg-slate-50" title="Compare">
                ⇄
              </button>
            </div>
          </div>
          <div className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500">{p.category}</div>
              <div className="text-xs text-slate-500">👁 {stats.views} · 🛒 {stats.sold}</div>
            </div>
            <div className="text-sm font-semibold text-slate-900 mt-1 line-clamp-1">{p.title}</div>
            <div className="text-sm text-slate-700 mt-2">{p.price}</div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  setSelectedProductId(p.id);
                  setPage("product");
                }}
                className="flex-1 rounded-xl border border-slate-200 text-slate-800 py-2 text-sm hover:bg-slate-50"
              >
                View
              </button>
              <button
                onClick={() => {
                  setSelectedProductId(p.id);
                  setPage("product");
                }}
                className="flex-1 rounded-xl bg-emerald-600 text-white py-2 text-sm hover:bg-emerald-700"
              >
                Request
              </button>
            </div>
          </div>
        </Card>
      </div>
    );
  };

  function ManualBrandCarousel() {
    const scrollerRef = useRef<HTMLDivElement | null>(null);
    const scrollBy = (dx: number) => {
      scrollerRef.current?.scrollBy({ left: dx, behavior: "smooth" });
    };

    return (
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-3">
          <div className="text-xs font-semibold text-slate-500 min-w-[150px]">Brands we sell</div>
          <button
            onClick={() => scrollBy(-280)}
            className="h-9 w-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
            aria-label="Scroll left"
          >
            ‹
          </button>
          <div ref={scrollerRef} className="flex-1 overflow-x-auto scroll-smooth no-scrollbar">
            <div className="flex gap-3 min-w-max">
              {brands.map((b) => (
                <BrandChip key={b.name} b={b} />
              ))}
            </div>
          </div>
          <button
            onClick={() => scrollBy(280)}
            className="h-9 w-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
            aria-label="Scroll right"
          >
            ›
          </button>
          <style>{`
            .no-scrollbar::-webkit-scrollbar { display: none; }
            .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          `}</style>
        </div>
      </div>
    );
  }

  function Testimonials() {
    const [idx, setIdx] = useState(0);
    const t = testimonials[idx];

    const goPrev = () => setIdx((x) => (x - 1 + testimonials.length) % testimonials.length);
    const goNext = () => setIdx((x) => (x + 1) % testimonials.length);

    return (
      <Card className="p-6">
        <div className="grid md:grid-cols-3 gap-6 items-start">
          <div className="md:col-span-2">
            <div className="text-slate-600 text-sm leading-relaxed">“{t.text}”</div>
            <div className="mt-5 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-semibold">
                {t.initials}
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">{t.name}</div>
                <div className="text-xs text-slate-500">{t.role}</div>
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                onClick={goPrev}
                className="h-10 w-10 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                aria-label="Previous"
              >
                ‹
              </button>
              <button
                onClick={goNext}
                className="h-10 w-10 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                aria-label="Next"
              >
                ›
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {testimonials.map((x, i) => (
              <button
                key={x.name}
                onClick={() => setIdx(i)}
                className={`w-full text-left rounded-2xl border p-4 transition ${
                  i === idx ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="text-sm font-semibold text-slate-900 line-clamp-1">{x.name}</div>
                <div className="text-xs text-slate-500 line-clamp-1">{x.role}</div>
              </button>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  function BrandStripAuto() {
    const items = [...brands, ...brands, ...brands];
    return (
      <Card className="p-0 overflow-hidden">
        <div className="relative">
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-white to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-white to-transparent" />
          <div className="py-6">
            <div className="marquee-track">
              {items.map((b, idx) => (
                <div key={`${b.name}-${idx}`} className="mx-2">
                  <BrandChip b={b} />
                </div>
              ))}
            </div>
          </div>
          <style>{`
            .marquee-track {
              display: flex;
              width: max-content;
              animation: marquee 22s linear infinite;
              will-change: transform;
            }
            @keyframes marquee {
              0% { transform: translateX(0); }
              100% { transform: translateX(-33.333%); }
            }
            @media (prefers-reduced-motion: reduce) {
              .marquee-track { animation: none; }
            }
          `}</style>
        </div>
      </Card>
    );
  }

  const Home = () => (
    <div>
      <section className="bg-gradient-to-b from-white to-slate-50">
        <div className="max-w-7xl mx-auto px-6 py-14 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-100 px-3 py-1 rounded-full text-xs font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-600" />
              Payment-free checkout · Email confirmation
            </div>
            <h1 className="text-4xl md:text-5xl font-semibold text-slate-900 mt-4 leading-tight">
              Clean, fast catalog platform
              <span className="text-emerald-700"> with login & chatbot</span>
            </h1>
            <p className="text-slate-600 mt-4 max-w-xl">
              Marketplace-like layout, premium light UI. Users request orders; your team confirms by email.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button
                onClick={() => setPage("shop")}
                className="rounded-xl bg-emerald-600 text-white px-6 py-3 text-sm font-medium hover:bg-emerald-700"
              >
                Browse products
              </button>
              <button
                onClick={() => setPage("pricing")}
                className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-medium hover:bg-slate-50"
              >
                View pricing
              </button>
            </div>

            {/* (4) exactly 3 small cards here */}
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {["Multi-language", "Fast", "Admin panel"].map((t) => (
                <div key={t} className="bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-700">
                  {t}
                </div>
              ))}
            </div>
          </div>

          <Card className="p-4">
            <div className="rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 h-72 flex items-end justify-between p-6">
              <div>
                <div className="text-xs text-slate-500">Featured</div>
                <div className="text-xl font-semibold text-slate-900 mt-1">Seasonal bundle</div>
                <div className="text-sm text-slate-600 mt-1">Limited-time offer</div>
              </div>
              <button
                onClick={() => setPage("shop")}
                className="rounded-xl bg-white border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
              >
                Shop now
              </button>
            </div>

            {/* Banner rotator (3s) */}
            <div className="mt-4">
              <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
                <div className="p-5 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs text-slate-500">Banner</div>
                    <div className="text-lg font-semibold text-slate-900 mt-1">{banners[bannerIdx].title}</div>
                    <div className="text-sm text-slate-600 mt-1">{banners[bannerIdx].subtitle}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setBannerIdx((x) => (x - 1 + banners.length) % banners.length)}
                      className="h-9 w-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                      aria-label="Previous banner"
                    >
                      ‹
                    </button>
                    <button
                      onClick={() => setBannerIdx((x) => (x + 1) % banners.length)}
                      className="h-9 w-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                      aria-label="Next banner"
                    >
                      ›
                    </button>
                    <button
                      onClick={() => setPage(bannerIdx === 0 ? "shop" : bannerIdx === 1 ? "contact" : "checkout")}
                      className="ml-2 rounded-xl bg-slate-900 text-white px-4 py-2 text-sm hover:bg-black"
                    >
                      {banners[bannerIdx].cta}
                    </button>
                  </div>
                </div>
                <div className="px-5 pb-4 flex gap-2">
                  {banners.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setBannerIdx(i)}
                      className={`h-2.5 rounded-full transition ${
                        i === bannerIdx ? "w-10 bg-emerald-600" : "w-2.5 bg-slate-200 hover:bg-slate-300"
                      }`}
                      aria-label={`Go to banner ${i + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-12">
        <SectionTitle title="Browse by category" subtitle="Tab-style navigation." />
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <Pill key={c} active={selectedCategory === c} onClick={() => setSelectedCategory(c)}>
              {c}
            </Pill>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-5">
          {filtered.slice(0, 10).map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <button
            onClick={() => setPage("shop")}
            className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm hover:bg-slate-50"
          >
            View all products
          </button>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-10">
        <SectionTitle title="What our clients say" />
        <Testimonials />
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-16">
        <SectionTitle title="Trusted by teams" subtitle="Auto moving brand strip (SVG supported)." />
        <BrandStripAuto />
      </section>
    </div>
  );

  const Shop = () => (
    <section className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <SectionTitle title="Shop" subtitle="Search + category select." />
        <div className="flex gap-2 items-center flex-wrap">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="rounded-xl border border-slate-200 bg-white pl-3 pr-10 py-2 text-sm w-56"
            />
            {/* (7) clear X */}
            {query ? (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full hover:bg-slate-100 text-slate-500"
                aria-label="Clear search"
              >
                ✕
              </button>
            ) : null}
          </div>

          <button className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm">Sort ▾</button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-5">
        {filtered.map((p) => (
          <ProductCard key={p.id} p={p} />
        ))}
      </div>
    </section>
  );

  const Product = () => {
    const stats = productStats[selectedProduct.id] || { views: selectedProduct.views, sold: selectedProduct.sold };

    return (
      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <button onClick={() => setPage("shop")} className="hover:text-slate-700">
            Shop
          </button>
          <span>/</span>
          <span className="text-slate-700">{selectedProduct.title}</span>
        </div>

        <div className="mt-6 grid lg:grid-cols-2 gap-8">
          <Card className="p-4">
            <div className="rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 h-96" />
            <div className="mt-4 grid grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl bg-slate-50 border border-slate-200 h-20" />
              ))}
            </div>
          </Card>

          <div>
            {selectedProduct.badge ? (
              <div className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-800 border border-emerald-100 px-3 py-1 text-xs font-medium">
                {selectedProduct.badge}
              </div>
            ) : null}
            <div className="text-3xl font-semibold text-slate-900 mt-3">{selectedProduct.title}</div>
            <div className="text-sm text-slate-600 mt-2">
              Category: <span className="text-slate-800">{selectedProduct.category}</span>
            </div>

            {/* (6) views + sold */}
            <div className="mt-3 text-sm text-slate-600">👁 {stats.views} views · 🛒 {stats.sold} sold</div>

            <div className="mt-5 flex items-center gap-3">
              <div className="text-2xl font-semibold text-slate-900">{selectedProduct.price}</div>
              <div className="text-sm text-slate-500">· Email confirmation</div>
            </div>

            <Card className="mt-6 p-5">
              <div className="text-sm font-semibold text-slate-900">Request options</div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value as "Standard" | "Pro")}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="Standard">Standard</option>
                  <option value="Pro">Pro</option>
                </select>

                <select
                  value={purchaseTerm}
                  onChange={(e) => setPurchaseTerm(e.target.value as PurchaseTerm)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="lifetime">Lifetime</option>
                  <option value="annual">Annual</option>
                </select>

                <select className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                  <option>Support</option>
                  <option>Basic</option>
                  <option>Priority</option>
                </select>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setPage("checkout")}
                  className="flex-1 rounded-xl bg-emerald-600 text-white px-5 py-3 text-sm font-medium hover:bg-emerald-700"
                >
                  Request order
                </button>
                <button className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm hover:bg-slate-50">
                  Wishlist
                </button>
              </div>

              <div className="mt-3 text-xs text-slate-500">
                Selected: {selectedType} · {purchaseTerm === "lifetime" ? "Lifetime" : "Annual"}
              </div>
            </Card>
          </div>
        </div>
      </section>
    );
  };

  const Pricing = () => (
    <section className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <SectionTitle title="Pricing" subtitle="Annual and Lifetime pricing." />
        <div className="flex gap-2">
          <Pill active={pricingTerm === "annual"} onClick={() => setPricingTerm("annual")}>Annual</Pill>
          <Pill active={pricingTerm === "lifetime"} onClick={() => setPricingTerm("lifetime")}>Lifetime</Pill>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {pricingPlans.map((plan) => {
          const price = pricingTerm === "annual" ? plan.annualPrice : plan.lifetimePrice;
          const suffix = pricingTerm === "annual" ? "/yr" : "";
          return (
            <Card key={plan.name} className={`overflow-hidden ${plan.popular ? "ring-2 ring-emerald-200" : ""}`}>
              <div className="p-6 bg-gradient-to-br from-white to-slate-50 border-b border-slate-200">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-slate-900">{plan.name}</div>
                    <div className="text-sm text-slate-600 mt-1">{plan.tagline}</div>
                  </div>
                  {plan.popular ? (
                    <div className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-1 rounded-full">Popular</div>
                  ) : null}
                </div>

                <div className="mt-5 flex items-end gap-2">
                  <div className="text-4xl font-semibold text-slate-900">{price}</div>
                  <div className="text-xs text-slate-500 mb-1">{pricingTerm === "annual" ? "per year" : "lifetime"}</div>
                </div>

                <button
                  onClick={() => {
                    setPage("checkout");
                    setPurchaseTerm(pricingTerm);
                  }}
                  className={`mt-5 w-full rounded-xl px-4 py-3 text-sm font-medium ${
                    plan.popular ? "bg-slate-900 text-white hover:bg-black" : "bg-emerald-600 text-white hover:bg-emerald-700"
                  }`}
                >
                  Request ({pricingTerm === "annual" ? "Annual" : "Lifetime"})
                </button>
              </div>

              <div className="p-6">
                <div className="space-y-3">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-center gap-3 text-sm">
                      <span className="text-emerald-700">✓</span>
                      <span className="text-slate-700">{f}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-2xl bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600">
                  Email order confirmation · 24/7 Support
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );

  const Fraud = () => {
    const [openIdx, setOpenIdx] = useState<number | null>(0);

    const reportExisting = (idx: number) => {
      setFraudItems((prev) => prev.map((it, i) => (i === idx ? { ...it, reports: it.reports + 1 } : it)));
    };

    const submitNewFraud = () => {
      // Basic validation
      if (!fraudForm.name.trim() || !fraudForm.handle.trim() || !fraudForm.details.trim()) {
        alert("Please fill: Name, Handle/Contact, Details");
        return;
      }
      setFraudItems((prev) => [
        {
          name: fraudForm.name.trim(),
          platform: fraudForm.platform,
          handle: fraudForm.handle.trim(),
          note: fraudForm.details.trim().slice(0, 140),
          reports: 1,
        },
        ...prev,
      ]);
      setFraudFormSent(true);
      setFraudForm({ name: "", platform: "Telegram", handle: "", details: "", evidenceLink: "" });
      setTimeout(() => setFraudFormSent(false), 2500);
    };

    return (
      <section className="max-w-7xl mx-auto px-6 py-12">
        <SectionTitle title="Attention Fraud" subtitle="If you see fraud accounts, report them here." />

        {/* (2) Report form */}
        <Card className="p-6 mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-lg font-semibold text-slate-900">Report a fraud account</div>
              <div className="text-sm text-slate-600 mt-1">
                Fill the form — we will review and add it to the list.
              </div>
            </div>
            {fraudFormSent ? (
              <div className="text-sm bg-emerald-50 text-emerald-800 border border-emerald-100 px-3 py-2 rounded-xl">
                Submitted ✅
              </div>
            ) : null}
          </div>

          <div className="mt-5 grid md:grid-cols-2 gap-4">
            <input
              value={fraudForm.name}
              onChange={(e) => setFraudForm((s) => ({ ...s, name: e.target.value }))}
              placeholder="Fraud name / title"
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
            />
            <select
              value={fraudForm.platform}
              onChange={(e) => setFraudForm((s) => ({ ...s, platform: e.target.value as FraudItem["platform"] }))}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
            >
              <option value="Telegram">Telegram</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Email">Email</option>
              <option value="Other">Other</option>
            </select>
            <input
              value={fraudForm.handle}
              onChange={(e) => setFraudForm((s) => ({ ...s, handle: e.target.value }))}
              placeholder="@username / phone / email"
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
            />
            <input
              value={fraudForm.evidenceLink}
              onChange={(e) => setFraudForm((s) => ({ ...s, evidenceLink: e.target.value }))}
              placeholder="Evidence link (optional)"
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
            />
          </div>
          <textarea
            value={fraudForm.details}
            onChange={(e) => setFraudForm((s) => ({ ...s, details: e.target.value }))}
            placeholder="Details: what happened, date, payment request, links, screenshots..."
            className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm min-h-[110px]"
          />
          <div className="mt-4 flex gap-2">
            <button
              onClick={submitNewFraud}
              className="rounded-xl bg-slate-900 text-white px-5 py-3 text-sm hover:bg-black"
            >
              Submit report
            </button>
            <button
              onClick={() => setFraudForm({ name: "", platform: "Telegram", handle: "", details: "", evidenceLink: "" })}
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm hover:bg-slate-50"
            >
              Clear
            </button>
          </div>
        </Card>

        <div className="grid md:grid-cols-3 gap-6">
          {fraudItems.map((x, i) => {
            const isOpen = openIdx === i;
            const initials = x.name
              .split(" ")
              .slice(0, 2)
              .map((p) => p[0]?.toUpperCase())
              .join("");

            return (
              <div
                key={`${x.name}-${x.handle}-${i}`}
                role="button"
                tabIndex={0}
                onClick={() => setOpenIdx((cur) => (cur === i ? null : i))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOpenIdx((cur) => (cur === i ? null : i));
                  }
                }}
                className="text-left cursor-pointer"
              >
                <Card className="p-5 hover:shadow-md transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="h-11 w-11 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-sm font-semibold text-slate-600">
                        {initials}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{x.name}</div>
                        <div className="mt-1 text-sm text-slate-600">
                          <span className="font-medium text-slate-700">{x.platform}:</span> {x.handle}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs bg-red-50 text-red-700 border border-red-100 px-2 py-1 rounded-full">Fraud</div>
                  </div>

                  <div className="mt-3 text-sm text-slate-600 line-clamp-2">{x.note}</div>

                  {/* (5) show report count */}
                  <div className="mt-3 text-xs text-slate-500">🚩 Reported by {x.reports} people</div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-xs text-slate-500">Tap to {isOpen ? "hide" : "view"} details</div>
                    <div className="text-slate-400 text-lg">{isOpen ? "–" : "+"}</div>
                  </div>

                  {isOpen ? (
                    <div className="mt-4">
                      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                        <div className="text-sm font-semibold text-slate-900">Details</div>
                        <div className="mt-2 text-sm text-slate-600 leading-relaxed">
                          Example extra info: scam method, date reported, links/screenshots.
                        </div>

                        <div className="mt-4">
                          <div className="text-xs text-slate-500 mb-2">Evidence screenshot (optional)</div>
                          <div className="h-28 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-xs text-slate-500">
                            Upload screenshot here
                          </div>
                        </div>

                        <div className="mt-4 flex gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard?.writeText(`${x.platform}: ${x.handle}`);
                            }}
                            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50"
                          >
                            Copy
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              reportExisting(i);
                            }}
                            className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm hover:bg-black"
                          >
                            Report
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </Card>
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  const Account = () => (
    <section className="max-w-5xl mx-auto px-6 py-12">
      <div className="grid lg:grid-cols-2 gap-8 items-start">
        <Card className="p-6">
          <div className="text-xl font-semibold text-slate-900">Login</div>
          <div className="text-sm text-slate-600 mt-1">Access your orders and wishlist.</div>
          <div className="mt-5 space-y-3">
            <input placeholder="Email" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
            <input type="password" placeholder="Password" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
            <button className="w-full rounded-xl bg-slate-900 text-white py-3 text-sm hover:bg-black">Sign in</button>
            <button className="w-full rounded-xl border border-slate-200 bg-white py-3 text-sm hover:bg-slate-50">Continue with email code</button>
          </div>
        </Card>

        <Card className="p-6">
          <div className="text-xl font-semibold text-slate-900">Create account</div>
          <div className="text-sm text-slate-600 mt-1">Register to save your order history.</div>
          <div className="mt-5 space-y-3">
            <input placeholder="Full name" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
            <input placeholder="Email" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
            <input type="password" placeholder="Password" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
            <button className="w-full rounded-xl bg-emerald-600 text-white py-3 text-sm hover:bg-emerald-700">Create account</button>
          </div>
        </Card>
      </div>
    </section>
  );

  const Checkout = () => (
    <section className="max-w-7xl mx-auto px-6 py-12">
      <div className="grid lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2">
          <SectionTitle title="Checkout" subtitle="No payment — order is confirmed via email." />
          <Card className="p-6">
            <div className="grid md:grid-cols-2 gap-4">
              <input placeholder="Full name" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
              <input placeholder="Email address" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
              <input placeholder="Phone (optional)" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
              <select className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                <option>Preferred language</option>
                <option>English</option>
                <option>Russian</option>
                <option>Italian</option>
                <option>Arabic</option>
              </select>
            </div>

            <div className="mt-4 grid sm:grid-cols-2 gap-4">
              <select value={selectedType} onChange={(e) => setSelectedType(e.target.value as "Standard" | "Pro")} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                <option value="Standard">Standard</option>
                <option value="Pro">Pro</option>
              </select>
              <select value={purchaseTerm} onChange={(e) => setPurchaseTerm(e.target.value as PurchaseTerm)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                <option value="lifetime">Lifetime</option>
                <option value="annual">Annual</option>
              </select>
            </div>

            <textarea placeholder="Order notes" className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm min-h-[110px]" />
            <div className="mt-5 flex flex-wrap gap-3">
              <button className="rounded-xl bg-emerald-600 text-white px-6 py-3 text-sm font-medium hover:bg-emerald-700">Place order (Email confirmation)</button>
              <button onClick={() => setPage("shop")} className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm hover:bg-slate-50">Back to shop</button>
            </div>
            <div className="text-xs text-slate-500 mt-3">After you place the order, the system emails the order summary to you and to the admin team.</div>
          </Card>
        </div>

        <div>
          <SectionTitle title="Order summary" />
          <Card className="p-6">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-600">Product</span><span className="text-slate-900 font-medium">{selectedProduct.title}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">Type</span><span className="text-slate-900 font-medium">{selectedType}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">Term</span><span className="text-slate-900 font-medium">{purchaseTerm === "lifetime" ? "Lifetime" : "Annual"}</span></div>
              <div className="h-px bg-slate-200" />
              <div className="flex justify-between"><span className="text-slate-600">Delivery</span><span className="text-slate-900 font-medium">Email</span></div>
            </div>
            <div className="mt-5 rounded-2xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-700">
              <div className="font-semibold text-slate-900">Email confirmation</div>
              <div className="mt-1 text-slate-600">Your team can contact the customer after the order is submitted.</div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );

  const Contact = () => (
    <section className="max-w-6xl mx-auto px-6 py-12">
      <SectionTitle title="Contact" subtitle="Let users reach you easily (also via chatbot)." />
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="text-sm font-semibold text-slate-900">Send a message</div>
          <div className="mt-4 space-y-3">
            <input placeholder="Name" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
            <input placeholder="Email" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
            <textarea placeholder="Message" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm min-h-[120px]" />
            <button className="rounded-xl bg-slate-900 text-white px-6 py-3 text-sm hover:bg-black">Send</button>
          </div>
        </Card>
        <Card className="p-6">
          <div className="text-sm font-semibold text-slate-900">Support</div>
          <div className="text-sm text-slate-600 mt-2">support@example.com</div>
          <div className="text-sm text-slate-600 mt-1">WhatsApp · 24/7</div>
          <div className="mt-6 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 h-56" />
        </Card>
      </div>
    </section>
  );

  const PageBody = () => {
    if (page === "home") return <Home />;
    if (page === "shop") return <Shop />;
    if (page === "product") return <Product />;
    if (page === "pricing") return <Pricing />;
    if (page === "fraud") return <Fraud />;
    if (page === "account") return <Account />;
    if (page === "checkout") return <Checkout />;
    return <Contact />;
  };

  // Header search clear
  const HeaderSearch = () => (
    <div className="hidden md:flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
      <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="text-sm bg-transparent outline-none">
        {categories.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <div className="h-5 w-px bg-slate-200" />
      <div className="relative">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products" className="text-sm outline-none w-48 pr-8" />
        {query ? (
          <button onClick={() => setQuery("")} className="absolute right-0 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full hover:bg-slate-100 text-slate-500" aria-label="Clear search">✕</button>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Topbar */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-between text-xs text-slate-600">
          <div className="flex gap-3 items-center">
            <span>support@example.com</span>
            <span className="h-3 w-px bg-slate-200" />
            <span>WhatsApp 24/7</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-emerald-700 font-medium">No online payment</span>
            <span className="h-3 w-px bg-slate-200" />
            <span>Email order confirmation</span>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <button onClick={() => setPage("home")} className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-emerald-600" />
            <div className="text-lg font-semibold text-slate-900">YourBrand</div>
          </button>

          <nav className="hidden md:flex items-center gap-4">
            <NavLink id="home" label="Home" />
            <NavLink id="shop" label="Shop" />
            <NavLink id="pricing" label="Pricing" />
            <NavLink id="fraud" label="Attention Fraud" />
            <NavLink id="contact" label="Contact" />
          </nav>

          <div className="flex items-center gap-3">
            <HeaderSearch />
            <button
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
              onClick={() => setLang((x) => (x === "EN" ? "RU" : x === "RU" ? "IT" : x === "IT" ? "AR" : "EN"))}
              title="Change language"
            >
              {lang} ▾
            </button>
            <button onClick={() => setPage("account")} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50">
              Account
            </button>
            <button onClick={() => setPage("checkout")} className="rounded-xl bg-slate-900 text-white px-3 py-2 text-sm hover:bg-black">
              Cart · 2
            </button>
          </div>
        </div>
      </header>

      {/* Manual logo carousel under navbar (SVG supported) */}
      <ManualBrandCarousel />

      {/* Content */}
      <PageBody />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-10 grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-emerald-600" />
              <div className="text-lg font-semibold text-slate-900">YourBrand</div>
            </div>
            <div className="text-sm text-slate-600 mt-3">Custom catalog platform with login, email orders and chatbot.</div>
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">Resources</div>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <button onClick={() => setPage("pricing")} className="block hover:text-slate-900">Pricing</button>
              <button onClick={() => setPage("fraud")} className="block hover:text-slate-900">Attention Fraud</button>
              <button onClick={() => setPage("contact")} className="block hover:text-slate-900">Contact</button>
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">Information</div>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <div>About</div>
              <div>F.A.Q</div>
              <div>Privacy Policy</div>
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">Subscribe</div>
            <div className="text-sm text-slate-600 mt-2">Please enter email address to manage subscriptions.</div>
            <div className="mt-3 flex gap-2">
              <input placeholder="example@domain.com" className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
              <button className="rounded-xl bg-emerald-600 text-white px-4 py-3 text-sm hover:bg-emerald-700">Subscribe</button>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-200">
          <div className="max-w-7xl mx-auto px-6 py-4 text-xs text-slate-500 flex justify-between">
            <span>© {new Date().getFullYear()} YourBrand. All rights reserved.</span>
            <span>Language: {lang}</span>
          </div>
        </div>
      </footer>

      {/* Chat widget */}
      <div className="fixed bottom-6 right-6 z-50">
        {isChatOpen ? (
          <div className="w-[320px] bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900 text-white">
              <div className="text-sm font-semibold">Support Chat</div>
              <button onClick={() => setIsChatOpen(false)} className="text-sm">✕</button>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <div className="text-slate-600">Hi! How can I help you?</div>
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 text-slate-700">Try: “How do orders work?”</div>
              <div className="flex gap-2">
                <input placeholder="Type your message..." className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                <button className="rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm hover:bg-emerald-700">Send</button>
              </div>
              <div className="text-xs text-slate-500">In the real build, this connects to your chatbot backend (FAQ + AI + operator).</div>
            </div>
          </div>
        ) : (
          <button onClick={() => setIsChatOpen(true)} className="h-14 w-14 rounded-full bg-emerald-600 text-white shadow-lg hover:bg-emerald-700" title="Chat">💬</button>
        )}
      </div>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40">
        <div className="max-w-7xl mx-auto px-4 py-2 flex justify-around text-xs">
          <button onClick={() => setPage("home")} className="py-2">Home</button>
          <button onClick={() => setPage("shop")} className="py-2">Shop</button>
          <button onClick={() => setPage("pricing")} className="py-2">Pricing</button>
          <button onClick={() => setPage("fraud")} className="py-2">Fraud</button>
        </div>
      </div>
    </div>
  );
}
