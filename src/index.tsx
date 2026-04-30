import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, memo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

// Types
import type { Page, Lang, Brand, ProductT, CartItemT, FraudItem, TestimonialT } from "./types";

// Components
import { TestimonialsSection } from "./components/TestimonialsSection";
import { HeaderSearch } from "./components/HeaderSearch";

// Constants
import { translations } from "./constants/translations";

// Utils
import { runSelfTests } from "./utils/selfTests";

// Translations moved to constants/translations.ts - using imported translations

// TestimonialsSection moved to components/TestimonialsSection.tsx
// HeaderSearch moved to components/HeaderSearch.tsx

// BrandChip component - moved outside to prevent recreation on each render
const BrandChip = memo(({ b }: { b: Brand }) => {
  const isSvg = b.logo?.toLowerCase().endsWith('.svg');
  return (
    <div className="h-10 sm:h-14 min-w-[120px] sm:min-w-[160px] rounded-xl sm:rounded-2xl bg-slate-50 overflow-hidden relative">
      {b.logo ? (
        isSvg ? (
          // SVG: use object-contain to preserve aspect ratio and center it
          <div className="h-full w-full flex items-center justify-center p-2 sm:p-3 bg-white">
            <img 
              src={b.logo} 
              alt={b.name} 
              className="h-full w-full object-contain"
              style={{ maxWidth: '100%', maxHeight: '100%' }}
            />
          </div>
        ) : (
          // Raster images: use object-cover to fill the container
          <img 
            src={b.logo} 
            alt={b.name} 
            className="h-full w-full object-cover"
          />
        )
      ) : (
        <div className="h-full w-full flex items-center justify-center px-3 sm:px-5">
          <div className="text-xs sm:text-sm font-semibold text-slate-600">{b.name}</div>
        </div>
      )}
    </div>
  );
});

// Global styles for marquee - defined once to prevent recreation
if (typeof document !== 'undefined' && !document.getElementById('marquee-styles')) {
  const style = document.createElement('style');
  style.id = 'marquee-styles';
  style.textContent = `
    .marquee-track-persistent {
      display: flex;
      width: max-content;
      animation: marquee-persistent 120s linear infinite;
      will-change: transform;
    }
    @keyframes marquee-persistent {
      0% { transform: translateX(0); }
      100% { transform: translateX(-33.333%); }
    }
    @media (prefers-reduced-motion: reduce) {
      .marquee-track-persistent { animation: none; }
    }
    .no-scrollbar::-webkit-scrollbar { 
      display: none !important; 
      width: 0 !important;
      height: 0 !important;
    }
    .no-scrollbar { 
      -ms-overflow-style: none !important; 
      scrollbar-width: none !important;
    }
  `;
  document.head.appendChild(style);
}

// ManualBrandCarousel component - moved outside to prevent recreation on each render
// This preserves scroll position when parent re-renders
// Can be used with or without title (for "Brands we sell" vs "Trusted by teams")
const ManualBrandCarousel = memo(({ brands, title, showTitle = true }: { brands: Brand[]; title: string; showTitle?: boolean }) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const scrollBy = useCallback((dx: number) => {
    scrollerRef.current?.scrollBy({ left: dx, behavior: "smooth" });
  }, []);

  return (
    <div className={showTitle ? "bg-white border-b border-slate-200" : "bg-white"}>
      <div className={`max-w-7xl mx-auto ${showTitle ? 'px-3 sm:px-6 py-2 sm:py-3' : 'px-3 sm:px-6 py-4 sm:py-6'} flex items-center gap-2 sm:gap-3`}>
        {showTitle && title && (
          <div className="text-[10px] sm:text-xs font-semibold text-slate-500 min-w-[100px] sm:min-w-[150px]">{title}</div>
        )}
        <button
          onClick={() => scrollBy(-280)}
          className="h-7 w-7 sm:h-9 sm:w-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex-shrink-0 text-sm sm:text-base"
          aria-label="Scroll left"
        >
          ‹
        </button>
        <div 
          ref={scrollerRef} 
          className="flex-1 overflow-x-auto scroll-smooth no-scrollbar"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          } as React.CSSProperties}
        >
          <div className="flex gap-2 sm:gap-3 min-w-max">
            {brands.map((b) => (
              <BrandChip key={b.id || b.name} b={b} />
            ))}
          </div>
        </div>
        <button
          onClick={() => scrollBy(280)}
          className="h-7 w-7 sm:h-9 sm:w-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex-shrink-0 text-sm sm:text-base"
          aria-label="Scroll right"
        >
          ›
        </button>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if brands actually changed
  if (prevProps.brands.length !== nextProps.brands.length) return false;
  if (prevProps.title !== nextProps.title) return false;
  if (prevProps.showTitle !== nextProps.showTitle) return false;
  return prevProps.brands.every((brand, idx) => {
    const nextBrand = nextProps.brands[idx];
    return brand.name === nextBrand.name && brand.logo === nextBrand.logo && brand.id === nextBrand.id;
  });
});

// BrandStripAuto component - auto-scrolling marquee for "Trusted by teams"
// Moved outside to prevent recreation on each render
// Animation continues smoothly even when parent re-renders
const BrandStripAuto = memo(({ brands }: { brands: Brand[] }) => {
  const items = useMemo(() => [...brands, ...brands, ...brands], [brands]);
  const trackRef = useRef<HTMLDivElement>(null);

  return (
    <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-0 overflow-hidden">
      <div className="relative">
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 sm:w-10 bg-gradient-to-r from-white to-transparent z-10" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 sm:w-10 bg-gradient-to-l from-white to-transparent z-10" />
        <div className="py-3 sm:py-6">
          <div 
            ref={trackRef}
            className="marquee-track-persistent"
          >
            {items.map((b, idx) => (
              <div key={`${b.id || b.name}-${idx}`} className="mx-1 sm:mx-2">
                <BrandChip b={b} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Return true if props are equal (skip re-render), false if different (re-render)
  // This prevents re-renders when parent updates but brands haven't changed
  if (prevProps.brands.length !== nextProps.brands.length) return false;
  return prevProps.brands.every((brand, idx) => {
    const nextBrand = nextProps.brands[idx];
    return brand.name === nextBrand.name && brand.logo === nextBrand.logo && brand.id === nextBrand.id;
  });
});

// TrustedBrandsSection - isolated wrapper to prevent re-renders from parent
// Uses auto-scrolling marquee animation
const TrustedBrandsSection = memo(({ brands }: { brands: Brand[] }) => {
  const SectionTitle = ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div className="mb-4 sm:mb-6">
      <h2 className="text-lg sm:text-2xl font-bold text-slate-900">{title}</h2>
      {subtitle ? <p className="mt-1 text-xs sm:text-sm text-slate-600">{subtitle}</p> : null}
    </div>
  );

  // Get title from translations - this is stable and won't change
  const title = "Trusted by teams"; // Static title to avoid re-renders

  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 pb-8 sm:pb-12 md:pb-16">
      <SectionTitle title={title} />
      <BrandStripAuto brands={brands} />
    </section>
  );
}, (prevProps, nextProps) => {
  // Only check brands - title is now static inside component
  if (prevProps.brands.length !== nextProps.brands.length) return false;
  return prevProps.brands.every((brand, idx) => {
    const nextBrand = nextProps.brands[idx];
    return brand.name === nextBrand.name && brand.logo === nextBrand.logo && brand.id === nextBrand.id;
  });
});

export default function LightCatalogDemo(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  
  // Sync URL with page state
  const getPageFromPath = (pathname: string): Page => {
    const path = pathname.replace(/^\//, "").split("/")[0] || "home";
    if (path === "admin") {
      const adminPath = pathname.replace(/^\/admin\/?/, "").split("/")[0] || "dashboard";
      return "admin" as Page; // Admin pages handled separately
    }
    const pageMap: Record<string, Page> = {
      "": "home",
      "home": "home",
      "shop": "shop",
      "product": "product",
      "pricing": "pricing",
      "contact": "contact",
      "fraud": "fraud",
      "account": "account",
      "cart": "cart",
      "checkout": "checkout",
      "track": "track",
      "refund": "refund",
      "privacy": "privacy",
      "cookies": "cookies",
      "disclaimer": "disclaimer",
      "terms": "terms",
      "about": "about",
      "faq": "faq",
      "special": "special",
      "coupons": "coupons",
    };
    return pageMap[path] || "home";
  };

  const [pageState, setPageStateInternal] = useState<Page>(() => getPageFromPath(location.pathname));
  
  // Get product ID from URL params if on product page, otherwise default to 1
  const getProductIdFromUrl = () => {
    if (params.id && getPageFromPath(location.pathname) === "product") {
      const id = Number(params.id);
      if (Number.isFinite(id) && id > 0) return id;
    }
    return 1;
  };
  
  // Declare selectedProductId BEFORE setPage to avoid initialization error
  const [selectedProductId, setSelectedProductId] = useState(() => getProductIdFromUrl());
  
  // Sync selectedProductId with URL param when URL changes
  useEffect(() => {
    if (pageState === "product") {
      const pathParts = location.pathname.replace(/^\//, "").split("/");
      
      // Ensure we're actually on a /product/... path
      if (pathParts[0] !== "product") {
        return;
      }
      
      const routeOrId = pathParts[1]; // Get the route/id part (second segment after /product/)
      
      if (routeOrId) {
        // Check if it's a numeric ID (from /product/:id)
        const numericId = Number(routeOrId);
        if (Number.isFinite(numericId) && numericId > 0) {
          if (numericId !== selectedProductId) {
            setSelectedProductId(numericId);
          }
        } else {
          // It's a custom route - fetch product by route
          const fetchProductByRoute = async () => {
            try {
              const did = getDeviceId();
              const json = await gatewayFetch(`/products/route/${encodeURIComponent(routeOrId)}?deviceId=${encodeURIComponent(did)}`, { method: "GET" });
              const item = json?.item as ProductT | undefined;
              if (item && item.id !== selectedProductId) {
                setSelectedProductId(item.id);
                // Also add to products list if not already there
                setProducts((prev) => {
                  const idx = prev.findIndex((p) => p.id === item.id);
                  if (idx < 0) {
                    return [...prev, item];
                  }
                  return prev;
                });
              }
            } catch {
              // If route not found, fallback to default
              if (selectedProductId !== 1) {
                setSelectedProductId(1);
              }
            }
          };
          fetchProductByRoute();
        }
      }
    }
  }, [pageState, location.pathname, selectedProductId]);
  
  // Sync page state with URL
  useEffect(() => {
    const newPage = getPageFromPath(location.pathname);
    if (newPage !== pageState) {
      setPageStateInternal(newPage);
    }
  }, [location.pathname]);
  
  const page = pageState;

  // Form/panel səhifələrində auto interval/polling işləməsin (yazılar silinməsin)
  const shouldStopAutoUI = (p: string) => {
    const x = String(p || "").toLowerCase();

    // user side (form olan yerlər)
    if (
      x.includes("account") ||
      x.includes("checkout") ||
      x.includes("fraud") ||
      x.includes("attention") ||
      x.includes("coupons") 
    ) return true;

    // admin side (bütün admin panel səhifələri)
    if (
      x.includes("admin") ||
      x.startsWith("admin-") ||
      x.startsWith("admin/")
    ) return true;

    return false;
  };

  // Scroll to top and track page view when page changes (do not clear search so header search → Shop works)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Track page view in Google Analytics
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("config", import.meta.env.VITE_GOOGLE_ANALYTICS_ID, {
        page_path: window.location.pathname + window.location.search,
        page_title: document.title,
      });
      
    }
  }, [page]);

  const [lang, setLang] = useState<Lang>("EN");
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const [footerLinks, setFooterLinks] = useState<any[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [bannerIdx, setBannerIdx] = useState(0);
  const [me, setMe] = useState<any>(null);

  const [testimonialIdx, setTestimonialIdx] = useState(0);
  const [testimonialManualAt, setTestimonialManualAt] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Nav items from API
  type NavItemT = { id?: number; label: string; page: string; sortOrder?: number; visible?: boolean };
  const [navItems, setNavItems] = useState<NavItemT[]>([
    { label: "Home", page: "home" },
    { label: "Shop", page: "shop" },
    { label: "Pricing", page: "pricing" },
    { label: "Attention Fraud", page: "fraud" },
    { label: "Contact", page: "contact" },
  ]);

  // Site settings
  type SiteSettingsT = {
    siteName: string;
    headerLogo: string;
    footerLogo: string;
    supportImage: string;
    heroKicker?: string;
    heroTitle?: string;
    heroTitleAccent?: string;
    heroSubtitle?: string;
    heroCtaBrowse?: string;
    heroCtaPricing?: string;
    heroFeature1?: string;
    heroFeature2?: string;
    heroFeature3?: string;
    topbarEmail?: string;
    topbarPhone?: string;
    topbarWhatsApp?: string;
    topbarNoPayment?: string;
    topbarEmailConfirm?: string;
  };
  const [siteSettings, setSiteSettings] = useState<SiteSettingsT>({
    siteName: "YourBrand",
    headerLogo: "",
    footerLogo: "",
    supportImage: "",
    heroKicker: "",
    heroTitle: "",
    heroTitleAccent: "",
    heroSubtitle: "",
    heroCtaBrowse: "",
    heroCtaPricing: "",
    heroFeature1: "",
    heroFeature2: "",
    heroFeature3: "",
    topbarEmail: "support@ripcrack.net",
    topbarPhone: "+48 6388 1006",
    topbarWhatsApp: "+48 6388 1006",
    topbarNoPayment: "No online payment",
    topbarEmailConfirm: "Email confirmation",
  });

  type HomeFeaturedT = { id: number; productId: number; sortOrder: number; active: boolean; product: ProductT };
  const [homeFeatured, setHomeFeatured] = useState<HomeFeaturedT[]>([]);
  const [featuredIdx, setFeaturedIdx] = useState(0);

  const refreshNavItems = async () => {
    try {
      const json = await gatewayFetch("/nav", { method: "GET" });
      const items = (json?.items || []) as NavItemT[];
      if (items.length > 0) setNavItems(items);
    } catch {
      // keep defaults
    }
  };

  const refreshHomeFeatured = async () => {
    try {
      const json = await gatewayFetch("/featured-products", { method: "GET" });
      const items = Array.isArray(json?.items) ? (json.items as any[]) : [];
      const mapped = items
        .map((x: any) => ({
          id: Number(x.id),
          productId: Number(x.productId),
          sortOrder: Number(x.sortOrder || 0),
          active: Boolean(x.active),
          product: x.product as ProductT,
        }))
        .filter((x: any) => Number.isFinite(x.id) && x.product && Number.isFinite(Number(x.product?.id)));
      setHomeFeatured(mapped);
    } catch {
      setHomeFeatured([]);
    }
  };

  const normalizeSeoKeyword = (input: string) => String(input || "").trim().toLowerCase().replace(/\s+/g, " ");

  const SeoPanel = (props: {
    entityType: "PRODUCT" | "CATEGORY" | "FAQ";
    entityId?: number | null;
    titleText?: string;
    contentText?: string;
    seoTitle?: string;
    seoDescription?: string;
    primaryKeyword: string;
    setPrimaryKeyword: (v: string) => void;
    secondaryKeywordsText: string;
    setSecondaryKeywordsText: (v: string) => void;
  }) => {
    const [autoItems, setAutoItems] = useState<string[]>([]);
    const [autoBusy, setAutoBusy] = useState(false);
    const [dupBusy, setDupBusy] = useState(false);
    const [dupErr, setDupErr] = useState<string | null>(null);

    const normalizedPrimary = useMemo(() => normalizeSeoKeyword(props.primaryKeyword), [props.primaryKeyword]);
    const secondaryList = useMemo(
      () =>
        props.secondaryKeywordsText
          .split(",")
          .map((x) => normalizeSeoKeyword(x))
          .filter(Boolean),
      [props.secondaryKeywordsText]
    );

    const score = useMemo(() => {
      const kw = normalizedPrimary;
      if (!kw) return 0;
      const hay = (
        String(props.titleText || "") +
        "\n" +
        String(props.seoTitle || "") +
        "\n" +
        String(props.seoDescription || "") +
        "\n" +
        String(props.contentText || "")
      )
        .toLowerCase()
        .replace(/\s+/g, " ");

      let s = 0;
      if (kw.length >= 3) s += 10;
      if (kw.length >= 8) s += 10;
      if (hay.includes(kw)) s += 40;
      if (String(props.seoTitle || "").toLowerCase().includes(kw)) s += 20;
      if (String(props.seoDescription || "").toLowerCase().includes(kw)) s += 10;
      return Math.min(100, s);
    }, [normalizedPrimary, props.titleText, props.seoTitle, props.seoDescription, props.contentText]);

    const scoreColor = score >= 60 ? "text-emerald-700" : score >= 35 ? "text-amber-700" : "text-red-700";
    const scoreBg = score >= 60 ? "bg-emerald-50 border-emerald-200" : score >= 35 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";

    useEffect(() => {
      let cancelled = false;
      const q = normalizedPrimary;
      if (!q) {
        setAutoItems([]);
        return;
      }
      setAutoBusy(true);
      const t = setTimeout(async () => {
        try {
          const json = await gatewayFetch(`/admin/seo/keywords/autocomplete?q=${encodeURIComponent(q)}`, { method: "GET" });
          const items = (json?.items || []).map((x: any) => String(x.keyword || x.normalized || "")).filter(Boolean);
          if (!cancelled) setAutoItems(items);
        } catch {
          if (!cancelled) setAutoItems([]);
        } finally {
          if (!cancelled) setAutoBusy(false);
        }
      }, 250);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }, [normalizedPrimary]);

    useEffect(() => {
      let cancelled = false;
      const kw = normalizedPrimary;
      if (!kw) {
        setDupErr(null);
        return;
      }
      setDupBusy(true);
      const t = setTimeout(async () => {
        try {
          const qs = new URLSearchParams();
          qs.set("entityType", props.entityType);
          qs.set("keyword", kw);
          if (props.entityId) qs.set("excludeEntityId", String(props.entityId));
          const json = await gatewayFetch(`/admin/seo/keywords/duplicate-check?${qs.toString()}`, { method: "GET" });
          if (!cancelled) {
            if (json?.ok) setDupErr(null);
            else setDupErr(`Duplicate keyword: used by ${json?.conflict?.entityType} #${json?.conflict?.entityId}`);
          }
        } catch (e: any) {
          if (!cancelled) setDupErr(e?.message || "Duplicate check failed");
        } finally {
          if (!cancelled) setDupBusy(false);
        }
      }, 250);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }, [normalizedPrimary, props.entityType, props.entityId]);

    return (
      <div className={"mt-4 rounded-2xl border p-4 " + scoreBg}>
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-900">SEO (RankMath-like)</div>
          <div className={"text-xs font-semibold " + scoreColor}>Score: {score}/100</div>
        </div>

        <div className="mt-3 grid md:grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-slate-600 mb-1">Primary keyword</div>
            <input
              value={props.primaryKeyword}
              onChange={(e) => props.setPrimaryKeyword(e.target.value)}
              placeholder="Primary keyword"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
            />
            {dupBusy ? <div className="mt-1 text-xs text-slate-500">Checking duplicates...</div> : null}
            {dupErr ? <div className="mt-1 text-xs text-red-700">{dupErr}</div> : null}
          </div>

          <div>
            <div className="text-xs text-slate-600 mb-1">Secondary keywords (comma-separated)</div>
            <input
              value={props.secondaryKeywordsText}
              onChange={(e) => props.setSecondaryKeywordsText(e.target.value)}
              placeholder="keyword 1, keyword 2"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
            />
            {secondaryList.length ? <div className="mt-1 text-xs text-slate-500">Count: {secondaryList.length}</div> : null}
          </div>
        </div>

        <div className="mt-3">
          <div className="text-xs text-slate-600">Autocomplete</div>
          {autoBusy ? <div className="mt-1 text-xs text-slate-500">Loading...</div> : null}
          {!autoBusy && autoItems.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {autoItems.slice(0, 10).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => props.setPrimaryKeyword(k)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs hover:bg-slate-50"
                >
                  {k}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* SEO Keywords by Strength (Rank Math style) */}
        {props.setSeoKeywords && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="text-xs font-semibold text-slate-700 mb-3">Keywords by Strength (Rank Math style)</div>
            
            <div className="space-y-3">
              {/* Strong Keywords */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-xs font-medium text-emerald-700">🟢 Strong Keywords</div>
                  <span className="text-xs text-slate-500">(Most important)</span>
                </div>
                <div className="space-y-2">
                  {(props.seoKeywords || []).filter(k => k.strength === "strong").map((kw, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        value={kw.keyword}
                        onChange={(e) => {
                          const updated = [...(props.seoKeywords || [])];
                          updated[updated.findIndex(k => k === kw)] = { ...kw, keyword: e.target.value };
                          props.setSeoKeywords!(updated);
                        }}
                        placeholder="Strong keyword"
                        className="flex-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm"
                      />
                      <button
                        onClick={() => {
                          props.setSeoKeywords!((props.seoKeywords || []).filter(k => k !== kw));
                        }}
                        className="text-red-600 hover:text-red-700 text-sm px-2"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      props.setSeoKeywords!([...(props.seoKeywords || []), { keyword: "", strength: "strong" }]);
                    }}
                    className="text-xs text-emerald-700 hover:text-emerald-800"
                  >
                    + Add Strong Keyword
                  </button>
                </div>
              </div>

              {/* Medium Keywords */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-xs font-medium text-amber-700">🟡 Medium Keywords</div>
                  <span className="text-xs text-slate-500">(Important)</span>
                </div>
                <div className="space-y-2">
                  {(props.seoKeywords || []).filter(k => k.strength === "medium").map((kw, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        value={kw.keyword}
                        onChange={(e) => {
                          const updated = [...(props.seoKeywords || [])];
                          updated[updated.findIndex(k => k === kw)] = { ...kw, keyword: e.target.value };
                          props.setSeoKeywords!(updated);
                        }}
                        placeholder="Medium keyword"
                        className="flex-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm"
                      />
                      <button
                        onClick={() => {
                          props.setSeoKeywords!((props.seoKeywords || []).filter(k => k !== kw));
                        }}
                        className="text-red-600 hover:text-red-700 text-sm px-2"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      props.setSeoKeywords!([...(props.seoKeywords || []), { keyword: "", strength: "medium" }]);
                    }}
                    className="text-xs text-amber-700 hover:text-amber-800"
                  >
                    + Add Medium Keyword
                  </button>
                </div>
              </div>

              {/* Weak Keywords */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-xs font-medium text-slate-600">⚪ Weak Keywords</div>
                  <span className="text-xs text-slate-500">(Supporting)</span>
                </div>
                <div className="space-y-2">
                  {(props.seoKeywords || []).filter(k => k.strength === "weak").map((kw, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        value={kw.keyword}
                        onChange={(e) => {
                          const updated = [...(props.seoKeywords || [])];
                          updated[updated.findIndex(k => k === kw)] = { ...kw, keyword: e.target.value };
                          props.setSeoKeywords!(updated);
                        }}
                        placeholder="Weak keyword"
                        className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                      />
                      <button
                        onClick={() => {
                          props.setSeoKeywords!((props.seoKeywords || []).filter(k => k !== kw));
                        }}
                        className="text-red-600 hover:text-red-700 text-sm px-2"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      props.setSeoKeywords!([...(props.seoKeywords || []), { keyword: "", strength: "weak" }]);
                    }}
                    className="text-xs text-slate-600 hover:text-slate-700"
                  >
                    + Add Weak Keyword
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-3 text-xs text-slate-500">
              Total: {(props.seoKeywords || []).length} keywords
              ({(props.seoKeywords || []).filter(k => k.strength === "strong").length} strong, 
              {(props.seoKeywords || []).filter(k => k.strength === "medium").length} medium, 
              {(props.seoKeywords || []).filter(k => k.strength === "weak").length} weak)
            </div>
          </div>
        )}
      </div>
    );
  };

  const refreshSiteSettings = async () => {
    try {
      const json = await gatewayFetch("/settings");
      if (json?.settings) setSiteSettings(json.settings);
    } catch {
      // ignore
    }
  };

  const refreshFooterLinks = async () => {
    try {
      const json = await gatewayFetch("/footer-links");
      if (Array.isArray(json?.items)) setFooterLinks(json.items);
      else setFooterLinks([]);
    } catch {
      setFooterLinks([]);
    }
  };

  useEffect(() => {
    refreshMe();
    refreshProducts();
    refreshSiteSettings();
    refreshFooterLinks();
    refreshNavItems();
    refreshHomeFeatured();
  }, []);


  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const qs = new URLSearchParams(window.location.search || "");
      const orderId = String(qs.get("orderId") || "").trim();
      const token = String(qs.get("token") || "").trim();
      if (orderId && token) setPage("track");
    } catch {
      // ignore
    }
  }, []);

  // Cookie consent
  const [cookieConsent, setCookieConsent] = useState<"pending" | "accepted" | "rejected">(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("cookieConsent");
      if (stored === "accepted" || stored === "rejected") return stored;
    }
    return "pending";
  });

  const handleCookieConsent = (decision: "accepted" | "rejected") => {
    setCookieConsent(decision);
    localStorage.setItem("cookieConsent", decision);
  };
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const t = (key: string, vars?: Record<string, string | number>) => {
    const base = translations[lang]?.[key] ?? translations.EN[key] ?? key;
    if (!vars) return base;
    return Object.keys(vars).reduce((acc, k) => acc.replaceAll(`{${k}}`, String(vars[k])), base);
  };

  const parsePriceToNumber = (v: string) => {
    const raw = String(v || "");
    const m = raw.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
    const n = m ? Number(m[0]) : NaN;
    return Number.isFinite(n) ? n : 0;
  };

  const formatMoney = (n: number) => {
    const safe = Number.isFinite(n) ? n : 0;
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(safe);
    } catch {
      return `$${safe.toFixed(2)}`;
    }
  };

  const gatewayBase = import.meta.env.VITE_API_URL || "/api";
  class ApiError extends Error {
    status: number;
    retryAfterMs?: number;
    constructor(message: string, status: number, retryAfterMs?: number) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.retryAfterMs = retryAfterMs;
    }
  }
  const isProbablyJwt = (token: string) => token.split(".").length === 3;

  const getDeviceId = () => {
    if (typeof window === "undefined") return "";
    const key = "deviceId";
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const id = (typeof crypto !== "undefined" && "randomUUID" in crypto)
      ? (crypto as any).randomUUID()
      : `dev_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem(key, id);
    return id;
  };

  const gatewayFetch = async (path: string, init?: RequestInit) => {
    const token = typeof window !== "undefined" ? window.localStorage.getItem("token") : null;
    if (token && !isProbablyJwt(token)) window.localStorage.removeItem("token");
    const effectiveToken = token && isProbablyJwt(token) ? token : null;

    const isFormDataBody = typeof FormData !== "undefined" && init?.body instanceof FormData;

    const isOrders = path === "/orders";
    if (isOrders) {
      console.log("[Checkout] fetch /orders started", {
        url: `${gatewayBase}${path}`,
        method: init?.method || "GET",
        hasAuthToken: !!effectiveToken,
        tokenLength: effectiveToken ? effectiveToken.length : 0,
      });
    }

    try {
      const res = await fetch(`${gatewayBase}${path}`, {
        ...init,
        headers: {
          ...(isFormDataBody ? {} : { "Content-Type": "application/json" }),
          ...(effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {}),
          ...(init?.headers || {}),
        },
        credentials: "include",
      });

      if (res.status === 401 && typeof window !== "undefined") window.localStorage.removeItem("token");

      if (isOrders) {
        console.log("[Checkout] fetch /orders response received", {
          status: res.status,
          ok: res.ok,
          statusText: res.statusText,
          headers: { "content-type": res.headers.get("content-type") },
        });
      }

      const json = await res.json().catch((parseErr) => {
        if (isOrders) console.warn("[Checkout] fetch /orders body parse failed", parseErr);
        return null;
      });
      if (!res.ok) {
        const errorMsg = json?.error || `Request failed (${res.status})`;
        const ra = res.headers.get("Retry-After");
        const retryAfterMs = ra && Number.isFinite(Number(ra)) ? Math.max(0, Math.floor(Number(ra) * 1000)) : undefined;
        if (isOrders) {
          console.error("[Checkout] fetch /orders failed (non-2xx)", {
            status: res.status,
            statusText: res.statusText,
            errorMsg,
            bodyKeys: json ? Object.keys(json) : null,
          });
        }
        console.error(`API Error [${path}]:`, errorMsg, res.status);
        throw new ApiError(errorMsg, res.status, retryAfterMs);
      }
      if (isOrders) console.log("[Checkout] fetch /orders success", { orderId: json?.order?.id });
      return json;
    } catch (err: any) {
      if (isOrders) {
        console.error("[Checkout] fetch /orders exception", {
          name: err?.name,
          message: err?.message,
          status: err?.status,
          stack: err?.stack?.split?.("\n")?.slice?.(0, 3),
        });
      }
      if (err.name === "TypeError" && err.message.includes("fetch")) {
        console.error(`Network Error [${path}]:`, err.message);
        throw new Error("Network error: Backend server may not be running");
      }
      throw err;
    }
  };

  const refreshMe = async () => {
    try {
      const json = await gatewayFetch("/auth/me", { method: "GET" });
      setMe(json?.user || null);
    } catch {
      setMe(null);
    }
  };

  useEffect(() => {
    refreshMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [selectedType, setSelectedType] = useState<"Personal" | "Business">("Personal");
  const [purchaseTerm, setPurchaseTerm] = useState<PurchaseTerm>("lifetime");
  const [pricingTerm, setPricingTerm] = useState<PurchaseTerm>("lifetime");
  const [addToCartModal, setAddToCartModal] = useState<{ product: ProductT | null; qty: number }>({ product: null, qty: 1 });
  const [addToCartType, setAddToCartType] = useState<"Personal" | "Business">("Personal");

  const [cartItems, setCartItems] = useState<CartItemT[]>([]);

  const [subscriptionEmail, setSubscriptionEmail] = useState("");
  const [subscriptionStatus, setSubscriptionStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [subscriptionMessage, setSubscriptionMessage] = useState("");

  const cartCount = useMemo(() => cartItems.reduce((acc, it) => acc + (it.qty || 0), 0), [cartItems]);
  const cartTotal = useMemo(
    () => cartItems.reduce((acc, it) => acc + (it.unitPrice || 0) * (it.qty || 0), 0),
    [cartItems]
  );

  const addToCart = (p: ProductT, qty = 1, productType?: "Personal" | "Business") => {
    const type = productType || selectedType;
    const effectivePriceText =
      type === "Business" ? ((p as any).businessPrice || p.price) : ((p as any).personalPrice || p.price);
    const unitPrice = parsePriceToNumber(effectivePriceText);
    const safeQty = Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1;

    setCartItems((prev) => {
      const idx = prev.findIndex((x) => x.productId === p.id && x.productType === type);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + safeQty };
        return next;
      }
      return [...prev, { productId: p.id, title: p.title, unitPrice, qty: safeQty, productType: type }];
    });
  };

  const handleAddToCartClick = (p: ProductT, qty = 1) => {
    // Check if product has both personal and business prices
    const hasPersonalPrice = !!(p as any).personalPrice;
    const hasBusinessPrice = !!(p as any).businessPrice;
    
    if (hasPersonalPrice && hasBusinessPrice) {
      // Show modal to select type
      setAddToCartModal({ product: p, qty });
      setAddToCartType("Personal");
    } else {
      // Prioritize business price if available, otherwise use personal price
      const typeToUse = hasBusinessPrice ? "Business" : "Personal";
      addToCart(p, qty, typeToUse);
    }
  };

  const confirmAddToCart = () => {
    if (addToCartModal.product) {
      addToCart(addToCartModal.product, addToCartModal.qty, addToCartType);
      setAddToCartModal({ product: null, qty: 1 });
    }
  };

  const setCartQty = (productId: number, qty: number, productType?: "Personal" | "Business") => {
    const safeQty = Number.isFinite(qty) ? Math.floor(qty) : 1;
    setCartItems((prev) => {
      if (safeQty <= 0) {
        if (productType) {
          return prev.filter((x) => !(x.productId === productId && x.productType === productType));
        }
        return prev.filter((x) => x.productId !== productId);
      }
      return prev.map((x) => {
        if (productType) {
          return x.productId === productId && x.productType === productType ? { ...x, qty: safeQty } : x;
        }
        return x.productId === productId ? { ...x, qty: safeQty } : x;
      });
    });
  };

  const removeFromCart = (productId: number, productType?: "Personal" | "Business") => {
    setCartItems((prev) => {
      if (productType) {
        return prev.filter((x) => !(x.productId === productId && x.productType === productType));
      }
      return prev.filter((x) => x.productId !== productId);
    });
  };

  const clearCart = () => setCartItems([]);

  const [categories, setCategories] = useState<string[]>(["All", "Design", "Security", "Marketing", "Automation", "AI Tools"]);
  const [categoryItems, setCategoryItems] = useState<{ id: number; name: string; sortOrder: number }[]>([]);

  const refreshCategories = async () => {
    try {
      const json = await gatewayFetch("/categories", { method: "GET" });
      const items = (json?.items || []) as { id: number; name: string; sortOrder: number }[];
      setCategoryItems(items);
      if (items.length > 0) {
        setCategories(["All", ...items.map((c) => c.name)]);
      }
    } catch {
      // keep defaults on error
    }
  };

  useEffect(() => {
    refreshCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [products, setProducts] = useState<ProductT[]>([]);
  const [productsBusy, setProductsBusy] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);

  // Auto-slide: only admin-selected featured products
  useEffect(() => {
    // Form / admin / checkout / fraud səhifələrində interval işləməsin
    if (shouldStopAutoUI(page)) return;

    const productList = homeFeatured.length > 0 ? homeFeatured.map(hf => hf.product) : [];
    if (!productList.length) return;

    const t = setInterval(() => {
      setFeaturedIdx((x) => (x + 1) % productList.length);
    }, 7000);

    return () => clearInterval(t);
  }, [homeFeatured.length, page]);

  const refreshProducts = async () => {
    setProductsBusy(true);
    setProductsError(null);
    try {
      const params = new URLSearchParams();
      if (String(query || "").trim()) params.set("q", query);
      if (selectedCategory && selectedCategory !== "All") params.set("category", selectedCategory);

      const qs = params.toString();
      const json = await gatewayFetch(`/products${qs ? `?${qs}` : ""}`, { method: "GET" });
      const items = (json?.items || []) as ProductT[];
      setProducts(items);
      // Only auto-select first product if we're on shop page and current product is not in list
      // Don't override if we're on product page with a specific ID from URL
      if (page !== "product" && items.length && !items.some((p) => p.id === selectedProductId)) {
        setSelectedProductId(items[0].id);
      }
    } catch (e: any) {
      setProductsError(e?.message || "Failed to load products");
      setProducts([]);
    } finally {
      setProductsBusy(false);
    }
  };

  const refreshSelectedProduct = async (id: number) => {
    try {
      const did = getDeviceId();
      const json = await gatewayFetch(`/products/${id}?deviceId=${encodeURIComponent(did)}`, { method: "GET" });
      const item = json?.item as ProductT | undefined;
      if (!item) return;

      setProducts((prev) => {
        const idx = prev.findIndex((p) => p.id === id);
        if (idx < 0) {
          // Product not in list, add it
          return [...prev, item];
        }
        const next = prev.slice();
        next[idx] = item;
        return next;
      });
      setProductStats((prev) => ({ ...prev, [id]: { views: item.views, sold: item.sold } }));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    refreshProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (page !== "shop") return;
    const timer = setTimeout(() => {
      refreshProducts();
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, query, selectedCategory]);

  const categoryLabel = (c: string) =>
    c === "All"
      ? t("cat.all")
      : c === "Design"
      ? t("cat.design")
      : c === "Security"
      ? t("cat.security")
      : c === "Marketing"
      ? t("cat.marketing")
      : c === "Automation"
      ? t("cat.automation")
      : c === "AI Tools"
      ? t("cat.aiTools")
      : c;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (selectedCategory && selectedCategory !== "All" && p.category !== selectedCategory) return false;
      if (q && !(p.title || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, query, selectedCategory]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) || products[0],
    [products, selectedProductId]
  );

  // Enhanced setPage that also updates URL - defined after products is available
  const setPage = useCallback((newPage: Page, productId?: number) => {
    setPageStateInternal(newPage);
    
    // Update selectedProductId if navigating to product page with an ID
    if (newPage === "product" && productId && Number.isFinite(productId) && productId > 0) {
      setSelectedProductId(productId);
    }
    
    // Get product route if available
    const getProductRoute = () => {
      const targetProductId = productId || selectedProductId || 1;
      const product = products.find((p) => p.id === targetProductId);
      if (product && (product as any).frontendRoute && String((product as any).frontendRoute).trim()) {
        return `/product/${String((product as any).frontendRoute).trim()}`;
      }
      return `/product/${targetProductId}`;
    };
    
    const routeMap: Record<Page, string> = {
      "home": "/",
      "shop": "/shop",
      "product": newPage === "product" ? getProductRoute() : selectedProductId ? `/product/${selectedProductId}` : "/product/1",
      "pricing": "/pricing",
      "contact": "/contact",
      "fraud": "/fraud",
      "account": "/account",
      "cart": "/cart",
      "checkout": "/checkout",
      "track": "/track",
      "refund": "/refund",
      "privacy": "/privacy",
      "cookies": "/cookies",
      "disclaimer": "/disclaimer",
      "terms": "/terms",
      "about": "/about",
      "faq": "/faq",
      "special": "/special",
      "coupons": "/coupons",
      "admin": "/admin/dashboard",
    };
    const route = routeMap[newPage] || "/";
    if (location.pathname !== route) {
      navigate(route, { replace: true });
    }
  }, [navigate, location.pathname, selectedProductId, products]);

  useEffect(() => {
    if (page !== "product") return;
    if (!selectedProduct) return;

    const nextTitle = (selectedProduct.seoTitle || selectedProduct.title || "").trim();
    if (nextTitle) document.title = nextTitle;

    const nextDesc = (selectedProduct.seoDescription || selectedProduct.description || "").trim();
    if (!nextDesc) return;

    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = nextDesc;
  }, [page, selectedProduct]);

  const [productStats, setProductStats] = useState<Record<number, { views: number; sold: number }>>({});
  useEffect(() => {
    const init: Record<number, { views: number; sold: number }> = {};
    for (const p of products) init[p.id] = { views: p.views, sold: p.sold };
    setProductStats(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  // Sync selectedProductId with URL param when on product page
  useEffect(() => {
    if (page === "product" && params.id) {
      const productIdFromUrl = Number(params.id);
      if (Number.isFinite(productIdFromUrl) && productIdFromUrl > 0 && productIdFromUrl !== selectedProductId) {
        setSelectedProductId(productIdFromUrl);
      }
    }
  }, [page, params.id, selectedProductId]);

  useEffect(() => {
    if (page !== "product") return;
    refreshSelectedProduct(selectedProductId);
  }, [page, selectedProductId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const deviceId = getDeviceId();
    if (!deviceId) return;

    const productId = page === "product" ? selectedProductId : undefined;
    const path = `${window.location.pathname || ""}${window.location.search || ""}${window.location.hash || ""}`;

    gatewayFetch("/track/page", {
      method: "POST",
      body: JSON.stringify({
        deviceId,
        page,
        path,
        productId,
      }),
    }).catch(() => {
      // ignore
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, selectedProductId]);

  const [testimonials, setTestimonials] = useState<TestimonialT[]>([
    {
      name: "Michael Thompson",
      role: "CEO / Business Owner",
      company: "United States",
      rating: "⭐⭐⭐⭐⭐",
      date: "March 18, 2025",
      text:
        "As a CEO managing a small creative business, I’ve been using Ripcrack.net since around 2020 for different software needs. Over the years, I’ve purchased several licenses and the overall experience has been consistent. The checkout process is straightforward, delivery is fast, and the software performs exactly as described. This saves time for my team and helps us focus on our work.",
      photo: "",
      companyLogo: "",
    },
    {
      name: "Andrew Miller",
      role: "CNC Operator",
      company: "United States",
      rating: "⭐⭐⭐⭐☆",
      date: "January 7, 2025",
      text:
        "I work as a CNC operator and needed specific software for daily production tasks. I’ve used Ripcrack.net more than once since 2021. License activation went smoothly and the software was compatible with our workflow. Support could be a bit faster, but the product quality itself is solid.",
      photo: "",
      companyLogo: "",
    },
    {
      name: "Alessandro Romano",
      role: "CNC Designer",
      company: "Italy",
      rating: "⭐⭐⭐⭐⭐",
      date: "November 22, 2024",
      text:
        "Lavoro come progettista CNC e utilizzo Ripcrack.net da diversi anni. Ho acquistato più licenze nel tempo e il processo è sempre stato chiaro. Il software funziona correttamente dopo l’attivazione e mi aiuta a velocizzare il lavoro quotidiano.",
      photo: "",
      companyLogo: "",
    },
    {
      name: "Julien Moreau",
      role: "Graphic Designer",
      company: "France",
      rating: "⭐⭐⭐⭐⭐",
      date: "March 2, 2025",
      text:
        "« En tant que designer graphique, j’ai utilisé Ripcrack.net à plusieurs reprises depuis 2020. Les logiciels correspondent aux descriptions et l’activation est simple. Cela m’a permis de travailler plus efficacement sur mes projets clients. »",
      photo: "",
      companyLogo: "",
    },
    {
      name: "Markus Schneider",
      role: "Production Manager",
      company: "Germany",
      rating: "⭐⭐⭐⭐☆",
      date: "October 15, 2024",
      text:
        "„Als Produktionsmanager habe ich mehrfach Software über Ripcrack.net bezogen. Die Lieferung war zuverlässig und die Programme ließen sich problemlos in unsere bestehenden Abläufe integrieren.“",
      photo: "",
      companyLogo: "",
    },
    {
      name: "Mehmet Yılmaz",
      role: "Operations Manager",
      company: "Turkey",
      rating: "⭐⭐⭐⭐⭐",
      date: "February 5, 2025",
      text:
        "2019’dan beri operasyon yöneticisi olarak farklı yazılım ihtiyaçları için bu siteyi kullanıyorum. Satın alma ve lisans teslim süreçleri genelde sorunsuz ilerliyor. Programlar iş akışımıza uygun şekilde çalışıyor.",
      photo: "",
      companyLogo: "",
    },
    {
      name: "Dmitry Ivanov",
      role: "Technical Specialist",
      company: "Russia",
      rating: "⭐⭐⭐⭐☆",
      date: "August 19, 2024",
      text:
        "«Я работаю техническим специалистом и использую этот сайт уже несколько лет. За это время приобретал разные программы. В большинстве случаев активация проходила без проблем, а программное обеспечение работало стабильно.»",
      photo: "",
      companyLogo: "",
    },
    {
      name: "Min-Jae Park",
      role: "Design Engineer",
      company: "South Korea",
      rating: "⭐⭐⭐⭐☆",
      date: "July 8, 2024",
      text:
        "디자인 엔지니어로 일하면서 여러 소프트웨어가 필요했는데, 이 사이트를 몇 년간 사용해 왔습니다. 구매 과정이 명확하고 설치 후에도 큰 문제는 없었습니다.",
      photo: "",
      companyLogo: "",
    },
    {
      name: "Andi Pratama",
      role: "Printing & ICC Specialist",
      company: "Indonesia",
      rating: "⭐⭐⭐⭐⭐",
      date: "September 27, 2024",
      text:
        "Sebagai spesialis ICC dan percetakan, saya membutuhkan software yang stabil. Saya menggunakan Ripcrack.net sejak 2021 dan sejauh ini lisensi yang saya beli selalu berfungsi dengan baik dan sesuai kebutuhan kerja saya.",
      photo: "",
      companyLogo: "",
    },
    {
      name: "Khalid Al-Mansoori",
      role: "Project Manager",
      company: "Qatar",
      rating: "⭐⭐⭐⭐☆",
      date: "January 29, 2025",
      text:
        "أعمل كمدير مشاريع واستخدمت الموقع عدة مرات خلال السنوات الماضية. عملية الشراء واضحة، والبرامج التي حصلت عليها تعمل كما هو موضح. التجربة العامة كانت إيجابية.",
      photo: "",
      companyLogo: "",
    },
  ]);

  const refreshTestimonials = async () => {
    try {
      const json = await gatewayFetch("/testimonials", { method: "GET" });
      const items = (json?.items || []) as TestimonialT[];
      if (items.length > 0) setTestimonials(items);
    } catch {
      // ignore
    }
  };

  const testimonialAutoplayMs = 3000; // Time between autoplay transitions
  const testimonialPauseAfterManualMs = 5000; // Pause autoplay for 5 seconds after manual click
  
  const setTestimonialIdxManual = (next: number | ((prev: number) => number)) => {
    setTestimonialManualAt(Date.now());
    setTestimonialIdx((prev) => {
      if (typeof next === "function") return (next as (p: number) => number)(prev);
      return next;
    });
  };

  // Autoplay testimonials - loops through until user clicks
  useEffect(() => {
    // Only autoplay on home page
    if (page !== "home") return;
    
    const len = testimonials.length;
    if (len <= 1) return; // No need to autoplay if 1 or fewer testimonials
    
    let intervalId: ReturnType<typeof setInterval> | null = null;
    
    const startAutoplay = () => {
      // Clear any existing interval
      if (intervalId) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
      
      // Start autoplay interval
      intervalId = window.setInterval(() => {
      setTestimonialIdx((x) => (x + 1) % len);
    }, testimonialAutoplayMs);
    };
    
    // Check if user recently clicked (within pause period)
    const timeSinceManualClick = testimonialManualAt ? Date.now() - testimonialManualAt : Infinity;
    
    if (timeSinceManualClick < testimonialPauseAfterManualMs) {
      // User clicked recently, pause autoplay
      // Set a timer to resume after pause period
      const remainingPauseTime = testimonialPauseAfterManualMs - timeSinceManualClick;
      const resumeTimer = window.setTimeout(() => {
        startAutoplay();
      }, remainingPauseTime);
      
      return () => {
        window.clearTimeout(resumeTimer);
        if (intervalId) window.clearInterval(intervalId);
      };
    } else {
      // No recent manual click, start autoplay immediately
      startAutoplay();
      
      return () => {
        if (intervalId) window.clearInterval(intervalId);
      };
    }
  }, [page, testimonials.length, testimonialManualAt, testimonialAutoplayMs, testimonialPauseAfterManualMs]);

  // Ensure testimonialIdx is valid when testimonials array changes
  useEffect(() => {
    const len = testimonials.length;
    if (len === 0) return;
    setTestimonialIdx((x) => (x < 0 ? 0 : x >= len ? 0 : x));
  }, [testimonials.length]);

  useEffect(() => {
    refreshTestimonials();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Header brands (Brands we sell)
  const [headerBrands, setHeaderBrands] = useState<Brand[]>([
    { name: "Gerber" }, { name: "Maxima" }, { name: "OKI" }, { name: "Roland" }, { name: "ENCAD" }, { name: "Jetrix" }, { name: "Xerox" }
  ]);

  // Trusted brands (Trusted by teams)
  const [trustedBrands, setTrustedBrands] = useState<Brand[]>([
    { name: "Gerber" }, { name: "Maxima" }, { name: "OKI" }, { name: "Roland" }
  ]);

  // Memoize trustedBrands to keep stable reference and prevent unnecessary re-renders
  // Only update when brands actually change (by content, not reference)
  const trustedBrandsMemo = useMemo(() => trustedBrands, [
    JSON.stringify(trustedBrands.map(b => ({ id: b.id, name: b.name, logo: b.logo })))
  ]);

  const refreshHeaderBrands = async () => {
    try {
      const json = await gatewayFetch("/brands/header", { method: "GET" });
      const items = (json?.items || []) as Brand[];
      if (items.length > 0) setHeaderBrands(items);
    } catch {
      // keep defaults on error
    }
  };

  const refreshTrustedBrands = async () => {
    try {
      const json = await gatewayFetch("/brands/trusted", { method: "GET" });
      const items = (json?.items || []) as Brand[];
      if (items.length > 0) setTrustedBrands(items);
    } catch {
      // keep defaults on error
    }
  };

  useEffect(() => {
    refreshHeaderBrands();
    refreshTrustedBrands();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [fraudForm, setFraudForm] = useState({
    name: "",
    platform: "Telegram" as string,
    handle: "",
    details: "",
    evidenceLink: "",
  });

  const [fraudVerifyOpen, setFraudVerifyOpen] = useState(false);
  const [fraudVerifyEmail, setFraudVerifyEmail] = useState("");
  const [fraudVerifySubmissionId, setFraudVerifySubmissionId] = useState("");
  const [fraudVerifyCode, setFraudVerifyCode] = useState("");
  const [fraudVerifyBusy, setFraudVerifyBusy] = useState(false);
  const [fraudVerifyErr, setFraudVerifyErr] = useState<string | null>(null);
  const [fraudVerifyOk, setFraudVerifyOk] = useState<string | null>(null);
  const [fraudResendLeft, setFraudResendLeft] = useState(0);

  type PricingPlanT = {
    id?: number;
    name: string;
    tagline: string;
    lifetimePrice: string;
    annualPrice: string;
    popular: boolean;
    features: string[];
    sortOrder?: number;
  };

  const [pricingPlans, setPricingPlans] = useState<PricingPlanT[]>([
    { name: "Cadlink Pack", tagline: "Great for production", lifetimePrice: "$450", annualPrice: "$99/yr", popular: false, features: ["Cadlink Digital Factory 10.1", "Maintop 5.3", "24/7 Support"] },
    { name: "SAi Pack", tagline: "Best value", lifetimePrice: "$250", annualPrice: "$79/yr", popular: true, features: ["Flexi (PhotoPrint)", "EnRoute 7", "24/7 Support"] },
    { name: "ONYX Pack", tagline: "Premium", lifetimePrice: "$490", annualPrice: "$119/yr", popular: false, features: ["ONYX", "Maintop 5.3", "24/7 Support"] },
  ]);

  const [siteBanners, setSiteBanners] = useState<any[]>([]);

  const refreshPricingPlans = async () => {
    try {
      const json = await gatewayFetch("/pricing", { method: "GET" });
      const items = (json?.items || []) as PricingPlanT[];
      if (items.length > 0) setPricingPlans(items);
    } catch {
      // keep defaults on error
    }
  };

  const refreshBanners = async () => {
    try {
      const json = await gatewayFetch("/banners", { method: "GET" });
      const items = Array.isArray(json?.items) ? json.items : [];
      setSiteBanners(items);
    } catch {
      setSiteBanners([]);
    }
  };

  useEffect(() => {
    refreshPricingPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const banners = useMemo(() => {
    const items = Array.isArray(siteBanners) ? siteBanners : [];
    const mapped = items
      .filter((x: any) => x && x.title)
      .map((x: any) => ({
        id: Number(x.id),
        title: String(x.title || ""),
        subtitle: String(x.subtitle || ""),
        cta: String(x.cta || ""),
        targetPage: String(x.targetPage || ""),
        targetUrl: String(x.targetUrl || ""),
        sortOrder: Number(x.sortOrder || 0),
        active: Boolean(x.active),
      }));
    if (mapped.length >= 1) return mapped;
    return [
      { title: "Seasonal bundle", subtitle: "Limited-time offer", cta: "Shop now", targetPage: "shop", targetUrl: "" },
      { title: "Support 24/7", subtitle: "Chat + WhatsApp", cta: "Contact", targetPage: "contact", targetUrl: "" },
      { title: "Email orders", subtitle: "No payment gateway", cta: "Request", targetPage: "checkout", targetUrl: "" },
    ];
  }, [siteBanners]);

  useEffect(() => {
    refreshBanners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      runSelfTests({ categories, brands: headerBrands, banners, pricingPlans });
    } catch (e) {
      console.error(e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, headerBrands, banners, pricingPlans]);

  useEffect(() => {
    if (page !== "home") return;
    const timer = setInterval(() => setBannerIdx((x) => (x + 1) % banners.length), 3000);
    return () => clearInterval(timer);
  }, [banners.length, page]);

  const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <div className={`rounded-xl sm:rounded-2xl border border-slate-200 bg-white ${className}`}>{children}</div>
  );

  const guardCheckout = () => {
    if (!me?.id) {
      alert("To place an order you must register/login first.");
      setPage("account");
      return false;
    }
    return true;
  };

  const SectionTitle = ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div className="mb-6">
      <div className="text-2xl font-semibold text-slate-900">{title}</div>
      {subtitle ? <div className="text-slate-600 mt-1">{subtitle}</div> : null}
    </div>
  );

  const PolicyHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <SectionTitle title={title} subtitle={subtitle} />
      <div className="flex items-center gap-2">
        <div className="text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-full">Last updated: September 1, 2022</div>
        <button onClick={() => setPage("home")} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50">
          Back
        </button>
      </div>
    </div>
  );

  const LegalContacts = () => (
    <div className="mt-3 space-y-2">
      <a href="mailto:support@ripcrack.net" className="flex items-center gap-2 hover:text-slate-900">
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16v16H4z" />
          <path d="m22 6-10 7L2 6" />
        </svg>
        <span>support@ripcrack.net</span>
      </a>

      <a href="https://wa.me/4863881006" target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-slate-900">
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 21a9 9 0 1 0-7.65-4.27L3 21l4.27-1.35A8.96 8.96 0 0 0 12 21z" />
          <path d="M9.5 10.5c.6 1.6 2.4 3.4 4 4" />
          <path d="M13.8 14.2l1.2-.4c.4-.1.8 0 1.1.3l1 1" />
        </svg>
        <span>WhatsApp Support: +48 6388 1006</span>
      </a>

      <div className="flex items-center gap-2">
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
        </svg>
        <span>WeChat: RipCrack</span>
      </div>

      <a href="https://t.me/ripcrack" target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-slate-900">
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 5 10 12" />
          <path d="m21 5-7 16-4-9-8-3z" />
        </svg>
        <span>Telegram: @ripcrack</span>
      </a>

      <a href="https://ripcrack.net/contact" target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-slate-900">
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 1 0-7l.5-.5a5 5 0 0 1 7 7L17 13" />
          <path d="M14 11a5 5 0 0 1 0 7l-.5.5a5 5 0 0 1-7-7L7 11" />
        </svg>
        <span>Contact Form</span>
      </a>
    </div>
  );

  const Pill = ({ active, children, onClick }: { active?: boolean; children: React.ReactNode; onClick?: () => void }) => (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm border transition ${
        active ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );

  const NavLink = ({ id, label }: { id: Page; label: string }) => (
    <button
      onClick={() => setPage(id)}
      className={`text-sm px-2 py-1 rounded-md transition ${page === id ? "text-emerald-700" : "text-slate-700 hover:text-slate-900"}`}
    >
      {label}
    </button>
  );


  const ProductCard = ({ p }: { p: ProductT }) => {
    const stats = productStats[p.id] || { views: p.views, sold: p.sold };
    const cover = p.images?.[0];
    
    // Card display: show personal price; only if admin set no personal price, show business price
    let effectivePrice: string;
    const businessPrice = String((p as any).businessPrice || "").trim();
    const personalPrice = String((p as any).personalPrice || "").trim();
    const hasPersonal = personalPrice && personalPrice !== "Price on request";
    const hasBusiness = businessPrice && businessPrice !== "Price on request";
    if (hasPersonal) {
      effectivePrice = `${personalPrice}(personal)`;
    } else if (hasBusiness) {
      effectivePrice = `${businessPrice}(business)`;
    } else {
      effectivePrice = p.price;
    }
    return (
      <div className="group h-full">
        <Card className="overflow-hidden h-full flex flex-col">
          <div className="relative">
            {cover ? (
              <img src={cover} alt={p.title} className="h-36 w-full object-cover bg-slate-100" loading="lazy" />
            ) : (
              <div className="h-36 bg-gradient-to-br from-slate-100 to-slate-200" />
            )}
            {p.badge ? (
              <div className="absolute top-3 left-3 text-xs font-medium bg-emerald-600 text-white px-2 py-1 rounded-full">{p.badge}</div>
            ) : null}
          </div>
          <div className="p-4 flex-1 flex flex-col">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500">{p.category}</div>
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <span className="inline-flex items-center gap-1">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-slate-500">
                    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth="2" />
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  {stats.views}
                </span>
                <span className="text-slate-300">·</span>
                <span className="inline-flex items-center gap-1">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-slate-500">
                    <path d="M6 6h15l-1.5 9h-12z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    <path d="M6 6l-2-3H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="9" cy="20" r="1.5" fill="currentColor" />
                    <circle cx="18" cy="20" r="1.5" fill="currentColor" />
                  </svg>
                  {stats.sold}
                </span>
              </div>
            </div>
            <div className="text-sm font-semibold text-slate-900 mt-1 line-clamp-1">{p.title}</div>
            <div className="text-sm text-slate-700 mt-2">{effectivePrice}</div>
            {p.description ? <div className="text-xs text-slate-600 mt-2 leading-relaxed line-clamp-2">{p.description}</div> : null}
            <div className="mt-auto pt-4 flex gap-2">
              <button
                onClick={() => {
                  setPage("product", p.id);
                }}
                className="flex-1 rounded-xl border border-slate-200 text-slate-800 py-2 text-sm hover:bg-slate-50"
              >
                {t("product.view")}
              </button>
              <button
                onClick={() => {
                  setSelectedProductId(p.id);
                  handleAddToCartClick(p, 1);
                }}
                className="flex-1 rounded-xl bg-emerald-600 text-white py-2 text-sm hover:bg-emerald-700"
              >
                Add to cart
              </button>
            </div>
          </div>
        </Card>
      </div>
    );
  };


  const Home = () => (
    <div>
      <section className="bg-gradient-to-b from-white to-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-14 grid lg:grid-cols-2 gap-6 sm:gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-100 px-3 py-1 rounded-full text-xs font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-600" />
              {String(siteSettings.heroKicker || "").trim() || t("hero.kicker")}
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-slate-900 mt-4 leading-tight">
              {(String(siteSettings.heroTitle || "").trim() || t("hero.title"))}{" "}
              <span className="text-emerald-700">{String(siteSettings.heroTitleAccent || "").trim() || t("hero.titleAccent")}</span>
            </h1>
            <p className="text-sm sm:text-base text-slate-600 mt-4 max-w-xl">{String(siteSettings.heroSubtitle || "").trim() || t("hero.subtitle")}</p>

            <div className="mt-7 flex flex-wrap gap-3">
              <button onClick={() => setPage("shop")} className="rounded-xl bg-emerald-600 text-white px-6 py-3 text-sm font-medium hover:bg-emerald-700">
                {String(siteSettings.heroCtaBrowse || "").trim() || t("hero.ctaBrowse")}
              </button>
              <button onClick={() => setPage("pricing")} className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-medium hover:bg-slate-50">
                {String(siteSettings.heroCtaPricing || "").trim() || t("hero.ctaPricing")}
              </button>
            </div>

            <div className="mt-6 sm:mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  title: String(siteSettings.heroFeature1 || "").trim() || "Free Shipping worldwide",
                  icon: (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 7h11v10H3z" />
                      <path d="M14 10h4l3 3v4h-7z" />
                      <circle cx="7" cy="19" r="1" />
                      <circle cx="18" cy="19" r="1" />
                    </svg>
                  ),
                },
                {
                  title: String(siteSettings.heroFeature2 || "").trim() || "Members gift weekly",
                  icon: (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 12v10H4V12" />
                      <path d="M2 7h20v5H2z" />
                      <path d="M12 22V7" />
                      <path d="M12 7c-1.5 0-3-1-3-2.5S10.5 2 12 4.5C13.5 2 15 3 15 4.5S13.5 7 12 7z" />
                    </svg>
                  ),
                },
                {
                  title: String(siteSettings.heroFeature3 || "").trim() || "Friendly support 24/7",
                  icon: (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12a8 8 0 0 1 16 0" />
                      <path d="M4 12v4a2 2 0 0 0 2 2h2v-6H6a2 2 0 0 0-2 2z" />
                      <path d="M20 12v4a2 2 0 0 1-2 2h-2v-6h2a2 2 0 0 1 2 2z" />
                      <path d="M12 20h4" />
                    </svg>
                  ),
                },
              ].map((item) => (
                <div key={item.title} className="bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-700 flex items-center gap-2">
                  <span className="text-emerald-700">{item.icon}</span>
                  <span>{item.title}</span>
                </div>
              ))}
            </div>
          </div>

          <Card className="p-4">
            {homeFeatured.length > 0 && (
            <>
            <div className="rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 h-72 flex items-end justify-between p-6 relative overflow-hidden">
              {(() => {
                const productList = homeFeatured.map(hf => hf.product);
                const featuredProduct = productList[featuredIdx] || homeFeatured[0]?.product;
                const productImage = featuredProduct?.images?.[0];
                return productImage ? (
                  <img 
                    src={productImage} 
                    alt={featuredProduct?.title || "Featured product"} 
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : null;
              })()}
              <div className="relative z-10 flex flex-col items-start gap-2">
                {(() => {
                  const productList = homeFeatured.map(hf => hf.product);
                  const featuredProduct = productList[featuredIdx] || homeFeatured[0]?.product;
                  const category = featuredProduct?.category;
                  return category ? (
                    <span className="inline-block text-xs text-slate-500 bg-white/95 px-2 py-1 rounded">{category}</span>
                  ) : null;
                })()}
                {(() => {
                  const productList = homeFeatured.map(hf => hf.product);
                  const featuredProduct = productList[featuredIdx] || homeFeatured[0]?.product;
                  const title = featuredProduct?.title || "Featured";
                  return (
                    <span className="inline-block text-xl font-semibold text-slate-900 bg-white/95 px-2 py-1 rounded">{title}</span>
                  );
                })()}
                {(() => {
                  const productList = homeFeatured.map(hf => hf.product);
                  const featuredProduct = productList[featuredIdx] || homeFeatured[0]?.product;
                  let effectivePrice: string | null = null;
                  if (featuredProduct) {
                    const businessPrice = String((featuredProduct as any)?.businessPrice || "").trim();
                    const personalPrice = String((featuredProduct as any)?.personalPrice || "").trim();
                    const hasPersonal = personalPrice && personalPrice !== "Price on request";
                    const hasBusiness = businessPrice && businessPrice !== "Price on request";
                    if (hasPersonal) {
                      effectivePrice = `${personalPrice}(personal)`;
                    } else if (hasBusiness) {
                      effectivePrice = `${businessPrice}(business)`;
                    } else {
                      effectivePrice = featuredProduct.price;
                    }
                  }
                  return effectivePrice ? (
                    <span className="inline-block text-sm text-slate-600 bg-white/95 px-2 py-1 rounded">{effectivePrice}</span>
                  ) : null;
                })()}
              </div>
              <button
                onClick={() => {
                  const productList = homeFeatured.map(hf => hf.product);
                  const p = productList[featuredIdx] || homeFeatured[0]?.product;
                  if (p?.id) {
                    setPage("product", p.id);
                    return;
                  }
                  setPage("shop");
                }}
                className="relative z-10 rounded-xl bg-white border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
              >
                {t("home.shopNow")}
              </button>
            </div>

            {(() => {
              const productList = homeFeatured.map(hf => hf.product);
              return productList.length > 1 ? (
                <div className="mt-3 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFeaturedIdx((x) => (x - 1 + productList.length) % productList.length)}
                    className="h-9 w-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                    aria-label="Previous featured"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeaturedIdx((x) => (x + 1) % productList.length)}
                    className="h-9 w-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                    aria-label="Next featured"
                  >
                    ›
                  </button>
                </div>
              ) : null;
            })()}

            </>
            )}
            <div className="mt-4">
              <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
                <div className="p-5 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs text-slate-500">{t("home.bannerLabel")}</div>
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
                      onClick={() => {
                        const b: any = banners[bannerIdx] || {};
                        const url = String(b.targetUrl || "").trim();
                        const targetPage = String(b.targetPage || "").trim();
                        if (url) {
                          window.open(url, "_blank", "noopener,noreferrer");
                          return;
                        }
                        if (targetPage) {
                          setPage(targetPage as any);
                          return;
                        }
                        setPage("shop");
                      }}
                      className="ml-2 rounded-xl bg-slate-900 text-white px-4 py-2 text-sm hover:bg-black"
                      type="button"
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
                      className={`h-2.5 rounded-full transition ${i === bannerIdx ? "w-10 bg-emerald-600" : "w-2.5 bg-slate-200 hover:bg-slate-300"}`}
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
        <SectionTitle title={t("category.title")} subtitle={t("category.subtitle")} />
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <Pill key={c} active={selectedCategory === c} onClick={() => setSelectedCategory(c)}>
              {c}
            </Pill>
          ))}
        </div>

        <div className="mt-6 sm:mt-8 grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {filtered.slice(0, 10).map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <button onClick={() => setPage("shop")} className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm hover:bg-slate-50">
            {t("category.viewAll")}
          </button>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-8 sm:pb-10">
        <SectionTitle title={t("home.testimonials")} />
        <TestimonialsSection testimonials={testimonials} idx={testimonialIdx} onIdxChange={setTestimonialIdxManual} />
      </section>
    </div>
  );

  const Shop = () => (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <SectionTitle title={t("shop.title")} subtitle={t("shop.subtitle")} />
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="text-xs text-slate-500 hidden sm:inline">{t("common.sort")}</div>
            <button className="rounded-xl bg-slate-900 text-white px-3 sm:px-4 py-2 text-xs sm:text-sm">{t("common.sort")} ▾</button>
          </div>
        </div>
      </div>

      {productsError ? <div className="mt-6 text-sm text-red-700">{productsError}</div> : null}
      {productsBusy ? <div className="mt-6 text-sm text-slate-600">Loading products…</div> : null}

      <div className="mt-6 sm:mt-8 grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
        {!productsBusy && filtered.length === 0 ? (
          <div className="text-sm text-slate-600">No products found.</div>
        ) : (
          filtered.map((p) => <ProductCard key={p.id} p={p} />)
        )}
      </div>
    </section>
  );

  const ReturnRefundPolicy = () => (
    <section className="max-w-6xl mx-auto px-6 py-12">
      <PolicyHeader title="Return & Refund Policy" subtitle="EU / GDPR Compliant" />

      <Card className="p-6 mt-6">
        <style>{`
          .policy h3 { font-size: 18px; line-height: 26px; font-weight: 700; color: rgb(15 23 42); margin-top: 24px; }
          .policy p { margin-top: 10px; color: rgb(51 65 85); line-height: 1.8; }
          .policy ul { margin-top: 10px; padding-left: 18px; color: rgb(51 65 85); }
          .policy li { margin-top: 8px; list-style: disc; line-height: 1.8; }
          .policy a { color: rgb(5 150 105); text-decoration: underline; text-underline-offset: 2px; }
        `}</style>
        <div className="policy max-w-3xl">
          <p>
            For the purposes of this Return &amp; Refund Policy:
          </p>

          <h3>1. Definitions</h3>
          <p>
            <b>Company</b> refers to ripcrack.net (“we”, “us”, “our”).
          </p>
          <p>
            <b>Customer / Consumer</b> means any natural person residing in the European Union who purchases products or services for personal use.
          </p>
          <p>
            <b>Device</b> means any internet-enabled device used to access our Website.
          </p>
          <p>
            <b>Service</b> refers to the products and/or services provided by the Company.
          </p>
          <p>
            <b>Website</b> refers to https://ripcrack.net/
          </p>
          <p>
            <b>You</b> refers to the user or consumer of our Services.
          </p>

          <h3>2. Right of Withdrawal (EU Consumers)</h3>
          <p>
            In accordance with EU Directive 2011/83/EU, EU consumers have the right to withdraw from a purchase within 14 (fourteen) days without providing any reason.
          </p>
          <p>
            The withdrawal period expires 14 days from the day on which you, or a third party indicated by you (other than the carrier), acquired physical possession of the goods.
          </p>
          <p>
            To exercise the right of withdrawal, you must notify us of your decision by a clear written statement via email or contact form.
          </p>

          <h3>3. Exceptions to the Right of Withdrawal</h3>
          <p>The right of withdrawal does not apply to:</p>
          <ul>
            <li>
              Digital content that is not supplied on a tangible medium once the download or access has begun, provided you have given prior express consent and acknowledged the loss of the right of withdrawal.
            </li>
            <li>Services that have been fully performed with your prior express consent.</li>
            <li>Customized or personalized products.</li>
          </ul>

          <h3>4. Return Conditions</h3>
          <p>Returned items must meet the following conditions:</p>
          <ul>
            <li>The product must be unused and in its original condition.</li>
            <li>The product must be returned in its original packaging.</li>
            <li>Proof of purchase is required.</li>
          </ul>
          <p>We reserve the right to refuse returns that do not comply with these conditions.</p>

          <h3>5. Refund Process</h3>
          <p>
            Once we receive and inspect the returned product, we will notify you of the approval or rejection of your refund.
          </p>
          <p>
            If approved, the refund will be processed using the same payment method used for the original transaction, unless otherwise agreed.
          </p>
          <p>
            Refunds will be issued within 14 days of receiving the returned goods or proof of return, in accordance with EU law.
          </p>

          <h3>6. Return Shipping Costs</h3>
          <p>
            Unless the product is defective or incorrectly delivered, return shipping costs are the responsibility of the customer.
          </p>
          <p>If the item is faulty or not as described, the Company will bear the return shipping costs.</p>

          <h3>7. Liability During Transport</h3>
          <p>
            We are not responsible for damage caused during return shipment if the return is arranged by the customer. We recommend using a trackable shipping service.
          </p>

          <h3>8. Data Protection &amp; GDPR Compliance</h3>
          <p>
            We process personal data in accordance with the General Data Protection Regulation (GDPR) (EU) 2016/679.
          </p>
          <p>Personal data collected during returns and refunds is used solely for processing your request.</p>
          <p>Data is stored securely and retained only for the period required by law.</p>
          <p>You have the right to access, rectify, erase, or restrict processing of your personal data.</p>
          <p>You may lodge a complaint with your local EU data protection authority.</p>
          <p>For more details, please refer to our Privacy Policy.</p>

          <h3>9. Changes to This Policy</h3>
          <p>
            We may update this policy from time to time to reflect legal or operational changes. Updates will be posted on this page.
          </p>
          <p>Continued use of our Services after changes constitutes acceptance of the revised policy.</p>

          <h3>10. Contact Information</h3>
          <p>If you wish to exercise your right of withdrawal or have questions regarding returns, refunds, or data protection, please contact us:</p>
          <LegalContacts />
        </div>
      </Card>
    </section>
  );

  const TermsPage = () => (
    <section className="max-w-6xl mx-auto px-6 py-12">
      <PolicyHeader title="Terms & Conditions" />

      <Card className="p-6 mt-6">
        <style>{`
          .policy h3 { font-size: 18px; line-height: 26px; font-weight: 700; color: rgb(15 23 42); margin-top: 24px; }
          .policy p { margin-top: 10px; color: rgb(51 65 85); line-height: 1.8; }
          .policy ul { margin-top: 10px; padding-left: 18px; color: rgb(51 65 85); }
          .policy li { margin-top: 8px; list-style: disc; line-height: 1.8; }
          .policy a { color: rgb(5 150 105); text-decoration: underline; text-underline-offset: 2px; }
        `}</style>
        <div className="policy max-w-3xl">
          <p>
            These Terms &amp; Conditions govern your use of the website ripcrack.net (“Website”, “Service”) operated by ripcrack.net (“Company”, “we”, “us”, “our”).
          </p>
          <p>
            By accessing or using our Website and Services, you agree to be bound by these Terms &amp; Conditions. If you do not agree, please do not use our Services.
          </p>

          <h3>1. Eligibility</h3>
          <p>You must be at least 16 years old to use our Services. By using the Website, you confirm that you meet this requirement.</p>

          <h3>2. Services</h3>
          <p>
            We provide digital services and products as described on our Website. We reserve the right to modify, suspend, or discontinue any part of the Services at any time without prior notice.
          </p>

          <h3>3. User Accounts</h3>
          <p>You are responsible for maintaining the confidentiality of your account credentials.</p>
          <p>You are responsible for all activities conducted under your account.</p>
          <p>We reserve the right to suspend or terminate accounts that violate these Terms.</p>

          <h3>4. Payments &amp; Transactions</h3>
          <p>All prices are listed as shown on the Website.</p>
          <p>Payments are processed via secure third-party payment providers.</p>
          <p>Refunds and returns are governed strictly by our Return &amp; Refund Policy.</p>

          <h3>5. Prohibited Use</h3>
          <p>You agree not to:</p>
          <ul>
            <li>Use the Website for unlawful purposes</li>
            <li>Attempt to gain unauthorized access to systems or accounts</li>
            <li>Abuse, exploit, or interfere with the Services</li>
            <li>Violate any applicable laws or regulations</li>
          </ul>

          <h3>6. Intellectual Property</h3>
          <p>
            All content on the Website (text, graphics, logos, software) is the property of ripcrack.net or its licensors and is protected by intellectual property laws. Unauthorized use is strictly prohibited.
          </p>

          <h3>7. Limitation of Liability</h3>
          <p>To the maximum extent permitted by law, ripcrack.net shall not be liable for:</p>
          <ul>
            <li>Indirect or consequential damages</li>
            <li>Loss of data, revenue, or profits</li>
            <li>Service interruptions or technical issues</li>
          </ul>

          <h3>8. Termination</h3>
          <p>We may suspend or terminate your access to the Services immediately if you breach these Terms &amp; Conditions.</p>

          <h3>9. Governing Law</h3>
          <p>These Terms are governed by and interpreted in accordance with applicable EU laws, without regard to conflict of law principles.</p>

          <h3>10. Changes to Terms</h3>
          <p>We reserve the right to update these Terms at any time. Continued use of the Website constitutes acceptance of the revised Terms.</p>

          <h3>11. Contact</h3>
          <LegalContacts />
        </div>
      </Card>
    </section>
  );

  const DisclaimerPage = () => (
    <section className="max-w-6xl mx-auto px-6 py-12">
      <PolicyHeader title="Disclaimer" subtitle="Informational purposes only" />

      <Card className="p-6 mt-6">
        <style>{`
          .policy h3 { font-size: 18px; line-height: 26px; font-weight: 700; color: rgb(15 23 42); margin-top: 24px; }
          .policy p { margin-top: 10px; color: rgb(51 65 85); line-height: 1.8; }
          .policy ul { margin-top: 10px; padding-left: 18px; color: rgb(51 65 85); }
          .policy li { margin-top: 8px; list-style: disc; line-height: 1.8; }
          .policy a { color: rgb(5 150 105); text-decoration: underline; text-underline-offset: 2px; }
        `}</style>
        <div className="policy max-w-3xl">
          <p>
            The information and services provided on ripcrack.net (“Website”) are provided for informational and service purposes only.
          </p>

          <h3>1. No Guarantees</h3>
          <p>All content and services are provided “as is” and “as available”.</p>
          <p>We make no warranties, express or implied, regarding accuracy, reliability, availability, or suitability of the Services.</p>

          <h3>2. Use at Your Own Risk</h3>
          <p>Your use of this Website and Services is entirely at your own risk.</p>
          <p>
            ripcrack.net shall not be held liable for any direct, indirect, incidental, or consequential damages arising from the use or inability to use the Services.
          </p>

          <h3>3. Service Availability</h3>
          <p>We do not guarantee uninterrupted, secure, or error-free operation of the Website or Services. Technical issues, maintenance, or external factors may affect availability.</p>

          <h3>4. External Links</h3>
          <p>The Website may contain links to third-party websites or services.</p>
          <p>We have no control over and assume no responsibility for the content, privacy policies, or practices of any third-party sites.</p>

          <h3>5. Legal Responsibility</h3>
          <p>Users are solely responsible for ensuring that their use of the Website and Services complies with all applicable laws and regulations in their jurisdiction.</p>

          <h3>6. No Professional Advice</h3>
          <p>Nothing on this Website constitutes legal, financial, or professional advice of any kind.</p>

          <h3>7. Changes to Disclaimer</h3>
          <p>We reserve the right to update or modify this Disclaimer at any time.</p>
          <p>Continued use of the Website constitutes acceptance of any changes.</p>

          <h3>8. Contact</h3>
          <p>If you have any questions regarding this Disclaimer, please contact us:</p>
          <LegalContacts />
        </div>
      </Card>
    </section>
  );

  const AboutPage = () => (
    <section className="max-w-6xl mx-auto px-6 py-12">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <SectionTitle title="About RipCrack" subtitle="Software Development, Reverse Engineering & Crack Services Company" />
        <button onClick={() => setPage("home")} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50">
          Back
        </button>
      </div>

      <div className="mt-6 grid lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-slate-50 border border-emerald-100 p-6">
              <div className="text-xs font-semibold text-emerald-800">Since 2019</div>
              <div className="mt-2 text-2xl md:text-3xl font-semibold text-slate-900">Engineering-first software development and reverse engineering</div>
              <div className="mt-3 text-sm text-slate-600 leading-relaxed">
                RipCrack is a global IT consulting and software development company focused on excellence, innovation, and flexibility. We provide professional services in custom software development, IT consulting, reverse engineering, software analysis, security research, testing, and UI/UX design.
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {[
                  "Custom development",
                  "Security research",
                  "Binary analysis",
                  "Reverse engineering",
                  "Cracking",
                  "License development",
                  "UI/UX",
                  "Testing",
                ].map((x) => (
                  <div key={x} className="text-xs font-medium bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-full">
                    {x}
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <div className="grid sm:grid-cols-2 gap-6">
            <Card className="p-6">
              <div className="text-sm font-semibold text-slate-900">What we do</div>
              <div className="mt-3 text-sm text-slate-600 leading-relaxed">
                End-to-end engineering support: architecture, implementation, reverse engineering, audits, and delivery.
              </div>
              <ul className="mt-4 pl-5 list-disc space-y-2 text-sm text-slate-600">
                <li>Custom software development (web &amp; desktop)</li>
                <li>Microservices-based solutions</li>
                <li>Reverse engineering and binary analysis</li>
                <li>Authorized cracking &amp; license bypass solutions (with client/rights-holder permission)</li>
                <li>License recovery and license development</li>
                <li>Security audits and vulnerability research</li>
              </ul>
            </Card>

            <Card className="p-6">
              <div className="text-sm font-semibold text-slate-900">Legal, ethical, authorized use</div>
              <div className="mt-3 text-sm text-slate-600 leading-relaxed">
                All reverse engineering and cracking-related work is performed for legal, ethical, and authorized purposes only.
              </div>
              <ul className="mt-4 pl-5 list-disc space-y-2 text-sm text-slate-600">
                <li>License recovery</li>
                <li>Legacy software access</li>
                <li>Internal security testing</li>
                <li>Compatibility and migration analysis</li>
              </ul>
            </Card>
          </div>

          <Card className="p-6">
            <div className="text-sm font-semibold text-slate-900">Industries we serve</div>
            <div className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-slate-600">
              <div>Financial services</div>
              <div>Retail &amp; e-commerce</div>
              <div>Telecommunications</div>
              <div>Technology &amp; startups</div>
              <div>Printing &amp; print management systems</div>
              <div>Dental clinic management systems</div>
              <div>Embroidery &amp; textile automation</div>
              <div>CNC control systems &amp; integrations</div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-sm font-semibold text-slate-900">Mission &amp; vision</div>
            <div className="mt-3 text-sm text-slate-600 leading-relaxed">
              Our mission is to create extraordinary value by combining software development and reverse engineering with modern technology. Our vision is to become one of the most trusted teams worldwide, delivering high-quality solutions while honoring our people and values.
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <div className="text-sm font-semibold text-slate-900">Contact</div>
            <LegalContacts />
          </Card>

          <Card className="p-6">
            <div className="text-sm font-semibold text-slate-900">About in numbers</div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="text-xs text-slate-500">Founded</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">2019</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="text-xs text-slate-500">Projects</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">300+</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3 min-w-0">
                <div className="text-xs text-slate-500">Clients</div>
                <div className="mt-1 text-base font-semibold text-slate-900 truncate">Global</div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );

  const SpecialCrack = () => {
    const [formData, setFormData] = useState({
      name: "",
      email: "",
      whatsapp: "",
      website: "",
      service: "",
      budget: "",
      message: "",
    });
    const [attachment, setAttachment] = useState<File | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [smileyRating, setSmileyRating] = useState<number>(3);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [specialCaptchaToken, setSpecialCaptchaToken] = useState("");
    const [specialCaptchaOpen, setSpecialCaptchaOpen] = useState(false);
    const specialCaptchaWidgetIdRef = React.useRef<number | null>(null);
    const turnstileSiteKey = (import.meta as any)?.env?.VITE_TURNSTILE_SITE_KEY as string | undefined;

    const services = [
      "Software Crack",
      "License Bypass",
      "Keygen Development",
      "Patch Creation",
      "Reverse Engineering",
      "Custom Solution",
      "Other",
    ];

    const budgets = [
      "Less than $100",
      "$100 - $300",
      "$300 - $500",
      "$500 - $1000",
      "$1000 - $2000",
      "More than $2000",
      "Negotiable",
    ];

    const smileys = ["😞", "🙁", "😐", "🙂", "😃"];

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) setAttachment(file);
    };

    // Turnstile captcha setup for special crack form
    React.useEffect(() => {
      if (!turnstileSiteKey) return;
      const w = window as any;
      if (w.turnstile && specialCaptchaOpen && !specialCaptchaWidgetIdRef.current) {
        const el = document.getElementById("turnstile-special");
        if (el) {
          try {
            const widgetId = w.turnstile.render(el, {
              sitekey: turnstileSiteKey,
              callback: (token: string) => {
                setSpecialCaptchaToken(token);
                setSpecialCaptchaOpen(false);
              },
              "error-callback": () => {
                setSpecialCaptchaToken("");
              },
            });
            specialCaptchaWidgetIdRef.current = widgetId;
          } catch (err) {
            console.error("Turnstile render error:", err);
          }
        }
      }
    }, [turnstileSiteKey, specialCaptchaOpen]);

    const handleSubmit = async () => {
      if (!formData.name || !formData.email || !formData.whatsapp || !formData.service || !formData.budget || !formData.message) {
        alert("Please fill all required fields");
        return;
      }
      setSubmitting(true);
      try {
        const formDataToSend = new FormData();
        formDataToSend.append("name", formData.name);
        formDataToSend.append("email", formData.email);
        formDataToSend.append("whatsapp", formData.whatsapp);
        formDataToSend.append("website", formData.website);
        formDataToSend.append("service", formData.service);
        formDataToSend.append("budget", formData.budget);
        formDataToSend.append("message", formData.message);
        formDataToSend.append("smileyRating", String(smileyRating));
        if (attachment) {
          formDataToSend.append("attachment", attachment);
        }
        if (turnstileSiteKey && specialCaptchaToken) {
          formDataToSend.append("captchaToken", specialCaptchaToken);
        }

        await gatewayFetch("/special-crack", {
          method: "POST",
          body: formDataToSend,
        });
        setSubmitted(true);
        // Reset form
        setFormData({
          name: "",
          email: "",
          whatsapp: "",
          website: "",
          service: "",
          budget: "",
          message: "",
        });
        setAttachment(null);
        setSmileyRating(3);
        if (turnstileSiteKey) {
          setSpecialCaptchaToken("");
        }
      } catch (e: any) {
        alert(e?.message || "Failed to submit. Please try again.");
      } finally {
        setSubmitting(false);
      }
    };

    if (submitted) {
      return (
        <section className="max-w-3xl mx-auto px-6 py-16">
          <Card className="p-10 text-center">
            <div className="text-6xl mb-4">✅</div>
            <div className="text-2xl font-semibold text-slate-900">Request Submitted!</div>
            <div className="text-slate-600 mt-2">We'll get back to you within 24 hours via WhatsApp or Email.</div>
            <button onClick={() => setPage("home")} className="mt-6 rounded-xl bg-emerald-600 text-white px-8 py-3 text-sm font-medium hover:bg-emerald-700">
              Back to Home
            </button>
          </Card>
        </section>
      );
    }

    return (
      <section className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Special Crack</h1>
          <p className="text-slate-600 mt-2">Leave your message and we'll get back to you shortly.</p>
        </div>

        <Card className="p-8">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Your name <span className="text-red-500">*</span></label>
              <input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Doe"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email address <span className="text-red-500">*</span></label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="example@domain.com"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            {/* WhatsApp */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">WhatsApp <span className="text-red-500">*</span></label>
              <input
                value={formData.whatsapp}
                onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                placeholder="+1-999-999-9999"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            {/* Website */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Software official website <span className="text-red-500">*</span></label>
              <input
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="www.domain.com"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            {/* Service */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Select service <span className="text-red-500">*</span></label>
              <select
                value={formData.service}
                onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent appearance-none"
              >
                <option value="">Please select from here</option>
                {services.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Budget */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Select budget <span className="text-red-500">*</span></label>
              <select
                value={formData.budget}
                onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent appearance-none"
              >
                <option value="">Please select from here</option>
                {budgets.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>

          {/* Message */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">Message <span className="text-red-500">*</span></label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Tell us briefly about your needs"
              rows={4}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Attachment */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">Attachment</label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl py-8 px-4 text-center transition ${
                dragOver ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-slate-50"
              }`}
            >
              {attachment ? (
                <div className="flex items-center justify-center gap-2">
                  <span className="text-sm text-slate-700">{attachment.name}</span>
                  <button onClick={() => setAttachment(null)} className="text-red-500 text-sm">✕</button>
                </div>
              ) : (
                <>
                  <label className="cursor-pointer">
                    <span className="text-emerald-600 hover:text-emerald-700 underline">Choose file</span>
                    <input type="file" className="hidden" onChange={(e) => setAttachment(e.target.files?.[0] || null)} />
                  </label>
                  <span className="text-slate-500 text-sm"> or drag & drop here</span>
                </>
              )}
            </div>
          </div>

          {/* Smiley Scale */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-slate-700 mb-3">Smiley Scale</label>
            <div className="flex gap-3">
              {smileys.map((emoji, idx) => (
                <button
                  key={idx}
                  onClick={() => setSmileyRating(idx)}
                  className={`text-3xl p-2 rounded-full transition ${
                    smileyRating === idx 
                      ? "bg-emerald-100 ring-2 ring-emerald-500 scale-110" 
                      : "grayscale opacity-50 hover:opacity-100 hover:grayscale-0"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-200 my-8" />

          {/* Captcha */}
          {turnstileSiteKey ? (
            <div className="mb-6">
              {specialCaptchaToken ? (
                <div className="text-sm text-emerald-600">✓ Verified</div>
              ) : (
                <button
                  type="button"
                  onClick={() => setSpecialCaptchaOpen(true)}
                  className="text-sm text-emerald-600 hover:text-emerald-700 underline"
                >
                  Verify you are human
                </button>
              )}
            </div>
          ) : null}

          {turnstileSiteKey ? (
            <div
              style={{ display: specialCaptchaOpen ? "flex" : "none" }}
              className="fixed inset-0 z-50 items-center justify-center bg-black/40 p-4"
              onClick={() => setSpecialCaptchaOpen(false)}
            >
              <div
                className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Verify you are human</div>
                    <div className="text-xs text-slate-600 mt-1">Complete the challenge to continue.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSpecialCaptchaOpen(false)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>
                <div className="mt-4">
                  <div id="turnstile-special" className="w-full" />
                </div>
              </div>
            </div>
          ) : null}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting || (turnstileSiteKey ? !specialCaptchaToken : false)}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 text-sm font-medium disabled:opacity-60 transition"
          >
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </Card>
      </section>
    );
  };

  type CouponT = {
    id?: number;
    code: string;
    description: string;
    discountType: "PERCENTAGE" | "FIXED";
    discountValue: number;
    minPurchase: number;
    appliesToAll?: boolean;
    applicableProductIds?: number[];
    maxUses?: number;
    usedCount?: number;
    validFrom?: string;
    validUntil?: string | null;
    active?: boolean;
  };

  const CouponsPage = () => {
    const [coupons, setCoupons] = useState<CouponT[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadErr, setLoadErr] = useState<string | null>(null);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    const [couponProducts, setCouponProducts] = useState<{ id: number; title: string }[]>([]);

    useEffect(() => {
      (async () => {
        try {
          setLoadErr(null);
          const json = await gatewayFetch("/coupons/active", { method: "GET" });
          setCoupons(json?.items || []);
        } catch (e: any) {
          setLoadErr(e?.message || "Failed to load coupons");
          setCoupons([]);
        } finally {
          setLoading(false);
        }
      })();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      (async () => {
        try {
          const json = await gatewayFetch("/products", { method: "GET" });
          const items = (json?.items || []) as ProductT[];
          setCouponProducts(items.map((p) => ({ id: p.id, title: p.title })));
        } catch {
          setCouponProducts([]);
        }
      })();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const copyCode = async (code: string) => {
      try {
        await navigator.clipboard.writeText(code);
      } catch {
        try {
          const el = document.createElement("textarea");
          el.value = code;
          el.setAttribute("readonly", "");
          el.style.position = "fixed";
          el.style.left = "-9999px";
          document.body.appendChild(el);
          el.select();
          document.execCommand("copy");
          document.body.removeChild(el);
        } catch {
          // last resort (no throw): let user copy manually
          window.prompt("Copy this code:", code);
        }
      }
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode(null), 2000);
    };

    return (
      <section className="max-w-4xl mx-auto px-6 py-12">
        <SectionTitle title="🎟️ Available Coupons" subtitle="Use these codes at checkout to get discounts on your orders." />

        {loading ? (
          <div className="text-sm text-slate-600">Loading coupons...</div>
        ) : loadErr ? (
          <Card className="p-6">
            <div className="text-sm font-semibold text-slate-900">Failed to load coupons</div>
            <div className="mt-2 text-sm text-red-700">{loadErr}</div>
          </Card>
        ) : coupons.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="text-4xl mb-4">😔</div>
            <div className="text-lg font-semibold text-slate-900">No Active Coupons</div>
            <div className="text-slate-600 mt-2">Check back later for special offers!</div>
          </Card>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {coupons.map((c) => (
              <Card key={c.code} className="p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500 transform rotate-45 translate-x-10 -translate-y-10" />
                <div className="absolute top-2 right-2 text-white text-xs font-bold">
                  {c.discountType === "PERCENTAGE" ? `${c.discountValue}%` : `$${c.discountValue}`}
                </div>
                
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-mono text-lg font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg inline-block">
                      {c.code}
                    </div>
                    <div className="text-sm text-slate-600 mt-2">{c.description || "Discount coupon"}</div>
                    {c.appliesToAll === false && c.applicableProductIds && c.applicableProductIds.length > 0 && (
                      <div className="text-xs text-slate-500 mt-2">
                        <span className="font-medium">Applies to: </span>
                        {c.applicableProductIds
                          .map((id) => {
                            const product = couponProducts.find((p) => p.id === id);
                            return product ? product.title : null;
                          })
                          .filter(Boolean)
                          .join(", ") || "Selected products"}
                      </div>
                    )}
                    {c.appliesToAll !== false && (
                      <div className="text-xs text-slate-500 mt-2">
                        <span className="font-medium">Applies to: </span>All products
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                        {c.discountType === "PERCENTAGE" ? `${c.discountValue}% off` : `$${c.discountValue} off`}
                      </span>
                      {c.minPurchase > 0 && (
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                          Min. ${c.minPurchase}
                        </span>
                      )}
                      {c.validUntil && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">
                          Expires: {new Date(c.validUntil).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => copyCode(c.code)}
                  className="mt-4 w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-2 text-sm font-medium transition"
                >
                  {copiedCode === c.code ? "✓ Copied!" : "Copy Code"}
                </button>
              </Card>
            ))}
          </div>
        )}
      </section>
    );
  };

  const FaqPage = () => {
    const [faqs, setFaqs] = useState<any[]>([]);
    const [faqsBusy, setFaqsBusy] = useState(false);
    const [faqsErr, setFaqsErr] = useState<string | null>(null);

    const refreshFaqs = async () => {
      setFaqsBusy(true);
      setFaqsErr(null);
      try {
        const json = await gatewayFetch("/faqs", { method: "GET" });
        setFaqs(Array.isArray(json?.items) ? json.items : []);
      } catch (e: any) {
        setFaqs([]);
        setFaqsErr(e?.message || "Failed to load FAQs");
      } finally {
        setFaqsBusy(false);
      }
    };

    useEffect(() => {
      refreshFaqs();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <SectionTitle title={t("footer.faq")} subtitle="Quick answers to common questions." />
          <div className="flex items-center gap-3">
            <button onClick={refreshFaqs} disabled={faqsBusy} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60">
              {faqsBusy ? "Loading..." : "Refresh"}
            </button>
            <button onClick={() => setPage("home")} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50">
              Back
            </button>
          </div>
        </div>

        <div className="mt-6 grid lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6">
              <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-slate-50 border border-emerald-100 p-6">
                <div className="text-xs font-semibold text-emerald-800">Help Center</div>
                <div className="mt-2 text-2xl md:text-3xl font-semibold text-slate-900">Frequently asked questions</div>
                <div className="mt-3 text-sm text-slate-600 leading-relaxed">
                  Quick answers about our services, legal/authorized use, and how we work.
                </div>
              </div>
            </Card>

            {faqsErr ? (
              <Card className="p-4 bg-red-50 border border-red-200">
                <div className="text-sm text-red-700">{faqsErr}</div>
              </Card>
            ) : null}

            {faqs.length > 0 ? (
              <Card className="p-6">
                <div className="space-y-3">
                  {faqs.map((x: any, idx: number) => (
                    <details key={`${x?.source || ""}:${x?.id ?? idx}`} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <summary className="cursor-pointer select-none text-sm font-semibold text-slate-900">{x?.question || `FAQ #${idx + 1}`}</summary>
                      <div className="mt-3 text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{x?.answer || ""}</div>
                      {String(x?.question || "")
                        .trim()
                        .toLowerCase() === "how do i contact support?" ? (
                        <div className="mt-3">
                          <LegalContacts />
                        </div>
                      ) : null}
                    </details>
                  ))}
                </div>
              </Card>
            ) : null}

            {faqs.length === 0 ? (
            <Card className="p-6">
              <div className="space-y-3">
              <details className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer select-none text-sm font-semibold text-slate-900">1. What is RipCrack?</summary>
                <div className="mt-3 text-sm text-slate-600 leading-relaxed">
                  <p>
                    RipCrack is a software development and IT consulting team providing custom development, reverse engineering, authorized cracking services, software analysis, and security research.
                  </p>
                  <p className="mt-2">We have been actively delivering services since 2019.</p>
                </div>
              </details>

              <details className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer select-none text-sm font-semibold text-slate-900">2. Is RipCrack a legal company?</summary>
                <div className="mt-3 text-sm text-slate-600 leading-relaxed">
                  <p>Yes. All services are performed legally, ethically, and with client authorization.</p>
                  <p className="mt-2">
                    Reverse engineering and cracking-related services are used for license recovery, legacy software access, security testing, software protection analysis, and compatibility purposes.
                  </p>
                </div>
              </details>

              <details className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer select-none text-sm font-semibold text-slate-900">3. What do you mean by “crack services”?</summary>
                <div className="mt-3 text-sm text-slate-600 leading-relaxed">
                  <p>
                    By crack services, we mean authorized software cracking and license bypass solutions performed only with the permission of the software owner or rights holder.
                  </p>
                  <p className="mt-2">These services include:</p>
                  <ul className="mt-2 pl-5 list-disc space-y-1">
                    <li>License recovery</li>
                    <li>DRM and protection mechanism analysis</li>
                    <li>Internal security testing</li>
                    <li>Legacy software unlocking</li>
                    <li>Crack prevention and protection strengthening</li>
                  </ul>
                  <p className="mt-2">We do not support piracy or illegal software distribution.</p>
                </div>
              </details>

              <details className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer select-none text-sm font-semibold text-slate-900">4. Do you offer reverse engineering services?</summary>
                <div className="mt-3 text-sm text-slate-600 leading-relaxed">
                  <p>Yes. We specialize in reverse engineering and binary analysis for desktop, web, and embedded software.</p>
                  <p className="mt-2">We help clients understand behavior, improve security, migrate legacy systems, and protect IP.</p>
                </div>
              </details>

              <details className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer select-none text-sm font-semibold text-slate-900">5. Since when has RipCrack been operating?</summary>
                <div className="mt-3 text-sm text-slate-600 leading-relaxed">
                  <p>We have been delivering services since 2019.</p>
                </div>
              </details>

              <details className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer select-none text-sm font-semibold text-slate-900">6. What industries do you work with?</summary>
                <div className="mt-3 text-sm text-slate-600 leading-relaxed">
                  <p>We work with a wide range of industries, including:</p>
                  <ul className="mt-2 pl-5 list-disc space-y-1">
                    <li>Financial services</li>
                    <li>Energy</li>
                    <li>Retail &amp; e-commerce</li>
                    <li>Entertainment &amp; media</li>
                    <li>Telecommunications</li>
                    <li>Technology &amp; startups</li>
                    <li>Printing &amp; print management systems</li>
                    <li>Dental software &amp; clinic management systems</li>
                    <li>Embroidery &amp; textile automation</li>
                    <li>CNC machine software and control systems</li>
                  </ul>
                </div>
              </details>

              <details className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer select-none text-sm font-semibold text-slate-900">7. How large is your team?</summary>
                <div className="mt-3 text-sm text-slate-600 leading-relaxed">
                  <p>We work with a distributed team of 30+ highly skilled engineers located in multiple countries worldwide.</p>
                </div>
              </details>

              <details className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer select-none text-sm font-semibold text-slate-900">8. Do you offer nearshore and offshore development?</summary>
                <div className="mt-3 text-sm text-slate-600 leading-relaxed">
                  <p>
                    Yes. We provide nearshore and offshore software development, reverse engineering, and crack services to help clients reduce costs while maintaining high quality and security standards.
                  </p>
                </div>
              </details>

              <details className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer select-none text-sm font-semibold text-slate-900">9. What is your typical engagement process?</summary>
                <div className="mt-3 text-sm text-slate-600 leading-relaxed">
                  <p>We usually start with a short discovery call, define scope and deliverables, then execute with weekly updates.</p>
                  <p className="mt-2">For sensitive reverse engineering/cracking requests, we may require proof of authorization.</p>
                </div>
              </details>

              <details className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer select-none text-sm font-semibold text-slate-900">10. Do you provide ongoing support?</summary>
                <div className="mt-3 text-sm text-slate-600 leading-relaxed">
                  <p>Yes. We can provide maintenance, updates, security reviews, and long-term technical support depending on the engagement.</p>
                </div>
              </details>

              <details className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer select-none text-sm font-semibold text-slate-900">11. How do I contact support?</summary>
                <div className="mt-3 text-sm text-slate-600 leading-relaxed">
                  <p>Use the Contact page or message us through the support channels listed below.</p>
                  <div className="mt-3 text-sm text-slate-600">
                    <LegalContacts />
                  </div>
                </div>
              </details>

              <details className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer select-none text-sm font-semibold text-slate-900">12. Why choose RipCrack?</summary>
                <div className="mt-3 text-sm text-slate-600 leading-relaxed">
                  <p>Clients choose RipCrack because we offer:</p>
                  <ul className="mt-2 pl-5 list-disc space-y-1">
                    <li>Proven expertise in software development, reverse engineering, and crack services</li>
                    <li>Strong focus on security and legality</li>
                    <li>On-time and within-scope delivery</li>
                    <li>Competitive pricing compared to U.S.-based teams</li>
                    <li>Long-term technical partnership mindset</li>
                  </ul>
                </div>
              </details>
              </div>
            </Card>
            ) : null}
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <div className="text-sm font-semibold text-slate-900">Contact</div>
            <LegalContacts />
          </Card>

          <Card className="p-6">
            <div className="text-sm font-semibold text-slate-900">Quick facts</div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-3 min-w-0">
                <div className="text-xs text-slate-500">Founded</div>
                <div className="mt-1 text-base font-semibold text-slate-900">2019</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3 min-w-0">
                <div className="text-xs text-slate-500">Projects</div>
                <div className="mt-1 text-base font-semibold text-slate-900">300+</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3 min-w-0">
                <div className="text-xs text-slate-500">Clients</div>
                <div className="mt-1 text-base font-semibold text-slate-900 truncate">Global</div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );

  };

  const CookiePolicy = () => (
    <section className="max-w-6xl mx-auto px-6 py-12">
      <PolicyHeader title="Cookie Policy" subtitle="EU / GDPR Compliant" />

      <Card className="p-6 mt-6">
        <style>{`
          .policy h3 { font-size: 18px; line-height: 26px; font-weight: 700; color: rgb(15 23 42); margin-top: 24px; }
          .policy p { margin-top: 10px; color: rgb(51 65 85); line-height: 1.8; }
          .policy ul { margin-top: 10px; padding-left: 18px; color: rgb(51 65 85); }
          .policy li { margin-top: 8px; list-style: disc; line-height: 1.8; }
          .policy a { color: rgb(5 150 105); text-decoration: underline; text-underline-offset: 2px; }
        `}</style>
        <div className="policy max-w-3xl">
          <p>
            This Cookie Policy explains how ripcrack.net uses cookies and similar technologies in accordance with the GDPR and EU ePrivacy Directive.
          </p>

          <h3>1. What Are Cookies?</h3>
          <p>
            Cookies are small text files stored on your device when you visit a website. They help improve functionality, security, and user experience.
          </p>

          <h3>2. Types of Cookies We Use</h3>
          <p>
            <b>a) Strictly Necessary Cookies</b>
          </p>
          <p>These cookies are essential for the Website to function properly and cannot be disabled.</p>
          <p>Examples:</p>
          <ul>
            <li>User authentication</li>
            <li>Security and fraud prevention</li>
            <li>Session management</li>
          </ul>
          <p>
            Legal basis: Legitimate interest / Contract performance
          </p>

          <p>
            <b>b) Functional Cookies</b>
          </p>
          <p>These cookies enhance usability and remember user preferences.</p>
          <p>Examples:</p>
          <ul>
            <li>Language settings</li>
            <li>Login preferences</li>
          </ul>
          <p>Legal basis: Consent</p>

          <p>
            <b>c) Analytics Cookies</b>
          </p>
          <p>These cookies help us understand how users interact with the Website (anonymized data).</p>
          <p>Examples:</p>
          <ul>
            <li>Page visits</li>
            <li>Traffic sources</li>
          </ul>
          <p>Legal basis: Consent</p>

          <p>
            <b>d) Marketing Cookies (if applicable)</b>
          </p>
          <p>Used to deliver relevant advertising and track marketing performance.</p>
          <p>Legal basis: Explicit consent</p>

          <h3>3. Cookie Consent</h3>
          <p>When you first visit our Website, you will see a cookie consent banner allowing you to:</p>
          <ul>
            <li>Accept all cookies</li>
            <li>Reject non-essential cookies</li>
            <li>Customize cookie preferences</li>
          </ul>
          <p>Non-essential cookies are used only after consent is given.</p>

          <h3>4. Managing Cookies</h3>
          <p>You can manage or delete cookies through your browser settings at any time.</p>
          <p>Please note that disabling cookies may affect Website functionality.</p>

          <h3>5. Third-Party Cookies</h3>
          <p>
            Some cookies may be placed by third-party services (e.g. analytics or payment providers). These third parties process data in accordance with their own privacy policies.
          </p>

          <h3>6. Data Protection Rights</h3>
          <p>Under GDPR, you have the right to:</p>
          <ul>
            <li>Access your personal data</li>
            <li>Correct inaccurate or incomplete data</li>
            <li>Request deletion (“Right to be Forgotten”)</li>
            <li>Restrict or object to processing</li>
            <li>Data portability</li>
            <li>Withdraw consent at any time</li>
            <li>Lodge a complaint with your local Data Protection Authority (DPA)</li>
          </ul>
          <p>To exercise these rights, contact us at support@ripcrack.net.</p>

          <h3>7. Security of Data</h3>
          <p>
            We implement appropriate technical and organizational measures to protect your personal data against unauthorized access, loss or destruction, alteration or disclosure.
          </p>
          <p>However, no online system can be guaranteed 100% secure.</p>

          <h3>8. Cookies &amp; Tracking</h3>
          <p>We may use cookies and similar technologies to:</p>
          <ul>
            <li>Ensure website functionality</li>
            <li>Improve user experience</li>
            <li>Analyze traffic (anonymized)</li>
          </ul>
          <p>You can manage or disable cookies through your browser settings. Where required by law, cookie consent is obtained.</p>

          <h3>9. International Data Transfers</h3>
          <p>
            If personal data is transferred outside the EU, we ensure appropriate safeguards are in place, including Standard Contractual Clauses (SCCs).
          </p>

          <h3>10. Children’s Privacy</h3>
          <p>Our Services are not intended for individuals under the age of 16. We do not knowingly collect personal data from children.</p>

          <h3>11. Changes to This Cookie Policy</h3>
          <p>We may update this Cookie Policy to reflect legal, technical, or operational changes. Updates will be posted on this page.</p>
          <p>Continued use of our Website and Services constitutes acceptance of the updated policy.</p>

          <h3>12. Contact Us</h3>
          <p>If you have any questions about this Cookie Policy, GDPR rights, or how your data is handled, contact us:</p>
          <LegalContacts />
        </div>
      </Card>
    </section>
  );

  const PrivacyPolicy = () => (
    <section className="max-w-6xl mx-auto px-6 py-12">
      <PolicyHeader title="Privacy Policy" subtitle="EU / GDPR Compliant" />

      <Card className="p-6 mt-6">
        <style>{`
          .policy h3 { font-size: 18px; line-height: 26px; font-weight: 700; color: rgb(15 23 42); margin-top: 24px; }
          .policy p { margin-top: 10px; color: rgb(51 65 85); line-height: 1.8; }
          .policy ul { margin-top: 10px; padding-left: 18px; color: rgb(51 65 85); }
          .policy li { margin-top: 8px; list-style: disc; line-height: 1.8; }
          .policy a { color: rgb(5 150 105); text-decoration: underline; text-underline-offset: 2px; }
        `}</style>
        <div className="policy max-w-3xl">
          <p>
            This Privacy Policy explains how ripcrack.net (“Company”, “we”, “us”, “our”) collects, uses, stores, and protects your personal data when you use our Website and Services.
          </p>
          <p>
            We are committed to protecting your privacy and complying with the General Data Protection Regulation (GDPR) (EU) 2016/679.
          </p>

          <h3>1. Data Controller</h3>
          <p>The data controller responsible for your personal data is:</p>
          <p>
            <b>ripcrack.net</b>
            <br />
            Email: support@ripcrack.net
            <br />
            Website: https://ripcrack.net/
          </p>

          <h3>2. Personal Data We Collect</h3>
          <p>We may collect and process the following categories of personal data:</p>
          <ul>
            <li>Identity data (name, surname)</li>
            <li>Contact data (email address, phone number)</li>
            <li>Account data (username, user ID)</li>
            <li>Transaction data (order details, payment method, refund requests)</li>
            <li>Technical data (IP address, browser type, device information)</li>
            <li>Communication data (emails, messages, support requests)</li>
          </ul>
          <p>We do not intentionally collect sensitive personal data.</p>

          <h3>3. Legal Basis for Processing (GDPR Article 6)</h3>
          <p>We process your personal data based on the following legal grounds:</p>
          <ul>
            <li>Performance of a contract – to process orders, returns, and refunds</li>
            <li>Legal obligation – accounting, tax, and consumer protection laws</li>
            <li>Legitimate interest – customer support, fraud prevention, service improvement</li>
            <li>Consent – where explicitly required (e.g. marketing, cookies)</li>
          </ul>

          <h3>4. Use of Personal Data</h3>
          <p>Your personal data is used strictly for:</p>
          <ul>
            <li>Processing purchases, returns, and refunds</li>
            <li>Managing user accounts</li>
            <li>Providing customer support</li>
            <li>Communicating service-related information</li>
            <li>Complying with legal obligations</li>
            <li>Preventing fraud and abuse</li>
          </ul>
          <p>Data collected for refunds and returns is used only for those purposes, in line with our Return &amp; Refund Policy.</p>

          <h3>5. Data Sharing &amp; Third Parties</h3>
          <p>We do not sell your personal data.</p>
          <p>We may share data only with trusted third parties, such as:</p>
          <ul>
            <li>Payment processors</li>
            <li>Hosting and infrastructure providers</li>
            <li>Accounting or legal authorities (when required by law)</li>
          </ul>
          <p>All third parties are GDPR-compliant and process data under strict confidentiality agreements.</p>

          <h3>6. Data Retention</h3>
          <p>We retain personal data only as long as necessary:</p>
          <ul>
            <li>Order and transaction data: as required by tax and accounting laws</li>
            <li>Support and communication data: until issue resolution</li>
            <li>Account data: until account deletion is requested</li>
          </ul>
          <p>When data is no longer required, it is securely deleted or anonymized.</p>

          <h3>7. Your Rights Under GDPR</h3>
          <p>If you are an EU resident, you have the right to:</p>
          <ul>
            <li>Access your personal data</li>
            <li>Correct inaccurate or incomplete data</li>
            <li>Request deletion (“Right to be Forgotten”)</li>
            <li>Restrict or object to processing</li>
            <li>Data portability</li>
            <li>Withdraw consent at any time</li>
            <li>Lodge a complaint with your local Data Protection Authority (DPA)</li>
          </ul>
          <p>To exercise these rights, contact us at support@ripcrack.net.</p>

          <h3>8. Security of Data</h3>
          <p>
            We implement appropriate technical and organizational measures to protect your personal data against unauthorized access, loss or destruction, alteration or disclosure.
          </p>
          <p>However, no online system can be guaranteed 100% secure.</p>

          <h3>9. Cookies &amp; Tracking</h3>
          <p>We may use cookies and similar technologies to:</p>
          <ul>
            <li>Ensure website functionality</li>
            <li>Improve user experience</li>
            <li>Analyze traffic (anonymized)</li>
          </ul>
          <p>You can manage or disable cookies through your browser settings. Where required by law, cookie consent is obtained.</p>

          <h3>10. International Data Transfers</h3>
          <p>
            If personal data is transferred outside the EU, we ensure appropriate safeguards are in place, including Standard Contractual Clauses (SCCs).
          </p>

          <h3>11. Children’s Privacy</h3>
          <p>Our Services are not intended for individuals under the age of 16. We do not knowingly collect personal data from children.</p>

          <h3>12. Changes to This Privacy Policy</h3>
          <p>We may update this Privacy Policy to reflect legal, technical, or operational changes. Updates will be posted on this page.</p>
          <p>Continued use of our Website and Services constitutes acceptance of the updated policy.</p>

          <h3>13. Contact Us</h3>
          <p>If you have any questions about this Privacy Policy, GDPR rights, or how your data is handled, contact us:</p>
          <LegalContacts />
        </div>
      </Card>
    </section>
  );

  const Product = () => {
    if (!selectedProduct) return null;
    const stats = productStats[selectedProduct.id] || { views: selectedProduct.views, sold: selectedProduct.sold };
    const images = selectedProduct.images || [];
    
    // Display: personal price first; only if admin set no personal, show business
    let effectivePrice: string;
    const businessPrice = String((selectedProduct as any).businessPrice || "").trim();
    const personalPrice = String((selectedProduct as any).personalPrice || "").trim();
    const hasPersonal = personalPrice && personalPrice !== "Price on request";
    const hasBusiness = businessPrice && businessPrice !== "Price on request";
    if (hasPersonal) {
      effectivePrice = `${personalPrice}(personal)`;
    } else if (hasBusiness) {
      effectivePrice = `${businessPrice}(business)`;
    } else {
      effectivePrice = selectedProduct.price;
    }

    const primary = images[0];

    return (
      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <button onClick={() => setPage("shop")} className="hover:text-slate-700">
            Shop
          </button>
          <span>/</span>
          <span className="text-slate-700">{selectedProduct.title}</span>
        </div>

        <div className="mt-6 grid lg:grid-cols-2 gap-8 items-start">
          <Card className="p-6">
            {primary ? (
              <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-50">
                <img src={primary} alt={selectedProduct.title} className="w-full h-72 object-cover" loading="lazy" />
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden border border-slate-200 bg-gradient-to-br from-slate-100 to-slate-200 h-72" />
            )}

            {images.length > 1 ? (
              <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
                {images.slice(0, 8).map((src) => (
                  <div key={src} className="h-14 w-20 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shrink-0">
                    <img src={src} alt="" className="h-14 w-20 object-cover" loading="lazy" />
                  </div>
                ))}
              </div>
            ) : null}
          </Card>

          <Card className="p-6">
            <div className="text-2xl font-semibold text-slate-900">{selectedProduct.title}</div>
            <div className="mt-2 text-sm text-slate-600">Category: {selectedProduct.category}</div>
            {selectedProduct.description ? (
              <div className="mt-4 text-sm text-slate-700 leading-relaxed whitespace-pre-line">{selectedProduct.description}</div>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {selectedProduct.badge ? <div className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-1 rounded-full">{selectedProduct.badge}</div> : null}
              <div className="text-xs bg-slate-50 text-slate-700 border border-slate-200 px-2 py-1 rounded-full inline-flex items-center gap-1">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-slate-600">
                  <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth="2" />
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                </svg>
                {stats.views}
              </div>
              <div className="text-xs bg-slate-50 text-slate-700 border border-slate-200 px-2 py-1 rounded-full inline-flex items-center gap-1">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-slate-600">
                  <path d="M6 6h15l-1.5 9h-12z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <path d="M6 6l-2-3H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="9" cy="20" r="1.5" fill="currentColor" />
                  <circle cx="18" cy="20" r="1.5" fill="currentColor" />
                </svg>
                {stats.sold}
              </div>
            </div>
            <div className="mt-6 text-lg font-semibold text-slate-900">{effectivePrice}</div>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => {
                  handleAddToCartClick(selectedProduct, 1);
                }}
                className="flex-1 rounded-xl bg-emerald-600 text-white px-5 py-3 text-sm font-medium hover:bg-emerald-700"
              >
                Add to cart
              </button>
              <button onClick={() => setPage("shop")} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm hover:bg-slate-50">
                Back
              </button>
            </div>
          </Card>
        </div>
      </section>
    );
  };

  const Pricing = () => (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <SectionTitle title={t("nav.pricing")} subtitle="Pick a plan and request by email." />
      
      {/* Toggle Personal/Business */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex rounded-full bg-slate-100 p-1">
          <button
            onClick={() => setSelectedType("Personal")}
            className={`px-6 py-2 rounded-full text-sm font-medium transition ${
              selectedType === "Personal" ? "bg-white shadow text-slate-900" : "text-slate-600"
            }`}
          >
            Personal
          </button>
          <button
            onClick={() => setSelectedType("Business")}
            className={`px-6 py-2 rounded-full text-sm font-medium transition ${
              selectedType === "Business" ? "bg-white shadow text-slate-900" : "text-slate-600"
            }`}
          >
            Business
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        {pricingPlans.map((plan) => (
          <Card key={plan.id || plan.name} className={`p-6 relative ${plan.popular ? "ring-2 ring-emerald-500" : ""}`}>
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                Most Popular
              </div>
            )}
            <div className="text-center">
              <div className="text-lg font-semibold text-slate-900">{plan.name}</div>
              <div className="text-sm text-slate-500 mt-1">{plan.tagline}</div>
              <div className="mt-4">
                <span className="text-3xl font-bold text-slate-900">
                  {selectedType === "Personal" ? plan.lifetimePrice : plan.annualPrice}
                </span>
              </div>
            </div>
            
            <ul className="mt-6 space-y-3">
              {plan.features.map((feature, idx) => (
                <li key={idx} className="flex items-center gap-2 text-sm text-slate-700">
                  <span className="text-emerald-500">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
            
            <button
              onClick={() => {
                if (!guardCheckout()) return;
                // Add pricing plan to cart with the selected price
                const personalUnitPrice = parsePriceToNumber(plan.lifetimePrice);
                const businessUnitPrice = parsePriceToNumber(plan.annualPrice);
                const unitPrice = selectedType === "Personal" ? personalUnitPrice : businessUnitPrice;
                const planAsCartItem: CartItemT = {
                  // Always use a negative ID to avoid colliding with real Product IDs
                  productId: -Math.abs(Number(plan.id ?? Date.now())),
                  title: plan.name,
                  unitPrice,
                  personalUnitPrice,
                  businessUnitPrice,
                  qty: 1,
                  productType: selectedType,
                };
                setCartItems([planAsCartItem]);
                setPage("checkout");
              }}
              className={`mt-6 w-full py-3 rounded-xl text-sm font-medium transition ${
                plan.popular
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Buy now
            </button>
          </Card>
        ))}
      </div>

      {pricingPlans.length === 0 && (
        <Card className="p-6">
          <div className="text-sm text-slate-600 text-center">No pricing plans available.</div>
        </Card>
      )}
    </section>
  );

  const Admin = () => {
    const adminNavigate = useNavigate();
    const adminLocation = useLocation();
    
    // Get admin page from URL
    const getAdminPageFromPath = (pathname: string): string => {
      const match = pathname.match(/^\/admin\/(.+)$/);
      if (match) {
        return match[1] || "dashboard";
      }
      return "dashboard";
    };
    
    const [adminPage, setAdminPageState] = useState<string>(() => getAdminPageFromPath(adminLocation.pathname));
    
    // Sync admin page with URL
    useEffect(() => {
      const newAdminPage = getAdminPageFromPath(adminLocation.pathname);
      if (newAdminPage !== adminPage) {
        setAdminPageState(newAdminPage);
      }
    }, [adminLocation.pathname]);
    
    // Enhanced setAdminPage that also updates URL
    const setAdminPage = useCallback((newPage: string) => {
      setAdminPageState(newPage);
      const route = `/admin/${newPage}`;
      if (adminLocation.pathname !== route) {
        adminNavigate(route, { replace: true });
      }
      // Also save to localStorage for backward compatibility
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem("adminPage", newPage);
        } catch {
          // ignore
        }
      }
    }, [adminNavigate, adminLocation.pathname]);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [subscriptionRefreshKey, setSubscriptionRefreshKey] = useState(0);
    
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [ok, setOk] = useState<string | null>(null);

    useEffect(() => {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem("adminPage", adminPage);
      } catch {
        // ignore
      }
    }, [adminPage]);

    const handleDownloadSubscriptionsCsv = useCallback(async () => {
      try {
        const json = await gatewayFetch("/admin/subscriptions", { method: "GET" });
        const items = Array.isArray(json?.items) ? json.items : [];
        const headers = ["No", "Email", "Subscribed at"];
        const rows = items.map((s: any, i: number) => [
          i + 1,
          (s.email || "").replace(/"/g, '""'),
          s.createdAt ? new Date(s.createdAt).toISOString() : "",
        ]);
        const csv = [headers.join(","), ...rows.map((r: any[]) => r.map((c: any) => `"${String(c)}"`).join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `newsletter-subscriptions-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e: any) {
        alert(e?.message || "Failed to download CSV");
      }
    }, []);

    const handleClearSubscriptions = useCallback(async () => {
      if (!window.confirm("Clear all newsletter subscriptions? This cannot be undone.")) return;
      try {
        await gatewayFetch("/admin/subscriptions/clear", { method: "DELETE" });
        setSubscriptionRefreshKey((k) => k + 1);
      } catch (e: any) {
        alert(e?.message || "Failed to clear subscriptions");
      }
    }, []);

    const [orders, setOrders] = useState<any[]>([]);
    const [orderModalOpen, setOrderModalOpen] = useState(false);
    const [activeOrder, setActiveOrder] = useState<any | null>(null);
    const [orderStatusBusy, setOrderStatusBusy] = useState(false);
    const [orderStatusErr, setOrderStatusErr] = useState<string | null>(null);
    const [orderStatusOk, setOrderStatusOk] = useState<string | null>(null);

    const [analytics, setAnalytics] = useState<any | null>(null);
    const [analyticsBusy, setAnalyticsBusy] = useState(false);
    const [analyticsErr, setAnalyticsErr] = useState<string | null>(null);

    const [users, setUsers] = useState<any[]>([]);
    const [usersBusy, setUsersBusy] = useState(false);
    const [usersErr, setUsersErr] = useState<string | null>(null);

    const [ordersExportStatus, setOrdersExportStatus] = useState<"ALL" | "REQUESTED" | "CONFIRMED" | "REJECTED">("ALL");
    const [ordersExportFrom, setOrdersExportFrom] = useState("");
    const [ordersExportTo, setOrdersExportTo] = useState("");

    const [fraudEntriesAdmin, setFraudEntriesAdmin] = useState<any[]>([]);
    const [fraudEntriesBusy, setFraudEntriesBusy] = useState(false);
    const [fraudEntriesErr, setFraudEntriesErr] = useState<string | null>(null);

    const [fraudSubmissionsAdmin, setFraudSubmissionsAdmin] = useState<any[]>([]);
    const [fraudSubmissionsBusy, setFraudSubmissionsBusy] = useState(false);
    const [fraudSubmissionsErr, setFraudSubmissionsErr] = useState<string | null>(null);

    const fraudEntriesFetchInFlightRef = useRef(false);
    const fraudEntriesLastFailAtRef = useRef(0);
    const fraudEntriesLastFetchAtRef = useRef(0);
    const fraudSubmissionsFetchInFlightRef = useRef(false);
    const fraudSubmissionsLastFailAtRef = useRef(0);
    const fraudSubmissionsLastFetchAtRef = useRef(0);

    const [specialSubmissionsAdmin, setSpecialSubmissionsAdmin] = useState<any[]>([]);
    const [specialSubmissionsBusy, setSpecialSubmissionsBusy] = useState(false);
    const [specialSubmissionsErr, setSpecialSubmissionsErr] = useState<string | null>(null);
    const specialSubmissionsFetchInFlightRef = useRef(false);
    const specialSubmissionsLastFailAtRef = useRef(0);
    const specialSubmissionsLastFetchAtRef = useRef(0);

    const [footerLinksAdmin, setFooterLinksAdmin] = useState<any[]>([]);
    const [footerLinksBusy, setFooterLinksBusy] = useState(false);

    // Knowledge Base management states
    const [kbHealth, setKbHealth] = useState<{ ok: boolean; kbChunks: number } | null>(null);
    const [kbListState, setKbListState] = useState<{ total: number; limit: number; offset: number; items: any[] } | null>(null);
    const [kbTitle, setKbTitle] = useState("Pricing");
    const [kbSource, setKbSource] = useState("manual");
    const [kbContent, setKbContent] = useState("");
    const [kbBusy, setKbBusy] = useState(false);
    const [kbMsg, setKbMsg] = useState<string | null>(null);

    // Chat management states
    const [chatSessions, setChatSessions] = useState<any[]>([]);
    const [chatSessionsBusy, setChatSessionsBusy] = useState(false);
    const [chatSessionsErr, setChatSessionsErr] = useState<string | null>(null);
    const [selectedChatSession, setSelectedChatSession] = useState<any | null>(null);
    const [chatMessages, setChatMessages] = useState<any[]>([]);
    const [chatMessageInput, setChatMessageInput] = useState("");
    const [chatSending, setChatSending] = useState(false);
    const chatSendingRef = useRef(false);
    const chatSessionsBusyRef = useRef(false);
    const [chatStatusFilter, setChatStatusFilter] = useState<string>("");
    
    // Sync ref with state
    useEffect(() => {
      chatSendingRef.current = chatSending;
    }, [chatSending]);
    
    useEffect(() => {
      chatSessionsBusyRef.current = chatSessionsBusy;
    }, [chatSessionsBusy]);

    // FAQ management states
    const [chatFAQs, setChatFAQs] = useState<any[]>([]);
    const [chatFAQsBusy, setChatFAQsBusy] = useState(false);
    const [chatFAQsErr, setChatFAQsErr] = useState<string | null>(null);
    const [footerLinksErr, setFooterLinksErr] = useState<string | null>(null);
    const [footerLinksOk, setFooterLinksOk] = useState<string | null>(null);

    const canView = me?.role === "ADMIN" || me?.role === "AGENT";

    const availablePages = ["home", "shop", "pricing", "fraud", "contact", "about", "faq", "special", "coupons", "refund", "privacy", "cookies", "disclaimer", "terms"];

    // Chat functions
    const chatStatusFilterRef = useRef(chatStatusFilter);
    useEffect(() => {
      chatStatusFilterRef.current = chatStatusFilter;
    }, [chatStatusFilter]);
    
    // Store refreshChatSessions in a ref to avoid dependency issues
    const refreshChatSessionsRef = useRef<(() => Promise<void>) | null>(null);
    
    const refreshChatSessions = useCallback(async () => {
      if (!canView || adminPage !== "chat") return;
      // Prevent multiple simultaneous requests using ref
      if (chatSessionsBusyRef.current) return;
      
      chatSessionsBusyRef.current = true;
      setChatSessionsBusy(true);
      setChatSessionsErr(null);
      try {
        const params = chatStatusFilterRef.current ? `?status=${chatStatusFilterRef.current}` : "";
        const json = await gatewayFetch(`/admin/chat/sessions${params}`, { method: "GET" });
        setChatSessions(json?.items || []);
      } catch (e: any) {
        setChatSessionsErr(e?.message || "Failed to load chat sessions");
        // Don't throw - let the error be handled by the UI
      } finally {
        chatSessionsBusyRef.current = false;
        setChatSessionsBusy(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canView, adminPage]);
    
    // Keep ref in sync
    useEffect(() => {
      refreshChatSessionsRef.current = refreshChatSessions;
    }, [refreshChatSessions]);

    const loadChatSession = useCallback(async (sessionId: string) => {
      if (!canView) return;
      try {
        const json = await gatewayFetch(`/admin/chat/sessions/${sessionId}`, { method: "GET" });
        setSelectedChatSession(json?.item || null);
        setChatMessages(json?.item?.messages || []);
      } catch (e: any) {
        setChatSessionsErr(e?.message || "Failed to load chat session");
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canView]);

    const sendChatMessage = useCallback(async () => {
      if (!selectedChatSession || !chatMessageInput.trim() || chatSending) return;
      
      const messageText = chatMessageInput.trim();
      const sessionId = selectedChatSession.id;
      setChatSending(true);
      chatSendingRef.current = true;
      setChatSessionsErr(null);
      
      // Clear input immediately for better UX
      setChatMessageInput("");
      
      // Optimistically add message to UI
      const tempMessage = {
        id: `temp-${Date.now()}`,
        sessionId: sessionId,
        role: "ADMIN" as const,
        text: messageText,
        createdAt: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, tempMessage]);
      
      try {
        const response = await gatewayFetch(`/admin/chat/sessions/${sessionId}/message`, {
          method: "POST",
          body: JSON.stringify({ text: messageText }),
        });
        
        // Only reload the current session messages, don't refresh the entire list
        // This prevents unnecessary re-renders and input field refresh
        try {
          const json = await gatewayFetch(`/admin/chat/sessions/${sessionId}`, { method: "GET" });
          if (json?.item && json.item.id === sessionId) {
            setChatMessages(json.item?.messages || []);
            // Only update status if it changed, don't replace entire session object
            // This prevents input field from being reset
            setSelectedChatSession((prev) => {
              if (!prev || prev.id !== sessionId) return prev;
              if (json.item.status !== prev.status) {
                return { ...prev, status: json.item.status };
              }
              return prev; // Return same object to prevent re-render
            });
          }
        } catch (loadErr) {
          // If reload fails, just remove temp message and add the response message
          if (response?.item) {
            setChatMessages((prev) => {
              const filtered = prev.filter((m) => m.id !== tempMessage.id);
              return [...filtered, response.item];
            });
          }
        }
        
        // Silently refresh session list in background (don't await)
        const refreshFn = refreshChatSessionsRef.current;
        if (refreshFn) refreshFn().catch(() => {});
      } catch (e: any) {
        // Remove optimistic message on error
        setChatMessages((prev) => prev.filter((m) => m.id !== tempMessage.id));
        setChatMessageInput(messageText);
        const errorMsg = e?.message || "Failed to send message";
        setChatSessionsErr(errorMsg);
        console.error("Failed to send chat message:", errorMsg, e);
        alert(errorMsg);
      } finally {
        setChatSending(false);
        chatSendingRef.current = false;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedChatSession, chatMessageInput, chatSending]);

    const updateChatStatus = useCallback(async (sessionId: string, status: "BOT" | "WAITING_FOR_HUMAN" | "HUMAN" | "CLOSED") => {
      if (!canView) return;
      try {
        await gatewayFetch(`/admin/chat/sessions/${sessionId}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        });
        const refreshFn = refreshChatSessionsRef.current;
        if (refreshFn) await refreshFn();
        if (selectedChatSession?.id === sessionId) {
          await loadChatSession(sessionId);
        }
      } catch (e: any) {
        setChatSessionsErr(e?.message || "Failed to update status");
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canView, loadChatSession, selectedChatSession?.id]);

    // FAQ functions
    const refreshChatFAQs = async () => {
      if (!canView) return;
      // Prevent multiple simultaneous requests
      if (chatFAQsBusy) return;
      
      setChatFAQsBusy(true);
      setChatFAQsErr(null);
      try {
        const json = await gatewayFetch("/admin/chat/faqs", { method: "GET" });
        setChatFAQs(json?.items || []);
      } catch (e: any) {
        const errorMsg = e?.message || "Failed to load FAQs";
        console.error("Failed to load FAQs:", errorMsg);
        setChatFAQsErr(errorMsg);
        setChatFAQs([]);
        // Don't throw - let the error be handled by the UI
      } finally {
        setChatFAQsBusy(false);
      }
    };

    const importDefaultFAQs = async () => {
      if (!canView) return;
      setChatFAQsBusy(true);
      setChatFAQsErr(null);
      try {
        const json = await gatewayFetch("/admin/chat/faqs/import-defaults", { method: "POST" });
        const list = await gatewayFetch("/admin/chat/faqs", { method: "GET" });
        setChatFAQs(list?.items || []);
        const msg = `Imported default FAQs: created ${json?.createdCount ?? 0}, skipped ${json?.skippedCount ?? 0}`;
        setChatFAQsErr(msg);
      } catch (e: any) {
        setChatFAQsErr(e?.message || "Failed to import default FAQs");
      } finally {
        setChatFAQsBusy(false);
      }
    };

    const refreshOrders = async () => {
      if (!canView) return;
      setErr(null);
      try {
        const json = await gatewayFetch("/admin/orders", { method: "GET" });
        setOrders(json?.items || []);
      } catch (e: any) {
        const errorMsg = e?.message || "Failed to load orders";
        console.error("Failed to load orders:", errorMsg);
        setErr(errorMsg);
        setOrders([]);
      }
    };

    const refreshFooterLinksAdmin = async () => {
      if (!canView) return;
      setFooterLinksBusy(true);
      setFooterLinksErr(null);
      try {
        const json = await gatewayFetch("/admin/footer-links", { method: "GET" });
        setFooterLinksAdmin(json?.items || []);
      } catch (e: any) {
        const errorMsg = e?.message || "Failed to load footer links";
        console.error("Failed to load footer links:", errorMsg);
        setFooterLinksAdmin([]);
        setFooterLinksErr(errorMsg);
      } finally {
        setFooterLinksBusy(false);
      }
    };

    const refreshUsers = async () => {
      if (!canView) return;
      setUsersBusy(true);
      setUsersErr(null);
      try {
        const json = await gatewayFetch("/admin/users", { method: "GET" });
        setUsers(json?.items || []);
      } catch (e: any) {
        const errorMsg = e?.message || "Failed to load users";
        console.error("Failed to load users:", errorMsg);
        setUsers([]);
        setUsersErr(errorMsg);
      } finally {
        setUsersBusy(false);
      }
    };

    const refreshFraudEntriesAdmin = async (forceRefresh?: boolean) => {
      if (!canView) return;

      // Prevent multiple simultaneous requests; allow force refresh (e.g. after Approve)
      if (fraudEntriesBusy || fraudEntriesFetchInFlightRef.current) return;
      if (!forceRefresh) {
        const now = Date.now();
        if (fraudEntriesLastFetchAtRef.current && now - fraudEntriesLastFetchAtRef.current < 4000) return;
        if (fraudEntriesLastFailAtRef.current && now - fraudEntriesLastFailAtRef.current < 4000) return;
      }
      fraudEntriesFetchInFlightRef.current = true;

      setFraudEntriesBusy(true);
      setFraudEntriesErr(null);
      try {
        const json = await gatewayFetch("/admin/fraud/entries", { method: "GET" });
        setFraudEntriesAdmin(json?.items || []);
        fraudEntriesLastFetchAtRef.current = Date.now();
      } catch (e: any) {
        const errorMsg = e?.message || "Failed to load fraud entries";
        console.error("Failed to load fraud entries:", errorMsg);
        setFraudEntriesAdmin([]);
        setFraudEntriesErr(errorMsg);
        fraudEntriesLastFailAtRef.current = Date.now();
        // Don't throw - let the error be handled by the UI
      } finally {
        setFraudEntriesBusy(false);
        fraudEntriesFetchInFlightRef.current = false;
      }
    };

    const refreshFraudSubmissionsAdmin = async (forceRefresh?: boolean) => {
      if (!canView) return;

      // Prevent multiple simultaneous requests; allow force refresh (e.g. Refresh button)
      if (fraudSubmissionsBusy || fraudSubmissionsFetchInFlightRef.current) return;
      if (!forceRefresh) {
        const now = Date.now();
        if (fraudSubmissionsLastFetchAtRef.current && now - fraudSubmissionsLastFetchAtRef.current < 4000) return;
        if (fraudSubmissionsLastFailAtRef.current && now - fraudSubmissionsLastFailAtRef.current < 4000) return;
      }
      fraudSubmissionsFetchInFlightRef.current = true;

      setFraudSubmissionsBusy(true);
      setFraudSubmissionsErr(null);
      try {
        const json = await gatewayFetch("/admin/fraud/submissions", { method: "GET" });
        setFraudSubmissionsAdmin(json?.items || []);
        fraudSubmissionsLastFetchAtRef.current = Date.now();
      } catch (e: any) {
        setFraudSubmissionsAdmin([]);
        setFraudSubmissionsErr(e?.message || "Failed to load fraud submissions");
        fraudSubmissionsLastFailAtRef.current = Date.now();
      } finally {
        setFraudSubmissionsBusy(false);
        fraudSubmissionsFetchInFlightRef.current = false;
      }
    };

    const refreshSpecialSubmissionsAdmin = async () => {
      if (!canView) return;

      // Prevent multiple simultaneous requests + avoid hammering when backend is down
      if (specialSubmissionsBusy || specialSubmissionsFetchInFlightRef.current) return;
      const now = Date.now();
      if (specialSubmissionsLastFetchAtRef.current && now - specialSubmissionsLastFetchAtRef.current < 4000) return;
      if (specialSubmissionsLastFailAtRef.current && now - specialSubmissionsLastFailAtRef.current < 4000) return;
      specialSubmissionsFetchInFlightRef.current = true;

      setSpecialSubmissionsBusy(true);
      setSpecialSubmissionsErr(null);
      try {
        const json = await gatewayFetch("/admin/special", { method: "GET" });
        setSpecialSubmissionsAdmin(json?.items || []);
        specialSubmissionsLastFetchAtRef.current = Date.now();
      } catch (e: any) {
        setSpecialSubmissionsAdmin([]);
        setSpecialSubmissionsErr(e?.message || "Failed to load special crack submissions");
        specialSubmissionsLastFailAtRef.current = Date.now();
      } finally {
        setSpecialSubmissionsBusy(false);
        specialSubmissionsFetchInFlightRef.current = false;
      }
    };

    const startEditFraudEntry = (x: any) => {
      setFraudEntryEditingId(Number(x?.id || 0) || null);
      setFraudEntryEdit({
        name: String(x?.name || ""),
        platform: String(x?.platform || "Telegram"),
        handle: String(x?.handle || ""),
        note: String(x?.note || ""),
        details: String(x?.details || ""),
        evidenceUrl: String(x?.evidenceUrl || ""),
      });
    };

    const createFraudEntry = async () => {
      if (!canView) return;
      if (!String(fraudEntryNew?.name || "").trim()) return;
      setFraudEntriesBusy(true);
      setFraudEntriesErr(null);
      try {
        await gatewayFetch("/admin/fraud/entries", {
          method: "POST",
          body: JSON.stringify({
            name: String(fraudEntryNew?.name || "").trim(),
            platform: String(fraudEntryNew?.platform || "Telegram"),
            handle: String(fraudEntryNew?.handle || "").trim(),
            note: String(fraudEntryNew?.note || ""),
            details: String(fraudEntryNew?.details || ""),
            evidenceUrl: String(fraudEntryNew?.evidenceUrl || ""),
          }),
        });
        setFraudEntryNew({ name: "", platform: "Telegram", handle: "", note: "", details: "", evidenceUrl: "" });
        await refreshFraudEntriesAdmin();
      } catch (e: any) {
        setFraudEntriesErr(e?.message || "Failed to create fraud entry");
      } finally {
        setFraudEntriesBusy(false);
      }
    };

    const updateFraudEntry = async () => {
      if (!canView || !fraudEntryEditingId) return;
      setFraudEntriesBusy(true);
      setFraudEntriesErr(null);
      try {
        await gatewayFetch(`/admin/fraud/entries/${fraudEntryEditingId}`, {
          method: "PUT",
          body: JSON.stringify({
            name: String(fraudEntryEdit?.name || "").trim(),
            platform: String(fraudEntryEdit?.platform || "Telegram"),
            handle: String(fraudEntryEdit?.handle || "").trim(),
            note: String(fraudEntryEdit?.note || ""),
            details: String(fraudEntryEdit?.details || ""),
            evidenceUrl: String(fraudEntryEdit?.evidenceUrl || ""),
          }),
        });
        setFraudEntryEditingId(null);
        setFraudEntryEdit({ name: "", platform: "Telegram", handle: "", note: "", details: "", evidenceUrl: "" });
        await refreshFraudEntriesAdmin();
      } catch (e: any) {
        setFraudEntriesErr(e?.message || "Failed to update fraud entry");
      } finally {
        setFraudEntriesBusy(false);
      }
    };

    const deleteFraudEntry = async (id: number) => {
      if (!canView) return;
      if (!confirm("Delete this fraud entry?")) return;
      setFraudEntriesBusy(true);
      setFraudEntriesErr(null);
      try {
        await gatewayFetch(`/admin/fraud/entries/${id}`, { method: "DELETE" });
        await refreshFraudEntriesAdmin();
      } catch (e: any) {
        const isNotFound = e?.status === 404;
        setFraudEntriesErr(isNotFound ? "Entry was already deleted." : (e?.message || "Failed to delete fraud entry"));
        if (isNotFound) await refreshFraudEntriesAdmin();
      } finally {
        setFraudEntriesBusy(false);
      }
    };

    const importDefaultFraudEntries = async () => {
      if (!canView) return;
      setFraudEntriesBusy(true);
      setFraudEntriesErr(null);
      try {
        const json = await gatewayFetch("/admin/fraud/entries/import-defaults", { method: "POST" });
        await refreshFraudEntriesAdmin();
        setFraudEntriesErr(`Imported default fraud entries: created ${json?.createdCount ?? 0}, skipped ${json?.skippedCount ?? 0}`);
      } catch (e: any) {
        setFraudEntriesErr(e?.message || "Failed to import default fraud entries");
      } finally {
        setFraudEntriesBusy(false);
      }
    };

    const downloadCsv = async (path: string, filename: string) => {
      if (!canView) return;
      try {
        const token = typeof window !== "undefined" ? window.localStorage.getItem("token") : null;
        const effectiveToken = token && isProbablyJwt(token) ? token : null;

        const res = await fetch(`${gatewayBase}${path}`, {
          method: "GET",
          headers: {
            ...(effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {}),
          },
          credentials: "include",
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `Download failed (${res.status})`);
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (e: any) {
        alert(e?.message || "Download failed");
      }
    };

    const downloadUsersCsv = async () => {
      await downloadCsv("/admin/users/export.csv", `users_${new Date().toISOString().slice(0, 10)}.csv`);
    };

    const downloadOrdersCsv = async () => {
      const params = new URLSearchParams();
      params.set("status", ordersExportStatus);
      if (ordersExportFrom) params.set("from", ordersExportFrom);
      if (ordersExportTo) params.set("to", ordersExportTo);
      await downloadCsv(`/admin/orders/export.csv?${params.toString()}`, `orders_${new Date().toISOString().slice(0, 10)}.csv`);
    };

    const refreshKb = async () => {
      if (!canView || adminPage !== "knowledge") return;
      setKbMsg(null);
      try {
        const h = await gatewayFetch("/health", { method: "GET" });
        setKbHealth(h || null);
      } catch {
        setKbHealth(null);
      }
      try {
        const l = await gatewayFetch("/kb/list?limit=50&offset=0", { method: "GET" });
        setKbListState(l || null);
      } catch (e: any) {
        setKbListState(null);
        setKbMsg(e?.message || "Failed to load KB list");
      }
    };

    const ingestKb = async () => {
      if (!canView) return;
      if (!kbContent.trim() || kbContent.trim().length < 10) return;
      setKbBusy(true);
      setKbMsg(null);
      try {
        await gatewayFetch("/kb/ingest", {
          method: "POST",
          body: JSON.stringify({ title: kbTitle, source: kbSource, content: kbContent }),
        });
        setKbContent("");
        setKbMsg("✅ Saved!");
        await refreshKb();
      } catch (e: any) {
        setKbMsg(`❌ Error: ${e?.message || "unknown"}`);
      } finally {
        setKbBusy(false);
      }
    };

    const openOrder = (o: any) => {
      setOrderStatusErr(null);
      setOrderStatusOk(null);
      setActiveOrder(o);
      setOrderModalOpen(true);
    };

    const closeOrder = () => {
      setOrderModalOpen(false);
      setActiveOrder(null);
    };

    const getOrderCardClass = (status: string) => {
      const s = String(status || "").toUpperCase();
      if (s === "CONFIRMED") return "border-emerald-200 bg-emerald-50";
      if (s === "REJECTED") return "border-red-200 bg-red-50";
      return "border-slate-200 bg-white";
    };

    const canTransition = (from: string, to: string) => {
      const f = String(from || "").toUpperCase();
      const t = String(to || "").toUpperCase();
      if (f === t) return false;
      if (f === "REQUESTED" && (t === "CONFIRMED" || t === "REJECTED")) return true;
      return false;
    };

    const updateOrderStatus = async (status: "REQUESTED" | "CONFIRMED" | "REJECTED") => {
      if (!activeOrder?.id) return;
      if (!canTransition(activeOrder.status, status)) {
        setOrderStatusErr("Invalid status change");
        return;
      }
      const orderId = activeOrder.id;
      setOrderStatusBusy(true);
      setOrderStatusErr(null);
      setOrderStatusOk(null);

      // Close immediately (optimistic) so modal always disappears
      closeOrder();
      try {
        const json = await gatewayFetch(`/admin/orders/${orderId}/status`, {
          method: "PUT",
          body: JSON.stringify({ status }),
        });
        const updated = json?.item;

        // Update orders list immediately with new status
        if (updated) {
          setOrders((prev) => prev.map((x) => (x.id === updated.id ? { ...x, status: updated.status } : x)));
        } else {
          // If no updated item, update manually with new status
          setOrders((prev) => prev.map((x) => (x.id === orderId ? { ...x, status } : x)));
        }
        
        // Refresh orders in background to get latest data (after a small delay to ensure modal is closed)
        setTimeout(() => {
          refreshOrders().catch(() => {
            // Ignore errors in background refresh
          });
        }, 100);
      } catch (e: any) {
        alert(e?.message || "Failed to update status");
      } finally {
        setOrderStatusBusy(false);
      }
    };

    useEffect(() => {
      if (!canView) return;

      const isOrdersPage = adminPage === "orders" || adminPage === "dashboard";
      const isAnalyticsPage = adminPage === "analytics" || adminPage === "dashboard";
      const isUsersPage = adminPage === "users";
      const isFooterLinksPage = adminPage === "footer-links";

      // Only load data on mount, no auto-refresh to prevent form input resets
      if (isOrdersPage) refreshOrders();
      if (isAnalyticsPage) refreshAnalytics();
      if (isUsersPage) refreshUsers();
      if (isFooterLinksPage) refreshFooterLinksAdmin();

      // REMOVED: Auto-refresh polling to prevent form inputs from being reset
      // Users can manually refresh using the Refresh button if needed
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canView, adminPage]);

    useEffect(() => {
      if (canView && adminPage === "knowledge") {
        refreshKb().catch(() => {});
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canView, adminPage]);

    const CategoryManagement = () => {
      type CategoryT = {
        id: number;
        name: string;
        sortOrder: number;
        seoTitle?: string;
        seoDescription?: string;
        seoSlug?: string;
        seoOgImage?: string;
        primaryKeyword?: string;
        secondaryKeywords?: string[] | any;
      };

      const [allCategories, setAllCategories] = useState<CategoryT[]>([]);
      const [cmBusy, setCmBusy] = useState(false);
      const [cmErr, setCmErr] = useState<string | null>(null);
      const [cmOk, setCmOk] = useState<string | null>(null);

      const [name, setName] = useState("");
      const [sortOrder, setSortOrder] = useState<number>(0);
      const [seoTitle, setSeoTitle] = useState("");
      const [seoDescription, setSeoDescription] = useState("");
      const [seoSlug, setSeoSlug] = useState("");
      const [seoOgImage, setSeoOgImage] = useState("");
      const [primaryKeyword, setPrimaryKeyword] = useState("");
      const [secondaryKeywordsText, setSecondaryKeywordsText] = useState("");

      const [editingId, setEditingId] = useState<number | null>(null);
      const [editForm, setEditForm] = useState({
        name: "",
        sortOrder: 0,
        seoTitle: "",
        seoDescription: "",
        seoSlug: "",
        seoOgImage: "",
        primaryKeyword: "",
        secondaryKeywordsText: "",
      });

      const refreshAll = async () => {
        setCmErr(null);
        try {
          const json = await gatewayFetch("/admin/categories", { method: "GET" });
          setAllCategories(json?.items || []);
        } catch (e: any) {
          setCmErr(e?.message || "Failed to load categories");
        }
      };

      useEffect(() => {
        refreshAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      const createCategory = async () => {
        if (!canView) return;
        setCmBusy(true);
        setCmErr(null);
        setCmOk(null);
        try {
          await gatewayFetch("/admin/categories", {
            method: "POST",
            body: JSON.stringify({
              name,
              sortOrder: Number(sortOrder) || 0,
              seoTitle: seoTitle || "",
              seoDescription: seoDescription || "",
              seoSlug: seoSlug || "",
              seoOgImage: seoOgImage || "",
              primaryKeyword: primaryKeyword || "",
              secondaryKeywords: (secondaryKeywordsText || "")
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
            }),
          });
          setCmOk("Category created");
          setName("");
          setSortOrder(0);
          setSeoTitle("");
          setSeoDescription("");
          setSeoSlug("");
          setSeoOgImage("");
          setPrimaryKeyword("");
          setSecondaryKeywordsText("");
          await refreshAll();
        } catch (e: any) {
          setCmErr(e?.message || "Failed to create category");
        } finally {
          setCmBusy(false);
        }
      };

      const startEdit = (c: CategoryT) => {
        setEditingId(c.id);
        setEditForm({
          name: c.name || "",
          sortOrder: c.sortOrder || 0,
          seoTitle: c.seoTitle || "",
          seoDescription: c.seoDescription || "",
          seoSlug: c.seoSlug || "",
          seoOgImage: c.seoOgImage || "",
          primaryKeyword: c.primaryKeyword || "",
          secondaryKeywordsText: Array.isArray(c.secondaryKeywords)
            ? c.secondaryKeywords.join(", ")
            : "",
        });
        setCmOk(null);
        setCmErr(null);
      };

      const saveEdit = async () => {
        if (!editingId) return;
        setCmBusy(true);
        setCmErr(null);
        setCmOk(null);
        try {
          await gatewayFetch(`/admin/categories/${editingId}`, {
            method: "PUT",
            body: JSON.stringify({
              name: editForm.name,
              sortOrder: Number(editForm.sortOrder) || 0,
              seoTitle: editForm.seoTitle || "",
              seoDescription: editForm.seoDescription || "",
              seoSlug: editForm.seoSlug || "",
              seoOgImage: editForm.seoOgImage || "",
              primaryKeyword: editForm.primaryKeyword || "",
              secondaryKeywords: String(editForm.secondaryKeywordsText || "")
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
            }),
          });
          setCmOk("Category updated");
          setEditingId(null);
          await refreshAll();
        } catch (e: any) {
          setCmErr(e?.message || "Failed to update category");
        } finally {
          setCmBusy(false);
        }
      };

      const deleteCategory = async (id: number) => {
        if (!confirm("Delete this category?")) return;
        setCmBusy(true);
        setCmErr(null);
        setCmOk(null);
        try {
          await gatewayFetch(`/admin/categories/${id}`, { method: "DELETE" });
          setCmOk("Category deleted");
          if (editingId === id) setEditingId(null);
          await refreshAll();
        } catch (e: any) {
          setCmErr(e?.message || "Failed to delete category");
        } finally {
          setCmBusy(false);
        }
      };

      return (
        <div className="mt-6 space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-slate-900">Add category</div>
                <div className="text-sm text-slate-600 mt-1">Create a new category.</div>
              </div>
            </div>

            {cmErr ? <div className="mt-4 text-sm text-red-700">{cmErr}</div> : null}
            {cmOk ? <div className="mt-4 text-sm text-emerald-700">{cmOk}</div> : null}

            <div className="mt-4 grid md:grid-cols-2 gap-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Category name"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
              />
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
                placeholder="Sort order"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
              />
              <input
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                placeholder="SEO title (optional)"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
              />
              <input
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                placeholder="SEO description (optional)"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
              />
              <input
                value={seoSlug}
                onChange={(e) => setSeoSlug(e.target.value)}
                placeholder="SEO slug (optional)"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
              />
              <input
                value={seoOgImage}
                onChange={(e) => setSeoOgImage(e.target.value)}
                placeholder="OG image URL (optional)"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
              />
            </div>

            <SeoPanel
              entityType="CATEGORY"
              titleText={name}
              contentText=""
              seoTitle={seoTitle}
              seoDescription={seoDescription}
              primaryKeyword={primaryKeyword}
              setPrimaryKeyword={setPrimaryKeyword}
              secondaryKeywordsText={secondaryKeywordsText}
              setSecondaryKeywordsText={setSecondaryKeywordsText}
            />

            <button
              disabled={cmBusy || !name.trim()}
              onClick={createCategory}
              className="mt-4 w-full rounded-xl bg-emerald-600 text-white py-3 text-sm hover:bg-emerald-700 disabled:opacity-60"
            >
              {cmBusy ? "Creating..." : "Create"}
            </button>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-slate-900">Manage categories</div>
                <div className="text-sm text-slate-600 mt-1">Edit or delete existing categories.</div>
              </div>
              <button
                onClick={refreshAll}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50"
              >
                Refresh
              </button>
            </div>

            {cmErr ? <div className="mt-4 text-sm text-red-700">{cmErr}</div> : null}
            {cmOk ? <div className="mt-4 text-sm text-emerald-700">{cmOk}</div> : null}

            {editingId ? (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900">Editing #{editingId}</div>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-sm text-slate-600 hover:text-slate-900"
                  >
                    Cancel
                  </button>
                </div>
                <div className="mt-4 grid md:grid-cols-2 gap-3">
                  <input
                    value={editForm.name}
                    onChange={(e) => setEditForm((s) => ({ ...s, name: e.target.value }))}
                    placeholder="Category name"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  />
                  <input
                    type="number"
                    value={editForm.sortOrder}
                    onChange={(e) =>
                      setEditForm((s) => ({ ...s, sortOrder: Number(e.target.value) || 0 }))
                    }
                    placeholder="Sort order"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  />
                  <input
                    value={editForm.seoTitle}
                    onChange={(e) => setEditForm((s) => ({ ...s, seoTitle: e.target.value }))}
                    placeholder="SEO title (optional)"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  />
                  <input
                    value={editForm.seoDescription}
                    onChange={(e) =>
                      setEditForm((s) => ({ ...s, seoDescription: e.target.value }))
                    }
                    placeholder="SEO description (optional)"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  />
                  <input
                    value={editForm.seoSlug}
                    onChange={(e) => setEditForm((s) => ({ ...s, seoSlug: e.target.value }))}
                    placeholder="SEO slug (optional)"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  />
                  <input
                    value={editForm.seoOgImage}
                    onChange={(e) => setEditForm((s) => ({ ...s, seoOgImage: e.target.value }))}
                    placeholder="OG image URL (optional)"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  />
                </div>

                <SeoPanel
                  entityType="CATEGORY"
                  entityId={editingId}
                  titleText={editForm.name}
                  contentText=""
                  seoTitle={editForm.seoTitle}
                  seoDescription={editForm.seoDescription}
                  primaryKeyword={editForm.primaryKeyword}
                  setPrimaryKeyword={(v) => setEditForm((s) => ({ ...s, primaryKeyword: v }))}
                  secondaryKeywordsText={editForm.secondaryKeywordsText}
                  setSecondaryKeywordsText={(v) =>
                    setEditForm((s) => ({ ...s, secondaryKeywordsText: v }))
                  }
                />
                <div className="mt-4 flex gap-2">
                  <button
                    disabled={cmBusy || !editForm.name.trim()}
                    onClick={saveEdit}
                    className="flex-1 rounded-xl bg-emerald-600 text-white py-3 text-sm hover:bg-emerald-700 disabled:opacity-60"
                  >
                    Save
                  </button>
                  <button
                    disabled={cmBusy}
                    onClick={() => setEditingId(null)}
                    className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm hover:bg-slate-50 disabled:opacity-60"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-5 grid md:grid-cols-2 gap-3">
              {allCategories.length === 0 ? (
                <div className="text-sm text-slate-600">No categories.</div>
              ) : (
                allCategories.map((c) => (
                  <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900">{c.name}</div>
                        <div className="text-xs text-slate-500">
                          Sort: {c.sortOrder} {c.seoTitle ? `· ${c.seoTitle}` : ""}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => startEdit(c)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteCategory(c.id)}
                          className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      );
    };

    const ProductManagement = () => {
      const [allProducts, setAllProducts] = useState<ProductT[]>([]);
      const [pmBusy, setPmBusy] = useState(false);
      const [pmErr, setPmErr] = useState<string | null>(null);
      const [pmOk, setPmOk] = useState<string | null>(null);

      const [title, setTitle] = useState("");
      const [category, setCategory] = useState("Design");
      const [badge, setBadge] = useState("");
      const [personalPrice, setPersonalPrice] = useState("");
      const [businessPrice, setBusinessPrice] = useState("");
      const [description, setDescription] = useState("");
      const [seoTitle, setSeoTitle] = useState("");
      const [seoDescription, setSeoDescription] = useState("");
      const [seoSlug, setSeoSlug] = useState("");
      const [seoOgImage, setSeoOgImage] = useState("");
      const [primaryKeyword, setPrimaryKeyword] = useState("");
      const [secondaryKeywordsText, setSecondaryKeywordsText] = useState("");
      const [seoKeywords, setSeoKeywords] = useState<Array<{ keyword: string; strength: "strong" | "medium" | "weak" }>>([]);
      const [frontendRoute, setFrontendRoute] = useState("");
      const [images, setImages] = useState<File[]>([]);
      const [editImages, setEditImages] = useState<File[]>([]);

      const [editingId, setEditingId] = useState<number | null>(null);
      const [editForm, setEditForm] = useState({ title: "", category: "Design", badge: "", personalPrice: "", businessPrice: "", description: "", seoTitle: "", seoDescription: "", seoSlug: "", seoOgImage: "", primaryKeyword: "", secondaryKeywordsText: "", frontendRoute: "", seoKeywords: [] as Array<{ keyword: string; strength: "strong" | "medium" | "weak" }> });

      const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
          coordinateGetter: sortableKeyboardCoordinates,
        })
      );

      const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
          const oldIndex = allProducts.findIndex((p) => p.id === active.id);
          const newIndex = allProducts.findIndex((p) => p.id === over.id);

          const newProducts = arrayMove(allProducts, oldIndex, newIndex);
          setAllProducts(newProducts);

          // Save to backend
          try {
            await gatewayFetch("/admin/products/reorder", {
              method: "POST",
              body: JSON.stringify({ ids: newProducts.map((p) => p.id) }),
            });
            setPmOk("Order updated successfully.");
          } catch (err: any) {
            setPmErr(err?.message || "Failed to update order.");
            // Revert on error
            refreshAll();
          }
        }
      };

      const SortableProductItem = ({ p }: { p: ProductT }) => {
        const {
          attributes,
          listeners,
          setNodeRef,
          transform,
          transition,
          isDragging,
        } = useSortable({ id: p.id });

        const style = {
          transform: CSS.Transform.toString(transform),
          transition,
          zIndex: isDragging ? 50 : undefined,
          opacity: isDragging ? 0.5 : 1,
        };

        return (
          <div 
            ref={setNodeRef} 
            style={style} 
            className="rounded-2xl border border-slate-200 bg-white p-4 group"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <button
                  {...attributes}
                  {...listeners}
                  className="mt-1 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 shrink-0"
                >
                  <GripVertical size={16} />
                </button>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">
                    {p.title}
                  </div>
                  <div className="text-xs text-slate-500">
                    {p.category} · Personal: {(p as any).personalPrice || "-"} · Business: {(p as any).businessPrice || "-"}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => startEdit(p)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs hover:bg-slate-50"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteProduct(p.id)}
                  className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        );
      };

      // Keep Add product category in sync with API list: if current value isn't in categoryItems, use first from API (fixes "selected SAi but saved Design")
      useEffect(() => {
        if (categoryItems.length === 0) return;
        const names = categoryItems.map((c) => c.name);
        if (!names.includes(category)) setCategory(categoryItems[0].name);
      }, [categoryItems, category]);

      const refreshAll = async () => {
        setPmErr(null);
        try {
          const json = await gatewayFetch("/admin/products", { method: "GET" });
          setAllProducts(json?.items || []);
        } catch (e: any) {
          setPmErr(e?.message || "Failed to load products");
        }
      };

      const createProduct = async () => {
        if (!canView) return;
        setBusy(true);
        setErr(null);
        setOk(null);
        try {
          if (images.length) {
            const form = new FormData();
            form.append("title", title);
            form.append("category", category);
            form.append("description", description);
            form.append("badge", badge);
            form.append("personalPrice", personalPrice);
            form.append("businessPrice", businessPrice);
            form.append("seoTitle", seoTitle);
            form.append("seoDescription", seoDescription);
            form.append("seoSlug", (seoSlug as any) || "");
            form.append("seoOgImage", (seoOgImage as any) || "");
            form.append("primaryKeyword", (primaryKeyword as any) || "");
            form.append("frontendRoute", frontendRoute || "");
            form.append(
              "secondaryKeywords",
              JSON.stringify(
                (secondaryKeywordsText || "")
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean)
              )
            );
            form.append("seoKeywords", JSON.stringify(seoKeywords.filter(k => k.keyword.trim())));
            for (const f of images) form.append("images", f);

            await gatewayFetch("/admin/products-multipart", {
              method: "POST",
              body: form,
            });
          } else {
            await gatewayFetch("/admin/products", {
              method: "POST",
              body: JSON.stringify({
                title,
                category,
                description,
                badge,
                personalPrice,
                businessPrice,
                seoTitle,
                seoDescription,
                seoSlug: (seoSlug as any) || "",
                seoOgImage: (seoOgImage as any) || "",
                primaryKeyword: (primaryKeyword as any) || "",
                frontendRoute: frontendRoute || "",
                secondaryKeywords: (secondaryKeywordsText || "")
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
              }),
            });
          }
          setOk("Product created");
          setTitle("");
          setBadge("");
          setPersonalPrice("");
          setBusinessPrice("");
          setDescription("");
          setSeoTitle("");
          setSeoDescription("");
          setSeoSlug("");
          setSeoOgImage("");
          setPrimaryKeyword("");
          setSecondaryKeywordsText("");
          setFrontendRoute("");
          setSeoKeywords([]);
          setImages([]);
          await refreshProducts();
          await refreshAll();
        } catch (e: any) {
          setErr(e?.message || "Failed to create product");
        } finally {
          setBusy(false);
        }
      };

      useEffect(() => {
        refreshAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      const startEdit = (p: ProductT) => {
        setEditingId(p.id);
        setEditForm({
          title: p.title || "",
          category: p.category || "Design",
          badge: p.badge || "",
          personalPrice: (p as any).personalPrice || "",
          businessPrice: (p as any).businessPrice || "",
          description: p.description || "",
          seoTitle: (p as any).seoTitle || "",
          seoDescription: (p as any).seoDescription || "",
          seoSlug: (p as any).seoSlug || "",
          seoOgImage: (p as any).seoOgImage || "",
          primaryKeyword: (p as any).primaryKeyword || "",
          frontendRoute: (p as any).frontendRoute || "",
          secondaryKeywordsText: Array.isArray((p as any).secondaryKeywords) ? (p as any).secondaryKeywords.join(", ") : "",
          seoKeywords: Array.isArray((p as any).seoKeywords) ? (p as any).seoKeywords : [],
        });
        setEditImages([]);
        setPmOk(null);
        setPmErr(null);
      };

      const saveEdit = async () => {
        if (!editingId) return;
        setPmBusy(true);
        setPmErr(null);
        setPmOk(null);
        try {
          if (editImages.length) {
            const form = new FormData();
            form.append("title", editForm.title);
            form.append("category", editForm.category);
            form.append("description", editForm.description);
            form.append("badge", editForm.badge);
            form.append("personalPrice", (editForm as any).personalPrice || "");
            form.append("businessPrice", (editForm as any).businessPrice || "");
            form.append("seoTitle", editForm.seoTitle || "");
            form.append("seoDescription", editForm.seoDescription || "");
            form.append("seoSlug", (editForm as any).seoSlug || "");
            form.append("seoOgImage", (editForm as any).seoOgImage || "");
            form.append("primaryKeyword", (editForm as any).primaryKeyword || "");
            form.append("frontendRoute", (editForm as any).frontendRoute || "");
            form.append(
              "secondaryKeywords",
              JSON.stringify(
                String((editForm as any).secondaryKeywordsText || "")
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean)
              )
            );
            form.append("seoKeywords", JSON.stringify((editForm as any).seoKeywords?.filter((k: any) => k.keyword.trim()) || []));
            for (const f of editImages) form.append("images", f);

            await gatewayFetch(`/admin/products/${editingId}/multipart`, {
              method: "PUT",
              body: form,
            });
          } else {
            await gatewayFetch(`/admin/products/${editingId}`, {
              method: "PUT",
              body: JSON.stringify({
                title: editForm.title,
                category: editForm.category,
                badge: editForm.badge,
                personalPrice: (editForm as any).personalPrice,
                businessPrice: (editForm as any).businessPrice,
                description: editForm.description,
                seoTitle: editForm.seoTitle,
                seoDescription: editForm.seoDescription,
                seoSlug: (editForm as any).seoSlug || "",
                seoOgImage: (editForm as any).seoOgImage || "",
                primaryKeyword: (editForm as any).primaryKeyword || "",
                frontendRoute: (editForm as any).frontendRoute || "",
                secondaryKeywords: String((editForm as any).secondaryKeywordsText || "").split(",").map((x) => x.trim()).filter(Boolean),
                seoKeywords: (editForm as any).seoKeywords?.filter((k: any) => k.keyword.trim()) || [],
              }),
            });
          }
          setPmOk("Product updated");
          setEditingId(null);
          setEditImages([]);
          await refreshAll();
          await refreshProducts();
        } catch (e: any) {
          setPmErr(e?.message || "Failed to update product");
        } finally {
          setPmBusy(false);
        }
      };

      const deleteProduct = async (id: number) => {
        if (!confirm("Delete this product?")) return;
        setPmBusy(true);
        setPmErr(null);
        setPmOk(null);
        try {
          await gatewayFetch(`/admin/products/${id}`, { method: "DELETE" });
          setPmOk("Product deleted");
          if (editingId === id) setEditingId(null);
          await refreshAll();
          await refreshProducts();
        } catch (e: any) {
          setPmErr(e?.message || "Failed to delete product");
        } finally {
          setPmBusy(false);
        }
      };

      return (
        <div className="mt-6 space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-slate-900">Add product</div>
                <div className="text-sm text-slate-600 mt-1">Create a new product.</div>
              </div>
            </div>

            {err ? <div className="mt-4 text-sm text-red-700">{err}</div> : null}
            {ok ? <div className="mt-4 text-sm text-emerald-700">{ok}</div> : null}

            <div className="mt-4 grid md:grid-cols-2 gap-3">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                {(categoryItems.length > 0 ? categoryItems : [{ id: 0, name: "Design", sortOrder: 0 }]).map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="Badge (optional)" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
              <input value={personalPrice} onChange={(e) => setPersonalPrice(e.target.value)} placeholder="Personal price" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
              <input value={businessPrice} onChange={(e) => setBusinessPrice(e.target.value)} placeholder="Business price" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
              <input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder="SEO title (optional)" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
              <input value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} placeholder="SEO description (optional)" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
              <input value={seoSlug} onChange={(e) => setSeoSlug(e.target.value)} placeholder="SEO slug (optional)" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
              <input value={seoOgImage} onChange={(e) => setSeoOgImage(e.target.value)} placeholder="OG image URL (optional)" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
              <input value={frontendRoute} onChange={(e) => setFrontendRoute(e.target.value)} placeholder="Frontend route (e.g., my-product-name)" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
            </div>

            <SeoPanel
              entityType="PRODUCT"
              titleText={title}
              contentText={description}
              seoTitle={seoTitle}
              seoDescription={seoDescription}
              primaryKeyword={primaryKeyword}
              setPrimaryKeyword={setPrimaryKeyword}
              secondaryKeywordsText={secondaryKeywordsText}
              setSecondaryKeywordsText={setSecondaryKeywordsText}
            />

            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm min-h-[110px]" />

            <div className="mt-3">
              <input
                type="file"
                multiple
                onChange={(e) => setImages(Array.from(e.target.files || []))}
                className="block w-full text-sm text-slate-700"
              />
              {images.length ? <div className="mt-2 text-xs text-slate-500">Selected files: {images.length}</div> : null}
            </div>

            <button disabled={busy || !title.trim()} onClick={createProduct} className="mt-4 w-full rounded-xl bg-emerald-600 text-white py-3 text-sm hover:bg-emerald-700 disabled:opacity-60">
              {busy ? "Creating..." : "Create"}
            </button>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-slate-900">Manage products</div>
                <div className="text-sm text-slate-600 mt-1">Edit or delete existing products.</div>
              </div>
              <button onClick={refreshAll} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50">
                Refresh
              </button>
            </div>

            {pmErr ? <div className="mt-4 text-sm text-red-700">{pmErr}</div> : null}
            {pmOk ? <div className="mt-4 text-sm text-emerald-700">{pmOk}</div> : null}

            {editingId ? (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900">Editing #{editingId}</div>
                  <button onClick={() => setEditingId(null)} className="text-sm text-slate-600 hover:text-slate-900">
                    Cancel
                  </button>
                </div>
                <div className="mt-4 grid md:grid-cols-2 gap-3">
                  <input value={editForm.title} onChange={(e) => setEditForm((s) => ({ ...s, title: e.target.value }))} placeholder="Title" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                  <select value={editForm.category} onChange={(e) => setEditForm((s) => ({ ...s, category: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                    {(categoryItems.length > 0 ? categoryItems : [{ id: 0, name: "Design", sortOrder: 0 }]).map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <input value={editForm.badge} onChange={(e) => setEditForm((s) => ({ ...s, badge: e.target.value }))} placeholder="Badge (optional)" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                  <input value={(editForm as any).personalPrice} onChange={(e) => setEditForm((s) => ({ ...(s as any), personalPrice: e.target.value }))} placeholder="Personal price" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                  <input value={(editForm as any).businessPrice} onChange={(e) => setEditForm((s) => ({ ...(s as any), businessPrice: e.target.value }))} placeholder="Business price" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                  <input value={editForm.seoTitle} onChange={(e) => setEditForm((s) => ({ ...s, seoTitle: e.target.value }))} placeholder="SEO title (optional)" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                  <input value={editForm.seoDescription} onChange={(e) => setEditForm((s) => ({ ...s, seoDescription: e.target.value }))} placeholder="SEO description (optional)" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                  <input value={(editForm as any).seoSlug} onChange={(e) => setEditForm((s) => ({ ...(s as any), seoSlug: e.target.value }))} placeholder="SEO slug (optional)" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                  <input value={(editForm as any).seoOgImage} onChange={(e) => setEditForm((s) => ({ ...(s as any), seoOgImage: e.target.value }))} placeholder="OG image URL (optional)" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                  <input value={(editForm as any).frontendRoute} onChange={(e) => setEditForm((s) => ({ ...(s as any), frontendRoute: e.target.value }))} placeholder="Frontend route (e.g., my-product-name)" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                </div>
                <textarea value={editForm.description} onChange={(e) => setEditForm((s) => ({ ...s, description: e.target.value }))} placeholder="Description" className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm min-h-[110px]" />

                <div className="mt-3">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Product Images</label>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => setEditImages(Array.from(e.target.files || []))}
                    className="block w-full text-sm text-slate-700"
                  />
                  {editImages.length ? <div className="mt-2 text-xs text-slate-500">Selected files: {editImages.length}</div> : null}
                </div>

                <SeoPanel
                  entityType="PRODUCT"
                  entityId={editingId}
                  titleText={editForm.title}
                  contentText={editForm.description}
                  seoTitle={editForm.seoTitle}
                  seoDescription={editForm.seoDescription}
                  primaryKeyword={(editForm as any).primaryKeyword}
                  setPrimaryKeyword={(v) => setEditForm((s) => ({ ...(s as any), primaryKeyword: v }))}
                  secondaryKeywordsText={(editForm as any).secondaryKeywordsText}
                  setSecondaryKeywordsText={(v) => setEditForm((s) => ({ ...(s as any), secondaryKeywordsText: v }))}
                  seoKeywords={(editForm as any).seoKeywords || []}
                  setSeoKeywords={(v) => setEditForm((s) => ({ ...(s as any), seoKeywords: v }))}
                />
                <div className="mt-4 flex gap-2">
                  <button disabled={pmBusy || !editForm.title.trim()} onClick={saveEdit} className="flex-1 rounded-xl bg-emerald-600 text-white py-3 text-sm hover:bg-emerald-700 disabled:opacity-60">
                    Save
                  </button>
                  <button disabled={pmBusy} onClick={() => setEditingId(null)} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm hover:bg-slate-50 disabled:opacity-60">
                    Close
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-5">
              {allProducts.length === 0 ? (
                <div className="text-sm text-slate-600">No products.</div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={allProducts.map((p) => p.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="grid md:grid-cols-2 gap-3">
                      {allProducts.map((p) => (
                        <SortableProductItem key={p.id} p={p} />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </Card>
        </div>
      );
    };

    const KnowledgeManagement = () => {
      const canSave = kbContent.trim().length > 10 && !kbBusy;
      const items = Array.isArray(kbListState?.items) ? kbListState!.items : [];
      const fmtTime = (ms: any) => {
        const n = Number(ms || 0);
        if (!Number.isFinite(n) || n <= 0) return "-";
        return new Date(n).toLocaleString();
      };

      return (
        <div className="mt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-slate-900">📚 Knowledge Base</div>
              <div className="text-sm text-slate-600 mt-1">AI cavabları üçün məlumat əlavə et. (Title/Source/Content)</div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="text-xs text-slate-500">KB chunks</div>
              <div className="text-lg font-semibold text-emerald-700">{kbHealth ? kbHealth.kbChunks : "…"}</div>
              <button
                type="button"
                onClick={() => refreshKb()}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
                disabled={kbBusy}
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="font-semibold text-slate-900">Add Knowledge</div>
              <div className="mt-4 grid grid-cols-1 gap-3">
                <label className="text-sm text-slate-700">
                  Title
                  <input
                    className="mt-1 w-full h-11 px-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                    value={kbTitle}
                    onChange={(e) => setKbTitle(e.target.value)}
                    placeholder="Pricing / Refund / Delivery"
                  />
                </label>

                <label className="text-sm text-slate-700">
                  Source
                  <input
                    className="mt-1 w-full h-11 px-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                    value={kbSource}
                    onChange={(e) => setKbSource(e.target.value)}
                    placeholder="manual / url / page"
                  />
                </label>

                <label className="text-sm text-slate-700">
                  Content (paste text)
                  <textarea
                    className="mt-1 w-full min-h-[220px] p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                    value={kbContent}
                    onChange={(e) => setKbContent(e.target.value)}
                    placeholder="Məs: Product 1 price is 10 AZN. Delivery 1-3 days. Refund 14 days..."
                  />
                </label>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={ingestKb}
                    disabled={!canSave}
                    className={
                      "h-11 px-4 rounded-xl text-white font-medium " +
                      (canSave ? "bg-emerald-600 hover:bg-emerald-700" : "bg-emerald-300")
                    }
                  >
                    {kbBusy ? "Saving..." : "Save"}
                  </button>

                  {kbMsg && <div className="text-sm text-slate-700">{kbMsg}</div>}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-slate-900">Latest KB Chunks</div>
                <div className="text-xs text-slate-500">Total: {kbListState ? kbListState.total : "…"}</div>
              </div>

              <div className="mt-4 space-y-3 max-h-[520px] overflow-auto pr-2">
                {!items.length ? (
                  <div className="text-sm text-slate-600">Hələ heç nə yoxdur. Soldan content əlavə et.</div>
                ) : (
                  items.map((it: any) => (
                    <div key={it.id} className="rounded-xl border border-slate-200 p-3 hover:border-emerald-200">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-900">{it.docTitle || "(no title)"}</div>
                        <div className="text-xs text-slate-500">{fmtTime(it.createdAt)}</div>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        source: <span className="text-slate-700">{it.source || "(none)"}</span>
                      </div>
                      <div className="mt-2 text-sm text-slate-800 whitespace-pre-wrap">
                        {String(it.text || "").length > 400 ? String(it.text || "").slice(0, 400) + "…" : String(it.text || "")}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="font-semibold text-slate-900">Quick Test</div>
            <div className="mt-2 text-sm text-slate-700">
              Knowledge əlavə edəndən sonra chat widget-da sual ver:
              <span className="ml-2 inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-700 border border-emerald-100">
                “Refund neçə gündür?”
              </span>
            </div>
          </div>
        </div>
      );
    };

    // Load FAQs when FAQs page is selected (only once when page opens)
    useEffect(() => {
      if (canView && adminPage === "faqs") {
        refreshChatFAQs().catch(() => {
          // Silently handle errors to prevent infinite loops
        });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canView, adminPage]);

    // Load Footer Links when footer-links page is selected
    useEffect(() => {
      if (canView && adminPage === "footer-links") {
        refreshFooterLinksAdmin();
      }
    }, [canView, adminPage]);

    // Note: Chat session auto-refresh is handled inside ChatManagement component

    if (!canView) {
      return (
        <section className="max-w-5xl mx-auto px-6 py-12">
          <SectionTitle title="Admin" subtitle="Admin only." />
          <Card className="p-6">
            <div className="text-sm text-slate-700">You are not allowed to view this page.</div>
          </Card>
        </section>
      );
    }

    const refreshAnalytics = async () => {
      if (!canView) return;
      setAnalyticsBusy(true);
      setAnalyticsErr(null);
      try {
        const json = await gatewayFetch("/admin/analytics/summary", { method: "GET" });
        setAnalytics(json || null);
      } catch (e: any) {
        const errorMsg = e?.message || "Failed to load analytics";
        console.error("Failed to load analytics:", errorMsg);
        setAnalytics(null);
        setAnalyticsErr(errorMsg);
      } finally {
        setAnalyticsBusy(false);
      }
    };

    const totals = analytics?.totals || {};
    const topPages = Array.isArray(analytics?.topPages) ? analytics.topPages : [];
    const topCountries = Array.isArray(analytics?.topCountries) ? analytics.topCountries : [];
    const topProductsViewed = Array.isArray(analytics?.topProductsViewed) ? analytics.topProductsViewed : [];
    const topProductsSold = Array.isArray(analytics?.topProductsSold) ? analytics.topProductsSold : [];

    // Management Components - defined before return
    const OrdersManagement = () => {
      const [ordersSearch, setOrdersSearch] = useState("");
      return (
        <div>
          <Card className="p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-slate-900">Orders</div>
                <div className="text-sm text-slate-600 mt-1">Latest order requests.</div>
              </div>
              <div className="flex gap-2">
                <div className="relative w-[340px] max-w-full">
                  <input value={ordersSearch} onChange={(e) => setOrdersSearch(e.target.value)} placeholder="Search..." className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 pr-10 text-sm" />
                  {ordersSearch ? (
                    <button
                      onClick={() => setOrdersSearch("")}
                      className="absolute inset-y-0 right-0 flex items-center justify-center px-3 text-slate-400 hover:text-slate-600"
                      type="button"
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  ) : null}
                </div>
                <button onClick={refreshOrders} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50">
                  Refresh
                </button>
              </div>
            </div>

            {err ? <div className="mt-4 text-sm text-red-700">{err}</div> : null}

            <div className="mt-5 grid md:grid-cols-2 gap-3">
              {orders.length === 0 ? (
                <div className="text-sm text-slate-600">No orders.</div>
              ) : (
                orders
                  .filter((o: any) => {
                    const q = ordersSearch.trim().toLowerCase();
                    if (!q) return true;
                    const hay = `${o?.id || ""} ${o?.customerEmail || ""} ${o?.customerName || ""} ${o?.status || ""}`.toLowerCase();
                    return hay.includes(q);
                  })
                  .map((o: any) => (
                    <div
                      key={o.id}
                      onClick={() => openOrder(o)}
                      className={`rounded-2xl border p-4 cursor-pointer transition ${getOrderCardClass(o.status)}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-900">Order #{o.id}</div>
                          <div className="mt-1 text-xs text-slate-600">
                            {o.customerName || o.customerEmail || o.user?.email || "Anonymous"}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {o.createdAt ? new Date(o.createdAt).toLocaleString() : "-"}
                          </div>
                        </div>
                        <div className="text-xs bg-slate-100 text-slate-700 border border-slate-200 px-2 py-1 rounded-full whitespace-nowrap">
                          {String(o.status || "REQUESTED").toUpperCase()}
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-slate-500">Click to view details</div>
                    </div>
                  ))
              )}
            </div>
          </Card>

          {/* Order Modal */}
          {orderModalOpen && activeOrder ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-xl">
                <div className="p-5 border-b border-slate-200 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-slate-900">Order #{activeOrder.id}</div>
                    <div className="text-xs text-slate-500">{new Date(activeOrder.createdAt).toLocaleString()}</div>
                  </div>
                  <button onClick={closeOrder} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50">
                    Close
                  </button>
                </div>

                <div className="p-5 space-y-3 text-sm max-h-[70vh] overflow-auto">
                  {orderStatusErr ? <div className="text-sm text-red-700">{orderStatusErr}</div> : null}
                  {orderStatusOk ? <div className="text-sm text-emerald-700">{orderStatusOk}</div> : null}

                  {(() => {
                    const rawItems = (activeOrder as any)?.orderItems as any[] | undefined;
                    const items = Array.isArray(rawItems) ? rawItems : [];
                    const orderType = String((activeOrder as any)?.selectedType || "").toLowerCase();
                    const getUnitForType = (p: any, itemType: string) => {
                      const useBusiness = String(itemType || orderType).toLowerCase().includes("business");
                      const raw = useBusiness ? (p?.businessPrice || p?.price) : (p?.personalPrice || p?.price);
                      return parsePriceToNumber(String(raw || "0"));
                    };
                    const total = items.reduce(
                      (acc, it) => acc + getUnitForType(it?.product, it?.productType) * Number(it?.qty || 0),
                      0
                    );

                    if (!items.length) return null;
                    return (
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="text-xs text-slate-500">Items</div>
                        <div className="mt-2 space-y-2">
                          {items.map((it) => {
                            const p = it?.product;
                            const qty = Number(it?.qty || 0);
                            const unit = getUnitForType(p, it?.productType);
                            const line = unit * qty;
                            const typeName = String(it?.productType || (activeOrder as any)?.selectedType || "").trim().toLowerCase();
                            const itemLabel = typeName
                              ? `${String(p?.title || it?.productId || "-")}(${typeName})`
                              : String(p?.title || it?.productId || "-");
                            return (
                              <div key={String(it?.id ?? it?.productId)} className="flex items-center justify-between gap-3">
                                <div className="text-slate-700 truncate">{itemLabel}</div>
                                <div className="text-slate-700 whitespace-nowrap">× {qty}</div>
                                <div className="text-slate-900 font-medium whitespace-nowrap">{formatMoney(line)}</div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="h-px bg-slate-200 my-3" />
                        {(() => {
                          const subtotalVal = Number((activeOrder as any)?.subtotal);
                          const discountVal = Number((activeOrder as any)?.discountAmount ?? 0);
                          const storedTotal = Number((activeOrder as any)?.total);
                          const hasStoredTotals = Number.isFinite(subtotalVal) || Number.isFinite(storedTotal) || (Number.isFinite(discountVal) && discountVal > 0);
                          const displaySubtotal = Number.isFinite(subtotalVal) ? subtotalVal : total;
                          const displayDiscount = Number.isFinite(discountVal) ? discountVal : 0;
                          const displayTotal = Number.isFinite(storedTotal) ? storedTotal : (total - displayDiscount);
                          return (
                            <>
                              {hasStoredTotals && displayDiscount > 0 ? (
                                <>
                                  <div className="flex items-center justify-between text-slate-600">
                                    <div>Subtotal</div>
                                    <div>{formatMoney(displaySubtotal)}</div>
                                  </div>
                                  <div className="flex items-center justify-between text-slate-600">
                                    <div>Discount (coupon)</div>
                                    <div className="text-emerald-600">-{formatMoney(displayDiscount)}</div>
                                  </div>
                                </>
                              ) : null}
                              <div className="flex items-center justify-between">
                                <div className="text-slate-600">Total</div>
                                <div className="text-slate-900 font-semibold">{formatMoney(displayTotal)}</div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    );
                  })()}

                  {activeOrder.product ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="text-xs text-slate-500">Product</div>
                      <div className="mt-1 font-medium text-slate-900">{activeOrder.product?.title || "-"}</div>
                    </div>
                  ) : null}

                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-xs text-slate-500">Customer info</div>
                    <div className="mt-1 text-slate-900"><b>Name:</b> {String(activeOrder.customerName || "").trim() || "-"}</div>
                    <div className="text-slate-900"><b>Email:</b> {String(activeOrder.customerEmail || "").trim() || String(activeOrder.user?.email || "").trim() || "-"}</div>
                    <div className="text-slate-900"><b>Phone:</b> {String(activeOrder.customerPhone || "").trim() || "-"}</div>
                    <div className="text-slate-900">
                      <b>Address:</b>{" "}
                      {[activeOrder.street, activeOrder.city, activeOrder.zip, activeOrder.country]
                        .map((x: any) => String(x || "").trim())
                        .filter(Boolean)
                        .join(", ") || "-"}
                    </div>
                  </div>

                  {activeOrder.notes ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="text-xs text-slate-500">Notes</div>
                      <div className="mt-1 text-slate-900 whitespace-pre-wrap">{activeOrder.notes}</div>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      disabled={orderStatusBusy || !canTransition(activeOrder.status, "REQUESTED")}
                      onClick={() => updateOrderStatus("REQUESTED")}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
                    >
                      Requested
                    </button>
                    <button
                      disabled={orderStatusBusy || !canTransition(activeOrder.status, "CONFIRMED")}
                      onClick={() => updateOrderStatus("CONFIRMED")}
                      className="rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm hover:bg-emerald-700 disabled:opacity-60"
                    >
                      Confirm
                    </button>
                    <button
                      disabled={orderStatusBusy || !canTransition(activeOrder.status, "REJECTED")}
                      onClick={() => updateOrderStatus("REJECTED")}
                      className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                  <div className="text-xs text-slate-500">Status change triggers an email to the customer email.</div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      );
    };

    const ChatManagement = () => {
      // Initial load when chat page is opened
      const hasLoadedRef = useRef(false);
      
      useEffect(() => {
        // Reset when leaving chat page first
        if (adminPage !== "chat") {
          hasLoadedRef.current = false;
          return;
        }
        
        // Only load once when entering chat page
        if (!canView || hasLoadedRef.current) return;
        
        hasLoadedRef.current = true;
        // Use the ref to avoid dependency issues
        const refreshFn = refreshChatSessionsRef.current;
        if (refreshFn) {
          refreshFn().catch((err) => {
          console.error("Failed to load chat sessions:", err);
          // Reset on error so it can retry
          hasLoadedRef.current = false;
        });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [canView, adminPage]);

      // Auto-refresh only when on chat page and session is selected
      useEffect(() => {
        if (!canView || adminPage !== "chat" || !selectedChatSession) return;
        
        let isMounted = true;
        const sessionId = selectedChatSession.id;
        
        const interval = setInterval(() => {
          // Don't refresh if we're sending a message or component is unmounted
          if (!isMounted || adminPage !== "chat" || !sessionId || chatSendingRef.current) return;
          
          // Only refresh messages, don't refresh the entire session list
          gatewayFetch(`/admin/chat/sessions/${sessionId}`, { method: "GET" })
            .then((json: any) => {
              if (!isMounted || !json?.item || json.item.id !== sessionId || chatSendingRef.current) return;
              
              // Only update messages if they actually changed
                setChatMessages((prev) => {
                  const newMessages = json.item?.messages || [];
                // Deep comparison to avoid unnecessary updates
                if (prev.length !== newMessages.length) {
                    return newMessages;
                  }
                // Check if any message changed
                for (let i = 0; i < prev.length; i++) {
                  if (prev[i]?.id !== newMessages[i]?.id || prev[i]?.text !== newMessages[i]?.text) {
                    return newMessages;
                  }
                }
                return prev; // No changes, return same reference
              });
              
              // Only update session status if it actually changed (avoid unnecessary re-renders)
                setSelectedChatSession((prev) => {
                  if (!prev || prev.id !== sessionId) return prev;
                // Compare status strings directly
                const newStatus = json.item?.status;
                if (newStatus && prev.status !== newStatus) {
                  return { ...prev, status: newStatus };
                }
                return prev; // Return same reference to prevent re-render
              });
            })
            .catch(() => {
              // Silently handle errors - don't spam console
            });
        }, 20000); // Increase to 20 seconds to reduce load even more
        
        return () => {
          isMounted = false;
          clearInterval(interval);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [canView, adminPage, selectedChatSession?.id]);

      const getStatusBadgeColor = (status: string) => {
        switch (status) {
          case "WAITING_FOR_HUMAN":
            return "bg-yellow-100 text-yellow-800 border-yellow-200";
          case "HUMAN":
            return "bg-blue-100 text-blue-800 border-blue-200";
          case "CLOSED":
            return "bg-green-100 text-green-800 border-green-200";
          default:
            return "bg-gray-100 text-gray-800 border-gray-200";
        }
      };

      const parseDeviceInfo = (userAgent: string | null | undefined) => {
        if (!userAgent) return "Unknown";
        
        const ua = userAgent.toLowerCase();
        
        // Detect OS
        let os = "Unknown OS";
        if (ua.includes("windows")) os = "Windows";
        else if (ua.includes("mac os") || ua.includes("macos")) os = "macOS";
        else if (ua.includes("linux")) os = "Linux";
        else if (ua.includes("android")) os = "Android";
        else if (ua.includes("ios") || ua.includes("iphone") || ua.includes("ipad")) os = "iOS";
        
        // Detect Browser
        let browser = "Unknown Browser";
        if (ua.includes("chrome") && !ua.includes("edg")) browser = "Chrome";
        else if (ua.includes("firefox")) browser = "Firefox";
        else if (ua.includes("safari") && !ua.includes("chrome")) browser = "Safari";
        else if (ua.includes("edg")) browser = "Edge";
        else if (ua.includes("opera") || ua.includes("opr")) browser = "Opera";
        
        // Detect Device Type
        let deviceType = "Desktop";
        if (ua.includes("mobile")) deviceType = "Mobile";
        else if (ua.includes("tablet") || ua.includes("ipad")) deviceType = "Tablet";
        
        return `${deviceType} · ${os} · ${browser}`;
      };

      const formatTime = (date: string | Date) => {
        const d = new Date(date);
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m`;
        if (diffHours < 24) return `${diffHours}h`;
        if (diffDays < 7) return `${diffDays}d`;
        return d.toLocaleDateString();
      };

      const getLastMessagePreview = (session: any) => {
        if (!session.messages || session.messages.length === 0) return "No messages";
        const lastMsg = session.messages[session.messages.length - 1];
        return lastMsg.text.length > 50 ? lastMsg.text.substring(0, 50) + "..." : lastMsg.text;
      };

      return (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-lg font-semibold text-slate-900">💬 Chat Sessions</div>
              <div className="text-sm text-slate-600 mt-1">Manage customer support chat sessions.</div>
            </div>
            <div className="flex gap-2">
              <select
                value={chatStatusFilter}
                onChange={(e) => {
                  setChatStatusFilter(e.target.value);
                  // Use ref to avoid dependency issues
                  const refreshFn = refreshChatSessionsRef.current;
                  if (refreshFn) refreshFn();
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">All Status</option>
                <option value="BOT">Bot</option>
                <option value="WAITING_FOR_HUMAN">Waiting</option>
                <option value="HUMAN">Human</option>
                <option value="CLOSED">Closed</option>
              </select>
              <button 
                onClick={() => {
                  const refreshFn = refreshChatSessionsRef.current;
                  if (refreshFn) refreshFn();
                }} 
                disabled={chatSessionsBusy} 
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50"
              >
                Refresh
              </button>
            </div>
          </div>

          {chatSessionsErr ? <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{chatSessionsErr}</div> : null}

          <div className="grid grid-cols-12 gap-4" style={{ height: "calc(100vh - 300px)", minHeight: "600px" }}>
            {/* Left: Conversation List */}
            <div className="col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-200 bg-slate-50">
                <div className="text-sm font-semibold text-slate-900">
                  {chatStatusFilter ? `${chatStatusFilter} Sessions` : "All Sessions"} ({chatSessions.length})
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {chatSessionsBusy && chatSessions.length === 0 ? (
                  <div className="p-4 text-sm text-slate-500 text-center">Loading...</div>
                ) : chatSessions.length === 0 ? (
                  <div className="p-4 text-sm text-slate-500 text-center">No chat sessions.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {chatSessions.map((s: any) => (
                      <div
                        key={s.id}
                        onClick={() => loadChatSession(s.id)}
                        className={`p-4 cursor-pointer transition hover:bg-slate-50 ${
                          selectedChatSession?.id === s.id ? "bg-blue-50 border-l-4 border-blue-500" : ""
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                            {(s.email || s.deviceId || "A")[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="text-sm font-medium text-slate-900 truncate">
                                {s.email || s.deviceId || "Anonymous"}
                              </div>
                              <div className="text-xs text-slate-500 whitespace-nowrap">
                                {formatTime(s.updatedAt || s.createdAt)}
                              </div>
                            </div>
                            <div className="text-xs text-slate-500 mb-2 truncate">
                              {getLastMessagePreview(s)}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-xs px-2 py-0.5 rounded border ${getStatusBadgeColor(s.status)}`}>
                                {s.status === "WAITING_FOR_HUMAN" ? "Waiting" : s.status}
                              </span>
                              {s.country && (
                                <span className="text-xs text-slate-500">
                                  {s.country}{s.city ? `, ${s.city}` : ""}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Center: Chat Messages */}
            <div className="col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
              {selectedChatSession ? (
                <>
                  <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                        {(selectedChatSession.email || selectedChatSession.deviceId || "A")[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          {selectedChatSession.email || selectedChatSession.deviceId || "Anonymous"}
                        </div>
                        <div className="text-xs text-slate-500">
                          {selectedChatSession.country ? `${selectedChatSession.country}${selectedChatSession.city ? `, ${selectedChatSession.city}` : ""}` : "Unknown location"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedChatSession.status}
                        onChange={(e) => updateChatStatus(selectedChatSession.id, e.target.value as any)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs bg-white"
                      >
                        <option value="BOT">Bot</option>
                        <option value="WAITING_FOR_HUMAN">Waiting</option>
                        <option value="HUMAN">Human</option>
                        <option value="CLOSED">Closed</option>
                      </select>
                      {selectedChatSession.status === "WAITING_FOR_HUMAN" && (
                        <button
                          onClick={() => updateChatStatus(selectedChatSession.id, "HUMAN")}
                          className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                          Solve
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {selectedChatSession.status === "WAITING_FOR_HUMAN" && (
                    <div className="px-4 py-2 bg-yellow-50 border-b border-yellow-200 text-xs text-yellow-800">
                      The visitor went offline and will be notified about unread messages via email.
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                    {chatMessages.length === 0 ? (
                      <div className="text-center text-sm text-slate-500 py-8">No messages yet</div>
                    ) : (
                      chatMessages.map((m: any) => (
                        <div key={m.id} className={`flex ${m.role === "USER" ? "justify-end" : "justify-start"}`}>
                          <div className="flex flex-col max-w-[75%]">
                            <div
                              className={`rounded-lg px-4 py-2 text-sm ${
                                m.role === "USER"
                                  ? "bg-emerald-600 text-white"
                                  : m.role === "ADMIN"
                                  ? "bg-blue-600 text-white"
                                  : "bg-white text-slate-900 border border-slate-200"
                              }`}
                            >
                              {m.text}
                            </div>
                            <div className={`text-xs text-slate-500 mt-1 px-1 ${m.role === "USER" ? "text-right" : "text-left"}`}>
                              {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="p-4 border-t border-slate-200 bg-white">
                    <div className="flex gap-2">
                      <input
                        value={chatMessageInput}
                        onChange={(e) => setChatMessageInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey && !chatSending && chatMessageInput.trim()) {
                            e.preventDefault();
                            sendChatMessage();
                          }
                        }}
                        placeholder="Write a message..."
                        className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={chatSending || selectedChatSession.status === "CLOSED"}
                      />
                      <button
                        onClick={sendChatMessage}
                        disabled={chatSending || !chatMessageInput.trim() || selectedChatSession.status === "CLOSED"}
                        className="rounded-lg bg-emerald-600 text-white px-6 py-2 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {chatSending ? "Sending..." : "Send"}
                      </button>
                    </div>
                    {chatSending && (
                      <div className="mt-2 text-xs text-slate-500">Sending message...</div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-slate-500">
                  Select a session to view messages
                </div>
              )}
            </div>

            {/* Right: Customer Data */}
            <div className="col-span-3 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
              {selectedChatSession ? (
                <>
                  <div className="p-4 border-b border-slate-200 bg-slate-50">
                    <div className="text-sm font-semibold text-slate-900">Customer Data</div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div>
                      <div className="text-xs font-medium text-slate-700 mb-2">Email</div>
                      <div className="text-sm text-slate-900 break-all">
                        {selectedChatSession.email || "Not provided"}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-medium text-slate-700 mb-2">Location</div>
                      <div className="text-sm text-slate-900">
                        {selectedChatSession.country ? (
                          <>
                            {selectedChatSession.country}
                            {selectedChatSession.city && `, ${selectedChatSession.city}`}
                          </>
                        ) : (
                          "Unknown"
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-medium text-slate-700 mb-2">IP Address</div>
                      <div className="text-sm text-slate-900 font-mono">
                        {selectedChatSession.ip || "Unknown"}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-medium text-slate-700 mb-2">Device</div>
                      <div className="text-sm text-slate-900">
                        {parseDeviceInfo(selectedChatSession.userAgent)}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-medium text-slate-700 mb-2">Device ID</div>
                      <div className="text-sm text-slate-900 font-mono break-all text-xs">
                        {selectedChatSession.deviceId || "Unknown"}
                      </div>
                    </div>

                    {selectedChatSession.userAgent && (
                      <div>
                        <div className="text-xs font-medium text-slate-700 mb-2">User Agent</div>
                        <div className="text-xs text-slate-600 break-all">
                          {selectedChatSession.userAgent}
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="text-xs font-medium text-slate-700 mb-2">Current Page</div>
                      <div className="text-sm text-slate-900">
                        {selectedChatSession.currentPage || "Unknown"}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-medium text-slate-700 mb-2">Status</div>
                      <div className="text-sm">
                        <span className={`px-2 py-1 rounded border text-xs ${getStatusBadgeColor(selectedChatSession.status)}`}>
                          {selectedChatSession.status === "WAITING_FOR_HUMAN" ? "Waiting for Human" : selectedChatSession.status}
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-medium text-slate-700 mb-2">Created</div>
                      <div className="text-sm text-slate-900">
                        {new Date(selectedChatSession.createdAt).toLocaleString()}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-medium text-slate-700 mb-2">Last Updated</div>
                      <div className="text-sm text-slate-900">
                        {new Date(selectedChatSession.updatedAt || selectedChatSession.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-slate-500">
                  Select a session to view customer data
                </div>
              )}
            </div>
          </div>
        </div>
      );
    };

    const AnalyticsManagement = () => {
      return (
        <Card className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-slate-900">Analytics</div>
              <div className="text-sm text-slate-600 mt-1">Site visits, unique devices/IPs, and top content.</div>
            </div>
            <button onClick={refreshAnalytics} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50" disabled={analyticsBusy}>
              Refresh
            </button>
          </div>

          {analyticsErr ? <div className="mt-4 text-sm text-red-700">{analyticsErr}</div> : null}
          {analyticsBusy ? <div className="mt-4 text-sm text-slate-600">Loading…</div> : null}

          <div className="mt-5 grid md:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Total site entries</div>
              <div className="text-2xl font-semibold text-slate-900 mt-1">{Number(totals.totalVisits || 0).toLocaleString()}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Unique devices</div>
              <div className="text-2xl font-semibold text-slate-900 mt-1">{Number(totals.uniqueDevices || 0).toLocaleString()}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Unique IPs</div>
              <div className="text-2xl font-semibold text-slate-900 mt-1">{Number(totals.uniqueIps || 0).toLocaleString()}</div>
            </div>
          </div>

          <div className="mt-6 grid lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">Top pages</div>
              <div className="mt-3 space-y-2">
                {topPages.length === 0 ? <div className="text-sm text-slate-600">No data.</div> : null}
                {topPages.slice(0, 10).map((x: any) => (
                  <div key={String(x.page)} className="flex items-center justify-between gap-3 text-sm">
                    <div className="text-slate-700 truncate">{String(x.page || "-")}</div>
                    <div className="text-slate-900 font-medium">{Number(x.views || 0).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">Top countries / cities</div>
              <div className="mt-3 space-y-2">
                {topCountries.length === 0 ? <div className="text-sm text-slate-600">No data.</div> : null}
                {topCountries.slice(0, 10).map((x: any, idx: number) => (
                  <div key={`${String(x.country)}:${String(x.city)}:${idx}`} className="flex items-center justify-between gap-3 text-sm">
                    <div className="text-slate-700 truncate">{String(x.country || "-")}{x.city ? ` / ${String(x.city)}` : ""}</div>
                    <div className="text-slate-900 font-medium">{Number(x.views || 0).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 grid lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">Top viewed products</div>
              <div className="mt-3 space-y-2">
                {topProductsViewed.length === 0 ? <div className="text-sm text-slate-600">No data.</div> : null}
                {topProductsViewed.slice(0, 10).map((x: any) => (
                  <div key={String(x.productId)} className="flex items-center justify-between gap-3 text-sm">
                    <div className="text-slate-700 truncate">{String(x.title || x.productId || "-")}</div>
                    <div className="text-slate-900 font-medium">{Number(x.views || 0).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">Top sold products</div>
              <div className="mt-3 space-y-2">
                {topProductsSold.length === 0 ? <div className="text-sm text-slate-600">No data.</div> : null}
                {topProductsSold.slice(0, 10).map((x: any) => (
                  <div key={String(x.productId)} className="flex items-center justify-between gap-3 text-sm">
                    <div className="text-slate-700 truncate">{String(x.title || x.productId || "-")}</div>
                    <div className="text-slate-900 font-medium">{Number(x.sold || 0).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Google Site Kit Links */}
          <div className="mt-6 rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-6">
            <div className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-emerald-600" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google Site Kit
            </div>
            <div className="text-xs text-slate-600 mb-4">Access Google Analytics, Search Console, and Tag Manager directly from here.</div>
            <div className="grid md:grid-cols-3 gap-3">
              <a
                href="https://analytics.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-emerald-50 transition"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-emerald-600" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Google Analytics</span>
                <svg viewBox="0 0 24 24" className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 17L17 7M7 7h10v10"/>
                </svg>
              </a>
              <a
                href="https://tagmanager.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-emerald-50 transition"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-emerald-600" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <span>Tag Manager</span>
                <svg viewBox="0 0 24 24" className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 17L17 7M7 7h10v10"/>
                </svg>
              </a>
              <a
                href="https://search.google.com/search-console"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-emerald-50 transition"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-emerald-600" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <span>Search Console</span>
                <svg viewBox="0 0 24 24" className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 17L17 7M7 7h10v10"/>
                </svg>
              </a>
            </div>
          </div>
        </Card>
      );
    };

    const UsersManagement = () => {
      const [usersSearch, setUsersSearch] = useState("");
      return (
        <Card className="p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-slate-900">Users</div>
              <div className="text-sm text-slate-600 mt-1">Registered users.</div>
            </div>
            <div className="flex gap-2">
              <div className="relative w-[340px] max-w-full">
                <input value={usersSearch} onChange={(e) => setUsersSearch(e.target.value)} placeholder="Search..." className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 pr-10 text-sm" />
                {usersSearch ? (
                  <button
                    onClick={() => setUsersSearch("")}
                    className="absolute inset-y-0 right-0 flex items-center justify-center px-3 text-slate-400 hover:text-slate-600"
                    type="button"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                ) : null}
              </div>
              <button onClick={refreshUsers} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50">
                Refresh
              </button>
              <button onClick={downloadUsersCsv} className="rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm hover:bg-emerald-700">
                Download CSV
              </button>
            </div>
          </div>

          {usersErr ? <div className="mt-4 text-sm text-red-700">{usersErr}</div> : null}

          <div className="mt-5 grid md:grid-cols-2 gap-3">
            {usersBusy ? (
              <div className="text-sm text-slate-600">Loading...</div>
            ) : users.length === 0 ? (
              <div className="text-sm text-slate-600">No users.</div>
            ) : (
              users
                .filter((u) => {
                  const q = usersSearch.trim().toLowerCase();
                  if (!q) return true;
                  const hay = `${u?.email || ""} ${u?.id || ""} ${u?.role || ""}`.toLowerCase();
                  return hay.includes(q);
                })
                .slice(0, 50)
                .map((u) => (
                <div key={u.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900 truncate">{u.email}</div>
                  <div className="mt-1 text-xs text-slate-500">Role: {u.role}</div>
                  <div className="mt-1 text-xs text-slate-500">Created: {u.createdAt ? new Date(u.createdAt).toLocaleString() : "-"}</div>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <div className="text-xs text-slate-500 truncate">
                      ID: {String(u.id || "").slice(0, 4)}...{String(u.id || "").slice(-4)}
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        const full = String(u.id || "");
                        try {
                          if (navigator?.clipboard?.writeText) await navigator.clipboard.writeText(full);
                          else {
                            const ta = document.createElement("textarea");
                            ta.value = full;
                            document.body.appendChild(ta);
                            ta.select();
                            document.execCommand("copy");
                            ta.remove();
                          }
                        } catch {
                          // ignore
                        }
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs hover:bg-slate-50"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {users.length > 50 ? <div className="mt-3 text-xs text-slate-500">Showing first 50 users. Use CSV download for full list.</div> : null}
        </Card>
      );
    };

    const FraudManagement = () => {
      const [fraudEntryNew, setFraudEntryNew] = useState<any>({ name: "", platform: "Telegram", handle: "", note: "", details: "", evidenceUrl: "" });
      const [fraudEntryEditingId, setFraudEntryEditingId] = useState<number | null>(null);
      const [fraudEntryEdit, setFraudEntryEdit] = useState<any>({ name: "", platform: "Telegram", handle: "", note: "", details: "", evidenceUrl: "" });

      const startEditFraudEntry = (x: any) => {
        setFraudEntryEditingId(Number(x?.id || 0) || null);
        setFraudEntryEdit({
          name: String(x?.name || ""),
          platform: String(x?.platform || "Telegram"),
          handle: String(x?.handle || ""),
          note: String(x?.note || ""),
          details: String(x?.details || ""),
          evidenceUrl: String(x?.evidenceUrl || ""),
        });
      };

      const createFraudEntry = async () => {
        if (!canView) return;
        if (!String(fraudEntryNew?.name || "").trim()) return;
        setFraudEntriesBusy(true);
        setFraudEntriesErr(null);
        try {
          await gatewayFetch("/admin/fraud/entries", { method: "POST", body: JSON.stringify({
            name: String(fraudEntryNew?.name || "").trim(),
            platform: String(fraudEntryNew?.platform || "Telegram"),
            handle: String(fraudEntryNew?.handle || "").trim(),
            note: String(fraudEntryNew?.note || ""),
            details: String(fraudEntryNew?.details || ""),
            evidenceUrl: String(fraudEntryNew?.evidenceUrl || ""),
          }) });
          setFraudEntryNew({ name: "", platform: "Telegram", handle: "", note: "", details: "", evidenceUrl: "" });
          await refreshFraudEntriesAdmin();
        } catch (e: any) {
          setFraudEntriesErr(e?.message || "Failed to create fraud entry");
        } finally {
          setFraudEntriesBusy(false);
        }
      };

      const updateFraudEntry = async () => {
        if (!canView || !fraudEntryEditingId) return;
        setFraudEntriesBusy(true);
        setFraudEntriesErr(null);
        try {
          await gatewayFetch(`/admin/fraud/entries/${fraudEntryEditingId}`, { method: "PUT", body: JSON.stringify({
            name: String(fraudEntryEdit?.name || "").trim(),
            platform: String(fraudEntryEdit?.platform || "Telegram"),
            handle: String(fraudEntryEdit?.handle || "").trim(),
            note: String(fraudEntryEdit?.note || ""),
            details: String(fraudEntryEdit?.details || ""),
            evidenceUrl: String(fraudEntryEdit?.evidenceUrl || ""),
          }) });
          setFraudEntryEditingId(null);
          setFraudEntryEdit({ name: "", platform: "Telegram", handle: "", note: "", details: "", evidenceUrl: "" });
          await refreshFraudEntriesAdmin();
        } catch (e: any) {
          setFraudEntriesErr(e?.message || "Failed to update fraud entry");
        } finally {
          setFraudEntriesBusy(false);
        }
      };
      // Load fraud data when fraud page is opened
      useEffect(() => {
        if (canView && adminPage === "fraud") {
          refreshFraudEntriesAdmin().catch(() => {
            // Silently handle errors to prevent infinite loops
          });
          refreshFraudSubmissionsAdmin().catch(() => {
            // Silently handle errors to prevent infinite loops
          });
        }
        if (canView && adminPage === "special") {
          refreshSpecialSubmissionsAdmin().catch(() => {
            // Silently handle errors to prevent infinite loops
          });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [canView, adminPage]);

      return (
        <div className="space-y-6">
          {/* Fraud Entries Section */}
          <Card className="p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <div className="text-lg font-semibold text-slate-900">Fraud Entries</div>
                <div className="text-sm text-slate-600 mt-1">Manage fraud entries that appear on the fraud page.</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={importDefaultFraudEntries} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50" disabled={fraudEntriesBusy}>
                  Import defaults
                </button>
                <button onClick={() => refreshFraudEntriesAdmin(true)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50" disabled={fraudEntriesBusy}>
                  Refresh
                </button>
              </div>
            </div>

            {fraudEntriesErr ? <div className="mb-4 text-sm text-red-700">{fraudEntriesErr}</div> : null}

            {/* Create New Entry */}
            <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-medium text-slate-700 mb-3">Create New Fraud Entry</div>
              <div className="grid md:grid-cols-2 gap-3">
                <input
                  id="admin-fraud-entry-new-name"
                  name="fraudEntryName"
                  value={fraudEntryNew.name}
                  onChange={(e) => setFraudEntryNew({ ...fraudEntryNew, name: e.target.value })}
                  placeholder="Name / Title"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm"
                />
                <select
                  id="admin-fraud-entry-new-platform"
                  name="fraudEntryPlatform"
                  value={fraudEntryNew.platform}
                  onChange={(e) => setFraudEntryNew({ ...fraudEntryNew, platform: e.target.value })}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm"
                >
                  <option value="Telegram">Telegram</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Email">Email</option>
                  <option value="Other">Other</option>
                </select>
                <input
                  id="admin-fraud-entry-new-handle"
                  name="fraudEntryHandle"
                  value={fraudEntryNew.handle}
                  onChange={(e) => setFraudEntryNew({ ...fraudEntryNew, handle: e.target.value })}
                  placeholder="@username / phone / email"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm"
                />
                <input
                  id="admin-fraud-entry-new-evidenceUrl"
                  name="fraudEntryEvidenceUrl"
                  value={fraudEntryNew.evidenceUrl}
                  onChange={(e) => setFraudEntryNew({ ...fraudEntryNew, evidenceUrl: e.target.value })}
                  placeholder="Evidence URL (optional)"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm"
                />
                <input
                  id="admin-fraud-entry-new-note"
                  name="fraudEntryNote"
                  value={fraudEntryNew.note}
                  onChange={(e) => setFraudEntryNew({ ...fraudEntryNew, note: e.target.value })}
                  placeholder="Short note (optional)"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm md:col-span-2"
                />
                <textarea
                  id="admin-fraud-entry-new-details"
                  name="fraudEntryDetails"
                  value={fraudEntryNew.details}
                  onChange={(e) => setFraudEntryNew({ ...fraudEntryNew, details: e.target.value })}
                  placeholder="Details (optional)"
                  rows={3}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm md:col-span-2"
                />
              </div>
              <button
                onClick={createFraudEntry}
                disabled={fraudEntriesBusy || !fraudEntryNew.name.trim()}
                className="mt-3 rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm hover:bg-emerald-700 disabled:opacity-60"
              >
                Create Entry
              </button>
            </div>

            {/* Edit Entry Form */}
            {fraudEntryEditingId ? (
              <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium text-slate-700">Editing Entry #{fraudEntryEditingId}</div>
                  <button onClick={() => setFraudEntryEditingId(null)} className="text-sm text-slate-600 hover:text-slate-900">
                    Cancel
                  </button>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <input
                    id="admin-fraud-entry-edit-name"
                    name="fraudEntryEditName"
                    value={fraudEntryEdit.name}
                    onChange={(e) => setFraudEntryEdit({ ...fraudEntryEdit, name: e.target.value })}
                    placeholder="Name / Title"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm"
                  />
                  <select
                    id="admin-fraud-entry-edit-platform"
                    name="fraudEntryEditPlatform"
                    value={fraudEntryEdit.platform}
                    onChange={(e) => setFraudEntryEdit({ ...fraudEntryEdit, platform: e.target.value })}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm"
                  >
                    <option value="Telegram">Telegram</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Email">Email</option>
                    <option value="Other">Other</option>
                  </select>
                  <input
                    id="admin-fraud-entry-edit-handle"
                    name="fraudEntryEditHandle"
                    value={fraudEntryEdit.handle}
                    onChange={(e) => setFraudEntryEdit({ ...fraudEntryEdit, handle: e.target.value })}
                    placeholder="@username / phone / email"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm"
                  />
                  <input
                    id="admin-fraud-entry-edit-evidenceUrl"
                    name="fraudEntryEditEvidenceUrl"
                    value={fraudEntryEdit.evidenceUrl}
                    onChange={(e) => setFraudEntryEdit({ ...fraudEntryEdit, evidenceUrl: e.target.value })}
                    placeholder="Evidence URL (optional)"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm"
                  />
                  <input
                    id="admin-fraud-entry-edit-note"
                    name="fraudEntryEditNote"
                    value={fraudEntryEdit.note}
                    onChange={(e) => setFraudEntryEdit({ ...fraudEntryEdit, note: e.target.value })}
                    placeholder="Short note (optional)"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm md:col-span-2"
                  />
                  <textarea
                    id="admin-fraud-entry-edit-details"
                    name="fraudEntryEditDetails"
                    value={fraudEntryEdit.details}
                    onChange={(e) => setFraudEntryEdit({ ...fraudEntryEdit, details: e.target.value })}
                    placeholder="Details (optional)"
                    rows={3}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm md:col-span-2"
                  />
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={updateFraudEntry}
                    disabled={fraudEntriesBusy || !fraudEntryEdit.name.trim()}
                    className="flex-1 rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm hover:bg-emerald-700 disabled:opacity-60"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setFraudEntryEditingId(null)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {/* Entries List */}
            <div className="space-y-3">
              {fraudEntriesBusy && fraudEntriesAdmin.length === 0 ? (
                <div className="text-sm text-slate-600">Loading...</div>
              ) : fraudEntriesAdmin.length === 0 ? (
                <div className="text-sm text-slate-600">No fraud entries.</div>
              ) : (
                fraudEntriesAdmin.map((entry: any) => (
                  <div key={entry.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-slate-900">{entry.name}</div>
                        <div className="mt-1 text-xs text-slate-600">
                          <span className="font-medium">{entry.platform}:</span> {entry.handle}
                        </div>
                        {entry.note ? <div className="mt-1 text-xs text-slate-500">{entry.note}</div> : null}
                        {entry.details ? <div className="mt-1 text-xs text-slate-500 line-clamp-2">{entry.details}</div> : null}
                        {entry.evidenceUrl ? (
                          <a href={entry.evidenceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 text-xs text-blue-600 hover:underline">
                            Evidence Link
                          </a>
                        ) : null}
                        <div className="mt-2 text-xs text-slate-400">Reports: {entry.reports || 0}</div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => startEditFraudEntry(entry)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteFraudEntry(entry.id)}
                          className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Fraud Submissions Section */}
          <Card className="p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <div className="text-lg font-semibold text-slate-900">Fraud Submissions</div>
                <div className="text-sm text-slate-600 mt-1">Review and approve fraud reports from users.</div>
              </div>
              <button onClick={() => refreshFraudSubmissionsAdmin(true)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50" disabled={fraudSubmissionsBusy}>
                Refresh
              </button>
            </div>

            {fraudSubmissionsErr ? <div className="mb-4 text-sm text-red-700">{fraudSubmissionsErr}</div> : null}

            <div className="space-y-3">
              {fraudSubmissionsBusy && fraudSubmissionsAdmin.length === 0 ? (
                <div className="text-sm text-slate-600">Loading...</div>
              ) : fraudSubmissionsAdmin.length === 0 ? (
                <div className="text-sm text-slate-600">No submissions.</div>
              ) : (
                fraudSubmissionsAdmin.map((submission: any) => (
                  <div key={submission.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-slate-900">{submission.name}</div>
                        <div className="mt-1 text-xs text-slate-600">
                          <span className="font-medium">{submission.platform}:</span> {submission.handle}
                        </div>
                        {submission.details ? <div className="mt-1 text-xs text-slate-500">{submission.details}</div> : null}
                        {submission.evidenceUrl ? (
                          <a href={submission.evidenceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 text-xs text-blue-600 hover:underline">
                            Evidence Link
                          </a>
                        ) : null}
                        <div className="mt-2 text-xs text-slate-400">
                          Email: {submission.email} | Verified: {submission.verifiedAt ? "Yes" : "No"} | 
                          {submission.approvedAt ? " Approved" : submission.rejectedAt ? " Rejected" : " Pending"}
                        </div>
                      </div>
                      {!submission.approvedAt && !submission.rejectedAt && submission.verifiedAt ? (
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={async () => {
                              if (!confirm("Approve this submission and create a fraud entry?")) return;
                              try {
                                await gatewayFetch(`/admin/fraud/submissions/${submission.id}/approve`, { method: "POST" });
                                await refreshFraudSubmissionsAdmin(true);
                                await refreshFraudEntriesAdmin(true);
                              } catch (e: any) {
                                alert(e?.message || "Failed to approve");
                              }
                            }}
                            className="rounded-xl bg-emerald-600 text-white px-3 py-1.5 text-xs hover:bg-emerald-700"
                          >
                            Approve
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm("Reject this submission?")) return;
                              try {
                                await gatewayFetch(`/admin/fraud/submissions/${submission.id}/reject`, { method: "POST" });
                                await refreshFraudSubmissionsAdmin();
                              } catch (e: any) {
                                alert(e?.message || "Failed to reject");
                              }
                            }}
                            className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
                          >
                            Reject
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      );
    };

    const FAQsManagement = () => {
      const [newFAQ, setNewFAQ] = useState({
        question: "",
        answer: "",
        keywords: "",
        seoTitle: "",
        seoDescription: "",
        seoSlug: "",
        seoOgImage: "",
        primaryKeyword: "",
        secondaryKeywordsText: "",
        sortOrder: 0,
        active: true,
      });
      const [editingFAQKey, setEditingFAQKey] = useState<string | null>(null);
      const [editFAQSource, setEditFAQSource] = useState<"new" | "old" | null>(null);
      const [editFAQ, setEditFAQ] = useState({
        question: "",
        answer: "",
        keywords: "",
        seoTitle: "",
        seoDescription: "",
        seoSlug: "",
        seoOgImage: "",
        primaryKeyword: "",
        secondaryKeywordsText: "",
        sortOrder: 0,
        active: true,
      });

      const createFAQ = async () => {
        if (!canView || !newFAQ.question.trim() || !newFAQ.answer.trim()) return;
        setChatFAQsBusy(true);
        try {
          const keywords = newFAQ.keywords.split(",").map((k) => k.trim()).filter((k) => k);
          const secondaryKeywords = String((newFAQ as any).secondaryKeywordsText || "")
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean);
          await gatewayFetch("/admin/chat/faqs", {
            method: "POST",
            body: JSON.stringify({
              question: newFAQ.question,
              answer: newFAQ.answer,
              keywords,
              seoTitle: (newFAQ as any).seoTitle || "",
              seoDescription: (newFAQ as any).seoDescription || "",
              seoSlug: (newFAQ as any).seoSlug || "",
              seoOgImage: (newFAQ as any).seoOgImage || "",
              primaryKeyword: (newFAQ as any).primaryKeyword || "",
              secondaryKeywords,
              sortOrder: newFAQ.sortOrder,
              active: newFAQ.active,
            }),
          });
          setNewFAQ({
            question: "",
            answer: "",
            keywords: "",
            seoTitle: "",
            seoDescription: "",
            seoSlug: "",
            seoOgImage: "",
            primaryKeyword: "",
            secondaryKeywordsText: "",
            sortOrder: 0,
            active: true,
          });
          await refreshChatFAQs();
        } catch (e: any) {
          setChatFAQsErr(e?.message || "Failed to create FAQ");
        } finally {
          setChatFAQsBusy(false);
        }
      };

      const updateFAQ = async () => {
        if (!canView || !editingFAQKey || !editFAQ.question.trim() || !editFAQ.answer.trim()) return;
        const id = Number(String(editingFAQKey).split(":")[1]);
        if (!Number.isFinite(id)) return;
        setChatFAQsBusy(true);
        try {
          const keywords = editFAQ.keywords.split(",").map((k) => k.trim()).filter((k) => k);
          const secondaryKeywords = String((editFAQ as any).secondaryKeywordsText || "")
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean);
          await gatewayFetch(`/admin/chat/faqs/${id}`, {
            method: "PATCH",
            body: JSON.stringify({
              question: editFAQ.question,
              answer: editFAQ.answer,
              keywords,
              seoTitle: (editFAQ as any).seoTitle || "",
              seoDescription: (editFAQ as any).seoDescription || "",
              seoSlug: (editFAQ as any).seoSlug || "",
              seoOgImage: (editFAQ as any).seoOgImage || "",
              primaryKeyword: (editFAQ as any).primaryKeyword || "",
              secondaryKeywords,
              sortOrder: editFAQ.sortOrder,
              active: editFAQ.active,
              source: editFAQSource || undefined,
            }),
          });
          setEditingFAQKey(null);
          setEditFAQSource(null);
          await refreshChatFAQs();
        } catch (e: any) {
          setChatFAQsErr(e?.message || "Failed to update FAQ");
        } finally {
          setChatFAQsBusy(false);
        }
      };

      const deleteFAQ = async (id: number, source?: "new" | "old") => {
        if (!canView) return;
        if (!confirm("Delete this FAQ?")) return;
        setChatFAQsBusy(true);
        try {
          const qs = source ? `?source=${encodeURIComponent(source)}` : "";
          await gatewayFetch(`/admin/chat/faqs/${id}${qs}`, { method: "DELETE" });
          await refreshChatFAQs();
        } catch (e: any) {
          setChatFAQsErr(e?.message || "Failed to delete FAQ");
        } finally {
          setChatFAQsBusy(false);
        }
      };

      // Note: FAQ refresh is handled by the main useEffect in Admin component
      // No need for duplicate useEffect here

      return (
        <div className="space-y-6">
          {chatFAQsErr && (
            <Card className="p-4 bg-red-50 border border-red-200">
              <div className="text-sm text-red-700">{chatFAQsErr}</div>
            </Card>
          )}

          {/* Create New FAQ */}
          <Card className="p-6">
            <div className="text-lg font-semibold text-slate-900 mb-4">Create New FAQ</div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Question</label>
                <input
                  type="text"
                  value={newFAQ.question}
                  onChange={(e) => setNewFAQ({ ...newFAQ, question: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Enter question"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Answer</label>
                <textarea
                  value={newFAQ.answer}
                  onChange={(e) => setNewFAQ({ ...newFAQ, answer: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  rows={4}
                  placeholder="Enter answer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Keywords (comma-separated)</label>
                <input
                  type="text"
                  value={newFAQ.keywords}
                  onChange={(e) => setNewFAQ({ ...newFAQ, keywords: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="keyword1, keyword2, keyword3"
                />
              </div>

              <SeoPanel
                entityType="FAQ"
                titleText={newFAQ.question}
                contentText={newFAQ.answer}
                seoTitle={(newFAQ as any).seoTitle}
                seoDescription={(newFAQ as any).seoDescription}
                primaryKeyword={(newFAQ as any).primaryKeyword}
                setPrimaryKeyword={(v) => setNewFAQ((s) => ({ ...(s as any), primaryKeyword: v }))}
                secondaryKeywordsText={(newFAQ as any).secondaryKeywordsText}
                setSecondaryKeywordsText={(v) => setNewFAQ((s) => ({ ...(s as any), secondaryKeywordsText: v }))}
              />
              <div className="flex items-center gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sort Order</label>
                  <input
                    type="number"
                    value={newFAQ.sortOrder}
                    onChange={(e) => setNewFAQ({ ...newFAQ, sortOrder: parseInt(e.target.value) || 0 })}
                    className="w-24 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex items-center gap-2 mt-6">
                  <input
                    type="checkbox"
                    checked={newFAQ.active}
                    onChange={(e) => setNewFAQ({ ...newFAQ, active: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label className="text-sm text-slate-700">Active</label>
                </div>
              </div>
              <button
                onClick={createFAQ}
                disabled={chatFAQsBusy || !newFAQ.question.trim() || !newFAQ.answer.trim()}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {chatFAQsBusy ? "Creating..." : "Create FAQ"}
              </button>
            </div>
          </Card>

          {/* FAQs List */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-semibold text-slate-900">FAQs ({chatFAQs.length})</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={importDefaultFAQs}
                  disabled={chatFAQsBusy}
                  className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                >
                  Import defaults
                </button>
                <button
                  onClick={refreshChatFAQs}
                  disabled={chatFAQsBusy}
                  className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                >
                  {chatFAQsBusy ? "Loading..." : "Refresh"}
                </button>
              </div>
            </div>

            {chatFAQsErr ? <div className="mb-4 text-sm text-slate-700">{chatFAQsErr}</div> : null}

            {chatFAQsBusy && chatFAQs.length === 0 ? (
              <div className="text-center py-8 text-slate-500">Loading FAQs...</div>
            ) : chatFAQs.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No FAQs found. Create one above.</div>
            ) : (
              <div className="space-y-4">
                {chatFAQs.map((faq: any) => (
                  <div key={`${faq?.source || ""}:${faq.id}`} className="border border-slate-200 rounded-lg p-4">
                    {editingFAQKey === `${faq?.source || "new"}:${faq.id}` ? (
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={editFAQ.question}
                          onChange={(e) => setEditFAQ({ ...editFAQ, question: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                        />
                        <textarea
                          value={editFAQ.answer}
                          onChange={(e) => setEditFAQ({ ...editFAQ, answer: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                          rows={3}
                        />

                        <SeoPanel
                          entityType="FAQ"
                          entityId={Number(faq.id)}
                          titleText={editFAQ.question}
                          contentText={editFAQ.answer}
                          seoTitle={(editFAQ as any).seoTitle}
                          seoDescription={(editFAQ as any).seoDescription}
                          primaryKeyword={(editFAQ as any).primaryKeyword}
                          setPrimaryKeyword={(v) => setEditFAQ((s) => ({ ...(s as any), primaryKeyword: v }))}
                          secondaryKeywordsText={(editFAQ as any).secondaryKeywordsText}
                          setSecondaryKeywordsText={(v) => setEditFAQ((s) => ({ ...(s as any), secondaryKeywordsText: v }))}
                        />
                        <div className="flex items-center gap-4">
                          <button
                            onClick={updateFAQ}
                            disabled={chatFAQsBusy}
                            className="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingFAQKey(null);
                              setEditFAQSource(null);
                            }}
                            className="px-3 py-1.5 border border-slate-300 text-sm rounded-lg hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-semibold text-slate-900 mb-1">{faq.question}</div>
                            <div className="text-sm text-slate-600 mb-2">{faq.answer}</div>
                            {faq.keywords && faq.keywords.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-2">
                                {faq.keywords.map((kw: string, idx: number) => (
                                  <span key={idx} className="px-2 py-0.5 bg-slate-100 text-xs text-slate-600 rounded">
                                    {kw}
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="text-xs text-slate-500">
                              Sort: {faq.sortOrder} | {faq.active ? "Active" : "Inactive"}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <button
                              onClick={() => {
                                setEditingFAQKey(`${faq?.source || "new"}:${faq.id}`);
                                setEditFAQSource((faq?.source as any) || null);
                                setEditFAQ({
                                  question: faq.question,
                                  answer: faq.answer,
                                  keywords: Array.isArray(faq.keywords) ? faq.keywords.join(", ") : "",
                                  sortOrder: faq.sortOrder,
                                  active: faq.active,
                                });
                              }}
                              className="px-3 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteFAQ(faq.id, faq?.source)}
                              disabled={chatFAQsBusy}
                              className="px-3 py-1 text-xs border border-red-300 text-red-600 rounded hover:bg-red-50 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      );
    };

    const SpecialCrackManagement = () => {
      const [expandedId, setExpandedId] = useState<string | null>(null);
      
      useEffect(() => {
        if (canView && adminPage === "special") {
          refreshSpecialSubmissionsAdmin().catch(() => {
            // Silently handle errors to prevent infinite loops
          });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [canView, adminPage]);

      const smileyEmojis = ["😞", "🙁", "😐", "🙂", "😃"];

      return (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <div className="text-lg font-semibold text-slate-900">Special Crack Submissions</div>
                <div className="text-sm text-slate-600 mt-1">View all special crack requests from users.</div>
              </div>
              <button onClick={refreshSpecialSubmissionsAdmin} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50" disabled={specialSubmissionsBusy}>
                Refresh
              </button>
            </div>

            {specialSubmissionsErr ? <div className="mb-4 text-sm text-red-700">{specialSubmissionsErr}</div> : null}

            {specialSubmissionsBusy && specialSubmissionsAdmin.length === 0 ? (
              <div className="text-sm text-slate-600 py-8 text-center">Loading...</div>
            ) : specialSubmissionsAdmin.length === 0 ? (
              <div className="text-sm text-slate-600 py-8 text-center">No submissions.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase">Name</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase">Email</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase">WhatsApp</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase">Website</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase">Service</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase">Budget</th>
                      <th className="text-center py-3 px-4 text-xs font-semibold text-slate-700 uppercase">Rating</th>
                      <th className="text-center py-3 px-4 text-xs font-semibold text-slate-700 uppercase">Attachment</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase">Date</th>
                      <th className="text-center py-3 px-4 text-xs font-semibold text-slate-700 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {specialSubmissionsAdmin.map((submission: any) => (
                      <React.Fragment key={submission.id}>
                        <tr className="border-b border-slate-100 hover:bg-slate-50 transition">
                          <td className="py-3 px-4 text-sm text-slate-900 font-medium">{submission.name}</td>
                          <td className="py-3 px-4 text-sm text-slate-600">{submission.email}</td>
                          <td className="py-3 px-4 text-sm text-slate-600">{submission.whatsapp}</td>
                          <td className="py-3 px-4 text-sm text-slate-600">
                            <a href={submission.website.startsWith('http') ? submission.website : `https://${submission.website}`} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">
                              {submission.website}
                            </a>
                          </td>
                          <td className="py-3 px-4 text-sm text-slate-600">{submission.service}</td>
                          <td className="py-3 px-4 text-sm text-slate-600">{submission.budget}</td>
                          <td className="py-3 px-4 text-center text-xl">{smileyEmojis[submission.smileyRating] || "😐"}</td>
                          <td className="py-3 px-4 text-center">
                            {submission.attachmentUrl ? (
                              <a href={submission.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline text-sm">
                                View
                              </a>
                            ) : (
                              <span className="text-slate-400 text-sm">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm text-slate-500">
                            {new Date(submission.createdAt).toLocaleDateString()}
                            <br />
                            <span className="text-xs">{new Date(submission.createdAt).toLocaleTimeString()}</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => setExpandedId(expandedId === submission.id ? null : submission.id)}
                              className="text-xs text-emerald-600 hover:text-emerald-700 hover:underline"
                            >
                              {expandedId === submission.id ? "Hide" : "View"}
                            </button>
                          </td>
                        </tr>
                        {expandedId === submission.id && (
                          <tr>
                            <td colSpan={10} className="py-4 px-4 bg-slate-50">
                              <div className="space-y-2">
                                <div className="text-xs font-semibold text-slate-700 uppercase mb-2">Full Message:</div>
                                <div className="text-sm text-slate-700 whitespace-pre-wrap bg-white p-3 rounded-lg border border-slate-200">
                                  {submission.message}
                                </div>
                                <div className="text-xs text-slate-500 mt-2">
                                  <span className="font-medium">Submission ID:</span> {submission.id}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      );
    };

    const FooterLinksManagement = () => {
      const [flNewGroup, setFlNewGroup] = useState<"RESOURCES" | "INFORMATION">("RESOURCES");
      const [flNewTargetType, setFlNewTargetType] = useState<"PAGE" | "URL">("PAGE");
      const [flNewTargetPage, setFlNewTargetPage] = useState<string>("pricing");
      const [flNewTargetUrl, setFlNewTargetUrl] = useState<string>("");
      const [flNewSortOrder, setFlNewSortOrder] = useState<string>("0");
      const [flNewEnabled, setFlNewEnabled] = useState<boolean>(true);
      const [flNewLabelEN, setFlNewLabelEN] = useState<string>("");
      const [flNewLabelRU, setFlNewLabelRU] = useState<string>("");
      const [flNewLabelIT, setFlNewLabelIT] = useState<string>("");
      const [flNewLabelAR, setFlNewLabelAR] = useState<string>("");

      const [flEditingId, setFlEditingId] = useState<number | null>(null);
      const [flEditForm, setFlEditForm] = useState<any>({ group: "RESOURCES", targetType: "PAGE", targetPage: "pricing", targetUrl: "", sortOrder: 0, enabled: true, labels: { EN: "", RU: "", IT: "", AR: "" } });

      const resourcesLinks = footerLinksAdmin.filter((fl: any) => fl.group === "RESOURCES");
      const informationLinks = footerLinksAdmin.filter((fl: any) => fl.group === "INFORMATION");

      return (
        <div className="space-y-6">
          {footerLinksErr && (
            <Card className="p-4 bg-red-50 border border-red-200">
              <div className="text-sm text-red-700">{footerLinksErr}</div>
            </Card>
          )}

          {/* Create New Footer Link */}
          <Card className="p-6">
            <div className="text-lg font-semibold text-slate-900 mb-4">Create New Footer Link</div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Group</label>
                <select
                  value={flNewGroup}
                  onChange={(e) => setFlNewGroup(e.target.value as "RESOURCES" | "INFORMATION")}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="RESOURCES">Resources</option>
                  <option value="INFORMATION">Information</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Labels (Multi-language)</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <input
                      type="text"
                      value={flNewLabelEN}
                      onChange={(e) => setFlNewLabelEN(e.target.value)}
                      placeholder="English"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={flNewLabelRU}
                      onChange={(e) => setFlNewLabelRU(e.target.value)}
                      placeholder="Russian"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={flNewLabelIT}
                      onChange={(e) => setFlNewLabelIT(e.target.value)}
                      placeholder="Italian"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={flNewLabelAR}
                      onChange={(e) => setFlNewLabelAR(e.target.value)}
                      placeholder="Arabic"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Target Type</label>
                <select
                  value={flNewTargetType}
                  onChange={(e) => setFlNewTargetType(e.target.value as "PAGE" | "URL")}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="PAGE">Page</option>
                  <option value="URL">URL</option>
                </select>
              </div>
              {flNewTargetType === "PAGE" ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Target Page</label>
                  <select
                    value={flNewTargetPage}
                    onChange={(e) => setFlNewTargetPage(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {availablePages.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Target URL</label>
                  <input
                    type="url"
                    value={flNewTargetUrl}
                    onChange={(e) => setFlNewTargetUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="https://example.com"
                  />
                </div>
              )}
              <div className="flex items-center gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sort Order</label>
                  <input
                    type="number"
                    value={flNewSortOrder}
                    onChange={(e) => setFlNewSortOrder(e.target.value)}
                    className="w-24 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex items-center gap-2 mt-6">
                  <input
                    type="checkbox"
                    checked={flNewEnabled}
                    onChange={(e) => setFlNewEnabled(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label className="text-sm text-slate-700">Enabled</label>
                </div>
              </div>
              <button
                onClick={async () => {
                  if (!flNewLabelEN.trim()) {
                    setFooterLinksErr("English label is required");
                    return;
                  }
                  const labels: any = {};
                  if (flNewLabelEN.trim()) labels.EN = flNewLabelEN.trim();
                  if (flNewLabelRU.trim()) labels.RU = flNewLabelRU.trim();
                  if (flNewLabelIT.trim()) labels.IT = flNewLabelIT.trim();
                  if (flNewLabelAR.trim()) labels.AR = flNewLabelAR.trim();
                  
                  try {
                    await gatewayFetch("/admin/footer-links", {
                      method: "POST",
                      body: JSON.stringify({
                        group: flNewGroup,
                        labels,
                        targetType: flNewTargetType,
                        targetPage: flNewTargetType === "PAGE" ? flNewTargetPage : "",
                        targetUrl: flNewTargetType === "URL" ? flNewTargetUrl : "",
                        sortOrder: parseInt(flNewSortOrder) || 0,
                        enabled: flNewEnabled,
                      }),
                    });
                    setFlNewLabelEN("");
                    setFlNewLabelRU("");
                    setFlNewLabelIT("");
                    setFlNewLabelAR("");
                    setFlNewTargetPage("pricing");
                    setFlNewTargetUrl("");
                    setFlNewSortOrder("0");
                    setFlNewEnabled(true);
                    await refreshFooterLinksAdmin();
                  } catch (e: any) {
                    setFooterLinksErr(e?.message || "Failed to create footer link");
                  }
                }}
                disabled={footerLinksBusy || !flNewLabelEN.trim()}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {footerLinksBusy ? "Creating..." : "Create Footer Link"}
              </button>
            </div>
          </Card>

          {/* Footer Links List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Resources Group */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-lg font-semibold text-slate-900">Resources ({resourcesLinks.length})</div>
                <button
                  onClick={refreshFooterLinksAdmin}
                  disabled={footerLinksBusy}
                  className="px-3 py-1 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                >
                  Refresh
                </button>
              </div>
              {footerLinksBusy && resourcesLinks.length === 0 ? (
                <div className="text-center py-4 text-slate-500 text-sm">Loading...</div>
              ) : resourcesLinks.length === 0 ? (
                <div className="text-center py-4 text-slate-500 text-sm">No links</div>
              ) : (
                <div className="space-y-2">
                  {resourcesLinks.map((fl: any) => (
                    <div key={fl.id} className="border border-slate-200 rounded-lg p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-slate-900 text-sm">
                            {(fl.labels as any)?.EN || (fl.labels as any)?.RU || "-"}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {fl.targetType === "PAGE" ? `Page: ${fl.targetPage}` : `URL: ${fl.targetUrl}`}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            Sort: {fl.sortOrder} | {fl.enabled ? "Enabled" : "Disabled"}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            onClick={async () => {
                              setFlEditingId(fl.id);
                              setFlEditForm({
                                group: fl.group,
                                labels: fl.labels || {},
                                targetType: fl.targetType,
                                targetPage: fl.targetPage || "",
                                targetUrl: fl.targetUrl || "",
                                sortOrder: fl.sortOrder,
                                enabled: fl.enabled,
                              });
                            }}
                            className="px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm("Delete this footer link?")) return;
                              try {
                                await gatewayFetch(`/admin/footer-links/${fl.id}`, { method: "DELETE" });
                                await refreshFooterLinksAdmin();
                              } catch (e: any) {
                                setFooterLinksErr(e?.message || "Failed to delete");
                              }
                            }}
                            className="px-2 py-1 text-xs border border-red-300 text-red-600 rounded hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Information Group */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-lg font-semibold text-slate-900">Information ({informationLinks.length})</div>
                <button
                  onClick={refreshFooterLinksAdmin}
                  disabled={footerLinksBusy}
                  className="px-3 py-1 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                >
                  Refresh
                </button>
              </div>
              {footerLinksBusy && informationLinks.length === 0 ? (
                <div className="text-center py-4 text-slate-500 text-sm">Loading...</div>
              ) : informationLinks.length === 0 ? (
                <div className="text-center py-4 text-slate-500 text-sm">No links</div>
              ) : (
                <div className="space-y-2">
                  {informationLinks.map((fl: any) => (
                    <div key={fl.id} className="border border-slate-200 rounded-lg p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-slate-900 text-sm">
                            {(fl.labels as any)?.EN || (fl.labels as any)?.RU || "-"}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {fl.targetType === "PAGE" ? `Page: ${fl.targetPage}` : `URL: ${fl.targetUrl}`}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            Sort: {fl.sortOrder} | {fl.enabled ? "Enabled" : "Disabled"}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            onClick={async () => {
                              setFlEditingId(fl.id);
                              setFlEditForm({
                                group: fl.group,
                                labels: fl.labels || {},
                                targetType: fl.targetType,
                                targetPage: fl.targetPage || "",
                                targetUrl: fl.targetUrl || "",
                                sortOrder: fl.sortOrder,
                                enabled: fl.enabled,
                              });
                            }}
                            className="px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm("Delete this footer link?")) return;
                              try {
                                await gatewayFetch(`/admin/footer-links/${fl.id}`, { method: "DELETE" });
                                await refreshFooterLinksAdmin();
                              } catch (e: any) {
                                setFooterLinksErr(e?.message || "Failed to delete");
                              }
                            }}
                            className="px-2 py-1 text-xs border border-red-300 text-red-600 rounded hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Edit Modal */}
          {flEditingId && (
            <Card className="p-6 border-2 border-emerald-500">
              <div className="text-lg font-semibold text-slate-900 mb-4">Edit Footer Link</div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Group</label>
                  <select
                    value={flEditForm.group}
                    onChange={(e) => setFlEditForm({ ...flEditForm, group: e.target.value as "RESOURCES" | "INFORMATION" })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="RESOURCES">Resources</option>
                    <option value="INFORMATION">Information</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Labels</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <input
                        type="text"
                        value={(flEditForm.labels as any)?.EN || ""}
                        onChange={(e) => setFlEditForm({ ...flEditForm, labels: { ...(flEditForm.labels as any), EN: e.target.value } })}
                        placeholder="English"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={(flEditForm.labels as any)?.RU || ""}
                        onChange={(e) => setFlEditForm({ ...flEditForm, labels: { ...(flEditForm.labels as any), RU: e.target.value } })}
                        placeholder="Russian"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={(flEditForm.labels as any)?.IT || ""}
                        onChange={(e) => setFlEditForm({ ...flEditForm, labels: { ...(flEditForm.labels as any), IT: e.target.value } })}
                        placeholder="Italian"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={(flEditForm.labels as any)?.AR || ""}
                        onChange={(e) => setFlEditForm({ ...flEditForm, labels: { ...(flEditForm.labels as any), AR: e.target.value } })}
                        placeholder="Arabic"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Target Type</label>
                  <select
                    value={flEditForm.targetType}
                    onChange={(e) => setFlEditForm({ ...flEditForm, targetType: e.target.value as "PAGE" | "URL" })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="PAGE">Page</option>
                    <option value="URL">URL</option>
                  </select>
                </div>
                {flEditForm.targetType === "PAGE" ? (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Target Page</label>
                    <select
                      value={flEditForm.targetPage}
                      onChange={(e) => setFlEditForm({ ...flEditForm, targetPage: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    >
                      {availablePages.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Target URL</label>
                    <input
                      type="url"
                      value={flEditForm.targetUrl}
                      onChange={(e) => setFlEditForm({ ...flEditForm, targetUrl: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                )}
                <div className="flex items-center gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Sort Order</label>
                    <input
                      type="number"
                      value={flEditForm.sortOrder}
                      onChange={(e) => setFlEditForm({ ...flEditForm, sortOrder: parseInt(e.target.value) || 0 })}
                      className="w-24 px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-6">
                    <input
                      type="checkbox"
                      checked={flEditForm.enabled}
                      onChange={(e) => setFlEditForm({ ...flEditForm, enabled: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <label className="text-sm text-slate-700">Enabled</label>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      try {
                        await gatewayFetch(`/admin/footer-links/${flEditingId}`, {
                          method: "PUT",
                          body: JSON.stringify(flEditForm),
                        });
                        setFlEditingId(null);
                        await refreshFooterLinksAdmin();
                      } catch (e: any) {
                        setFooterLinksErr(e?.message || "Failed to update");
                      }
                    }}
                    disabled={footerLinksBusy}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setFlEditingId(null)}
                    className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </Card>
          )}
        </div>
      );
    };

// Admin Sidebar Navigation
const AdminSidebar = () => (
  <div className={`${sidebarOpen ? "w-64" : "w-16"} bg-white border-r border-slate-200 h-screen fixed left-0 top-0 transition-all duration-300 z-40 flex flex-col shadow-sm overflow-y-auto`}>
    <div className="p-4 border-b border-slate-200 flex items-center justify-between">
      {sidebarOpen && <div className="text-base font-bold text-slate-900">Admin Panel</div>}
      <button
        type="button"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="p-2 rounded-lg hover:bg-slate-100 transition"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d={sidebarOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
        </svg>
      </button>
    </div>

    <div className="flex-1 overflow-y-auto p-2">
      <nav className="space-y-1">
        {[
          { id: "dashboard", label: "Dashboard", icon: "M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" },
          { id: "categories", label: "Category", icon: "M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z" },
          { id: "products", label: "Products", icon: "M20 6h-2.18c.11-.31.18-.65.18-1a2.996 2.996 0 0 0-5.5-1.65l-.5.67-.5-.68C10.96 2.54 10 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z" },
          { id: "featured-products", label: "Featured Products", icon: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" },
          { id: "orders", label: "Orders", icon: "M7 18c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12L8.1 13h7.45c.75 0 1.41-.41 1.75-1.03L21.7 4H5.21l-.94-2H1zm16 16c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" },
          { id: "users", label: "Users", icon: "M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.96.05 1.16.84 1.96 1.96 1.96 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" },
          { id: "analytics", label: "Analytics", icon: "M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z" },
          { id: "pricing", label: "Pricing Plans", icon: "M12 1.5c-3.59 0-6.5 2.01-6.5 4.5S8.41 10.5 12 10.5 18.5 8.49 18.5 6 15.59 1.5 12 1.5zm0 11c-4.14 0-7.5 2.01-7.5 4.5v.5c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V17c0-2.49-3.36-4.5-7.5-4.5z" },
          { id: "coupons", label: "Coupons", icon: "M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z" },
          { id: "banners", label: "Banners", icon: "M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" },
          { id: "brands", label: "Brands", icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" },
          { id: "fraud", label: "Fraud", icon: "M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" },
          { id: "special", label: "Special Crack", icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" },
          { id: "faqs", label: "FAQs", icon: "M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z" },
          { id: "footer-links", label: "Footer Links", icon: "M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" },
          { id: "subscription", label: "Subscription", icon: "M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.89 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" },
          { id: "testimonials", label: "Testimonials", icon: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" },
          { id: "settings", label: "Settings", icon: "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setAdminPage(item.id as any)}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-base transition ${
              adminPage === item.id
                ? "bg-emerald-50 text-emerald-700 font-medium"
                : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
              <path d={item.icon} />
            </svg>
            {sidebarOpen && <span className="text-base">{item.label}</span>}
          </button>
        ))}
      </nav>
    </div>

    <div className="p-4 border-t border-slate-200">
      <button
        type="button"
        onClick={() => setPage("home")}
        className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-base text-slate-700 hover:bg-slate-50 transition"
      >
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        {sidebarOpen && <span className="text-base">Back to Site</span>}
      </button>
    </div>
  </div>
);
    // Admin Dashboard Page
    const AdminDashboard = () => (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card className="p-6 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <div className="text-sm opacity-90">Total Products</div>
          <div className="text-3xl font-bold mt-2">{products.length}</div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="text-sm opacity-90">Total Orders</div>
          <div className="text-3xl font-bold mt-2">{orders.length}</div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="text-sm opacity-90">Active Chats</div>
          <div className="text-3xl font-bold mt-2">{chatSessions.filter((s: any) => s.status !== "CLOSED").length}</div>
        </Card>
      </div>
    );

    return (
      <div className="flex min-h-screen bg-slate-50">
        <AdminSidebar />
        <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? "ml-64" : "ml-16"}`} style={{ minHeight: "100vh", overflowY: "auto" }}>
          <div className="p-6">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 capitalize">{adminPage.replace("-", " ")}</h1>
                <p className="text-base text-slate-600 mt-1">
                  {adminPage === "dashboard" && "Overview of your store"}
                  {adminPage === "categories" && "Manage product categories"}
                  {adminPage === "products" && "Manage your products"}
                  {adminPage === "featured-products" && "Manage homepage featured products"}
                  {adminPage === "orders" && "View and manage orders"}
                  {adminPage === "users" && "Manage registered users"}
                  {adminPage === "analytics" && "View sales and performance"}
                  {adminPage === "pricing" && "Manage pricing plans shown on the Pricing page"}
                  {adminPage === "coupons" && "Discount codes and promotions"}
                  {adminPage === "banners" && "Homepage banners"}
                  {adminPage === "brands" && "Manage brand logos for header and trusted sections"}
                  {adminPage === "fraud" && "Fraud reports"}
                  {adminPage === "special" && "Special Crack Submissions"}
                  {adminPage === "faqs" && "Chat FAQ management"}
                  {adminPage === "footer-links" && "Footer navigation links"}
                  {adminPage === "subscription" && ""}
                  {adminPage === "testimonials" && "Customer testimonials"}
                  {adminPage === "settings" && "Site settings"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {adminPage === "subscription" ? (
                  <>
                    <button
                      type="button"
                      onClick={handleDownloadSubscriptionsCsv}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm hover:bg-slate-50"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download CSV
                    </button>
                    <button
                      type="button"
                      onClick={handleClearSubscriptions}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm hover:bg-red-100"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Clear
                    </button>
                  </>
                ) : (
                  <>
                    <div className="text-sm text-slate-600">{me?.email}</div>
                    <button
                      onClick={() => {
                        window.localStorage.removeItem("token");
                        setMe(null);
                        setPage("home");
                      }}
                      className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm hover:bg-slate-50"
                    >
                      Logout
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Content based on selected page */}
            {adminPage === "dashboard" && <AdminDashboard />}
            {adminPage === "categories" && (
              <div>
                <CategoryManagement />
              </div>
            )}
            {adminPage === "products" && (
              <div>
                <ProductManagement />
              </div>
            )}
            {adminPage === "pricing" && (
              <div>
                <PricingManagement />
              </div>
            )}
            {adminPage === "featured-products" && (
              <div>
                <FeaturedProductsManagement />
              </div>
            )}
            {adminPage === "orders" && (
              <div>
                <OrdersManagement />
              </div>
            )}
            {adminPage === "chat" && (
              <div>
                <ChatManagement />
              </div>
            )}
            {adminPage === "knowledge" && (
              <div>
                <KnowledgeManagement />
              </div>
            )}
            {adminPage === "analytics" && (
              <div>
                <AnalyticsManagement />
              </div>
            )}
            {adminPage === "coupons" && (
              <div>
                <CouponManagement />
              </div>
            )}
            {adminPage === "banners" && (
              <div>
                <BannersManagement />
              </div>
            )}
            {adminPage === "brands" && (
              <div>
                <BrandManagement />
              </div>
            )}
            {adminPage === "users" && (
              <div>
                <UsersManagement />
              </div>
            )}
            {adminPage === "fraud" && (
              <div>
                <FraudManagement />
              </div>
            )}
            {adminPage === "special" && (
              <div>
                <SpecialCrackManagement />
              </div>
            )}
            {adminPage === "faqs" && (
              <div>
                <FAQsManagement />
              </div>
            )}
            {adminPage === "footer-links" && (
              <div>
                <FooterLinksManagement />
              </div>
            )}
            {adminPage === "subscription" && (
              <div key={subscriptionRefreshKey}>
                <SubscriptionManagement />
              </div>
            )}
            {adminPage === "testimonials" && (
              <div>
                <TestimonialManagement />
              </div>
            )}
            {adminPage === "settings" && (
              <div>
                <SiteSettingsManagement />
                <NavManagement />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };
  const FeaturedProductsManagement = () => {
    const [items, setItems] = useState<any[]>([]);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [ok, setOk] = useState<string | null>(null);

    const [newProductId, setNewProductId] = useState<number>(Number(products[0]?.id || 1));
    const [newSortOrder, setNewSortOrder] = useState<number>(0);
    const [newActive, setNewActive] = useState<boolean>(true);

    const refreshAll = async () => {
      setErr(null);
      try {
        const json = await gatewayFetch("/admin/featured-products", { method: "GET" });
        setItems(Array.isArray(json?.items) ? json.items : []);
      } catch (e: any) {
        setItems([]);
        setErr(e?.message || "Failed to load featured products");
      }
    };

    useEffect(() => {
      refreshAll();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const createItem = async () => {
      if (!Number.isFinite(Number(newProductId))) return;
      setBusy(true);
      setErr(null);
      setOk(null);
      try {
        await gatewayFetch("/admin/featured-products", {
          method: "POST",
          body: JSON.stringify({
            productId: Number(newProductId),
            sortOrder: Number(newSortOrder || 0),
            active: Boolean(newActive),
          }),
        });
        setOk("Created");
        await refreshAll();
        refreshHomeFeatured();
      } catch (e: any) {
        setErr(e?.message || "Failed to create");
      } finally {
        setBusy(false);
      }
    };

    const updateItem = async (id: number, patch: { sortOrder?: number; active?: boolean }) => {
      if (!Number.isFinite(Number(id))) return;
      setBusy(true);
      setErr(null);
      setOk(null);
      try {
        await gatewayFetch(`/admin/featured-products/${id}`, {
          method: "PUT",
          body: JSON.stringify(patch),
        });
        setOk("Saved");
        await refreshAll();
        refreshHomeFeatured();
      } catch (e: any) {
        setErr(e?.message || "Failed to save");
      } finally {
        setBusy(false);
      }
    };

    const deleteItem = async (id: number) => {
      if (!Number.isFinite(Number(id))) return;
      if (!confirm("Delete featured product?")) return;
      setBusy(true);
      setErr(null);
      setOk(null);
      try {
        await gatewayFetch(`/admin/featured-products/${id}`, { method: "DELETE" });
        setOk("Deleted");
        await refreshAll();
        refreshHomeFeatured();
      } catch (e: any) {
        setErr(e?.message || "Failed to delete");
      } finally {
        setBusy(false);
      }
    };

    return (
      <div className="space-y-6">
        <Card className="p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-lg font-semibold text-slate-900">Homepage Featured Products</div>
              <div className="text-sm text-slate-600 mt-1">Shown on Home (active items only). Sorted by sortOrder.</div>
            </div>
            <button
              type="button"
              onClick={refreshAll}
              className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>

          {err ? <div className="mt-4 text-sm text-red-600">{err}</div> : null}
          {ok ? <div className="mt-4 text-sm text-emerald-700">{ok}</div> : null}

          <div className="mt-6 grid md:grid-cols-4 gap-3 items-end">
            <div>
              <div className="text-xs text-slate-500">Product</div>
              <select
                className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                value={newProductId}
                onChange={(e) => setNewProductId(Number(e.target.value))}
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="text-xs text-slate-500">Sort order</div>
              <input
                className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                type="number"
                value={newSortOrder}
                onChange={(e) => setNewSortOrder(Number(e.target.value))}
              />
            </div>

            <div className="flex items-center gap-2 mt-6">
              <input
                id="new-featured-active"
                type="checkbox"
                checked={newActive}
                onChange={(e) => setNewActive(e.target.checked)}
              />
              <label htmlFor="new-featured-active" className="text-sm text-slate-700">
                Active
              </label>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={createItem}
              className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm hover:bg-emerald-700 disabled:opacity-60"
            >
              Add
            </button>
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
            <div className="text-sm font-medium text-slate-900">Items</div>
            <div className="text-xs text-slate-500">{items.length} total</div>
          </div>

          <div className="divide-y divide-slate-200 bg-white">
            {items.map((it: any) => {
              const id = Number(it?.id);
              const title = String(it?.product?.title || `Product #${it?.productId || ""}`);
              const sortOrder = Number(it?.sortOrder || 0);
              const active = Boolean(it?.active);

              return (
                <div key={id} className="p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">{title}</div>
                    <div className="text-xs text-slate-500 mt-1">ID: {id} | productId: {it?.productId}</div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div>
                      <div className="text-xs text-slate-500">Sort</div>
                      <input
                        className="mt-1 w-24 border border-slate-300 rounded-lg px-2 py-1 text-sm"
                        type="number"
                        value={sortOrder}
                        onChange={(e) => {
                          const next = Number(e.target.value);
                          setItems((prev) =>
                            prev.map((x) => (x?.id === id ? { ...x, sortOrder: next } : x))
                          );
                        }}
                      />
                    </div>

                    <div className="flex items-center gap-2 mt-5">
                      <input
                        id={`featured-active-${id}`}
                        type="checkbox"
                        checked={active}
                        onChange={(e) => {
                          const next = e.target.checked;
                          setItems((prev) =>
                            prev.map((x) => (x?.id === id ? { ...x, active: next } : x))
                          );
                        }}
                      />
                      <label htmlFor={`featured-active-${id}`} className="text-sm text-slate-700">
                        Active
                      </label>
                    </div>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => updateItem(id, { sortOrder: Number((items.find((x: any) => x?.id === id) as any)?.sortOrder || 0), active: Boolean((items.find((x: any) => x?.id === id) as any)?.active) })}
                      className="mt-5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm hover:bg-slate-50 disabled:opacity-60"
                    >
                      Save
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => deleteItem(id)}
                      className="mt-5 px-3 py-1.5 rounded-lg border border-red-200 bg-white text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}

            {items.length === 0 ? (
              <div className="p-6 text-sm text-slate-600">No featured products yet.</div>
            ) : null}
          </div>
        </Card>
      </div>
    );
  };
  
  const SubscriptionManagement = () => {
    const [items, setItems] = useState<{ id: number; email: string; createdAt: string }[]>([]);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const refresh = useCallback(async () => {
      setErr(null);
      setBusy(true);
      try {
        const json = await gatewayFetch("/admin/subscriptions", { method: "GET" });
        setItems(Array.isArray(json?.items) ? json.items : []);
      } catch (e: any) {
        setItems([]);
        setErr(e?.message || "Failed to load subscriptions");
      } finally {
        setBusy(false);
      }
    }, []);

    useEffect(() => {
      refresh();
    }, [refresh]);

    const handleDelete = async (id: number, email: string) => {
      if (!window.confirm(`Delete subscription for ${email}?`)) return;
      setDeletingId(id);
      setErr(null);
      try {
        await gatewayFetch(`/admin/subscriptions/${id}`, { method: "DELETE" });
        await refresh();
      } catch (e: any) {
        setErr(e?.message || "Failed to delete subscription");
      } finally {
        setDeletingId(null);
      }
    };

    const filtered = useMemo(() => {
      const q = search.trim().toLowerCase();
      if (!q) return items;
      return items.filter((s) => (s.email || "").toLowerCase().includes(q));
    }, [items, search]);

    return (
      <div className="space-y-6">
        <Card className="p-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-lg font-semibold text-slate-900">Newsletter subscriptions</div>
            </div>
            <div className="flex gap-2 items-center">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by email..."
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 w-64 text-sm"
              />
              <button onClick={refresh} disabled={busy} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60">
                {busy ? "Loading..." : "Refresh"}
              </button>
            </div>
          </div>
          {err ? <div className="mt-3 text-sm text-red-600">{err}</div> : null}
          <div className="mt-4 overflow-x-auto">
            {filtered.length === 0 ? (
              <div className="text-sm text-slate-500 py-6">{busy ? "Loading..." : "No subscriptions yet."}</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-600">
                    <th className="pb-2 pr-4">No</th>
                    <th className="pb-2 pr-4">Email</th>
                    <th className="pb-2 pr-4">Subscribed at</th>
                    <th className="pb-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s, i) => (
                    <tr key={s.id} className="border-b border-slate-100">
                      <td className="py-3 pr-4 text-slate-500">{i + 1}</td>
                      <td className="py-3 pr-4 font-medium text-slate-900">{s.email}</td>
                      <td className="py-3 pr-4 text-slate-600">{s.createdAt ? new Date(s.createdAt).toLocaleString() : "-"}</td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(s.id, s.email)}
                          disabled={deletingId === s.id}
                          className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
                        >
                          {deletingId === s.id ? "..." : "delete"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>
    );
  };

  const BannersManagement = () => {
    const [items, setItems] = useState<any[]>([]);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [ok, setOk] = useState<string | null>(null);

    const [newB, setNewB] = useState<any>({ title: "", subtitle: "", cta: "", targetPage: "home", targetUrl: "", sortOrder: 0, active: true });

    const [editingId, setEditingId] = useState<number | null>(null);
    const [editB, setEditB] = useState<any>({ title: "", subtitle: "", cta: "", targetPage: "", targetUrl: "", sortOrder: 0, active: true });

    const refreshAll = async () => {
      setErr(null);
      try {
        const json = await gatewayFetch("/admin/banners", { method: "GET" });
        setItems(Array.isArray(json?.items) ? json.items : []);
      } catch (e: any) {
        setItems([]);
        setErr(e?.message || "Failed to load banners");
      }
    };

    useEffect(() => {
      refreshAll();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const createBanner = async () => {
      if (!newB.title.trim()) return;
      setBusy(true);
      setErr(null);
      setOk(null);
      try {
        await gatewayFetch("/admin/banners", {
          method: "POST",
          body: JSON.stringify({
            title: newB.title,
            subtitle: newB.subtitle,
            cta: newB.cta,
            targetPage: newB.targetPage,
            targetUrl: newB.targetUrl,
            sortOrder: Number(newB.sortOrder || 0),
            active: Boolean(newB.active),
          }),
        });
        setOk("Banner added!");
        setNewB({ title: "", subtitle: "", cta: "", targetPage: "home", targetUrl: "", sortOrder: items.length, active: true });
        await refreshAll();
        await refreshBanners();
      } catch (e: any) {
        setErr(e?.message || "Failed");
      } finally {
        setBusy(false);
      }
    };

    const updateBanner = async () => {
      if (!editingId) return;
      if (!editB.title.trim()) return;
      setBusy(true);
      setErr(null);
      setOk(null);
      try {
        await gatewayFetch(`/admin/banners/${editingId}`, {
          method: "PUT",
          body: JSON.stringify({
            title: editB.title,
            subtitle: editB.subtitle,
            cta: editB.cta,
            targetPage: editB.targetPage,
            targetUrl: editB.targetUrl,
            sortOrder: Number(editB.sortOrder || 0),
            active: Boolean(editB.active),
          }),
        });
        setOk("Saved!");
        setEditingId(null);
        await refreshAll();
        await refreshBanners();
      } catch (e: any) {
        setErr(e?.message || "Failed");
      } finally {
        setBusy(false);
      }
    };

    const deleteBanner = async (id: number) => {
      if (!confirm("Delete this banner?")) return;
      setBusy(true);
      setErr(null);
      setOk(null);
      try {
        await gatewayFetch(`/admin/banners/${id}`, { method: "DELETE" });
        setOk("Deleted!");
        await refreshAll();
        await refreshBanners();
      } catch (e: any) {
        setErr(e?.message || "Failed");
      } finally {
        setBusy(false);
      }
    };

    const startEdit = (b: any) => {
      setEditingId(Number(b.id));
      setEditB({
        title: String(b.title || ""),
        subtitle: String(b.subtitle || ""),
        cta: String(b.cta || ""),
        targetPage: String(b.targetPage || ""),
        targetUrl: String(b.targetUrl || ""),
        sortOrder: Number(b.sortOrder || 0),
        active: Boolean(b.active),
      });
    };

    const moveBanner = async (id: number, dir: -1 | 1) => {
      const sorted = [...items].sort((a, b) => (Number(a.sortOrder || 0) - Number(b.sortOrder || 0)) || (Number(a.id || 0) - Number(b.id || 0)));
      const idx = sorted.findIndex((x) => Number(x.id) === id);
      if (idx < 0) return;
      const otherIdx = idx + dir;
      if (otherIdx < 0 || otherIdx >= sorted.length) return;
      const a = sorted[idx];
      const b = sorted[otherIdx];

      setBusy(true);
      setErr(null);
      setOk(null);
      try {
        await gatewayFetch(`/admin/banners/${a.id}`, { method: "PUT", body: JSON.stringify({ sortOrder: Number(b.sortOrder || 0) }) });
        await gatewayFetch(`/admin/banners/${b.id}`, { method: "PUT", body: JSON.stringify({ sortOrder: Number(a.sortOrder || 0) }) });
        await refreshAll();
        await refreshBanners();
      } catch (e: any) {
        setErr(e?.message || "Failed to reorder");
      } finally {
        setBusy(false);
      }
    };

    const sortedItems = [...items].sort((a, b) => (Number(a.sortOrder || 0) - Number(b.sortOrder || 0)) || (Number(a.id || 0) - Number(b.id || 0)));

    return (
      <div className="space-y-6">
        {err && (
          <Card className="p-4 bg-red-50 border border-red-200">
            <div className="text-sm text-red-700">{err}</div>
          </Card>
        )}
        {ok && (
          <Card className="p-4 bg-emerald-50 border border-emerald-200">
            <div className="text-sm text-emerald-800">{ok}</div>
          </Card>
        )}

        <Card className="p-6">
          <div className="text-lg font-semibold text-slate-900 mb-4">Create New Banner</div>
          <div className="grid md:grid-cols-2 gap-4">
            <input value={newB.title} onChange={(e) => setNewB((s: any) => ({ ...s, title: e.target.value }))} placeholder="Title" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
            <input value={newB.subtitle} onChange={(e) => setNewB((s: any) => ({ ...s, subtitle: e.target.value }))} placeholder="Subtitle" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
            <input value={newB.cta} onChange={(e) => setNewB((s: any) => ({ ...s, cta: e.target.value }))} placeholder="CTA text (button)" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
            <input value={newB.targetUrl} onChange={(e) => setNewB((s: any) => ({ ...s, targetUrl: e.target.value }))} placeholder="Target URL (optional)" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
            <input value={newB.targetPage} onChange={(e) => setNewB((s: any) => ({ ...s, targetPage: e.target.value }))} placeholder='Target page (optional, e.g. "shop")' className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
            <input
              type="number"
              value={Number(newB.sortOrder || 0)}
              onChange={(e) => setNewB((s: any) => ({ ...s, sortOrder: parseInt(e.target.value) || 0 }))}
              placeholder="Sort order"
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
            />
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={Boolean(newB.active)} onChange={(e) => setNewB((s: any) => ({ ...s, active: e.target.checked }))} />
              Active
            </label>
            <button
              type="button"
              onClick={createBanner}
              disabled={busy || !String(newB.title || "").trim()}
              className="rounded-xl bg-emerald-600 text-white px-5 py-3 text-sm hover:bg-emerald-700 disabled:opacity-60"
            >
              {busy ? "Saving..." : "Create"}
            </button>
          </div>
        </Card>

        {editingId ? (
          <Card className="p-6">
            <div className="text-lg font-semibold text-slate-900 mb-4">Edit Banner #{editingId}</div>
            <div className="grid md:grid-cols-2 gap-4">
              <input value={editB.title} onChange={(e) => setEditB((s: any) => ({ ...s, title: e.target.value }))} placeholder="Title" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
              <input value={editB.subtitle} onChange={(e) => setEditB((s: any) => ({ ...s, subtitle: e.target.value }))} placeholder="Subtitle" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
              <input value={editB.cta} onChange={(e) => setEditB((s: any) => ({ ...s, cta: e.target.value }))} placeholder="CTA text (button)" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
              <input value={editB.targetUrl} onChange={(e) => setEditB((s: any) => ({ ...s, targetUrl: e.target.value }))} placeholder="Target URL (optional)" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
              <input value={editB.targetPage} onChange={(e) => setEditB((s: any) => ({ ...s, targetPage: e.target.value }))} placeholder='Target page (optional, e.g. "shop")' className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
              <input
                type="number"
                value={Number(editB.sortOrder || 0)}
                onChange={(e) => setEditB((s: any) => ({ ...s, sortOrder: parseInt(e.target.value) || 0 }))}
                placeholder="Sort order"
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
              />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={Boolean(editB.active)} onChange={(e) => setEditB((s: any) => ({ ...s, active: e.target.checked }))} />
                Active
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={updateBanner}
                  disabled={busy || !String(editB.title || "").trim()}
                  className="rounded-xl bg-emerald-600 text-white px-5 py-3 text-sm hover:bg-emerald-700 disabled:opacity-60"
                >
                  {busy ? "Saving..." : "Save"}
                </button>
                <button type="button" onClick={() => setEditingId(null)} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </div>
          </Card>
        ) : null}

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-lg font-semibold text-slate-900">Banners ({sortedItems.length})</div>
            <button type="button" onClick={refreshAll} disabled={busy} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50">
              {busy ? "Loading..." : "Refresh"}
            </button>
          </div>

          {sortedItems.length === 0 ? (
            <div className="text-sm text-slate-600">No banners yet.</div>
          ) : (
            <div className="space-y-3">
              {sortedItems.map((b: any, i: number) => (
                <div key={b.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">{b.title}</div>
                      <div className="text-sm text-slate-600 truncate">{b.subtitle}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        CTA: {b.cta || "-"} | sort: {b.sortOrder} | {b.active ? "Active" : "Inactive"}
                      </div>
                      {b.targetUrl ? <div className="mt-1 text-xs text-slate-500 truncate">URL: {b.targetUrl}</div> : null}
                      {b.targetPage ? <div className="mt-1 text-xs text-slate-500 truncate">Page: {b.targetPage}</div> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => moveBanner(Number(b.id), -1)} disabled={busy || i === 0} className="px-3 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50">
                        Up
                      </button>
                      <button type="button" onClick={() => moveBanner(Number(b.id), 1)} disabled={busy || i === sortedItems.length - 1} className="px-3 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50">
                        Down
                      </button>
                      <button type="button" onClick={() => startEdit(b)} disabled={busy} className="px-3 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50">
                        Edit
                      </button>
                      <button type="button" onClick={() => deleteBanner(Number(b.id))} disabled={busy} className="px-3 py-1 text-xs border border-red-300 text-red-600 rounded hover:bg-red-50 disabled:opacity-50">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    );
  };

  const TestimonialManagement = () => {
    const [allTestimonials, setAllTestimonials] = useState<TestimonialT[]>([]);
    const [testimonialBusy, setTestimonialBusy] = useState(false);
    const [testimonialErr, setTestimonialErr] = useState<string | null>(null);
    const [testimonialOk, setTestimonialOk] = useState<string | null>(null);
    
    const [newT, setNewT] = useState({ name: "", role: "", company: "", rating: "", date: "", text: "" });
    const [newPhoto, setNewPhoto] = useState<File | null>(null);
    const [newLogo, setNewLogo] = useState<File | null>(null);
    
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState({ name: "", role: "", company: "", rating: "", date: "", text: "" });
    const [editPhoto, setEditPhoto] = useState<File | null>(null);
    const [editLogo, setEditLogo] = useState<File | null>(null);

    const parseMetaText = (raw: string) => {
      const trimmed = (raw || "").trim();
      const [firstLineRaw, ...rest] = trimmed.split("\n");
      const firstLine = (firstLineRaw || "").trim();
      const looksLikeMeta = /^⭐{3,5}/.test(firstLine) && firstLine.includes("·");
      if (!looksLikeMeta) {
        return { rating: "", date: "", text: trimmed };
      }
      const [ratingPart, datePart] = firstLine.split("·").map((s) => s.trim());
      const body = (rest.length ? rest.join("\n") : "").trim();
      return { rating: ratingPart || "", date: datePart || "", text: body };
    };

    const buildMetaText = (rating: string, date: string, text: string) => {
      const r = (rating || "").trim();
      const d = (date || "").trim();
      const body = (text || "").trim();
      const meta = r && d ? `${r} · ${d}` : r ? r : d ? d : "";
      return meta ? `${meta}\n${body}`.trim() : body;
    };

    const refreshAll = async () => {
      setTestimonialErr(null);
      try {
        const json = await gatewayFetch("/admin/testimonials", { method: "GET" });
        setAllTestimonials(json?.items || []);
      } catch (e: any) {
        setAllTestimonials([]);
        setTestimonialErr(e?.message || "Failed to load testimonials");
      }
    };

    useEffect(() => {
      refreshAll();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const createTestimonial = async () => {
      if (!newT.name.trim() || !newT.text.trim()) return;
      setTestimonialBusy(true);
      setTestimonialErr(null);
      setTestimonialOk(null);
      try {
        const form = new FormData();
        form.append("name", newT.name.trim());
        form.append("role", newT.role.trim());
        form.append("company", newT.company.trim());
        form.append("text", buildMetaText(newT.rating, newT.date, newT.text));
        form.append("sortOrder", String(allTestimonials.length));
        if (newPhoto) form.append("photo", newPhoto);
        if (newLogo) form.append("companyLogo", newLogo);

        await gatewayFetch("/admin/testimonials", { method: "POST", body: form });
        setTestimonialOk("Testimonial added!");
        setNewT({ name: "", role: "", company: "", rating: "", date: "", text: "" });
        setNewPhoto(null);
        setNewLogo(null);
        await refreshAll();
        await refreshTestimonials();
      } catch (e: any) {
        setTestimonialErr(e?.message || "Failed");
      } finally {
        setTestimonialBusy(false);
      }
    };

    const updateTestimonial = async () => {
      if (!editingId) return;
      setTestimonialBusy(true);
      setTestimonialErr(null);
      setTestimonialOk(null);
      try {
        const form = new FormData();
        form.append("name", editForm.name.trim());
        form.append("role", editForm.role.trim());
        form.append("company", editForm.company.trim());
        form.append("text", buildMetaText(editForm.rating, editForm.date, editForm.text));
        if (editPhoto) form.append("photo", editPhoto);
        if (editLogo) form.append("companyLogo", editLogo);

        await gatewayFetch(`/admin/testimonials/${editingId}`, { method: "PUT", body: form });
        setTestimonialOk("Saved!");
        setEditingId(null);
        setEditPhoto(null);
        setEditLogo(null);
        await refreshAll();
        await refreshTestimonials();
      } catch (e: any) {
        setTestimonialErr(e?.message || "Failed");
      } finally {
        setTestimonialBusy(false);
      }
    };

    const deleteTestimonial = async (id: number) => {
      if (!confirm("Delete this testimonial?")) return;
      setTestimonialBusy(true);
      setTestimonialErr(null);
      setTestimonialOk(null);
      try {
        await gatewayFetch(`/admin/testimonials/${id}`, { method: "DELETE" });
        setTestimonialOk("Deleted!");
        await refreshAll();
        await refreshTestimonials();
      } catch (e: any) {
        setTestimonialErr(e?.message || "Failed");
      } finally {
        setTestimonialBusy(false);
      }
    };

    const startEdit = (t: TestimonialT) => {
      const parsed = parseMetaText(t.text);
      setEditingId(t.id!);
      setEditForm({ name: t.name, role: t.role, company: t.company, rating: parsed.rating, date: parsed.date, text: parsed.text });
      setEditPhoto(null);
      setEditLogo(null);
    };

    return (
      <div className="mt-6">
        <Card className="p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="text-lg font-semibold text-slate-900">💬 Testimonials</div>
              <span className="text-xs bg-cyan-100 text-cyan-700 px-2 py-1 rounded-full">What clients say</span>
            </div>
            <button
              onClick={refreshAll}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
              disabled={testimonialBusy}
            >
              Refresh
            </button>
          </div>
          <div className="text-sm text-slate-600 mt-1">Manage customer testimonials with photos and company logos.</div>

          {testimonialErr && <div className="mt-4 text-sm text-red-700">{testimonialErr}</div>}
          {testimonialOk && <div className="mt-4 text-sm text-emerald-700">{testimonialOk}</div>}

          {/* Create form */}
          <div className="mt-5 p-4 bg-slate-50 rounded-xl">
            <div className="text-sm font-medium text-slate-700 mb-3">Add New Testimonial</div>
            <div className="grid grid-cols-2 gap-3">
              <input value={newT.name} onChange={(e) => setNewT({ ...newT, name: e.target.value })} placeholder="Name *" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <input value={newT.role} onChange={(e) => setNewT({ ...newT, role: e.target.value })} placeholder="Role (e.g. CEO)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <input value={newT.company} onChange={(e) => setNewT({ ...newT, company: e.target.value })} placeholder="Company" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <input value={newT.rating} onChange={(e) => setNewT({ ...newT, rating: e.target.value })} placeholder="Rating (e.g. ⭐⭐⭐⭐⭐)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <input value={newT.date} onChange={(e) => setNewT({ ...newT, date: e.target.value })} placeholder="Date (e.g. March 18, 2025)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-slate-500">Photo</label>
                  <input type="file" accept="image/*" onChange={(e) => setNewPhoto(e.target.files?.[0] || null)} className="w-full text-xs" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-slate-500">Company Logo</label>
                  <input type="file" accept="image/*" onChange={(e) => setNewLogo(e.target.files?.[0] || null)} className="w-full text-xs" />
                </div>
              </div>
            </div>
            <textarea value={newT.text} onChange={(e) => setNewT({ ...newT, text: e.target.value })} placeholder="Testimonial text *" className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[80px]" />
            <button onClick={createTestimonial} disabled={testimonialBusy || !newT.name.trim() || !newT.text.trim()} className="mt-3 rounded-xl bg-emerald-600 text-white px-6 py-2 text-sm hover:bg-emerald-700 disabled:opacity-60">
              Add Testimonial
            </button>
          </div>

          {/* Existing testimonials */}
          <div className="mt-6 space-y-4">
            <div className="text-sm font-medium text-slate-700">Existing Testimonials</div>
            {allTestimonials.length === 0 ? (
              <div className="text-sm text-slate-500">{testimonialErr ? "Failed to load. Check error above." : "No testimonials yet."}</div>
            ) : (
              allTestimonials.map((t) => (
                <div key={t.id} className="rounded-xl border border-cyan-200 bg-cyan-50 p-4">
                  {editingId === t.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="Name" className="rounded-lg border px-3 py-2 text-sm" />
                        <input value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} placeholder="Role" className="rounded-lg border px-3 py-2 text-sm" />
                        <input value={editForm.company} onChange={(e) => setEditForm({ ...editForm, company: e.target.value })} placeholder="Company" className="rounded-lg border px-3 py-2 text-sm" />
                        <input value={editForm.rating} onChange={(e) => setEditForm({ ...editForm, rating: e.target.value })} placeholder="Rating (e.g. ⭐⭐⭐⭐⭐)" className="rounded-lg border px-3 py-2 text-sm" />
                        <input value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} placeholder="Date (e.g. March 18, 2025)" className="rounded-lg border px-3 py-2 text-sm" />
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="text-xs text-slate-500">New Photo</label>
                            <input type="file" accept="image/*" onChange={(e) => setEditPhoto(e.target.files?.[0] || null)} className="w-full text-xs" />
                          </div>
                          <div className="flex-1">
                            <label className="text-xs text-slate-500">New Logo</label>
                            <input type="file" accept="image/*" onChange={(e) => setEditLogo(e.target.files?.[0] || null)} className="w-full text-xs" />
                          </div>
                        </div>
                      </div>
                      <textarea value={editForm.text} onChange={(e) => setEditForm({ ...editForm, text: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm min-h-[80px]" />
                      <div className="flex gap-2">
                        <button onClick={updateTestimonial} className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm">Save</button>
                        <button onClick={() => setEditingId(null)} className="rounded-lg bg-slate-200 text-slate-700 px-4 py-2 text-sm">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        {t.photo ? (
                          <img src={t.photo} alt={t.name} className="h-12 w-12 rounded-full object-cover" />
                        ) : (
                          <div className="h-12 w-12 rounded-full bg-cyan-200 text-cyan-700 flex items-center justify-center font-semibold">
                            {t.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">{t.name}</span>
                          {t.companyLogo && <img src={t.companyLogo} alt="" className="h-4 w-auto opacity-60" />}
                        </div>
                        <div className="text-sm text-slate-600">{t.role}{t.company ? ` · ${t.company}` : ""}</div>
                        {(() => {
                          const p = parseMetaText(t.text);
                          return (
                            <>
                              {p.rating || p.date ? (
                                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                                  {p.rating ? <div className="text-amber-600">{p.rating}</div> : null}
                                  {p.date ? <div>{p.date}</div> : null}
                                </div>
                              ) : null}
                              <div className="text-sm text-slate-700 mt-2 line-clamp-2">"{p.text || t.text}"</div>
                            </>
                          );
                        })()}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(t)} className="text-blue-600 text-sm">Edit</button>
                        <button onClick={() => deleteTestimonial(t.id!)} className="text-red-600 text-sm">Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    );
  }

  const CouponManagement = () => {
    const [allCoupons, setAllCoupons] = useState<CouponT[]>([]);
    const [couponBusy, setCouponBusy] = useState(false);
    const [couponErr, setCouponErr] = useState<string | null>(null);
    const [couponOk, setCouponOk] = useState<string | null>(null);

    const [couponProducts, setCouponProducts] = useState<{ id: number; title: string }[]>([]);
    
    const [newCoupon, setNewCoupon] = useState({
      code: "",
      description: "",
      discountType: "PERCENTAGE" as "PERCENTAGE" | "FIXED",
      discountValue: "",
      minPurchase: "",
      appliesToAll: true,
      applicableProductIds: [] as number[],
      maxUses: "",
      validUntil: "",
    });

    const refreshCoupons = async () => {
      try {
        const json = await gatewayFetch("/admin/coupons", { method: "GET" });
        setAllCoupons(json?.items || []);
      } catch (e: any) {
        setCouponErr(e?.message || "Failed to load coupons");
        setAllCoupons([]);
      }
    };

    useEffect(() => {
      refreshCoupons();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      (async () => {
        try {
          const json = await gatewayFetch("/admin/products", { method: "GET" });
          const items = (json?.items || []) as ProductT[];
          setCouponProducts(items.map((p) => ({ id: p.id, title: p.title })));
        } catch {
          setCouponProducts([]);
        }
      })();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const createCoupon = async () => {
      if (!newCoupon.code.trim() || !newCoupon.discountValue) return;
      setCouponBusy(true);
      setCouponErr(null);
      setCouponOk(null);
      try {
        await gatewayFetch("/admin/coupons", {
          method: "POST",
          body: JSON.stringify({
            code: newCoupon.code.trim(),
            description: newCoupon.description,
            discountType: newCoupon.discountType,
            discountValue: Number(newCoupon.discountValue),
            minPurchase: Number(newCoupon.minPurchase) || 0,
            appliesToAll: !!newCoupon.appliesToAll,
            applicableProductIds: newCoupon.appliesToAll ? [] : newCoupon.applicableProductIds,
            maxUses: Number(newCoupon.maxUses) || 0,
            validUntil: newCoupon.validUntil || null,
          }),
        });
        setCouponOk("Coupon created!");
        setNewCoupon({ code: "", description: "", discountType: "PERCENTAGE", discountValue: "", minPurchase: "", appliesToAll: true, applicableProductIds: [], maxUses: "", validUntil: "" });
        await refreshCoupons();
      } catch (e: any) {
        setCouponErr(e?.message || "Failed");
      } finally {
        setCouponBusy(false);
      }
    };

    const toggleActive = async (id: number, active: boolean) => {
      try {
        await gatewayFetch(`/admin/coupons/${id}`, {
          method: "PUT",
          body: JSON.stringify({ active: !active }),
        });
        await refreshCoupons();
      } catch (e: any) {
        alert(e?.message || "Failed");
      }
    };

    const deleteCoupon = async (id: number) => {
      if (!confirm("Delete this coupon?")) return;
      try {
        await gatewayFetch(`/admin/coupons/${id}`, { method: "DELETE" });
        await refreshCoupons();
      } catch (e: any) {
        alert(e?.message || "Failed");
      }
    };

    return (
      <div className="mt-6">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="text-lg font-semibold text-slate-900">🎟️ Coupons</div>
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">Discounts</span>
          </div>
          <div className="text-sm text-slate-600 mt-1">Create and manage discount coupons.</div>

          {couponErr && <div className="mt-4 text-sm text-red-700">{couponErr}</div>}
          {couponOk && <div className="mt-4 text-sm text-emerald-700">{couponOk}</div>}

          {/* Create coupon form */}
          <div className="mt-5 p-4 bg-slate-50 rounded-xl">
            <div className="text-sm font-medium text-slate-700 mb-3">Create New Coupon</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <input
                value={newCoupon.code}
                onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
                placeholder="Code (e.g. SAVE20)"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono uppercase"
              />
              <select
                value={newCoupon.discountType}
                onChange={(e) => setNewCoupon({ ...newCoupon, discountType: e.target.value as "PERCENTAGE" | "FIXED" })}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED">Fixed ($)</option>
              </select>
              <input
                value={newCoupon.discountValue}
                onChange={(e) => setNewCoupon({ ...newCoupon, discountValue: e.target.value })}
                placeholder="Discount value"
                type="number"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                value={newCoupon.minPurchase}
                onChange={(e) => setNewCoupon({ ...newCoupon, minPurchase: e.target.value })}
                placeholder="Min purchase ($)"
                type="number"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />

              <label className="flex items-center gap-2 text-sm text-slate-700 col-span-2 md:col-span-4">
                <input
                  type="checkbox"
                  checked={!!newCoupon.appliesToAll}
                  onChange={(e) =>
                    setNewCoupon({
                      ...newCoupon,
                      appliesToAll: e.target.checked,
                      applicableProductIds: e.target.checked ? [] : newCoupon.applicableProductIds,
                    })
                  }
                />
                Use on all products
              </label>

              {!newCoupon.appliesToAll ? (
                <div className="col-span-2 md:col-span-4 rounded-xl border-2 border-orange-200 bg-orange-50 p-4">
                  <div className="text-sm font-medium text-slate-700 mb-2">📦 Select Products</div>
                  <div className="text-xs text-slate-600 mb-3">Choose which products this coupon applies to:</div>
                  <div className="max-h-60 overflow-auto border border-slate-200 bg-white rounded-lg p-3">
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {couponProducts.map((p) => {
                        const checked = newCoupon.applicableProductIds.includes(p.id);
                        return (
                          <label key={p.id} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-50 p-2 rounded">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? Array.from(new Set([...newCoupon.applicableProductIds, p.id]))
                                  : newCoupon.applicableProductIds.filter((x) => x !== p.id);
                                setNewCoupon({ ...newCoupon, applicableProductIds: next });
                              }}
                              className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                            />
                            <span className="truncate" title={p.title}>
                              {p.title}
                            </span>
                          </label>
                        );
                      })}
                      {couponProducts.length === 0 ? (
                        <div className="text-xs text-slate-500 col-span-full">No products available. Please add products first.</div>
                      ) : null}
                    </div>
                    {newCoupon.applicableProductIds.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-emerald-600 font-medium">
                        ✓ {newCoupon.applicableProductIds.length} product{newCoupon.applicableProductIds.length !== 1 ? 's' : ''} selected
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
              <input
                value={newCoupon.description}
                onChange={(e) => setNewCoupon({ ...newCoupon, description: e.target.value })}
                placeholder="Description"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm col-span-2"
              />
              <input
                value={newCoupon.maxUses}
                onChange={(e) => setNewCoupon({ ...newCoupon, maxUses: e.target.value })}
                placeholder="Max uses (0=unlimited)"
                type="number"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                value={newCoupon.validUntil}
                onChange={(e) => setNewCoupon({ ...newCoupon, validUntil: e.target.value })}
                placeholder="Expires"
                type="date"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={createCoupon}
              disabled={couponBusy || !newCoupon.code.trim() || !newCoupon.discountValue}
              className="mt-3 rounded-xl bg-orange-600 text-white px-6 py-2 text-sm hover:bg-orange-700 disabled:opacity-60"
            >
              Create Coupon
            </button>
          </div>

          {/* Existing coupons */}
          <div className="mt-6 space-y-3">
            <div className="text-sm font-medium text-slate-700">Existing Coupons</div>
            {allCoupons.length === 0 ? (
              <div className="text-sm text-slate-500">No coupons yet.</div>
            ) : (
              allCoupons.map((c) => (
                <div key={c.id} className={`rounded-xl border p-4 ${c.active ? "border-orange-200 bg-orange-50" : "border-slate-200 bg-slate-50 opacity-60"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{c.code}</span>
                        <span className="text-xs bg-slate-200 px-2 py-0.5 rounded">
                          {c.discountType === "PERCENTAGE" ? `${c.discountValue}%` : `$${c.discountValue}`}
                        </span>
                        {!c.active && <span className="text-xs text-red-500">(Inactive)</span>}
                      </div>
                      <div className="text-sm text-slate-600 mt-1">{c.description || "No description"}</div>
                      <div className="mt-2 text-xs text-slate-500">
                        {c.appliesToAll === false
                          ? (() => {
                              const productIds = c.applicableProductIds || [];
                              if (productIds.length === 0) {
                                return "Applies to: (no products selected)";
                              }
                              const productNames = productIds
                                .map((id) => {
                                  const product = couponProducts.find((p) => p.id === id);
                                  return product ? product.title : `Product #${id}`;
                                })
                                .filter(Boolean);
                              return `Applies to: ${productNames.join(", ")}`;
                            })()
                          : "Applies to: All products"}
                      </div>
                      <div className="flex gap-3 mt-2 text-xs text-slate-500">
                        {c.minPurchase ? <span>Min: ${c.minPurchase}</span> : null}
                        {c.maxUses ? <span>Uses: {c.usedCount}/{c.maxUses}</span> : <span>Uses: {c.usedCount}/∞</span>}
                        {c.validUntil && <span>Expires: {new Date(c.validUntil).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => toggleActive(c.id!, c.active!)} className={`text-sm ${c.active ? "text-amber-600" : "text-emerald-600"}`}>
                        {c.active ? "Deactivate" : "Activate"}
                      </button>
                      <button onClick={() => deleteCoupon(c.id!)} className="text-red-600 text-sm">Delete</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    );
  }

  const CategoryManagement = () => {
    const [catBusy, setCatBusy] = useState(false);
    const [catErr, setCatErr] = useState<string | null>(null);
    const [catOk, setCatOk] = useState<string | null>(null);

    const [adminCats, setAdminCats] = useState<CategoryAdminT[]>([]);

    const [newCat, setNewCat] = useState<any>({
      name: "",
      seoTitle: "",
      seoDescription: "",
      seoSlug: "",
      seoOgImage: "",
      primaryKeyword: "",
      secondaryKeywordsText: "",
    });

    const [editingId, setEditingId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<any>({
      name: "",
      seoTitle: "",
      seoDescription: "",
      seoSlug: "",
      seoOgImage: "",
      primaryKeyword: "",
      secondaryKeywordsText: "",
    });

    const refreshAdminCats = async () => {
      if (!canView) return;
      try {
        const json = await gatewayFetch("/admin/categories", { method: "GET" });
        setAdminCats((json?.items || []) as CategoryAdminT[]);
      } catch (e: any) {
        setAdminCats([]);
        setCatErr(e?.message || "Failed to load categories");
      }
    };

    useEffect(() => {
      refreshAdminCats();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const createCategory = async () => {
      if (!String(newCat?.name || "").trim()) return;
      setCatBusy(true);
      setCatErr(null);
      setCatOk(null);
      try {
        const secondaryKeywords = String(newCat?.secondaryKeywordsText || "")
          .split(",")
          .map((k: string) => k.trim())
          .filter(Boolean);
        await gatewayFetch("/admin/categories", {
          method: "POST",
          body: JSON.stringify({
            name: String(newCat?.name || "").trim(),
            sortOrder: adminCats.length,
            seoTitle: String(newCat?.seoTitle || ""),
            seoDescription: String(newCat?.seoDescription || ""),
            seoSlug: String(newCat?.seoSlug || ""),
            seoOgImage: String(newCat?.seoOgImage || ""),
            primaryKeyword: String(newCat?.primaryKeyword || ""),
            secondaryKeywords,
          }),
        });
        setCatOk("Category added!");
        setNewCat({ name: "", seoTitle: "", seoDescription: "", seoSlug: "", seoOgImage: "", primaryKeyword: "", secondaryKeywordsText: "" });
        await refreshAdminCats();
        await refreshCategories();
      } catch (e: any) {
        setCatErr(e?.message || "Failed");
      } finally {
        setCatBusy(false);
      }
    };

    const updateCategory = async (id: number) => {
      if (!String(editForm?.name || "").trim()) return;
      try {
        const secondaryKeywords = String(editForm?.secondaryKeywordsText || "")
          .split(",")
          .map((k: string) => k.trim())
          .filter(Boolean);
        await gatewayFetch(`/admin/categories/${id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: String(editForm?.name || "").trim(),
            seoTitle: String(editForm?.seoTitle || ""),
            seoDescription: String(editForm?.seoDescription || ""),
            seoSlug: String(editForm?.seoSlug || ""),
            seoOgImage: String(editForm?.seoOgImage || ""),
            primaryKeyword: String(editForm?.primaryKeyword || ""),
            secondaryKeywords,
          }),
        });
        setEditingId(null);
        setEditForm({ name: "", seoTitle: "", seoDescription: "", seoSlug: "", seoOgImage: "", primaryKeyword: "", secondaryKeywordsText: "" });
        await refreshAdminCats();
        await refreshCategories();
      } catch (e: any) {
        alert(e?.message || "Failed to update");
      }
    };

    const deleteCategory = async (id: number) => {
      if (!confirm("Delete this category?")) return;
      try {
        await gatewayFetch(`/admin/categories/${id}`, { method: "DELETE" });
        await refreshAdminCats();
        await refreshCategories();
      } catch (e: any) {
        alert(e?.message || "Failed to delete");
      }
    };

    return (
      <div className="mt-6">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="text-lg font-semibold text-slate-900">📂 Categories</div>
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">Browse by category</span>
          </div>
          <div className="text-sm text-slate-600 mt-1">Manage product categories shown in the shop.</div>

          {catErr ? <div className="mt-4 text-sm text-red-700">{catErr}</div> : null}
          {catOk ? <div className="mt-4 text-sm text-emerald-700">{catOk}</div> : null}

          <div className="mt-5 flex gap-3">
            <input
              value={newCat.name}
              onChange={(e) => setNewCat((s: any) => ({ ...s, name: e.target.value }))}
              placeholder="New category name"
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
              onKeyDown={(e) => e.key === "Enter" && createCategory()}
            />
            <button
              disabled={catBusy || !String(newCat?.name || "").trim()}
              onClick={createCategory}
              className="rounded-xl bg-emerald-600 text-white px-6 py-3 text-sm hover:bg-emerald-700 disabled:opacity-60 whitespace-nowrap"
            >
              Add Category
            </button>
          </div>

          <SeoPanel
            entityType="CATEGORY"
            titleText={String(newCat?.name || "")}
            seoTitle={String(newCat?.seoTitle || "")}
            seoDescription={String(newCat?.seoDescription || "")}
            primaryKeyword={String(newCat?.primaryKeyword || "")}
            setPrimaryKeyword={(v) => setNewCat((s: any) => ({ ...s, primaryKeyword: v }))}
            secondaryKeywordsText={String(newCat?.secondaryKeywordsText || "")}
            setSecondaryKeywordsText={(v) => setNewCat((s: any) => ({ ...s, secondaryKeywordsText: v }))}
          />

          <div className="mt-6">
            <div className="text-sm font-medium text-slate-700 mb-3">Current Categories</div>
            <div className="flex flex-wrap gap-2">
              {adminCats.map((c) => (
                <div key={c.id} className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                  {editingId === c.id ? (
                    <>
                      <input
                        value={editForm.name}
                        onChange={(e) => setEditForm((s: any) => ({ ...s, name: e.target.value }))}
                        className="w-24 rounded border border-purple-300 px-2 py-1 text-sm"
                        onKeyDown={(e) => e.key === "Enter" && updateCategory(c.id)}
                        autoFocus
                      />
                      <SeoPanel
                        entityType="CATEGORY"
                        entityId={c.id}
                        titleText={String(editForm?.name || "")}
                        seoTitle={String(editForm?.seoTitle || "")}
                        seoDescription={String(editForm?.seoDescription || "")}
                        primaryKeyword={String(editForm?.primaryKeyword || "")}
                        setPrimaryKeyword={(v) => setEditForm((s: any) => ({ ...s, primaryKeyword: v }))}
                        secondaryKeywordsText={String(editForm?.secondaryKeywordsText || "")}
                        setSecondaryKeywordsText={(v) => setEditForm((s: any) => ({ ...s, secondaryKeywordsText: v }))}
                      />
                      <button onClick={() => updateCategory(c.id)} className="text-emerald-600 hover:text-emerald-700 text-xs">✓</button>
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setEditForm({ name: "", seoTitle: "", seoDescription: "", seoSlug: "", seoOgImage: "", primaryKeyword: "", secondaryKeywordsText: "" });
                        }}
                        className="text-slate-500 hover:text-slate-700 text-xs"
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-slate-700">{c.name}</span>
                      <button
                        onClick={() => {
                          setEditingId(c.id);
                          setEditForm({
                            name: c.name,
                            seoTitle: String((c as any).seoTitle || ""),
                            seoDescription: String((c as any).seoDescription || ""),
                            seoSlug: String((c as any).seoSlug || ""),
                            seoOgImage: String((c as any).seoOgImage || ""),
                            primaryKeyword: String((c as any).primaryKeyword || ""),
                            secondaryKeywordsText: Array.isArray((c as any).secondaryKeywords) ? (c as any).secondaryKeywords.join(", ") : "",
                          });
                        }}
                        className="text-blue-500 hover:text-blue-700 text-xs"
                        title="Edit"
                      >✎</button>
                      <button
                        onClick={() => deleteCategory(c.id)}
                        className="text-red-500 hover:text-red-700 text-xs"
                        title="Delete"
                      >✕</button>
                    </>
                  )}
                </div>
              ))}
              {adminCats.length === 0 && (
                <div className="text-sm text-slate-500">No categories yet. Add one above.</div>
              )}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const PricingManagement = () => {
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState({ name: "", tagline: "", lifetimePrice: "", annualPrice: "", popular: false, features: "" });
    const [pricingErr, setPricingErr] = useState<string | null>(null);
    const [pricingOk, setPricingOk] = useState<string | null>(null);
    const [pricingBusy, setPricingBusy] = useState(false);

    // New plan form
    const [newName, setNewName] = useState("");
    const [newTagline, setNewTagline] = useState("");
    const [newLifetime, setNewLifetime] = useState("");
    const [newAnnual, setNewAnnual] = useState("");
    const [newPopular, setNewPopular] = useState(false);
    const [newFeatures, setNewFeatures] = useState("");

    const createPlan = async () => {
      if (!newName.trim()) return;
      setPricingBusy(true);
      setPricingErr(null);
      setPricingOk(null);
      try {
        await gatewayFetch("/admin/pricing", {
          method: "POST",
          body: JSON.stringify({
            name: newName.trim(),
            tagline: newTagline.trim(),
            lifetimePrice: newLifetime.trim(),
            annualPrice: newAnnual.trim(),
            popular: newPopular,
            features: newFeatures.split("\n").map((f) => f.trim()).filter(Boolean),
            sortOrder: pricingPlans.length,
          }),
        });
        setPricingOk("Plan created!");
        setNewName(""); setNewTagline(""); setNewLifetime(""); setNewAnnual(""); setNewPopular(false); setNewFeatures("");
        await refreshPricingPlans();
      } catch (e: any) {
        setPricingErr(e?.message || "Failed");
      } finally {
        setPricingBusy(false);
      }
    };

    const startEdit = (p: PricingPlanT) => {
      setEditingId(p.id!);
      setEditForm({
        name: p.name,
        tagline: p.tagline,
        lifetimePrice: p.lifetimePrice,
        annualPrice: p.annualPrice,
        popular: p.popular,
        features: p.features.join("\n"),
      });
    };

    const updatePlan = async () => {
      if (!editingId) return;
      try {
        await gatewayFetch(`/admin/pricing/${editingId}`, {
          method: "PUT",
          body: JSON.stringify({
            name: editForm.name.trim(),
            tagline: editForm.tagline.trim(),
            lifetimePrice: editForm.lifetimePrice.trim(),
            annualPrice: editForm.annualPrice.trim(),
            popular: editForm.popular,
            features: editForm.features.split("\n").map((f) => f.trim()).filter(Boolean),
          }),
        });
        setEditingId(null);
        await refreshPricingPlans();
      } catch (e: any) {
        alert(e?.message || "Failed to update");
      }
    };

    const deletePlan = async (id: number) => {
      if (!confirm("Delete this pricing plan?")) return;
      try {
        await gatewayFetch(`/admin/pricing/${id}`, { method: "DELETE" });
        await refreshPricingPlans();
      } catch (e: any) {
        alert(e?.message || "Failed to delete");
      }
    };

    return (
      <div className="mt-6">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="text-lg font-semibold text-slate-900">💰 Pricing Plans</div>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">Pricing page</span>
          </div>
          <div className="text-sm text-slate-600 mt-1">Manage pricing plans shown on the Pricing page.</div>

          {pricingErr ? <div className="mt-4 text-sm text-red-700">{pricingErr}</div> : null}
          {pricingOk ? <div className="mt-4 text-sm text-emerald-700">{pricingOk}</div> : null}

          {/* Add new plan */}
          <div className="mt-5 p-4 bg-slate-50 rounded-xl">
            <div className="text-sm font-medium text-slate-700 mb-3">Add New Plan</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Plan name" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <input value={newTagline} onChange={(e) => setNewTagline(e.target.value)} placeholder="Tagline" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <input value={newLifetime} onChange={(e) => setNewLifetime(e.target.value)} placeholder="Lifetime price (e.g. $450)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <input value={newAnnual} onChange={(e) => setNewAnnual(e.target.value)} placeholder="Annual price (e.g. $99/yr)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={newPopular} onChange={(e) => setNewPopular(e.target.checked)} className="rounded" />
                Popular
              </label>
            </div>
            <textarea value={newFeatures} onChange={(e) => setNewFeatures(e.target.value)} placeholder="Features (one per line)" className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[80px]" />
            <button disabled={pricingBusy || !newName.trim()} onClick={createPlan} className="mt-3 rounded-xl bg-emerald-600 text-white px-6 py-2 text-sm hover:bg-emerald-700 disabled:opacity-60">
              Add Plan
            </button>
          </div>

          {/* Existing plans */}
          <div className="mt-6 space-y-4">
            <div className="text-sm font-medium text-slate-700">Current Plans</div>
            {pricingPlans.map((p) => (
              <div key={p.id || p.name} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                {editingId === p.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="Name" className="rounded-lg border px-3 py-2 text-sm" />
                      <input value={editForm.tagline} onChange={(e) => setEditForm({ ...editForm, tagline: e.target.value })} placeholder="Tagline" className="rounded-lg border px-3 py-2 text-sm" />
                      <input value={editForm.lifetimePrice} onChange={(e) => setEditForm({ ...editForm, lifetimePrice: e.target.value })} placeholder="Lifetime" className="rounded-lg border px-3 py-2 text-sm" />
                      <input value={editForm.annualPrice} onChange={(e) => setEditForm({ ...editForm, annualPrice: e.target.value })} placeholder="Annual" className="rounded-lg border px-3 py-2 text-sm" />
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={editForm.popular} onChange={(e) => setEditForm({ ...editForm, popular: e.target.checked })} className="rounded" />
                        Popular
                      </label>
                    </div>
                    <textarea value={editForm.features} onChange={(e) => setEditForm({ ...editForm, features: e.target.value })} placeholder="Features (one per line)" className="w-full rounded-lg border px-3 py-2 text-sm min-h-[80px]" />
                    <div className="flex gap-2">
                      <button onClick={updatePlan} className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm">Save</button>
                      <button onClick={() => setEditingId(null)} className="rounded-lg bg-slate-200 text-slate-700 px-4 py-2 text-sm">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{p.name}</span>
                        {p.popular && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Popular</span>}
                      </div>
                      <div className="text-sm text-slate-600 mt-1">{p.tagline}</div>
                      <div className="text-sm text-slate-700 mt-1">Lifetime: {p.lifetimePrice} · Annual: {p.annualPrice}</div>
                      <div className="text-xs text-slate-500 mt-2">{p.features.join(" • ")}</div>
                    </div>
                    <div className="flex gap-2">
                      {p.id && (
                        <>
                          <button onClick={() => startEdit(p)} className="text-blue-600 hover:text-blue-700 text-sm">Edit</button>
                          <button onClick={() => deletePlan(p.id!)} className="text-red-600 hover:text-red-700 text-sm">Delete</button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  const NavManagement = () => {
    const [navLabel, setNavLabel] = useState("");
    const [navPage, setNavPage] = useState("");
    const [navBusy, setNavBusy] = useState(false);
    const [navErr, setNavErr] = useState<string | null>(null);
    const [navOk, setNavOk] = useState<string | null>(null);
    const [allNavItems, setAllNavItems] = useState<NavItemT[]>([]);
    const [editingNavId, setEditingNavId] = useState<number | null>(null);
    const [editNavForm, setEditNavForm] = useState({ label: "", page: "", visible: true });

    const refreshAllNav = async () => {
      try {
        const json = await gatewayFetch("/admin/nav", { method: "GET" });
        setAllNavItems(json?.items || []);
      } catch {
        // ignore
      }
    };

    useEffect(() => {
      refreshAllNav();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const createNav = async () => {
      if (!navLabel.trim() || !navPage.trim()) return;
      setNavBusy(true);
      setNavErr(null);
      setNavOk(null);
      try {
        await gatewayFetch("/admin/nav", {
          method: "POST",
          body: JSON.stringify({ label: navLabel.trim(), page: navPage.trim(), sortOrder: allNavItems.length }),
        });
        setNavOk("Menu item added!");
        setNavLabel("");
        setNavPage("");
        await refreshAllNav();
        await refreshNavItems();
      } catch (e: any) {
        setNavErr(e?.message || "Failed");
      } finally {
        setNavBusy(false);
      }
    };

    const updateNav = async () => {
      if (!editingNavId) return;
      try {
        await gatewayFetch(`/admin/nav/${editingNavId}`, {
          method: "PUT",
          body: JSON.stringify(editNavForm),
        });
        setEditingNavId(null);
        await refreshAllNav();
        await refreshNavItems();
      } catch (e: any) {
        alert(e?.message || "Failed");
      }
    };

    const deleteNav = async (id: number) => {
      if (!confirm("Delete this menu item?")) return;
      try {
        await gatewayFetch(`/admin/nav/${id}`, { method: "DELETE" });
        await refreshAllNav();
        await refreshNavItems();
      } catch (e: any) {
        alert(e?.message || "Failed");
      }
    };

    const moveNav = async (id: number, dir: -1 | 1) => {
      const sorted = [...allNavItems].sort((a, b) => (Number(a.sortOrder || 0) - Number(b.sortOrder || 0)) || (Number(a.id || 0) - Number(b.id || 0)));
      const idx = sorted.findIndex((x) => Number(x.id) === id);
      if (idx < 0) return;
      const otherIdx = idx + dir;
      if (otherIdx < 0 || otherIdx >= sorted.length) return;
      const a = sorted[idx];
      const b = sorted[otherIdx];

      setNavBusy(true);
      try {
        await gatewayFetch(`/admin/nav/${a.id}`, { method: "PUT", body: JSON.stringify({ sortOrder: Number(b.sortOrder || 0) }) });
        await gatewayFetch(`/admin/nav/${b.id}`, { method: "PUT", body: JSON.stringify({ sortOrder: Number(a.sortOrder || 0) }) });
        await refreshAllNav();
        await refreshNavItems();
      } catch (e: any) {
        alert(e?.message || "Failed to reorder");
      } finally {
        setNavBusy(false);
      }
    };

    const availablePages = ["home", "shop", "pricing", "fraud", "contact", "about", "faq", "special", "coupons", "refund", "privacy", "cookies", "disclaimer", "terms"];
    
    const sortedNavItems = [...allNavItems].sort((a, b) => (Number(a.sortOrder || 0) - Number(b.sortOrder || 0)) || (Number(a.id || 0) - Number(b.id || 0)));

    return (
      <div className="mt-6">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="text-lg font-semibold text-slate-900">🔗 Navigation Menu</div>
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">Header nav</span>
          </div>
          <div className="text-sm text-slate-600 mt-1">Add, edit, or remove navigation menu items.</div>

          {navErr && <div className="mt-4 text-sm text-red-700">{navErr}</div>}
          {navOk && <div className="mt-4 text-sm text-emerald-700">{navOk}</div>}

          <div className="mt-5 flex gap-3">
            <input value={navLabel} onChange={(e) => setNavLabel(e.target.value)} placeholder="Label (e.g. About)" className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm" />
            <select value={navPage} onChange={(e) => setNavPage(e.target.value)} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm">
              <option value="">Select page...</option>
              {availablePages.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <button disabled={navBusy || !navLabel.trim() || !navPage} onClick={createNav} className="rounded-xl bg-emerald-600 text-white px-6 py-3 text-sm hover:bg-emerald-700 disabled:opacity-60">
              Add
            </button>
          </div>

          <div className="mt-6 space-y-2">
            {sortedNavItems.map((item, i) => (
              <div key={item.id} className={`rounded-xl border p-3 flex items-center justify-between ${item.visible ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50 opacity-60"}`}>
                {editingNavId === item.id ? (
                  <div className="flex-1 flex gap-2 items-center flex-wrap">
                    <input value={editNavForm.label} onChange={(e) => setEditNavForm({ ...editNavForm, label: e.target.value })} placeholder="Label" className="rounded-xl border border-slate-200 px-3 py-2 text-sm w-32" />
                    <select value={editNavForm.page} onChange={(e) => setEditNavForm({ ...editNavForm, page: e.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                      {availablePages.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <label className="flex items-center gap-1 text-xs text-slate-700">
                      <input type="checkbox" checked={editNavForm.visible} onChange={(e) => setEditNavForm({ ...editNavForm, visible: e.target.checked })} />
                      Visible
                    </label>
                    <button onClick={updateNav} className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm hover:bg-emerald-700">Save</button>
                    <button onClick={() => setEditingNavId(null)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50">Cancel</button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col gap-1">
                        <button 
                          type="button" 
                          onClick={() => moveNav(item.id!, -1)} 
                          disabled={navBusy || i === 0} 
                          className="px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50"
                          title="Move up"
                        >
                          ↑
                        </button>
                        <button 
                          type="button" 
                          onClick={() => moveNav(item.id!, 1)} 
                          disabled={navBusy || i === sortedNavItems.length - 1} 
                          className="px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50"
                          title="Move down"
                        >
                          ↓
                        </button>
                      </div>
                      <div>
                        <span className="font-medium text-slate-900">{item.label}</span>
                        <span className="text-xs text-slate-500 ml-2">→ {item.page}</span>
                        {!item.visible && <span className="text-xs text-red-500 ml-2">(hidden)</span>}
                        <span className="text-xs text-slate-400 ml-2">#{i + 1}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingNavId(item.id!); setEditNavForm({ label: item.label, page: item.page, visible: item.visible ?? true }); }} className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm hover:bg-emerald-700">Edit</button>
                      <button onClick={() => deleteNav(item.id!)} className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm text-red-700 hover:bg-red-50">Delete</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  const SiteSettingsManagement = () => {
    const [siteName, setSiteName] = useState(siteSettings.siteName);
    const [headerLogoFile, setHeaderLogoFile] = useState<File | null>(null);
    const [footerLogoFile, setFooterLogoFile] = useState<File | null>(null);
    const [heroKicker, setHeroKicker] = useState(siteSettings.heroKicker || "");
    const [heroTitle, setHeroTitle] = useState(siteSettings.heroTitle || "");
    const [heroTitleAccent, setHeroTitleAccent] = useState(siteSettings.heroTitleAccent || "");
    const [heroSubtitle, setHeroSubtitle] = useState(siteSettings.heroSubtitle || "");
    const [heroCtaBrowse, setHeroCtaBrowse] = useState(siteSettings.heroCtaBrowse || "");
    const [heroCtaPricing, setHeroCtaPricing] = useState(siteSettings.heroCtaPricing || "");
    const [heroFeature1, setHeroFeature1] = useState(siteSettings.heroFeature1 || "");
    const [heroFeature2, setHeroFeature2] = useState(siteSettings.heroFeature2 || "");
    const [heroFeature3, setHeroFeature3] = useState(siteSettings.heroFeature3 || "");
    const [topbarEmail, setTopbarEmail] = useState(siteSettings.topbarEmail || "");
    const [topbarPhone, setTopbarPhone] = useState(siteSettings.topbarPhone || "");
    const [topbarWhatsApp, setTopbarWhatsApp] = useState(siteSettings.topbarWhatsApp || "");
    const [topbarNoPayment, setTopbarNoPayment] = useState(siteSettings.topbarNoPayment || "");
    const [topbarEmailConfirm, setTopbarEmailConfirm] = useState(siteSettings.topbarEmailConfirm || "");
    const [settingsBusy, setSettingsBusy] = useState(false);
    const [settingsOk, setSettingsOk] = useState<string | null>(null);
    const [settingsErr, setSettingsErr] = useState<string | null>(null);

    // Only initialize form fields once on mount, don't reset when siteSettings changes
    // This prevents form inputs from being cleared when refreshSiteSettings() is called
    useEffect(() => {
      // Only set if fields are empty (initial load)
      if (!siteName && siteSettings.siteName) setSiteName(siteSettings.siteName);
      if (!heroKicker && siteSettings.heroKicker) setHeroKicker(siteSettings.heroKicker);
      if (!heroTitle && siteSettings.heroTitle) setHeroTitle(siteSettings.heroTitle);
      if (!heroTitleAccent && siteSettings.heroTitleAccent) setHeroTitleAccent(siteSettings.heroTitleAccent);
      if (!heroSubtitle && siteSettings.heroSubtitle) setHeroSubtitle(siteSettings.heroSubtitle);
      if (!heroCtaBrowse && siteSettings.heroCtaBrowse) setHeroCtaBrowse(siteSettings.heroCtaBrowse);
      if (!heroCtaPricing && siteSettings.heroCtaPricing) setHeroCtaPricing(siteSettings.heroCtaPricing);
      if (!heroFeature1 && siteSettings.heroFeature1) setHeroFeature1(siteSettings.heroFeature1);
      if (!heroFeature2 && siteSettings.heroFeature2) setHeroFeature2(siteSettings.heroFeature2);
      if (!heroFeature3 && siteSettings.heroFeature3) setHeroFeature3(siteSettings.heroFeature3);
      if (!topbarEmail && siteSettings.topbarEmail) setTopbarEmail(siteSettings.topbarEmail);
      if (!topbarPhone && siteSettings.topbarPhone) setTopbarPhone(siteSettings.topbarPhone);
      if (!topbarWhatsApp && siteSettings.topbarWhatsApp) setTopbarWhatsApp(siteSettings.topbarWhatsApp);
      if (!topbarNoPayment && siteSettings.topbarNoPayment) setTopbarNoPayment(siteSettings.topbarNoPayment);
      if (!topbarEmailConfirm && siteSettings.topbarEmailConfirm) setTopbarEmailConfirm(siteSettings.topbarEmailConfirm);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run once on mount

    const saveSettings = async () => {
      setSettingsBusy(true);
      setSettingsErr(null);
      setSettingsOk(null);
      try {
        const form = new FormData();
        // Allow empty site name - send it anyway so it can be cleared
        if (siteName.trim() || siteName === "") {
          form.append("siteName", siteName.trim() || "");
        }
        if (headerLogoFile) form.append("headerLogo", headerLogoFile);
        if (footerLogoFile) form.append("footerLogo", footerLogoFile);
        
        // Add hero section fields
        form.append("heroKicker", heroKicker.trim());
        form.append("heroTitle", heroTitle.trim());
        form.append("heroTitleAccent", heroTitleAccent.trim());
        form.append("heroSubtitle", heroSubtitle.trim());
        form.append("heroCtaBrowse", heroCtaBrowse.trim());
        form.append("heroCtaPricing", heroCtaPricing.trim());
        form.append("heroFeature1", heroFeature1.trim());
        form.append("heroFeature2", heroFeature2.trim());
        form.append("heroFeature3", heroFeature3.trim());
        
        // Add topbar fields
        form.append("topbarEmail", topbarEmail.trim());
        form.append("topbarPhone", topbarPhone.trim());
        form.append("topbarWhatsApp", topbarWhatsApp.trim());
        form.append("topbarNoPayment", topbarNoPayment.trim());
        form.append("topbarEmailConfirm", topbarEmailConfirm.trim());

        await gatewayFetch("/admin/settings", { method: "PUT", body: form });
        setSettingsOk("Settings saved!");
        setHeaderLogoFile(null);
        setFooterLogoFile(null);
        await refreshSiteSettings();
      } catch (e: any) {
        setSettingsErr(e?.message || "Failed");
      } finally {
        setSettingsBusy(false);
      }
    };

    return (
      <div className="mt-6">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="text-lg font-semibold text-slate-900">⚙️ Site Settings</div>
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">Logo & Name</span>
          </div>
          <div className="text-sm text-slate-600 mt-1">Update site name and logos for header/footer.</div>

          {settingsErr && <div className="mt-4 text-sm text-red-700">{settingsErr}</div>}
          {settingsOk && <div className="mt-4 text-sm text-emerald-700">{settingsOk}</div>}

          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Site Name</label>
              <input value={siteName} onChange={(e) => setSiteName(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Header Logo</label>
                {siteSettings.headerLogo && (
                  <div className="mb-2 p-2 bg-slate-50 rounded-lg inline-block">
                    <img src={siteSettings.headerLogo} alt="Header" className="h-10 w-auto" />
                  </div>
                )}
                <input type="file" accept=".svg,.png,.jpg,.jpeg,.webp" onChange={(e) => setHeaderLogoFile(e.target.files?.[0] || null)} className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Footer Logo (optional)</label>
                {siteSettings.footerLogo && (
                  <div className="mb-2 p-2 bg-slate-50 rounded-lg inline-block">
                    <img src={siteSettings.footerLogo} alt="Footer" className="h-10 w-auto" />
                  </div>
                )}
                <input type="file" accept=".svg,.png,.jpg,.jpeg,.webp" onChange={(e) => setFooterLogoFile(e.target.files?.[0] || null)} className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" />
              </div>
            </div>

            <button disabled={settingsBusy} onClick={saveSettings} className="rounded-xl bg-emerald-600 text-white px-6 py-3 text-sm hover:bg-emerald-700 disabled:opacity-60">
              Save Settings
            </button>
          </div>
        </Card>

        {/* Hero Section Settings */}
        <Card className="p-6 mt-6">
          <div className="flex items-center gap-3">
            <div className="text-lg font-semibold text-slate-900">🎯 Hero Section</div>
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">Homepage</span>
          </div>
          <div className="text-sm text-slate-600 mt-1">Edit the main hero section on the homepage.</div>

          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Kicker / Tag (small text above title)</label>
              <input 
                value={heroKicker} 
                onChange={(e) => setHeroKicker(e.target.value)} 
                placeholder="e.g., Payment-free checkout · Email confirmation"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" 
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Main Title</label>
                <input 
                  value={heroTitle} 
                  onChange={(e) => setHeroTitle(e.target.value)} 
                  placeholder="e.g., Clean, fast catalog platform"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title Accent (highlighted part)</label>
                <input 
                  value={heroTitleAccent} 
                  onChange={(e) => setHeroTitleAccent(e.target.value)} 
                  placeholder="e.g., with login & chatbot"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" 
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Subtitle / Description</label>
              <textarea 
                value={heroSubtitle} 
                onChange={(e) => setHeroSubtitle(e.target.value)} 
                placeholder="e.g., Marketplace-like layout, premium light UI. Users request orders; your team confirms by email."
                rows={3}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" 
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Browse Products Button Text</label>
                <input 
                  value={heroCtaBrowse} 
                  onChange={(e) => setHeroCtaBrowse(e.target.value)} 
                  placeholder="e.g., Browse products"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">View Pricing Button Text</label>
                <input 
                  value={heroCtaPricing} 
                  onChange={(e) => setHeroCtaPricing(e.target.value)} 
                  placeholder="e.g., View pricing"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" 
                />
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <div className="text-sm font-medium text-slate-700 mb-3">Feature Cards (3 cards below buttons)</div>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Feature 1</label>
                  <input 
                    value={heroFeature1} 
                    onChange={(e) => setHeroFeature1(e.target.value)} 
                    placeholder="e.g., Free Shipping worldwide"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Feature 2</label>
                  <input 
                    value={heroFeature2} 
                    onChange={(e) => setHeroFeature2(e.target.value)} 
                    placeholder="e.g., Members gift weekly"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Feature 3</label>
                  <input 
                    value={heroFeature3} 
                    onChange={(e) => setHeroFeature3(e.target.value)} 
                    placeholder="e.g., Friendly support 24/7"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" 
                  />
                </div>
              </div>
            </div>

            <button disabled={settingsBusy} onClick={saveSettings} className="rounded-xl bg-emerald-600 text-white px-6 py-3 text-sm hover:bg-emerald-700 disabled:opacity-60">
              Save Hero Section
            </button>
          </div>
        </Card>

        {/* Topbar Settings */}
        <Card className="p-6 mt-6">
          <div className="flex items-center gap-3">
            <div className="text-lg font-semibold text-slate-900">📞 Topbar Section</div>
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">Header topbar</span>
          </div>
          <div className="text-sm text-slate-600 mt-1">Edit contact information and messages in the top bar above the header.</div>

          <div className="mt-5 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <input 
                  value={topbarEmail} 
                  onChange={(e) => setTopbarEmail(e.target.value)} 
                  placeholder="e.g., support@ripcrack.net"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                <input 
                  value={topbarPhone} 
                  onChange={(e) => setTopbarPhone(e.target.value)} 
                  placeholder="e.g., +48 6388 1006"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" 
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp Number</label>
              <input 
                value={topbarWhatsApp} 
                onChange={(e) => setTopbarWhatsApp(e.target.value)} 
                placeholder="e.g., +48 6388 1006"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" 
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Left Message (e.g., "No online payment")</label>
                <input 
                  value={topbarNoPayment} 
                  onChange={(e) => setTopbarNoPayment(e.target.value)} 
                  placeholder="e.g., No online payment"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Right Message (e.g., "Email confirmation")</label>
                <input 
                  value={topbarEmailConfirm} 
                  onChange={(e) => setTopbarEmailConfirm(e.target.value)} 
                  placeholder="e.g., Email confirmation"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" 
                />
              </div>
            </div>

            <button disabled={settingsBusy} onClick={saveSettings} className="rounded-xl bg-emerald-600 text-white px-6 py-3 text-sm hover:bg-emerald-700 disabled:opacity-60">
              Save Topbar Settings
            </button>
          </div>
        </Card>
      </div>
    );
  }

  const BrandManagement = () => {
    // Header brands state
    const [headerName, setHeaderName] = useState("");
    const [headerLogo, setHeaderLogo] = useState<File | null>(null);
    const [headerBusy, setHeaderBusy] = useState(false);
    const [headerErr, setHeaderErr] = useState<string | null>(null);
    const [headerOk, setHeaderOk] = useState<string | null>(null);
    const [headerFileInputKey, setHeaderFileInputKey] = useState(0);

    // Trusted brands state
    const [trustedName, setTrustedName] = useState("");
    const [trustedLogo, setTrustedLogo] = useState<File | null>(null);
    const [trustedBusy, setTrustedBusy] = useState(false);
    const [trustedErr, setTrustedErr] = useState<string | null>(null);
    const [trustedOk, setTrustedOk] = useState<string | null>(null);
    const [trustedFileInputKey, setTrustedFileInputKey] = useState(0);

    const createHeaderBrand = async () => {
      // Allow creating brand with just logo, name is optional
      if (!headerLogo && !headerName.trim()) {
        setHeaderErr("Please provide either a brand name or logo");
        return;
      }
      setHeaderBusy(true);
      setHeaderErr(null);
      setHeaderOk(null);
      try {
        const form = new FormData();
        form.append("name", headerName.trim() || "Brand");
        form.append("sortOrder", String(headerBrands.length));
        form.append("type", "HEADER");
        if (headerLogo) form.append("logo", headerLogo);

        await gatewayFetch("/admin/brands", { method: "POST", body: form });
        setHeaderOk("Brand added!");
        setHeaderName("");
        setHeaderLogo(null);
        setHeaderFileInputKey(prev => prev + 1);
        await refreshHeaderBrands();
      } catch (e: any) {
        setHeaderErr(e?.message || "Failed");
      } finally {
        setHeaderBusy(false);
      }
    };

    const createTrustedBrand = async () => {
      // Allow creating brand with just logo, name is optional
      if (!trustedLogo && !trustedName.trim()) {
        setTrustedErr("Please provide either a brand name or logo");
        return;
      }
      setTrustedBusy(true);
      setTrustedErr(null);
      setTrustedOk(null);
      try {
        const form = new FormData();
        form.append("name", trustedName.trim() || "Brand");
        form.append("sortOrder", String(trustedBrands.length));
        form.append("type", "TRUSTED");
        if (trustedLogo) form.append("logo", trustedLogo);

        await gatewayFetch("/admin/brands", { method: "POST", body: form });
        setTrustedOk("Brand added!");
        setTrustedName("");
        setTrustedLogo(null);
        setTrustedFileInputKey(prev => prev + 1);
        await refreshTrustedBrands();
      } catch (e: any) {
        setTrustedErr(e?.message || "Failed");
      } finally {
        setTrustedBusy(false);
      }
    };

    const deleteBrand = async (id: number, type: "HEADER" | "TRUSTED") => {
      if (!confirm("Delete this brand?")) return;
      try {
        await gatewayFetch(`/admin/brands/${id}`, { method: "DELETE" });
        if (type === "HEADER") await refreshHeaderBrands();
        else await refreshTrustedBrands();
      } catch (e: any) {
        alert(e?.message || "Failed to delete");
      }
    };

    return (
      <div className="mt-8 space-y-6">
        {/* HEADER BRANDS - Brands we sell */}
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="text-lg font-semibold text-slate-900">🏪 Brands we sell</div>
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">Header carousel</span>
          </div>
          <div className="text-sm text-slate-600 mt-1">Upload logos for the brand carousel below the navigation bar.</div>

          {headerErr ? <div className="mt-4 text-sm text-red-700">{headerErr}</div> : null}
          {headerOk ? <div className="mt-4 text-sm text-emerald-700">{headerOk}</div> : null}

          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <input
              value={headerName}
              onChange={(e) => setHeaderName(e.target.value)}
              placeholder="Brand name"
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
            />
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Logo (SVG, PNG, JPG)</label>
              <input
                key={headerFileInputKey}
                type="file"
                accept=".svg,.png,.jpg,.jpeg,.webp"
                onChange={(e) => setHeaderLogo(e.target.files?.[0] || null)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm"
              />
            </div>
            <button
              disabled={headerBusy || (!headerName.trim() && !headerLogo)}
              onClick={createHeaderBrand}
              className="rounded-xl bg-emerald-600 text-white px-6 py-3 text-sm hover:bg-emerald-700 disabled:opacity-60 whitespace-nowrap"
            >
              Add Brand
            </button>
          </div>

          <div className="mt-6">
            <div className="text-sm font-medium text-slate-700 mb-3">Current Brands</div>
            <div className="flex flex-wrap gap-3">
              {headerBrands.map((b) => (
                <div key={b.id || b.name} className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                  {b.logo ? (
                    <img src={b.logo} alt={b.name} className="h-6 w-auto max-w-[60px] object-contain" />
                  ) : (
                    <span className="text-sm text-slate-700">{b.name}</span>
                  )}
                  <span className="text-xs text-slate-500">{b.name}</span>
                  {b.id ? (
                    <button onClick={() => deleteBrand(b.id!, "HEADER")} className="ml-1 text-red-500 hover:text-red-700 text-xs" title="Delete">✕</button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* TRUSTED BRANDS - Trusted by teams */}
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="text-lg font-semibold text-slate-900">🤝 Trusted by teams</div>
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">Homepage carousel</span>
          </div>
          <div className="text-sm text-slate-600 mt-1">Upload logos for the auto-scrolling "Trusted by teams" section on homepage.</div>

          {trustedErr ? <div className="mt-4 text-sm text-red-700">{trustedErr}</div> : null}
          {trustedOk ? <div className="mt-4 text-sm text-emerald-700">{trustedOk}</div> : null}

          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <input
              value={trustedName}
              onChange={(e) => setTrustedName(e.target.value)}
              placeholder="Brand name"
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
            />
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Logo (SVG, PNG, JPG)</label>
              <input
                key={trustedFileInputKey}
                type="file"
                accept=".svg,.png,.jpg,.jpeg,.webp"
                onChange={(e) => setTrustedLogo(e.target.files?.[0] || null)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm"
              />
            </div>
            <button
              disabled={trustedBusy || (!trustedName.trim() && !trustedLogo)}
              onClick={createTrustedBrand}
              className="rounded-xl bg-emerald-600 text-white px-6 py-3 text-sm hover:bg-emerald-700 disabled:opacity-60 whitespace-nowrap"
            >
              Add Brand
            </button>
          </div>

          <div className="mt-6">
            <div className="text-sm font-medium text-slate-700 mb-3">Current Brands</div>
            <div className="flex flex-wrap gap-3">
              {trustedBrands.map((b) => (
                <div key={b.id || b.name} className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                  {b.logo ? (
                    <img src={b.logo} alt={b.name} className="h-6 w-auto max-w-[60px] object-contain" />
                  ) : (
                    <span className="text-sm text-slate-700">{b.name}</span>
                  )}
                  <span className="text-xs text-slate-500">{b.name}</span>
                  {b.id ? (
                    <button onClick={() => deleteBrand(b.id!, "TRUSTED")} className="ml-1 text-red-500 hover:text-red-700 text-xs" title="Delete">✕</button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const Fraud = useMemo(() => {
    return function AttentionFraudSectionImpl(props: {
      gatewayFetch: (path: string, init?: RequestInit) => Promise<any>;
      getDeviceId: () => string;
      fraudVerifyOpen: boolean;
      setFraudVerifyOpen: (v: boolean) => void;
      fraudVerifyEmail: string;
      setFraudVerifyEmail: (v: string) => void;
      fraudVerifySubmissionId: string;
      setFraudVerifySubmissionId: (v: string) => void;
      fraudVerifyCode: string;
      setFraudVerifyCode: (v: string) => void;
      fraudVerifyBusy: boolean;
      setFraudVerifyBusy: (v: boolean) => void;
      fraudVerifyErr: string | null;
      setFraudVerifyErr: (v: string | null) => void;
      fraudVerifyOk: string | null;
      setFraudVerifyOk: (v: string | null) => void;
      fraudResendLeft: number;
      setFraudResendLeft: (v: number | ((x: number) => number)) => void;
    }) {
      const {
        gatewayFetch,
        getDeviceId,
        fraudVerifyOpen,
        setFraudVerifyOpen,
        fraudVerifyEmail,
        setFraudVerifyEmail,
        fraudVerifySubmissionId,
        setFraudVerifySubmissionId,
        fraudVerifyCode,
        setFraudVerifyCode,
        fraudVerifyBusy,
        setFraudVerifyBusy,
        fraudVerifyErr,
        setFraudVerifyErr,
        fraudVerifyOk,
        setFraudVerifyOk,
        fraudResendLeft,
        setFraudResendLeft,
      } = props;
      const [fraudItems, setFraudItems] = useState<FraudItem[]>([]);
      const [fraudBusy, setFraudBusy] = useState(false);
      const [fraudErr, setFraudErr] = useState<string | null>(null);
      const fraudHasFetchedRef = useRef(false);
      const [openIdx, setOpenIdx] = useState<number | null>(null);

      const [fraudForm, setFraudForm] = useState({
      name: "",
      platform: "Telegram" as string,
      handle: "",
      details: "",
      evidenceLink: "",
    });

    const [fraudFormSent, setFraudFormSent] = useState(false);
    const [fraudSubmitEmail, setFraudSubmitEmail] = useState("");

    const fraudEmailRef = useRef<HTMLInputElement | null>(null);
    const fraudNameRef = useRef<HTMLInputElement | null>(null);
    const fraudPlatformRef = useRef<HTMLSelectElement | null>(null);
    const fraudHandleRef = useRef<HTMLInputElement | null>(null);
    const fraudEvidenceRef = useRef<HTMLInputElement | null>(null);
    const fraudDetailsRef = useRef<HTMLTextAreaElement | null>(null);

    const [fraudCaptchaToken, setFraudCaptchaToken] = useState("");
    const [fraudCaptchaOpen, setFraudCaptchaOpen] = useState(false);
    const fraudWidgetIdRef = useRef<any>(null);
    const fraudFetchInFlightRef = useRef(false);
    const fraudEntriesCooldownUntilRef = useRef(0);
    const turnstileSiteKey = (import.meta as any)?.env?.VITE_TURNSTILE_SITE_KEY as string | undefined;

    useEffect(() => {
      if (!turnstileSiteKey) return;
      if (typeof window === "undefined") return;

      const w = window as any;
      if (w.turnstile) return;

      const existing = document.querySelector('script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]');
      if (existing) return;

      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    }, [turnstileSiteKey]);

    useEffect(() => {
      if (!turnstileSiteKey) return;
      if (typeof window === "undefined") return;
      const w = window as any;

      let cancelled = false;
      const ensureRendered = async () => {
        for (let i = 0; i < 80; i++) {
          if (cancelled) return;
          if (w.turnstile && typeof w.turnstile.render === "function") break;
          await new Promise((r) => setTimeout(r, 100));
        }
        if (cancelled) return;
        if (!w.turnstile || typeof w.turnstile.render !== "function") return;

        const el = document.getElementById("turnstile-fraud");
        if (el && fraudCaptchaOpen && !el.getAttribute("data-rendered")) {
          const id = w.turnstile.render(el, {
            sitekey: turnstileSiteKey,
            callback: (token: string) => {
              setFraudCaptchaToken(token);
              setFraudCaptchaOpen(false);
            },
            "expired-callback": () => setFraudCaptchaToken(""),
            "error-callback": () => setFraudCaptchaToken(""),
          });
          fraudWidgetIdRef.current = id;
          el.setAttribute("data-rendered", "1");
        }
      };

      ensureRendered();
      return () => {
        cancelled = true;
      };
    }, [turnstileSiteKey, fraudCaptchaOpen]);

    const resetFraudCaptcha = () => {
      setFraudCaptchaToken("");
      const w = window as any;
      if (w?.turnstile && fraudWidgetIdRef.current != null) {
        try {
          const widgetId = fraudWidgetIdRef.current;
          if (widgetId != null) {
            w.turnstile.reset(widgetId);
          }
        } catch (err) {
          // Silently ignore if widget is not available
          console.debug("Turnstile reset failed:", err);
        }
      }
      const el = document.getElementById("turnstile-fraud");
      if (el) el.removeAttribute("data-rendered");
    };

    const startFraudResendCooldown = (seconds: number) => {
      const s = Math.max(0, Math.floor(seconds));
      setFraudResendLeft(s);
      if (typeof window !== "undefined") window.localStorage.setItem("fraudResendUntil", String(Date.now() + s * 1000));
    };

    useEffect(() => {
      if (!fraudVerifyOpen) return;
      if (fraudResendLeft <= 0) return;
      const t = window.setInterval(() => {
        setFraudResendLeft((x) => (x > 0 ? x - 1 : 0));
      }, 1000);
      return () => window.clearInterval(t);
    }, [fraudVerifyOpen, fraudResendLeft]);

    useEffect(() => {
      if (typeof window === "undefined") return;
      const pendingRaw = window.localStorage.getItem("pendingFraudVerify") || "";
      if (!pendingRaw) return;
      try {
        const pending = JSON.parse(pendingRaw) as any;
        const email = String(pending?.email || "").trim().toLowerCase();
        const submissionId = String(pending?.submissionId || "").trim();
        if (!email || !submissionId) return;
        if (fraudVerifyCode.trim()) return;
        setFraudVerifyEmail(email);
        setFraudVerifySubmissionId(submissionId);
        // Don't reset code while user is typing
        setFraudVerifyCode((prev) => prev);
        setFraudVerifyErr(null);
        setFraudVerifyOk("Please enter the 6-digit code sent to your email.");
        if (!fraudVerifyOpen) setFraudVerifyOpen(true);

        const untilRaw = window.localStorage.getItem("fraudResendUntil") || "";
        const until = Number(untilRaw || 0);
        const left = until > 0 ? Math.ceil((until - Date.now()) / 1000) : 0;
        setFraudResendLeft(left > 0 ? left : 0);
      } catch {
        // ignore
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const refreshFraudEntries = async () => {
      if (Date.now() < fraudEntriesCooldownUntilRef.current) return;
      if (fraudFetchInFlightRef.current) return;
      fraudFetchInFlightRef.current = true;
      setFraudBusy(true);
      setFraudErr(null);
      try {
        const json = await gatewayFetch("/fraud/entries", { method: "GET" });
        const items = (json?.items || []) as any[];
        setFraudItems(
          Array.isArray(items)
            ? items.map((x) => ({
                id: Number(x?.id || 0),
                name: String(x?.name || ""),
                handle: String(x?.handle || ""),
                platform: String(x?.platform || ""),
                note: String(x?.note || ""),
                details: String(x?.details || ""),
                evidenceUrl: String(x?.evidenceUrl || ""),
                reports: Number(x?.reports || 0),
              }))
            : []
        );
      } catch (e: any) {
        if (e?.status === 429) {
          const waitMs = Number.isFinite(e?.retryAfterMs) ? Number(e.retryAfterMs) : 30_000;
          fraudEntriesCooldownUntilRef.current = Date.now() + Math.max(0, waitMs);
        }
        setFraudErr(e?.message || "Failed to load fraud list");
      } finally {
        setFraudBusy(false);
        fraudFetchInFlightRef.current = false;
      }
    };

    const doFraudVerify = async () => {
      setFraudVerifyBusy(true);
      setFraudVerifyErr(null);
      setFraudVerifyOk(null);
      try {
        const email = fraudVerifyEmail.trim().toLowerCase();
        const code = fraudVerifyCode.trim();
        const submissionId = String(fraudVerifySubmissionId || "").trim();
        if (!email || code.length !== 6 || !submissionId) throw new Error("Missing verification data");

        await gatewayFetch("/fraud/verify", {
          method: "POST",
          body: JSON.stringify({ email, code, submissionId }),
        });

        setFraudVerifyOk("Verified. Thank you!");
        if (typeof window !== "undefined") window.localStorage.removeItem("pendingFraudVerify");
        setFraudFormSent(true);
        setFraudForm({ name: "", platform: "Telegram", handle: "", details: "", evidenceLink: "" });
        setFraudSubmitEmail("");
        setTimeout(() => {
          setFraudVerifyOpen(false);
          setFraudVerifyOk(null);
          setFraudVerifyCode("");
          setFraudVerifySubmissionId("");
          setFraudFormSent(false);
        }, 2500);
      } catch (e: any) {
        setFraudVerifyErr(e?.message || "Failed to verify");
      } finally {
        setFraudVerifyBusy(false);
      }
    };

    const doFraudResend = async () => {
      if (fraudResendLeft > 0) return;
      setFraudVerifyBusy(true);
      setFraudVerifyErr(null);
      setFraudVerifyOk(null);
      try {
        const email = fraudVerifyEmail.trim().toLowerCase();
        const submissionId = String(fraudVerifySubmissionId || "").trim();
        if (!email || !submissionId) throw new Error("Missing verification data");

        await gatewayFetch("/fraud/resend", {
          method: "POST",
          body: JSON.stringify({ email, submissionId, captchaToken: fraudCaptchaToken }),
        });

        setFraudVerifyOk("A new code was sent.");
        startFraudResendCooldown(30);
      } catch (e: any) {
        setFraudVerifyErr(e?.message || "Failed to resend");
      } finally {
        setFraudVerifyBusy(false);
      }
    };

    useEffect(() => {
      if (fraudHasFetchedRef.current) return;
      fraudHasFetchedRef.current = true;
      const loadData = async () => {
        await refreshFraudEntries();
      };
      loadData();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const canReportId = (id: number) => {
      if (typeof window === "undefined") return true;
      return window.localStorage.getItem(`fraudReported:${id}`) !== "1";
    };

    const reportExisting = async (id: number) => {
      if (!canReportId(id)) return;
      try {
        const deviceId = getDeviceId();
        const json = await gatewayFetch(`/fraud/entries/${id}/report`, {
          method: "POST",
          body: JSON.stringify({ deviceId }),
        });
        const updated = json?.item;
        if (updated?.id) {
          setFraudItems((prev) => prev.map((it) => (it.id === Number(updated.id) ? { ...it, reports: Number(updated.reports || it.reports) } : it)));
        } else {
          setFraudItems((prev) => prev.map((it) => (it.id === id ? { ...it, reports: it.reports + 1 } : it)));
        }
        if (typeof window !== "undefined") window.localStorage.setItem(`fraudReported:${id}`, "1");
      } catch (e: any) {
        const msg = String(e?.message || "");
        if (msg.toLowerCase().includes("already reported")) {
          if (typeof window !== "undefined") window.localStorage.setItem(`fraudReported:${id}`, "1");
          return;
        }
        alert(msg || "Failed to report");
      }
    };

    const submitNewFraud = async () => {
      const emailRaw = String(fraudSubmitEmail || "");
      const nameRaw = String(fraudForm?.name || "");
      const platformRaw = String(fraudForm?.platform || "Telegram");
      const handleRaw = String(fraudForm?.handle || "");
      const detailsRaw = String(fraudForm?.details || "");
      const evidenceRaw = String(fraudForm?.evidenceLink || "");

      if (!emailRaw.trim() || !nameRaw.trim() || !handleRaw.trim() || !detailsRaw.trim()) {
        alert("Please fill: Email, Name, Handle/Contact, Details");
        return;
      }

      if (turnstileSiteKey && !fraudCaptchaToken) {
        resetFraudCaptcha();
        setFraudCaptchaOpen(true);
        return;
      }

      setFraudBusy(true);
      setFraudErr(null);
      try {
        const email = emailRaw.trim().toLowerCase();
        const json = await gatewayFetch("/fraud/submit", {
          method: "POST",
          body: JSON.stringify({
            email,
            name: nameRaw.trim(),
            platform: platformRaw.trim(),
            handle: handleRaw.trim(),
            details: detailsRaw.trim(),
            evidenceUrl: evidenceRaw.trim(),
            captchaToken: fraudCaptchaToken,
          }),
        });

        const submissionId = String(json?.submissionId || "").trim();
        if (!submissionId) throw new Error("Submit failed");

        if (typeof window !== "undefined") {
          window.localStorage.setItem("pendingFraudVerify", JSON.stringify({ email, submissionId }));
        }
        setFraudVerifyEmail(email);
        setFraudVerifySubmissionId(submissionId);
        setFraudVerifyCode("");
        setFraudVerifyErr(null);
        setFraudVerifyOk(null);
        setFraudVerifyOpen(true);
        startFraudResendCooldown(30);

        resetFraudCaptcha();
      } catch (e: any) {
        setFraudErr(e?.message || "Failed to submit");
      } finally {
        setFraudBusy(false);
      }
    };

    return (
      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-5">
          <div className="flex items-start gap-4">
            <div className="h-11 w-11 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-rose-700">
                <path d="M12 2l7 4v6c0 5-3 9-7 10-4-1-7-5-7-10V6l7-4z" />
                <path d="M12 8v5" />
                <path d="M12 17h.01" />
              </svg>
            </div>
            <div>
              <div className="text-lg font-semibold text-rose-900">Attention: Fraud &amp; Impersonators</div>
              <div className="mt-1 text-sm text-rose-800 leading-relaxed">
                We <span className="font-semibold">NEVER</span> ask for crypto payments via Telegram or WhatsApp. All official orders are processed via email invoicing.
                <br />
                Below is a list of known impersonators reported by our community.
              </div>
            </div>
          </div>
        </div>
        <SectionTitle title="Attention Fraud" subtitle="If you see fraud accounts, report them here." />

        {fraudVerifyOpen && typeof document !== "undefined"
          ? createPortal(
              <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="fraud-verify-title">
                <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <h2 id="fraud-verify-title" className="text-lg font-semibold text-slate-900">Verify email</h2>
                    <button
                      type="button"
                      onClick={() => {
                        setFraudVerifyOpen(false);
                        if (typeof window !== "undefined") window.localStorage.removeItem("pendingFraudVerify");
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50 shrink-0"
                      aria-label="Close"
                    >
                      Close
                    </button>
                  </div>
                  <p className="text-sm text-slate-600 mt-1 mb-4">Enter the 6-digit code sent to {fraudVerifyEmail || "your email"}.</p>

                  {fraudVerifyErr ? <div className="mb-3 text-sm text-red-700">{fraudVerifyErr}</div> : null}
                  {fraudVerifyOk ? <div className="mb-3 text-sm text-emerald-700">{fraudVerifyOk}</div> : null}

                  <div className="space-y-3">
                    <input value={fraudVerifyEmail} onChange={(e) => setFraudVerifyEmail(e.target.value)} placeholder="Email" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" aria-label="Email address" />
                    <input
                      value={fraudVerifyCode}
                      onChange={(e) => setFraudVerifyCode(String(e.target.value || "").slice(0, 6))}
                      onKeyDown={(e) => e.stopPropagation()}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="6-digit code"
                      autoFocus
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                      aria-label="6-digit verification code"
                    />
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        disabled={fraudVerifyBusy || !fraudVerifyEmail.trim() || fraudVerifyCode.trim().length !== 6}
                        onClick={doFraudVerify}
                        className="flex-1 rounded-xl bg-emerald-600 text-white py-3 text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
                      >
                        Verify
                      </button>
                      <button
                        type="button"
                        disabled={fraudVerifyBusy || !fraudVerifyEmail.trim() || fraudResendLeft > 0}
                        onClick={doFraudResend}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {fraudResendLeft > 0 ? `Resend (${fraudResendLeft}s)` : "Resend"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>,
              document.body
            )
          : null}

        <Card className="p-6 mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-lg font-semibold text-slate-900">Report a fraud account</div>
              <div className="text-sm text-slate-600 mt-1">Fill the form — we will review and add it to the list. Email verification is required after you submit.</div>
            </div>
            {fraudFormSent ? <div className="text-sm bg-emerald-50 text-emerald-800 border border-emerald-100 px-3 py-2 rounded-xl">Submitted ✅</div> : null}
          </div>

          <div className="mt-5 grid md:grid-cols-2 gap-4">
            <input value={fraudSubmitEmail} onChange={(e) => setFraudSubmitEmail(e.target.value)} placeholder="Your email" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
            <input value={fraudForm.name} onChange={(e) => setFraudForm((s) => ({ ...s, name: e.target.value }))} placeholder="Fraud name / title" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
            <select value={fraudForm.platform} onChange={(e) => setFraudForm((s) => ({ ...s, platform: e.target.value }))} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
              <option value="Telegram">Telegram</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Email">Email</option>
              <option value="Other">Other</option>
            </select>
            <input value={fraudForm.handle} onChange={(e) => setFraudForm((s) => ({ ...s, handle: e.target.value }))} placeholder="@username / phone / email" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
            <input value={fraudForm.evidenceLink} onChange={(e) => setFraudForm((s) => ({ ...s, evidenceLink: e.target.value }))} placeholder="Evidence link (optional)" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
          </div>

          <textarea value={fraudForm.details} onChange={(e) => setFraudForm((s) => ({ ...s, details: e.target.value }))} placeholder="Details: what happened, date, payment request, links, screenshots..." className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm min-h-[110px]" />

          <div className="mt-4 flex gap-2">
            <button type="button" onClick={submitNewFraud} className="rounded-xl bg-emerald-600 text-white px-5 py-3 text-sm hover:bg-emerald-700">
              Submit report
            </button>
            <button type="button" onClick={() => setFraudForm({ name: "", platform: "Telegram", handle: "", details: "", evidenceLink: "" })} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm hover:bg-slate-50">
              Clear
            </button>
          </div>
        </Card>

        <div className="grid md:grid-cols-3 gap-6">
          {fraudItems.map((x) => {
            const isOpen = openIdx === x.id;
            const initials = x.name
              .split(" ")
              .slice(0, 2)
              .map((p) => p[0]?.toUpperCase())
              .join("");

            const canReport = canReportId(x.id);

            return (
              <div key={x.id} role="button" tabIndex={0} onClick={() => setOpenIdx((cur) => (cur === x.id ? null : x.id))} className="text-left cursor-pointer">
                <Card className="p-5 hover:shadow-md transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="h-11 w-11 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-sm font-semibold text-slate-600">{initials}</div>
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
                  <div className="mt-3 text-xs text-slate-500">🚩 Reported by {x.reports} people</div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-xs text-slate-500">Tap to {isOpen ? "hide" : "view"} details</div>
                    <div className="text-slate-400 text-lg">{isOpen ? "–" : "+"}</div>
                  </div>

                  {isOpen ? (
                    <div className="mt-4">
                      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                        <div className="text-sm font-semibold text-slate-900">Details</div>
                        <div className="mt-2 text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{(x.details || x.note || "").trim() || "—"}</div>

                        {x.evidenceUrl ? (
                          <a
                            href={x.evidenceUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="mt-3 inline-block text-sm text-slate-900 underline"
                          >
                            Evidence
                          </a>
                        ) : null}

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
                              reportExisting(x.id);
                            }}
                            disabled={!canReport}
                            className={`rounded-xl px-4 py-2 text-sm ${canReport ? "bg-slate-900 text-white hover:bg-black" : "bg-slate-200 text-slate-500 cursor-not-allowed"}`}
                          >
                            {canReport ? "Report" : "Reported"}
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
  }, []);

   const Account = () => {
    // Persist form state to prevent loss on re-renders
    const [loginEmail, setLoginEmail] = useState(() => {
      if (typeof window !== "undefined") {
        const saved = window.localStorage.getItem("loginEmail");
        return saved || "";
      }
      return "";
    });
    const [loginPassword, setLoginPassword] = useState(() => {
      if (typeof window !== "undefined") {
        const saved = window.localStorage.getItem("loginPassword");
        return saved || "";
      }
      return "";
    });
    const [loginPwVisible, setLoginPwVisible] = useState(false);
    const [loginCaptchaToken, setLoginCaptchaToken] = useState("");
    const [loginCaptchaOpen, setLoginCaptchaOpen] = useState(false);
    const [fullName, setFullName] = useState("");
    const [regEmail, setRegEmail] = useState("");
    const [regPassword, setRegPassword] = useState("");
    const [regPwVisible, setRegPwVisible] = useState(false);

    const [verifyOpen, setVerifyOpen] = useState(false);
    const [verifyEmail, setVerifyEmail] = useState("");
    const [verifyCode, setVerifyCode] = useState("");
    const [verifyBusy, setVerifyBusy] = useState(false);
    const [verifyErr, setVerifyErr] = useState<string | null>(null);
    const [verifyOk, setVerifyOk] = useState<string | null>(null);
    const [resendLeft, setResendLeft] = useState(0);
    const [regCaptchaToken, setRegCaptchaToken] = useState("");
    const [regCaptchaOpen, setRegCaptchaOpen] = useState(false);

    const [pwOld, setPwOld] = useState("");
    const [pwNew, setPwNew] = useState("");
    const [pwNew2, setPwNew2] = useState("");
    const [pwOldVisible, setPwOldVisible] = useState(false);
    const [pwNewVisible, setPwNewVisible] = useState(false);
    const [pwNew2Visible, setPwNew2Visible] = useState(false);
    const [pwBusy, setPwBusy] = useState(false);
    const [pwErr, setPwErr] = useState<string | null>(null);
    const [pwOk, setPwOk] = useState<string | null>(null);

    const [fpOpen, setFpOpen] = useState(false);
    const [fpEmail, setFpEmail] = useState("");
    const [fpBusy, setFpBusy] = useState(false);
    const [fpErr, setFpErr] = useState<string | null>(null);
    const [fpOk, setFpOk] = useState<string | null>(null);

    const [rpToken, setRpToken] = useState("");
    const [rpPw1, setRpPw1] = useState("");
    const [rpPw2, setRpPw2] = useState("");
    const [rpPw1Visible, setRpPw1Visible] = useState(false);
    const [rpPw2Visible, setRpPw2Visible] = useState(false);
    const [rpBusy, setRpBusy] = useState(false);
    const [rpErr, setRpErr] = useState<string | null>(null);
    const [rpOk, setRpOk] = useState<string | null>(null);

    const [myOrders, setMyOrders] = useState<any[]>([]);
    const [myOrdersBusy, setMyOrdersBusy] = useState(false);
    const [myOrdersErr, setMyOrdersErr] = useState<string | null>(null);
    const [cancelBusy, setCancelBusy] = useState<number | null>(null);
    const [cancelNotification, setCancelNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

    const [profileEmail, setProfileEmail] = useState("");
    const [profileFirstName, setProfileFirstName] = useState("");
    const [profileLastName, setProfileLastName] = useState("");
    const [profileBusy, setProfileBusy] = useState(false);
    const [profileErr, setProfileErr] = useState<string | null>(null);
    const [profileOk, setProfileOk] = useState<string | null>(null);

    const loginWidgetIdRef = useRef<any>(null);
    const regWidgetIdRef = useRef<any>(null);

    const turnstileSiteKey = (import.meta as any)?.env?.VITE_TURNSTILE_SITE_KEY as string | undefined;

    useEffect(() => {
      if (!turnstileSiteKey) return;
      if (typeof window === "undefined") return;

      const w = window as any;
      if (w.turnstile) return;

      const existing = document.querySelector('script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]');
      if (existing) return;

      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    }, [turnstileSiteKey]);

    useEffect(() => {
      if (!turnstileSiteKey) return;
      if (typeof window === "undefined") return;
      const w = window as any;

      let cancelled = false;
      const ensureRendered = async () => {
        for (let i = 0; i < 80; i++) {
          if (cancelled) return;
          if (w.turnstile && typeof w.turnstile.render === "function") break;
          await new Promise((r) => setTimeout(r, 100));
        }
        if (cancelled) return;
        if (!w.turnstile || typeof w.turnstile.render !== "function") return;

        const loginEl = document.getElementById("turnstile-login");
        if (loginEl && loginCaptchaOpen && !loginEl.getAttribute("data-rendered")) {
          const id = w.turnstile.render(loginEl, {
            sitekey: turnstileSiteKey,
            callback: (token: string) => {
              setLoginCaptchaToken(token);
              setLoginCaptchaOpen(false);
            },
            "expired-callback": () => setLoginCaptchaToken(""),
            "error-callback": () => setLoginCaptchaToken(""),
          });
          loginWidgetIdRef.current = id;
          loginEl.setAttribute("data-rendered", "1");
        }

        const regEl = document.getElementById("turnstile-register");
        if (regEl && regCaptchaOpen && !regEl.getAttribute("data-rendered")) {
          const id = w.turnstile.render(regEl, {
            sitekey: turnstileSiteKey,
            callback: (token: string) => {
              setRegCaptchaToken(token);
              setRegCaptchaOpen(false);
            },
            "expired-callback": () => setRegCaptchaToken(""),
            "error-callback": () => setRegCaptchaToken(""),
          });
          regWidgetIdRef.current = id;
          regEl.setAttribute("data-rendered", "1");
        }
      };

      ensureRendered();
      return () => {
        cancelled = true;
      };
    }, [turnstileSiteKey, loginCaptchaOpen, regCaptchaOpen]);

    const resetLoginCaptcha = () => {
      setLoginCaptchaToken("");
      const w = window as any;
      if (w?.turnstile && loginWidgetIdRef.current != null) {
        try {
          const widgetId = loginWidgetIdRef.current;
          if (widgetId != null) {
            w.turnstile.reset(widgetId);
          }
        } catch (err) {
          // Silently ignore if widget is not available
          console.debug("Turnstile reset failed:", err);
        }
      }
      const el = document.getElementById("turnstile-login");
      if (el) el.removeAttribute("data-rendered");
    };

    const resetRegCaptcha = () => {
      setRegCaptchaToken("");
      const w = window as any;
      if (w?.turnstile && regWidgetIdRef.current != null) {
        try {
          const widgetId = regWidgetIdRef.current;
          if (widgetId != null) {
            w.turnstile.reset(widgetId);
          }
        } catch (err) {
          // Silently ignore if widget is not available
          console.debug("Turnstile reset failed:", err);
        }
      }
      const el = document.getElementById("turnstile-register");
      if (el) el.removeAttribute("data-rendered");
    };

    const refreshMyOrders = async () => {
      if (!me?.id) return;
      setMyOrdersBusy(true);
      setMyOrdersErr(null);
      try {
        const json = await gatewayFetch("/me/orders", { method: "GET" });
        setMyOrders(json?.items || []);
      } catch (e: any) {
        setMyOrders([]);
        setMyOrdersErr(e?.message || "Failed to load orders");
      } finally {
        setMyOrdersBusy(false);
      }
    };

    const cancelOrder = async (orderId: number) => {
      setCancelBusy(orderId);
      setCancelNotification(null);
      try {
        const json = await gatewayFetch(`/me/orders/${orderId}/cancel`, { method: "PUT" });
        if (json?.item) {
          // Update the order in the local state
          setMyOrders((prev) =>
            prev.map((o) => (o.id === orderId ? { ...o, status: "CANCELED" } : o))
          );
          setCancelNotification({ type: "success", message: "Order canceled successfully" });
          // Clear notification after 3 seconds
          setTimeout(() => setCancelNotification(null), 3000);
        }
      } catch (e: any) {
        setCancelNotification({ type: "error", message: e?.message || "Failed to cancel order" });
        // Clear error notification after 5 seconds
        setTimeout(() => setCancelNotification(null), 5000);
      } finally {
        setCancelBusy(null);
      }
    };

    useEffect(() => {
      if (!me?.id) return;
      refreshMyOrders();

      // Auto-refresh user orders every 30 seconds
      const interval = setInterval(() => {
        refreshMyOrders();
      }, 30000);

      return () => clearInterval(interval);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [me?.id]);

    useEffect(() => {
      if (me) {
        setProfileEmail(me.email || "");
        setProfileFirstName((me as any).firstName || "");
        setProfileLastName((me as any).lastName || "");
      }
    }, [me]);

    useEffect(() => {
      if (typeof window === "undefined") return;
      const pending = window.localStorage.getItem("pendingVerifyEmail");
      if (pending && pending.trim()) {
        setVerifyEmail(pending.trim().toLowerCase());
        setVerifyOpen(true);
        const untilRaw = window.localStorage.getItem("verifyResendUntil") || "";
        const until = Number(untilRaw || 0);
        const left = until > 0 ? Math.ceil((until - Date.now()) / 1000) : 0;
        setResendLeft(left > 0 ? left : 0);
      }
    }, []);

    const startResendCooldown = (seconds: number) => {
      const s = Math.max(0, Math.floor(seconds));
      setResendLeft(s);
      if (typeof window !== "undefined") window.localStorage.setItem("verifyResendUntil", String(Date.now() + s * 1000));
    };

    useEffect(() => {
      if (!verifyOpen) return;
      if (resendLeft <= 0) return;
      const t = window.setInterval(() => {
        setResendLeft((s) => (s > 0 ? s - 1 : 0));
      }, 1000);
      return () => window.clearInterval(t);
    }, [verifyOpen, resendLeft]);

    // ✅ FIX: save token after login
    const doLogin = async () => {
      setAuthBusy(true);
      setAuthError(null);
      try {
        const json = await gatewayFetch("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email: loginEmail, password: loginPassword, captchaToken: loginCaptchaToken }),
        });

        if (json?.token) window.localStorage.setItem("token", json.token);

        // Clear form data from localStorage after successful login
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("loginEmail");
          window.localStorage.removeItem("loginPassword");
        }
        setLoginEmail("");
        setLoginPassword("");

        await refreshMe();
      } catch (e: any) {
        const msg = e?.message || "Login failed";
        setAuthError(msg);
        if (String(msg).toLowerCase().includes("email not verified")) {
          setVerifyEmail(loginEmail.trim().toLowerCase());
          setVerifyCode("");
          setVerifyErr(null);
          setVerifyOk("A verification code was sent to your email.");
          if (typeof window !== "undefined") window.localStorage.setItem("pendingVerifyEmail", loginEmail.trim().toLowerCase());
          setVerifyOpen(true);
          startResendCooldown(30);
        }
      } finally {
        setAuthBusy(false);
      }
    };

    // ✅ FIX: save token after register
    const doRegister = async () => {
      setAuthBusy(true);
      setAuthError(null);
      try {
        const json = await gatewayFetch("/auth/register", {
          method: "POST",
          body: JSON.stringify({ email: regEmail, password: regPassword, captchaToken: regCaptchaToken }),
        });

        // If backend requires email verification, it may return needsVerification.
        // Also treat "ok without token" as a verification-required response.
        if (json?.needsVerification || (json?.ok && !json?.token)) {
          setVerifyEmail(String(json?.email || regEmail).trim().toLowerCase());
          setVerifyCode("");
          setVerifyErr(null);
          setVerifyOk("A verification code was sent to your email.");
          if (typeof window !== "undefined") window.localStorage.setItem("pendingVerifyEmail", String(json?.email || regEmail).trim().toLowerCase());
          setVerifyOpen(true);
          startResendCooldown(30);
          return;
        }

        if (json?.token) window.localStorage.setItem("token", json.token);
        await refreshMe();
      } catch (e: any) {
        setAuthError(e?.message || "Register failed");
      } finally {
        setAuthBusy(false);
      }
    };

    const doVerifyEmail = async () => {
      setVerifyBusy(true);
      setVerifyErr(null);
      try {
        const json = await gatewayFetch("/auth/verify-email", {
          method: "POST",
          body: JSON.stringify({ email: verifyEmail.trim(), code: verifyCode.trim() }),
        });

        if (json?.token) window.localStorage.setItem("token", json.token);
        setVerifyOk("Email verified.");
        setVerifyOpen(false);
        if (typeof window !== "undefined") window.localStorage.removeItem("pendingVerifyEmail");
        setVerifyCode("");
        await refreshMe();
      } catch (e: any) {
        setVerifyErr(e?.message || "Verification failed");
      } finally {
        setVerifyBusy(false);
      }
    };

    const doResendVerify = async () => {
      setVerifyBusy(true);
      setVerifyErr(null);
      try {
        const captchaToken = regCaptchaToken || loginCaptchaToken || "";
        await gatewayFetch("/auth/resend-verification", {
          method: "POST",
          body: JSON.stringify({ email: verifyEmail.trim(), captchaToken }),
        });
        setVerifyOk("A new code was sent.");
        startResendCooldown(30);
      } catch (e: any) {
        setVerifyErr(e?.message || "Failed to resend code");
      } finally {
        setVerifyBusy(false);
      }
    };

    // ✅ FIX: remove token on logout
    const doLogout = async () => {
      setAuthBusy(true);
      setAuthError(null);
      try {
        await gatewayFetch("/auth/logout", { method: "POST" });
        window.localStorage.removeItem("token");
        setMe(null);
      } catch (e: any) {
        setAuthError(e?.message || "Logout failed");
      } finally {
        setAuthBusy(false);
      }
    };

    const doChangePassword = async () => {
      setPwErr(null);
      setPwOk(null);
      if (!pwOld.trim() || !pwNew.trim() || !pwNew2.trim()) return setPwErr("Please fill all fields");
      if (pwNew.trim().length < 6) return setPwErr("New password must be at least 6 characters");
      if (pwNew !== pwNew2) return setPwErr("New passwords do not match");
      setPwBusy(true);
      try {
        await gatewayFetch("/auth/password", {
          method: "PUT",
          body: JSON.stringify({ oldPassword: pwOld, newPassword: pwNew }),
        });
        setPwOk("Password updated");
        setPwOld("");
        setPwNew("");
        setPwNew2("");
      } catch (e: any) {
        setPwErr(e?.message || "Failed to update password");
      } finally {
        setPwBusy(false);
      }
    };

    const doForgotPassword = async () => {
      setFpErr(null);
      setFpOk(null);
      if (!fpEmail.trim()) return setFpErr("Enter your email");
      setFpBusy(true);
      try {
        await gatewayFetch("/auth/forgot-password", {
          method: "POST",
          body: JSON.stringify({ email: fpEmail.trim() }),
        });
        setFpOk("If the email exists, a reset code was sent.");
      } catch (e: any) {
        setFpErr(e?.message || "Failed to request reset");
      } finally {
        setFpBusy(false);
      }
    };

    const doResetPassword = async () => {
      setRpErr(null);
      setRpOk(null);
      if (!rpToken.trim()) return setRpErr("Paste the reset code");
      if (!rpPw1.trim() || !rpPw2.trim()) return setRpErr("Enter new password");
      if (rpPw1.trim().length < 6) return setRpErr("New password must be at least 6 characters");
      if (rpPw1 !== rpPw2) return setRpErr("New passwords do not match");
      setRpBusy(true);
      try {
        await gatewayFetch("/auth/reset-password", {
          method: "PUT",
          body: JSON.stringify({ token: rpToken.trim(), newPassword: rpPw1 }),
        });
        setRpOk("Password reset. You can sign in now.");
        setRpToken("");
        setRpPw1("");
        setRpPw2("");
      } catch (e: any) {
        setRpErr(e?.message || "Failed to reset password");
      } finally {
        setRpBusy(false);
      }
    };

    return (
      <section className="max-w-5xl mx-auto px-6 py-12">
        <style>{`
          input::-ms-reveal, input::-ms-clear { display: none; }
          input[type="password"]::-webkit-credentials-auto-fill-button,
          input[type="password"]::-webkit-contacts-auto-fill-button {
            visibility: hidden;
            display: none !important;
            pointer-events: none;
            position: absolute;
            right: 0;
          }
        `}</style>
        <div className="grid lg:grid-cols-2 gap-8 items-start">
          {verifyOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-slate-900">Verify email</div>
                    <div className="text-sm text-slate-600 mt-1">Enter the 6-digit code sent to {verifyEmail || "your email"}.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setVerifyOpen(false);
                      if (typeof window !== "undefined") window.localStorage.removeItem("pendingVerifyEmail");
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>

                {verifyErr ? <div className="mt-3 text-sm text-red-700">{verifyErr}</div> : null}
                {verifyOk ? <div className="mt-3 text-sm text-emerald-700">{verifyOk}</div> : null}

                <div className="mt-4 space-y-2">
                  <input value={verifyEmail} onChange={(e) => setVerifyEmail(e.target.value)} placeholder="Email" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                  <input value={verifyCode} onChange={(e) => setVerifyCode(e.target.value)} placeholder="6-digit code" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                  <div className="flex gap-2">
                    <button disabled={verifyBusy || !verifyEmail.trim() || verifyCode.trim().length !== 6} onClick={doVerifyEmail} className="flex-1 rounded-xl bg-emerald-600 text-white py-3 text-sm hover:bg-emerald-700 disabled:opacity-60">
                      Verify
                    </button>
                    <button
                      disabled={verifyBusy || !verifyEmail.trim() || resendLeft > 0}
                      onClick={doResendVerify}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm hover:bg-slate-50 disabled:opacity-60"
                    >
                      {resendLeft > 0 ? `Resend (${resendLeft}s)` : "Resend"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <Card className="p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xl font-semibold text-slate-900">Login</div>
                <div className="text-sm text-slate-600 mt-1">Access your orders and wishlist.</div>
              </div>
              {me ? <div className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-1 rounded-full">Logged in</div> : null}
            </div>

            {authError ? <div className="mt-4 text-sm text-red-700">{authError}</div> : null}

            {me ? (
              <div className="mt-5 space-y-3">
                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                  <div className="text-sm font-semibold text-slate-900">{(me as any).firstName || me.email}</div>
                  <div className="text-xs text-slate-500 mt-1">{me.email}</div>

                  {/* ✅ FIX: role from me.role */}
                  <div className="text-xs text-slate-500 mt-1">{me.role === "ADMIN" ? "Role: Admin" : me.role === "AGENT" ? "Role: Agent" : "Role: Customer"}</div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">Edit profile</div>
                  {profileErr ? <div className="mt-2 text-sm text-red-700">{profileErr}</div> : null}
                  {profileOk ? <div className="mt-2 text-sm text-emerald-700">{profileOk}</div> : null}
                  <div className="mt-3 space-y-2">
                    <input
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      type="email"
                      placeholder="Email address"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    />
                    <input
                      value={profileFirstName}
                      onChange={(e) => setProfileFirstName(e.target.value)}
                      placeholder="First name (optional)"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    />
                    <input
                      value={profileLastName}
                      onChange={(e) => setProfileLastName(e.target.value)}
                      placeholder="Last name (optional)"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    />
                    <button
                      disabled={profileBusy || !profileEmail.trim()}
                      onClick={async () => {
                        setProfileBusy(true);
                        setProfileErr(null);
                        setProfileOk(null);
                        try {
                          const json = await gatewayFetch("/auth/profile", {
                            method: "PUT",
                            body: JSON.stringify({
                              email: profileEmail.trim(),
                              firstName: profileFirstName.trim() || undefined,
                              lastName: profileLastName.trim() || undefined
                            })
                          });
                          if (json?.user) {
                            setProfileOk("Profile updated successfully");
                            await refreshMe();
                            setTimeout(() => setProfileOk(null), 3000);
                          }
                        } catch (e: any) {
                          setProfileErr(e?.message || "Failed to update profile");
                        } finally {
                          setProfileBusy(false);
                        }
                      }}
                      className="w-full rounded-xl bg-slate-900 text-white py-3 text-sm hover:bg-black disabled:opacity-60"
                    >
                      Update profile
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">Change password</div>
                  {pwErr ? <div className="mt-2 text-sm text-red-700">{pwErr}</div> : null}
                  {pwOk ? <div className="mt-2 text-sm text-emerald-700">{pwOk}</div> : null}
                  <form
                    className="mt-3 space-y-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      doChangePassword();
                    }}
                  >
                    <div className="relative">
                      <input
                        value={pwOld}
                        onChange={(e) => setPwOld(e.target.value)}
                        type={pwOldVisible ? "text" : "password"}
                        placeholder="Current password"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setPwOldVisible((v) => !v)}
                        className="absolute inset-y-0 right-0 flex items-center justify-center px-4 text-slate-500 hover:text-slate-700"
                        aria-label={pwOldVisible ? "Hide password" : "Show password"}
                      >
                        {pwOldVisible ? (
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <path d="M10.6 10.6a3 3 0 004.2 4.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <path d="M9.9 5.1A10.9 10.9 0 0112 5c6 0 10 7 10 7a17.4 17.4 0 01-3.2 3.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <path d="M6.3 6.3C3.9 8.3 2 12 2 12s4 7 10 7c1.4 0 2.7-.3 3.8-.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth="2" />
                            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                          </svg>
                        )}
                      </button>
                    </div>

                    <div className="relative">
                      <input
                        value={pwNew}
                        onChange={(e) => setPwNew(e.target.value)}
                        type={pwNewVisible ? "text" : "password"}
                        placeholder="New password"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setPwNewVisible((v) => !v)}
                        className="absolute inset-y-0 right-0 flex items-center justify-center px-4 text-slate-500 hover:text-slate-700"
                        aria-label={pwNewVisible ? "Hide password" : "Show password"}
                      >
                        {pwNewVisible ? (
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <path d="M10.6 10.6a3 3 0 004.2 4.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <path d="M9.9 5.1A10.9 10.9 0 0112 5c6 0 10 7 10 7a17.4 17.4 0 01-3.2 3.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <path d="M6.3 6.3C3.9 8.3 2 12 2 12s4 7 10 7c1.4 0 2.7-.3 3.8-.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth="2" />
                            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                          </svg>
                        )}
                      </button>
                    </div>

                    <div className="relative">
                      <input
                        value={pwNew2}
                        onChange={(e) => setPwNew2(e.target.value)}
                        type={pwNew2Visible ? "text" : "password"}
                        placeholder="Repeat new password"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setPwNew2Visible((v) => !v)}
                        className="absolute inset-y-0 right-0 flex items-center justify-center px-4 text-slate-500 hover:text-slate-700"
                        aria-label={pwNew2Visible ? "Hide password" : "Show password"}
                      >
                        {pwNew2Visible ? (
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <path d="M10.6 10.6a3 3 0 004.2 4.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <path d="M9.9 5.1A10.9 10.9 0 0112 5c6 0 10 7 10 7a17.4 17.4 0 01-3.2 3.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <path d="M6.3 6.3C3.9 8.3 2 12 2 12s4 7 10 7c1.4 0 2.7-.3 3.8-.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth="2" />
                            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                          </svg>
                        )}
                      </button>
                    </div>
                    <button type="submit" disabled={pwBusy} className="w-full rounded-xl bg-emerald-600 text-white py-3 text-sm hover:bg-emerald-700 disabled:opacity-60">
                      Update password
                    </button>
                  </form>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">My orders</div>
                      <div className="text-xs text-slate-600 mt-1">Track the status of your requests.</div>
                    </div>
                    <button
                      type="button"
                      onClick={refreshMyOrders}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50 disabled:opacity-60"
                      disabled={myOrdersBusy}
                    >
                      Refresh
                    </button>
                  </div>

                  {myOrdersErr ? <div className="mt-3 text-sm text-red-700">{myOrdersErr}</div> : null}
                  {myOrdersBusy ? <div className="mt-3 text-sm text-slate-600">Loading…</div> : null}
                  
                  {cancelNotification ? (
                    <div className={`mt-3 text-sm ${
                      cancelNotification.type === "success" 
                        ? "text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl" 
                        : "text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-xl"
                    }`}>
                      {cancelNotification.message}
                    </div>
                  ) : null}

                  {!myOrdersBusy && myOrders.length === 0 ? (
                    <div className="mt-3 text-sm text-slate-600">No orders yet.</div>
                  ) : null}

                  <div className="mt-3 space-y-2">
                    {myOrders.map((o) => (
                      <div key={o.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-slate-900 truncate">{o?.product?.title || "Order"}</div>
                            <div className="text-xs text-slate-500 mt-1">
                              Order #{o.id}
                              {o?.createdAt ? ` • ${new Date(o.createdAt).toLocaleString()}` : ""}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              {o?.purchaseTerm ? `Term: ${o.purchaseTerm}` : ""}
                              {o?.selectedType ? ` • Plan: ${o.selectedType}` : ""}
                            </div>
                            {(o.status === "REQUESTED" || !o.status) && (
                              <button
                                type="button"
                                onClick={() => cancelOrder(o.id)}
                                disabled={cancelBusy === o.id}
                                className="mt-2 rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                {cancelBusy === o.id ? "Canceling..." : "Cancel"}
                              </button>
                            )}
                          </div>
                          <div className="shrink-0">
                            <div
                              className={`text-xs font-medium px-2 py-1 rounded-full border ${
                                o.status === "CONFIRMED"
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-100"
                                  : o.status === "REJECTED"
                                    ? "bg-red-50 text-red-800 border-red-100"
                                    : o.status === "CANCELED"
                                      ? "bg-orange-50 text-orange-800 border-orange-100"
                                      : "bg-slate-100 text-slate-700 border-slate-200"
                              }`}
                            >
                              {o.status || "REQUESTED"}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button disabled={authBusy} onClick={doLogout} className="w-full rounded-xl border border-slate-200 bg-white py-3 text-sm hover:bg-slate-50 disabled:opacity-60">
                  Logout
                </button>
              </div>
            ) : (
              <form
                className="mt-5 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  // Don't submit login form if reset password section is open
                  if (fpOpen) {
                    return;
                  }
                  doLogin();
                }}
              >
                <input
                  value={loginEmail}
                  onChange={(e) => {
                    const value = e.target.value;
                    setLoginEmail(value);
                    if (typeof window !== "undefined") {
                      window.localStorage.setItem("loginEmail", value);
                    }
                  }}
                  placeholder="Email"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                />
                <div className="relative">
                  <input
                    value={loginPassword}
                    onChange={(e) => {
                      const value = e.target.value;
                      setLoginPassword(value);
                      if (typeof window !== "undefined") {
                        window.localStorage.setItem("loginPassword", value);
                      }
                    }}
                    type={loginPwVisible ? "text" : "password"}
                    placeholder="Password"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setLoginPwVisible((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center justify-center px-4 text-slate-500 hover:text-slate-700"
                    aria-label={loginPwVisible ? "Hide password" : "Show password"}
                  >
                    {loginPwVisible ? (
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <path d="M10.6 10.6a3 3 0 004.2 4.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <path d="M9.9 5.1A10.9 10.9 0 0112 5c6 0 10 7 10 7a17.4 17.4 0 01-3.2 3.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <path d="M6.3 6.3C3.9 8.3 2 12 2 12s4 7 10 7c1.4 0 2.7-.3 3.8-.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth="2" />
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                      </svg>
                    )}
                  </button>
                </div>

                {turnstileSiteKey ? (
                  <div className="flex items-center justify-between gap-3">
                    {loginCaptchaToken ? (
                      <div className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-1 rounded-full">Verified ✅</div>
                    ) : (
                      <div className="text-xs text-slate-500">Verification required</div>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          resetLoginCaptcha();
                          setLoginCaptchaOpen(true);
                        }}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50"
                      >
                        {loginCaptchaToken ? "Re-verify" : "Verify"}
                      </button>
                      {loginCaptchaToken ? (
                        <button
                          type="button"
                          onClick={resetLoginCaptcha}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50"
                        >
                          Reset
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  null
                )}

                {turnstileSiteKey ? (
                  <div
                    style={{ display: loginCaptchaOpen ? "flex" : "none" }}
                    className="fixed inset-0 z-50 items-center justify-center bg-black/40 p-4"
                    onClick={() => setLoginCaptchaOpen(false)}
                  >
                    <div
                      className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">Verify you are human</div>
                          <div className="text-xs text-slate-600 mt-1">Complete the challenge to continue.</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setLoginCaptchaOpen(false)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50"
                        >
                          Close
                        </button>
                      </div>
                      <div className="mt-4">
                        <div id="turnstile-login" className="w-full" />
                      </div>
                    </div>
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={authBusy || (turnstileSiteKey ? !loginCaptchaToken : false)}
                  className="w-full rounded-xl bg-slate-900 text-white py-3 text-sm hover:bg-black disabled:opacity-60"
                >
                  Sign in
                </button>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setFpOpen((v) => !v);
                      setFpErr(null);
                      setFpOk(null);
                      setRpErr(null);
                      setRpOk(null);
                    }}
                    className="text-xs text-slate-600 hover:text-slate-900"
                  >
                    Forgot password?
                  </button>
                </div>

                {fpOpen ? (
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-sm font-semibold text-slate-900">Reset password</div>
                    <div className="mt-1 text-xs text-slate-600">We will send you a reset code (dev-mode prints to backend console if SMTP is not configured).</div>

                    {fpErr ? <div className="mt-2 text-sm text-red-700">{fpErr}</div> : null}
                    {fpOk ? <div className="mt-2 text-sm text-emerald-700">{fpOk}</div> : null}

                    <div className="mt-3 flex gap-2">
                      <input value={fpEmail} onChange={(e) => setFpEmail(e.target.value)} placeholder="Email" className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                      <button disabled={fpBusy} onClick={doForgotPassword} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm hover:bg-slate-50 disabled:opacity-60">
                        Send
                      </button>
                    </div>

                    <div className="mt-3 grid gap-2">
                      {rpErr ? <div className="text-sm text-red-700">{rpErr}</div> : null}
                      {rpOk ? <div className="text-sm text-emerald-700">{rpOk}</div> : null}
                      <input 
                        value={rpToken} 
                        onChange={(e) => setRpToken(e.target.value)} 
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            e.stopPropagation();
                            doResetPassword();
                          }
                        }}
                        placeholder="Reset code" 
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" 
                      />
                      <div className="relative">
                        <input
                          value={rpPw1}
                          onChange={(e) => setRpPw1(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              e.stopPropagation();
                              doResetPassword();
                            }
                          }}
                          type={rpPw1Visible ? "text" : "password"}
                          placeholder="New password"
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setRpPw1Visible((v) => !v)}
                          className="absolute inset-y-0 right-0 flex items-center justify-center px-4 text-slate-500 hover:text-slate-700"
                          aria-label={rpPw1Visible ? "Hide password" : "Show password"}
                        >
                          {rpPw1Visible ? (
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                              <path d="M10.6 10.6a3 3 0 004.2 4.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                              <path d="M9.9 5.1A10.9 10.9 0 0112 5c6 0 10 7 10 7a17.4 17.4 0 01-3.2 3.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                              <path d="M6.3 6.3C3.9 8.3 2 12 2 12s4 7 10 7c1.4 0 2.7-.3 3.8-.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth="2" />
                              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                            </svg>
                          )}
                        </button>
                      </div>

                      <div className="relative">
                        <input
                          value={rpPw2}
                          onChange={(e) => setRpPw2(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              e.stopPropagation();
                              doResetPassword();
                            }
                          }}
                          type={rpPw2Visible ? "text" : "password"}
                          placeholder="Repeat new password"
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setRpPw2Visible((v) => !v)}
                          className="absolute inset-y-0 right-0 flex items-center justify-center px-4 text-slate-500 hover:text-slate-700"
                          aria-label={rpPw2Visible ? "Hide password" : "Show password"}
                        >
                          {rpPw2Visible ? (
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                              <path d="M10.6 10.6a3 3 0 004.2 4.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                              <path d="M9.9 5.1A10.9 10.9 0 0112 5c6 0 10 7 10 7a17.4 17.4 0 01-3.2 3.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                              <path d="M6.3 6.3C3.9 8.3 2 12 2 12s4 7 10 7c1.4 0 2.7-.3 3.8-.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth="2" />
                              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                            </svg>
                          )}
                        </button>
                      </div>
                      <button disabled={rpBusy} onClick={doResetPassword} className="w-full rounded-xl bg-emerald-600 text-white py-3 text-sm hover:bg-emerald-700 disabled:opacity-60">
                        Set new password
                      </button>
                    </div>
                  </div>
                ) : null}
              </form>
            )}
          </Card>

          {!me && (
          <Card className="p-6">
            <div className="text-xl font-semibold text-slate-900">Create account</div>
            <div className="text-sm text-slate-600 mt-1">Register to save your order history.</div>
            <form
              className="mt-5 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                doRegister();
              }}
            >
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
              <input value={regEmail} onChange={(e) => setRegEmail(e.target.value)} placeholder="Email" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
              <div className="relative">
                <input
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  type={regPwVisible ? "text" : "password"}
                  placeholder="Password"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setRegPwVisible((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center justify-center px-4 text-slate-500 hover:text-slate-700"
                  aria-label={regPwVisible ? "Hide password" : "Show password"}
                >
                  {regPwVisible ? (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M10.6 10.6a3 3 0 004.2 4.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M9.9 5.1A10.9 10.9 0 0112 5c6 0 10 7 10 7a17.4 17.4 0 01-3.2 3.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M6.3 6.3C3.9 8.3 2 12 2 12s4 7 10 7c1.4 0 2.7-.3 3.8-.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth="2" />
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  )}
                </button>
              </div>

              {turnstileSiteKey ? (
                <div className="flex items-center justify-between gap-3">
                  {regCaptchaToken ? (
                    <div className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-1 rounded-full">Verified ✅</div>
                  ) : (
                    <div className="text-xs text-slate-500">Verification required</div>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        resetRegCaptcha();
                        setRegCaptchaOpen(true);
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50"
                    >
                      {regCaptchaToken ? "Re-verify" : "Verify"}
                    </button>
                    {regCaptchaToken ? (
                      <button
                        type="button"
                        onClick={resetRegCaptcha}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50"
                      >
                        Reset
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : (
                null
              )}

              {turnstileSiteKey ? (
                <div
                  style={{ display: regCaptchaOpen ? "flex" : "none" }}
                  className="fixed inset-0 z-50 items-center justify-center bg-black/40 p-4"
                  onClick={() => setRegCaptchaOpen(false)}
                >
                  <div
                    className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">Verify you are human</div>
                        <div className="text-xs text-slate-600 mt-1">Complete the challenge to continue.</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRegCaptchaOpen(false)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50"
                      >
                        Close
                      </button>
                    </div>
                    <div className="mt-4">
                      <div id="turnstile-register" className="w-full" />
                    </div>
                  </div>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={authBusy || (turnstileSiteKey ? !regCaptchaToken : false)}
                className="w-full rounded-xl bg-emerald-600 text-white py-3 text-sm hover:bg-emerald-700 disabled:opacity-60"
              >
                Create account
              </button>
            </form>
          </Card>
          )}
        </div>
      </section>
    );
  };


  const Cart = () => {
    const lines = cartItems.map((it) => {
      // Use the price and license type the user selected when adding to cart
      let unitPrice = it.unitPrice || 0;
      let productType = it.productType || "Personal";

      // Only derive from product for legacy items (no productType or missing unitPrice)
      if (unitPrice <= 0 || !it.productType) {
        const product = products.find((p) => p.id === it.productId);
        if (product) {
          const businessPrice = String((product as any).businessPrice || "").trim();
          const personalPrice = String((product as any).personalPrice || "").trim();
          const hasBusiness = businessPrice && businessPrice !== "" && businessPrice !== "Price on request";
          const hasPersonal = personalPrice && personalPrice !== "" && personalPrice !== "Price on request";
          if (hasPersonal) {
            unitPrice = parsePriceToNumber(personalPrice);
            productType = "Personal";
          } else if (hasBusiness) {
            unitPrice = parsePriceToNumber(businessPrice);
            productType = "Business";
          } else {
            unitPrice = parsePriceToNumber(product.price);
            productType = "Personal";
          }
        }
      }

      return {
        ...it,
        unitPrice,
        productType,
        subtotal: unitPrice * (it.qty || 0),
      };
    });

    return (
      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <SectionTitle title={t("header.cart")} subtitle="Add products, change quantity, then place your order." />
          <button onClick={() => setPage("shop")} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50">
            Continue shopping
          </button>
        </div>

        <div className="mt-6 grid lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2">
            <Card className="p-6">
              {lines.length === 0 ? (
                <div className="text-sm text-slate-600">Your cart is empty.</div>
              ) : (
                <div className="space-y-4">
                  {lines.map((it, idx) => (
                    <div key={`${it.productId}-${it.productType || 'default'}-${idx}`} className="flex items-center justify-between gap-4 border border-slate-200 rounded-2xl p-4 bg-white">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate">{it.title}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          Unit: {formatMoney(it.unitPrice)}
                          {it.productType && <span className="ml-2 text-emerald-700">({it.productType})</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCartQty(it.productId, (it.qty || 1) - 1, it.productType)}
                          className="h-9 w-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                          aria-label="Decrease"
                        >
                          −
                        </button>
                        <input
                          value={String(it.qty)}
                          onChange={(e) => setCartQty(it.productId, Number(e.target.value), it.productType)}
                          className="w-16 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-center"
                          inputMode="numeric"
                        />
                        <button
                          onClick={() => setCartQty(it.productId, (it.qty || 0) + 1, it.productType)}
                          className="h-9 w-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                          aria-label="Increase"
                        >
                          +
                        </button>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-semibold text-slate-900">{formatMoney(it.subtotal)}</div>
                        <button onClick={() => removeFromCart(it.productId, it.productType)} className="mt-1 text-xs text-red-600 hover:underline">
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="flex items-center justify-between">
                    <button onClick={clearCart} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50">
                      Clear cart
                    </button>
                    <div className="text-sm text-slate-700">
                      Total: <span className="font-semibold text-slate-900">{formatMoney(cartTotal)}</span>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>

          <div>
            <SectionTitle title="Order total" />
            <Card className="p-6">
              <div className="text-sm text-slate-700 flex items-center justify-between">
                <span>Items</span>
                <span className="font-medium text-slate-900">{cartCount}</span>
              </div>
              <div className="text-sm text-slate-700 flex items-center justify-between mt-2">
                <span>Total</span>
                <span className="font-semibold text-slate-900">{formatMoney(cartTotal)}</span>
              </div>

              <div className="mt-5 flex flex-col gap-2">
                <button
                  onClick={() => {
                    if (!guardCheckout()) return;
                    if (cartItems.length === 0) return;
                    setPage("checkout");
                  }}
                  disabled={cartItems.length === 0}
                  className="rounded-xl bg-emerald-600 text-white px-6 py-3 text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
                >
                  Order now
                </button>
                <button onClick={() => setPage("shop")} className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm hover:bg-slate-50">
                  Back to shop
                </button>
              </div>
            </Card>
          </div>
        </div>
      </section>
    );
  };

  // ✅ Checkout and other pages unchanged from your code
  const Checkout = () => {
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [country, setCountry] = useState("");
    const [city, setCity] = useState("");
    const [street, setStreet] = useState("");
    const [zip, setZip] = useState("");
    const [notes, setNotes] = useState("");
    const [busy, setBusy] = useState(false);
    const [sent, setSent] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    
    // Local selectedType for checkout to prevent form reset
    // Initialize from cart items if available
    const [checkoutSelectedType, setCheckoutSelectedType] = useState<"Personal" | "Business">(() => {
      if (cartItems.length > 0 && cartItems[0].productType) {
        return cartItems[0].productType;
      }
      return selectedType;
    });

    // Keep checkout type in sync with cart: when all items have the same type (e.g. all Business),
    // use that type so "Business" selected at add-to-cart is not lost when user goes to checkout
    useEffect(() => {
      if (cartItems.length === 0) return;
      const types = [...new Set(cartItems.map((it) => it.productType).filter(Boolean))];
      if (types.length === 1 && (types[0] === "Personal" || types[0] === "Business")) {
        setCheckoutSelectedType(types[0]);
      }
    }, [cartItems]);

    // Legal agreements checkboxes
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
    const [acceptedRefund, setAcceptedRefund] = useState(false);
    
    // Coupon state
    const [couponCode, setCouponCode] = useState("");
    const [appliedCoupon, setAppliedCoupon] = useState<CouponT | null>(null);
    const [couponLoading, setCouponLoading] = useState(false);
    const [couponError, setCouponError] = useState<string | null>(null);

    // Check if all cart items support both Personal and Business pricing
    const canSwitchType = useMemo(() => {
      // Check if any cart item comes from a product with both prices
      return cartItems.every((it) => {
        const product = products.find((p) => p.id === it.productId);
        if (!product) return !!it.personalUnitPrice && !!it.businessUnitPrice;
        const hasPersonal = !!(product as any).personalPrice;
        const hasBusiness = !!(product as any).businessPrice;
        return hasPersonal && hasBusiness;
      });
    }, [cartItems, products]);

    const checkoutLines = useMemo(() => {
      return cartItems.map((it) => {
        // Use the price and license type the user selected when adding to cart
        let unitPrice = it.unitPrice || 0;
        let productType = it.productType || "Personal";

        // Only derive from product for legacy items (no productType or missing unitPrice)
        if (unitPrice <= 0 || !it.productType) {
          const product = products.find((p) => p.id === it.productId);
          if (product) {
            const businessPrice = String((product as any).businessPrice || "").trim();
            const personalPrice = String((product as any).personalPrice || "").trim();
            const hasBusiness = businessPrice && businessPrice !== "" && businessPrice !== "Price on request";
            const hasPersonal = personalPrice && personalPrice !== "" && personalPrice !== "Price on request";
            const typeToUse = checkoutSelectedType;
            if (typeToUse === "Business" && hasBusiness) {
              unitPrice = parsePriceToNumber(businessPrice);
              productType = "Business";
            } else if (hasPersonal) {
              unitPrice = parsePriceToNumber(personalPrice);
              productType = "Personal";
            } else if (hasBusiness) {
              unitPrice = parsePriceToNumber(businessPrice);
              productType = "Business";
            } else {
              unitPrice = parsePriceToNumber(product.price);
              productType = "Personal";
            }
          }
        } else if (it.personalUnitPrice != null || it.businessUnitPrice != null) {
          // Pricing-plan items: use stored price by type
          productType = it.productType || "Personal";
          unitPrice = productType === "Business"
            ? (it.businessUnitPrice ?? it.unitPrice ?? 0)
            : (it.personalUnitPrice ?? it.unitPrice ?? 0);
        }

        return {
          ...it,
          unitPrice,
          productType,
          subtotal: unitPrice * (it.qty || 0),
        };
      });
    }, [cartItems, checkoutSelectedType, products]);
    
    // Calculate discount from coupon (only on eligible products when coupon is product-specific)
    const discountAmount = useMemo(() => {
      if (!appliedCoupon || checkoutLines.length === 0) return 0;

      const fullSubtotal = checkoutLines.reduce((acc, it) => acc + it.subtotal, 0);
      const applicableIds = Array.isArray(appliedCoupon.applicableProductIds) ? appliedCoupon.applicableProductIds : [];

      // When coupon applies to selected products only, discount only eligible line items
      const eligibleSubtotal = appliedCoupon.appliesToAll
        ? fullSubtotal
        : checkoutLines
            .filter((it) => applicableIds.includes(it.productId))
            .reduce((acc, it) => acc + it.subtotal, 0);

      if (eligibleSubtotal <= 0) return 0;

      // Min purchase is checked against full cart subtotal
      if (fullSubtotal < (appliedCoupon.minPurchase || 0)) return 0;

      if (appliedCoupon.discountType === "PERCENTAGE") {
        return (eligibleSubtotal * appliedCoupon.discountValue) / 100;
      }
      return Math.min(appliedCoupon.discountValue, eligibleSubtotal);
    }, [appliedCoupon, checkoutLines]);
    
    const checkoutTotal = checkoutLines.reduce((acc, it) => acc + it.subtotal, 0) - discountAmount;

    const applyCoupon = async () => {
      if (!couponCode.trim()) return;
      setCouponLoading(true);
      setCouponError(null);
      try {
        const json = await gatewayFetch("/coupons/validate", {
          method: "POST",
          body: JSON.stringify({
            code: couponCode.trim(),
            productIds: checkoutLines.map((it) => it.productId),
          }),
        });
        if (json?.valid && json?.coupon) {
          setAppliedCoupon(json.coupon);
          setCouponCode("");
        }
      } catch (e: any) {
        setCouponError(e?.message || "Invalid coupon");
        setAppliedCoupon(null);
      } finally {
        setCouponLoading(false);
      }
    };

    const removeCoupon = () => {
      setAppliedCoupon(null);
      setCouponError(null);
    };

    const isEmailValid = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
    const isPhoneValid = (v: string) => {
      const cleaned = v.replace(/[^0-9+]/g, "");
      return cleaned.length >= 6;
    };

    const submit = async () => {
      console.log("[Checkout] submit started", {
        cartItemsCount: cartItems.length,
        productIds: cartItems.map((it) => it.productId),
      });
      setBusy(true);
      setErr(null);
      setSent(false);
      try {
        if (cartItems.length === 0) {
          alert(t("order.error.selectProduct"));
          setBusy(false);
          return;
        }
        if (!fullName.trim()) {
          alert(t("order.error.fullNameRequired"));
          setBusy(false);
          return;
        }
        if (!email.trim() || !isEmailValid(email)) {
          alert(t("order.error.invalidEmail"));
          setBusy(false);
          return;
        }
        if (!phone.trim() || !isPhoneValid(phone)) {
          alert(t("order.error.invalidPhone"));
          setBusy(false);
          return;
        }
        if (!country.trim()) {
          alert(t("order.error.countryRequired"));
          setBusy(false);
          return;
        }
        if (!city.trim()) {
          alert(t("order.error.cityRequired"));
          setBusy(false);
          return;
        }
        if (!street.trim()) {
          alert(t("order.error.streetRequired"));
          setBusy(false);
          return;
        }
        if (!zip.trim() || zip.trim().length < 3) {
          alert(t("order.error.zipRequired"));
          setBusy(false);
          return;
        }
        if (!acceptedTerms || !acceptedPrivacy || !acceptedRefund) {
          alert("Please accept the Terms of Service, Privacy Policy, and Return & Refund Policy to place your order.");
          setBusy(false);
          return;
        }
        const licenseLine = checkoutSelectedType === "Business" ? "This license is for multiple PCs." : "License for one PC.";

        console.log("[Checkout] validation passed, sending POST /orders");
        const checkoutSubtotal = checkoutLines.reduce((acc, it) => acc + it.subtotal, 0);
        // Send order request and wait for response (orderSummary so email shows correct subtotal/discount/total)
        const response = await gatewayFetch("/orders", {
          method: "POST",
          body: JSON.stringify({
            items: cartItems.map((it) => ({
              productId: it.productId,
              qty: it.qty,
              productType: it.productType || checkoutSelectedType,
            })),
            purchaseTerm: purchaseTerm === "annual" ? "ANNUAL" : "LIFETIME",
            selectedType: checkoutSelectedType,
            customerName: fullName.trim(),
            customerEmail: email.trim(),
            customerPhone: phone.trim(),
            country: country.trim(),
            city: city.trim(),
            street: street.trim(),
            zip: zip.trim(),
            notes: `${licenseLine}${notes.trim() ? `\n${notes}` : ""}${appliedCoupon ? `\n[Coupon: ${appliedCoupon.code}]` : ""}`,
            orderSummary: {
              subtotal: checkoutSubtotal,
              discount: discountAmount,
              total: checkoutTotal,
            },
          }),
        });

        console.log("[Checkout] POST /orders returned", {
          hasResponse: !!response,
          hasOrder: !!(response && response.order),
          orderId: response?.order?.id,
          responseKeys: response ? Object.keys(response) : [],
        });
        // Only proceed if we got a successful response
        if (response && response.order) {
          console.log("[Checkout] success path", { orderId: response.order.id });
          setSent(true);
          // Show success alert
          alert("Place order successfully");
          window.scrollTo({top:0, behavior:"smooth"});
          setErr(null);

          // Clear form fields
          setFullName("");
          setEmail("");
          setPhone("");
          setCountry("");
          setCity("");
          setStreet("");
          setZip("");
          setNotes("");
          setAppliedCoupon(null);
          setCouponCode("");
          setAcceptedTerms(false);
          setAcceptedPrivacy(false);
          setAcceptedRefund(false);
          
          // Clear cart after successful order
          clearCart();
        } else {
          console.warn("[Checkout] invalid response from server", { response });
          throw new Error("Invalid response from server");
        }
      } catch (e: any) {
        console.error("[Checkout] submit error", {
          message: e?.message,
          status: e?.status,
          name: e?.name,
          constructor: e?.constructor?.name,
        });
        const isTimeout = e?.status === 524 || (e?.message && String(e.message).includes("524"));
        const message = isTimeout
          ? "The request took too long (timeout). Your order may still have been placed — please check your email. If you don't receive a confirmation, try again or contact support."
          : (e?.message || t("order.error.failed"));
        alert(message);
        setErr(message);
      } finally {
        setBusy(false);
      }
    };

    const canSubmit =
      cartItems.length > 0 &&
      !!fullName.trim() &&
      !!email.trim() &&
      isEmailValid(email) &&
      !!phone.trim() &&
      isPhoneValid(phone) &&
      !!country.trim() &&
      !!city.trim() &&
      !!street.trim() &&
      !!zip.trim() &&
      zip.trim().length >= 3 &&
      acceptedTerms &&
      acceptedPrivacy &&
      acceptedRefund;

    return (
      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2">
            <SectionTitle title="Checkout" subtitle="No payment — order is confirmed via email." />
            <Card className="p-6">
              {err ? <div className="text-sm text-red-700 mb-4">{err}</div> : null}
              {sent ? <div className="text-sm bg-emerald-50 text-emerald-800 border border-emerald-100 px-3 py-2 rounded-xl mb-4">{t("order.success")}</div> : null}

              {sent ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                  <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-xl p-5">
                    <div className="text-lg font-semibold text-slate-900">{t("order.success")}</div>
                    <div className="text-sm text-slate-600 mt-2">Your order request was submitted. We will confirm it by email.</div>
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSent(false);
                          setPage("account");
                        }}
                        className="flex-1 rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm hover:bg-emerald-700"
                      >
                        Go to account
                      </button>
                      <button
                        type="button"
                        onClick={() => setSent(false)}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="grid md:grid-cols-2 gap-4">
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                <select className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                  <option>Preferred language</option>
                  <option>English</option>
                  <option>Russian</option>
                  <option>Italian</option>
                  <option>Arabic</option>
                </select>
              </div>

              <div className="mt-4 grid md:grid-cols-2 gap-4">
                <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                <input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Street address" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm md:col-span-2" />
                <input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="ZIP / Postal code" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
              </div>

              <div className="mt-4 grid sm:grid-cols-2 gap-4">
                {canSwitchType ? (
                  <select value={checkoutSelectedType} onChange={(e) => setCheckoutSelectedType(e.target.value as "Personal" | "Business")} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                    <option value="Personal">Personal</option>
                    <option value="Business">Business</option>
                  </select>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 font-medium">
                    {checkoutSelectedType}
                  </div>
                )}
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  {checkoutSelectedType === "Business" ? "This license is for multiple PCs." : "License for one PC."}
                </div>
              </div>

              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Order notes" className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm min-h-[110px]" />

              {/* Coupon Section */}
              <div className="mt-4 p-4 bg-slate-50 rounded-xl">
                <div className="text-sm font-medium text-slate-700 mb-2">🎟️ Have a coupon?</div>
                {appliedCoupon ? (
                  <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                    <div>
                      <span className="font-mono font-bold text-emerald-700">{appliedCoupon.code}</span>
                      <span className="text-sm text-emerald-600 ml-2">
                        ({appliedCoupon.discountType === "PERCENTAGE" ? `${appliedCoupon.discountValue}% off` : `$${appliedCoupon.discountValue} off`})
                      </span>
                    </div>
                    <button onClick={removeCoupon} className="text-red-500 hover:text-red-700 text-sm">Remove</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="Enter coupon code"
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-mono uppercase"
                      onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
                    />
                    <button
                      onClick={applyCoupon}
                      disabled={couponLoading || !couponCode.trim()}
                      className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm hover:bg-black disabled:opacity-60"
                    >
                      {couponLoading ? "..." : "Apply"}
                    </button>
                  </div>
                )}
                {couponError && <div className="text-sm text-red-600 mt-2">{couponError}</div>}
                <button onClick={() => setPage("coupons")} className="text-xs text-emerald-600 hover:underline mt-2">
                  View available coupons →
                </button>
              </div>

              {/* Legal Agreements */}
              <div className="mt-6 p-4 bg-slate-50 rounded-xl space-y-3">
                <div className="text-sm font-medium text-slate-700 mb-3">Legal Agreements</div>
                
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-slate-700">
                    I agree to the{" "}
                    <button
                      type="button"
                      onClick={() => setPage("terms")}
                      className="text-emerald-600 hover:underline font-medium"
                    >
                      Terms of Service
                    </button>
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptedPrivacy}
                    onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-slate-700">
                    I agree to the{" "}
                    <button
                      type="button"
                      onClick={() => setPage("privacy")}
                      className="text-emerald-600 hover:underline font-medium"
                    >
                      Privacy Policy
                    </button>
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptedRefund}
                    onChange={(e) => setAcceptedRefund(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-slate-700">
                    I agree to the{" "}
                    <button
                      type="button"
                      onClick={() => setPage("refund")}
                      className="text-emerald-600 hover:underline font-medium"
                    >
                      Return & Refund Policy
                    </button>
                  </span>
                </label>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={busy || !canSubmit}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!busy && canSubmit) submit();
                  }}
                  className="rounded-xl bg-emerald-600 text-white px-6 py-3 text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
                >
                  {busy ? "Placing order…" : "Place order (Email confirmation)"}
                </button>
                <button
                  type="button"
                  onClick={() => setPage("shop")}
                  className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm hover:bg-slate-50"
                >
                  Back to shop
                </button>
              </div>
            </Card>
          </div>

          <div>
            <SectionTitle title="Order summary" />
            <Card className="p-6">
              <div className="space-y-3 text-sm">
                {checkoutLines.length ? (
                  <div className="space-y-2">
                    {checkoutLines.map((it, idx) => (
                      <div key={`${it.productId}-${it.productType || 'default'}-${idx}`} className="flex justify-between gap-3">
                        <span className="text-slate-600 truncate">
                          {it.title} × {it.qty}
                          <span className="ml-1 text-emerald-700">({it.productType || "Personal"})</span>
                        </span>
                        <span className="text-slate-900 font-medium">{formatMoney(it.subtotal)}</span>
                      </div>
                    ))}
                    <div className="h-px bg-slate-200" />
                    {appliedCoupon && discountAmount > 0 && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Subtotal</span>
                          <span className="text-slate-900">{formatMoney(checkoutLines.reduce((acc, it) => acc + it.subtotal, 0))}</span>
                        </div>
                        <div className="flex justify-between text-sm text-emerald-600">
                          <span>
                            Discount ({appliedCoupon.code})
                            {appliedCoupon.discountType === "PERCENTAGE" 
                              ? ` -${appliedCoupon.discountValue}%`
                              : ` -${formatMoney(appliedCoupon.discountValue)}`}
                          </span>
                          <span>-{formatMoney(discountAmount)}</span>
                        </div>
                        <div className="h-px bg-slate-200" />
                      </>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-600">Total</span>
                      <span className="text-slate-900 font-semibold">{formatMoney(checkoutTotal)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-600">Your cart is empty.</div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-600">Type</span>
                  <span className="text-slate-900 font-medium">
                    {checkoutLines.length === 0
                      ? checkoutSelectedType
                      : (() => {
                          const types = [...new Set(checkoutLines.map((l) => l.productType || "Personal"))];
                          return types.length === 1 ? types[0] : "Mixed (see per item)";
                        })()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">License</span>
                  <span className="text-slate-900 font-medium">
                    {checkoutLines.length === 0
                      ? (checkoutSelectedType === "Business" ? "This license is for multiple PCs." : "License for one PC.")
                      : (() => {
                          const types = [...new Set(checkoutLines.map((l) => l.productType || "Personal"))];
                          if (types.length === 1) {
                            return types[0] === "Business" ? "This license is for multiple PCs." : "License for one PC.";
                          }
                          return "See license type per item above.";
                        })()}
                  </span>
                </div>
                <div className="h-px bg-slate-200" />
                <div className="flex justify-between">
                  <span className="text-slate-600">Delivery</span>
                  <span className="text-slate-900 font-medium">Email</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>
    );
  };

  const Contact = () => {
    // Close mobile menu when navigating
    useEffect(() => {
      setMobileMenuOpen(false);
    }, [page]);
    const [contactName, setContactName] = useState("");
    const [contactEmail, setContactEmail] = useState("");
    const [contactMessage, setContactMessage] = useState("");
    const [contactBusy, setContactBusy] = useState(false);
    const [contactErr, setContactErr] = useState<string | null>(null);
    const [contactOk, setContactOk] = useState<string | null>(null);

    const [contactCaptchaToken, setContactCaptchaToken] = useState("");
    const [contactCaptchaOpen, setContactCaptchaOpen] = useState(false);
    const contactWidgetIdRef = useRef<any>(null);

    const turnstileSiteKey = (import.meta as any)?.env?.VITE_TURNSTILE_SITE_KEY as string | undefined;

    const [supportImage, setSupportImage] = useState<File | null>(null);
    const [supportImageUrl, setSupportImageUrl] = useState<string | null>(null);
    const [supportDragOver, setSupportDragOver] = useState(false);
    const [supportSaveBusy, setSupportSaveBusy] = useState(false);
    const [supportSaveErr, setSupportSaveErr] = useState<string | null>(null);
    const [supportSaveOk, setSupportSaveOk] = useState<string | null>(null);

    useEffect(() => {
      if (!turnstileSiteKey) return;
      if (typeof window === "undefined") return;

      const w = window as any;
      if (w.turnstile) return;

      const existing = document.querySelector('script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]');
      if (existing) return;

      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    }, [turnstileSiteKey]);

    useEffect(() => {
      if (!turnstileSiteKey) return;
      if (typeof window === "undefined") return;
      const w = window as any;

      let cancelled = false;
      const ensureRendered = async () => {
        if (!contactCaptchaOpen) return;
        for (let i = 0; i < 80; i++) {
          if (cancelled) return;
          if (w.turnstile && typeof w.turnstile.render === "function") break;
          await new Promise((r) => setTimeout(r, 100));
        }
        if (cancelled) return;
        if (!w.turnstile || typeof w.turnstile.render !== "function") return;

        const el = document.getElementById("turnstile-contact");
        if (el && !el.getAttribute("data-rendered")) {
          const id = w.turnstile.render(el, {
            sitekey: turnstileSiteKey,
            callback: (token: string) => {
              setContactCaptchaToken(token);
              setContactCaptchaOpen(false);
            },
            "expired-callback": () => setContactCaptchaToken(""),
            "error-callback": () => setContactCaptchaToken(""),
          });
          contactWidgetIdRef.current = id;
          el.setAttribute("data-rendered", "1");
        }
      };

      ensureRendered();
      return () => {
        cancelled = true;
      };
    }, [turnstileSiteKey, contactCaptchaOpen]);

    const resetContactCaptcha = () => {
      setContactCaptchaToken("");
      const w = window as any;
      if (w?.turnstile && contactWidgetIdRef.current != null) {
        try {
          const widgetId = contactWidgetIdRef.current;
          if (widgetId != null) {
            w.turnstile.reset(widgetId);
          }
        } catch (err) {
          // Silently ignore if widget is not available
          console.debug("Turnstile reset failed:", err);
        }
      }
      const el = document.getElementById("turnstile-contact");
      if (el) el.removeAttribute("data-rendered");
    };

    const sendContact = async () => {
      setContactBusy(true);
      setContactErr(null);
      setContactOk(null);
      try {
        await gatewayFetch("/contact", {
          method: "POST",
          body: JSON.stringify({ name: contactName, email: contactEmail, message: contactMessage, captchaToken: contactCaptchaToken }),
        });
        setContactOk("Sent!");
        setContactName("");
        setContactEmail("");
        setContactMessage("");
        resetContactCaptcha();
      } catch (e: any) {
        setContactErr(e?.message || "Failed to send");
      } finally {
        setContactBusy(false);
      }
    };

    useEffect(() => {
      if (!supportImage) {
        setSupportImageUrl(null);
        return;
      }
      const url = URL.createObjectURL(supportImage);
      setSupportImageUrl(url);
      return () => URL.revokeObjectURL(url);
    }, [supportImage]);

    const acceptFile = (file: File | null | undefined) => {
      if (!file) return;
      const allowed = ["image/svg+xml", "image/png", "image/jpeg", "image/webp"];
      const ok = allowed.includes(String(file.type || "").toLowerCase());
      if (!ok) {
        alert("Only SVG, PNG, JPG/JPEG, WEBP images are allowed.");
        return;
      }
      setSupportImage(file);
    };

    const onDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setSupportDragOver(false);
      const file = e.dataTransfer.files?.[0];
      acceptFile(file);
    };

    const saveSupportImage = async () => {
      if (!supportImage) return;
      setSupportSaveBusy(true);
      setSupportSaveErr(null);
      setSupportSaveOk(null);
      try {
        const form = new FormData();
        form.append("siteName", siteSettings.siteName || "");
        form.append("supportImage", supportImage);
        await gatewayFetch("/admin/settings", { method: "PUT", body: form });
        setSupportSaveOk("Saved!");
        setSupportImage(null);
        await refreshSiteSettings();
      } catch (e: any) {
        setSupportSaveErr(e?.message || "Failed");
      } finally {
        setSupportSaveBusy(false);
      }
    };

    return (
      <section className="max-w-6xl mx-auto px-6 py-12">
        <SectionTitle title="Contact" subtitle="Let users reach you easily (also via chatbot)." />
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-6">
            <div className="text-sm font-semibold text-slate-900">Send a message</div>
            <div className="mt-4 space-y-3">
              {contactErr ? <div className="text-sm text-red-700">{contactErr}</div> : null}
              {contactOk ? <div className="text-sm text-emerald-700">{contactOk}</div> : null}

              <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Name" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
              <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Email" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
              <textarea value={contactMessage} onChange={(e) => setContactMessage(e.target.value)} placeholder="Message" rows={6} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />

              {turnstileSiteKey ? (
                <div className="flex items-center justify-between gap-3">
                  {contactCaptchaToken ? (
                    <div className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-1 rounded-full">Verified ✅</div>
                  ) : (
                    <div className="text-xs text-slate-500">Verification required</div>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        resetContactCaptcha();
                        setContactCaptchaOpen(true);
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50"
                    >
                      {contactCaptchaToken ? "Re-verify" : "Verify"}
                    </button>
                    {contactCaptchaToken ? (
                      <button
                        type="button"
                        onClick={resetContactCaptcha}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50"
                      >
                        Reset
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : (
                null
              )}

              {turnstileSiteKey ? (
                <div
                  style={{ display: contactCaptchaOpen ? "flex" : "none" }}
                  className="fixed inset-0 z-50 items-center justify-center bg-black/40 p-4"
                  onClick={() => setContactCaptchaOpen(false)}
                >
                  <div
                    className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">Verify you are human</div>
                        <div className="text-xs text-slate-600 mt-1">Complete the challenge to continue.</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setContactCaptchaOpen(false)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50"
                      >
                        Close
                      </button>
                    </div>
                    <div className="mt-4">
                      <div id="turnstile-contact" className="w-full" />
                    </div>
                  </div>
                </div>
              ) : null}

              <button
                disabled={
                  contactBusy ||
                  !contactName.trim() ||
                  !contactEmail.trim() ||
                  !contactMessage.trim() ||
                  (turnstileSiteKey ? !contactCaptchaToken : false)
                }
                onClick={sendContact}
                className="rounded-xl bg-slate-900 text-white px-6 py-3 text-sm hover:bg-black disabled:opacity-60"
              >
                {contactBusy ? "Sending..." : "Send"}
              </button>
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-sm font-semibold text-slate-900">Support</div>
            <a href="mailto:support@ripcrack.net" className="block text-sm text-slate-600 mt-2 hover:text-slate-900">
              support@ripcrack.net
            </a>
            <div className="text-sm text-slate-600 mt-1">
              <a href="https://wa.me/4863881006" target="_blank" rel="noreferrer" className="hover:text-slate-900">
                WhatsApp · 24/7 — +48 6388 1006
              </a>
            </div>

            {supportSaveErr ? <div className="mt-3 text-sm text-red-700">{supportSaveErr}</div> : null}
            {supportSaveOk ? <div className="mt-3 text-sm text-emerald-700">{supportSaveOk}</div> : null}

            {me?.role === "ADMIN" || me?.role === "AGENT" ? (
              <div
                className={`mt-6 rounded-2xl border border-dashed overflow-hidden h-56 flex items-center justify-center transition ${
                  supportDragOver ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-gradient-to-br from-slate-100 to-slate-200"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setSupportDragOver(true);
                }}
                onDragLeave={() => setSupportDragOver(false)}
                onDrop={onDrop}
              >
                {supportImageUrl ? (
                  <div className="relative w-full h-full">
                    <img src={supportImageUrl} alt="Uploaded" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setSupportImage(null)}
                      className="absolute top-3 right-3 rounded-xl bg-white/90 border border-slate-200 px-3 py-1 text-xs hover:bg-white"
                    >
                      Remove
                    </button>

                    <button
                      type="button"
                      disabled={supportSaveBusy}
                      onClick={saveSupportImage}
                      className="absolute bottom-3 right-3 rounded-xl bg-emerald-600 text-white px-3 py-1 text-xs hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {supportSaveBusy ? "Saving..." : "Save"}
                    </button>
                  </div>
                ) : siteSettings.supportImage ? (
                  <div className="relative w-full h-full">
                    <img src={siteSettings.supportImage} alt="Support" className="w-full h-full object-cover" />
                    <div className="absolute top-3 left-3 rounded-xl bg-white/90 border border-slate-200 px-3 py-1 text-xs text-slate-700">
                      Current image
                    </div>
                    <label className="absolute bottom-3 right-3">
                      <span className="cursor-pointer rounded-xl bg-white/90 border border-slate-200 px-3 py-1 text-xs hover:bg-white">
                        Replace
                      </span>
                      <input
                        type="file"
                        accept="image/svg+xml,image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => acceptFile(e.target.files?.[0])}
                      />
                    </label>
                  </div>
                ) : (
                  <div className="text-center px-6">
                    <div className="text-sm font-medium text-slate-800">Upload image</div>
                    <div className="mt-1 text-xs text-slate-600">Drag & drop here or choose a file.</div>
                    <label className="inline-block mt-3">
                      <span className="cursor-pointer rounded-xl bg-white border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50">
                        Choose image
                      </span>
                      <input
                        type="file"
                        accept="image/svg+xml,image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => acceptFile(e.target.files?.[0])}
                      />
                    </label>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 h-56 flex items-center justify-center">
                {siteSettings.supportImage ? (
                  <img src={siteSettings.supportImage} alt="Support" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full" />
                )}
              </div>
            )}
          </Card>
        </div>
      </section>
    );
  };

  const OrderTracking = () => {
    const [orderId, setOrderId] = useState("");
    const [token, setToken] = useState("");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [item, setItem] = useState<any>(null);

    useEffect(() => {
      if (typeof window === "undefined") return;
      const qs = new URLSearchParams(window.location.search || "");
      setOrderId(String(qs.get("orderId") || "").trim());
      setToken(String(qs.get("token") || "").trim());
    }, []);

    const doTrack = async () => {
      setErr(null);
      setItem(null);
      const oid = String(orderId || "").trim();
      const tok = String(token || "").trim();
      if (!oid) return setErr("Missing orderId");
      if (!tok) return setErr("Missing token");
      setBusy(true);
      try {
        const qs = new URLSearchParams({ orderId: oid, token: tok });
        const json = await gatewayFetch(`/orders/track?${qs.toString()}`, { method: "GET" });
        setItem(json?.item || null);
      } catch (e: any) {
        setErr(e?.message || "Failed to track order");
      } finally {
        setBusy(false);
      }
    };

    return (
      <section className="max-w-3xl mx-auto px-6 py-12">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <SectionTitle title="Order tracking" subtitle="Paste orderId + token from your email link." />
          <button onClick={() => setPage("home")} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50">
            Back
          </button>
        </div>
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
          <input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="orderId" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
          <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="token" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
          <button disabled={busy} onClick={doTrack} className="rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm hover:bg-emerald-700 disabled:opacity-60">
            {busy ? "Loading…" : "Track"}
          </button>
          {err ? <div className="text-sm text-red-700">{err}</div> : null}
          {item ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-sm font-semibold text-slate-900">{item?.product?.title || "Order"}</div>
              <div className="text-sm text-slate-700 mt-1">Status: {item?.status || "REQUESTED"}</div>
              <div className="text-xs text-slate-500 mt-1">Order #{item?.id}</div>
            </div>
          ) : null}
        </div>
      </section>
    );
  };

  const PageBody = () => {
    if (page === "home") return <Home />;
    if (page === "shop") return <Shop />;
    if (page === "product") return <Product />;
    if (page === "pricing") return <Pricing />;
    if (page === "fraud") return (
      <Fraud
        gatewayFetch={gatewayFetch}
        getDeviceId={getDeviceId}
        fraudVerifyOpen={fraudVerifyOpen}
        setFraudVerifyOpen={setFraudVerifyOpen}
        fraudVerifyEmail={fraudVerifyEmail}
        setFraudVerifyEmail={setFraudVerifyEmail}
        fraudVerifySubmissionId={fraudVerifySubmissionId}
        setFraudVerifySubmissionId={setFraudVerifySubmissionId}
        fraudVerifyCode={fraudVerifyCode}
        setFraudVerifyCode={setFraudVerifyCode}
        fraudVerifyBusy={fraudVerifyBusy}
        setFraudVerifyBusy={setFraudVerifyBusy}
        fraudVerifyErr={fraudVerifyErr}
        setFraudVerifyErr={setFraudVerifyErr}
        fraudVerifyOk={fraudVerifyOk}
        setFraudVerifyOk={setFraudVerifyOk}
        fraudResendLeft={fraudResendLeft}
        setFraudResendLeft={setFraudResendLeft}
      />
    );
    if (page === "account") return <Account />;
    if (page === "track") return <OrderTracking />;
    if (page === "admin") return <Admin />;
    if (page === "cart") return <Cart />;
    if (page === "checkout") return <Checkout />;
    if (page === "refund") return <ReturnRefundPolicy />;
    if (page === "privacy") return <PrivacyPolicy />;
    if (page === "cookies") return <CookiePolicy />;
    if (page === "disclaimer") return <DisclaimerPage />;
    if (page === "terms") return <TermsPage />;
    if (page === "about") return <AboutPage />;
    if (page === "faq") return <FaqPage />;
    if (page === "special") return <SpecialCrack />;
    if (page === "coupons") return <CouponsPage />;
    return <Contact />;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <button onClick={() => setPage("home")} className="flex flex-col items-start gap-0.5 min-w-0 flex-shrink text-left">
              <div className="flex items-center gap-2">
                {siteSettings.headerLogo ? (
                  <img src={siteSettings.headerLogo} alt={siteSettings.siteName} className="h-8 sm:h-10 max-h-10 w-auto max-w-[120px] sm:max-w-[160px] object-contain flex-shrink-0" />
                ) : (
                  <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-emerald-600 flex-shrink-0" />
                )}
                <div className="text-sm sm:text-base font-semibold text-slate-900 truncate">{siteSettings.siteName}</div>
              </div>
              <div className="text-[11px] sm:text-xs text-slate-500 whitespace-normal leading-tight">{t("hero.kicker")}</div>
            </button>

            <nav className="hidden lg:flex items-center gap-3">
              {navItems.map((item) => (
                <NavLink key={item.id || item.page} id={item.page as Page} label={item.label} />
              ))}
            </nav>

            <div className="flex items-center gap-1 sm:gap-3">
              <HeaderSearch query={query} setQuery={setQuery} placeholder={t("common.search")} onSubmit={() => setPage("shop")} />

              <button
                className="hidden sm:flex rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
                onClick={() => setLang((x) => (x === "EN" ? "RU" : x === "RU" ? "IT" : x === "IT" ? "AR" : "EN"))}
                title={t("header.changeLanguage")}
              >
                {lang} ▾
              </button>

              <button onClick={() => setPage("account")} className="hidden sm:flex rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50">
                {t("header.account")}
              </button>

              {me?.role === "ADMIN" || me?.role === "AGENT" ? (
                <button onClick={() => setPage("admin")} className="hidden sm:flex rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50">
                  Admin
                </button>
              ) : null}

              <button
                onClick={() => {
                  setPage("cart");
                }}
                className="rounded-lg sm:rounded-xl bg-slate-900 text-white px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm hover:bg-black flex-shrink-0 min-w-[32px] sm:min-w-0"
              >
                <span className="hidden sm:inline">{t("header.cart")} · </span>{cartCount}
              </button>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden rounded-lg sm:rounded-xl border border-slate-200 bg-white p-1.5 sm:p-2 hover:bg-slate-50 flex-shrink-0"
                aria-label="Menu"
              >
                <svg className="h-4 w-4 sm:h-5 sm:w-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div className="lg:hidden mt-3 pb-3 border-t border-slate-200 pt-3 space-y-2">
              {navItems.map((item) => (
                <button
                  key={item.id || item.page}
                  onClick={() => {
                    setPage(item.page as Page);
                    setMobileMenuOpen(false);
                  }}
                  className={`block w-full text-left px-3 py-2 rounded-xl text-sm transition ${
                    page === item.page
                      ? "bg-emerald-50 text-emerald-700 font-medium"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {item.label}
                </button>
              ))}
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <button
                  className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    setLang((x) => (x === "EN" ? "RU" : x === "RU" ? "IT" : x === "IT" ? "AR" : "EN"));
                  }}
                >
                  <span>{t("header.changeLanguage")}</span>
                  <span className="font-medium">{lang}</span>
                </button>
                <button
                  onClick={() => {
                    setPage("account");
                    setMobileMenuOpen(false);
                  }}
                  className="block w-full text-left px-3 py-2 rounded-xl text-sm text-slate-700 hover:bg-slate-50"
                >
                  {t("header.account")}
                </button>
                {me?.role === "ADMIN" || me?.role === "AGENT" ? (
                  <button
                    onClick={() => {
                      setPage("admin");
                      setMobileMenuOpen(false);
                    }}
                    className="block w-full text-left px-3 py-2 rounded-xl text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Admin
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Brand carousel */}
      <ManualBrandCarousel brands={headerBrands} title={t("brands.title")} />

      {/* Content */}
      <PageBody />

      {/* Trusted by teams - rendered outside Home to prevent remounting when Home re-renders */}
      {page === "home" && <TrustedBrandsSection brands={trustedBrandsMemo} />}

      {/* Footer */}
      {page !== "admin" && (
      <footer className="bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
          <div>
            <div className="flex items-center gap-2">
              {siteSettings.footerLogo ? (
                <img src={siteSettings.footerLogo} alt={siteSettings.siteName} className="h-8 max-h-8 w-auto max-w-[120px] object-contain" />
              ) : (
                <div className="h-8 w-8 rounded-xl bg-emerald-600" />
              )}
              <div className="text-lg font-semibold text-slate-900">{siteSettings.siteName}</div>
            </div>
            <div className="mt-5 space-y-2 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
                <span>Smolki Stanisława 29, Warszawa 01-101 Poland</span>
              </div>

              <a href="mailto:support@ripcrack.net" className="flex items-center gap-2 hover:text-slate-900">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16v16H4z" />
                  <path d="m22 6-10 7L2 6" />
                </svg>
                <span>support@ripcrack.net</span>
              </a>

              <a href="https://wa.me/4863881006" target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-slate-900">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 21a9 9 0 1 0-7.65-4.27L3 21l4.27-1.35A8.96 8.96 0 0 0 12 21z" />
                  <path d="M9.5 10.5c.6 1.6 2.4 3.4 4 4" />
                  <path d="M13.8 14.2l1.2-.4c.4-.1.8 0 1.1.3l1 1" />
                </svg>
                <span>WhatsApp Support: +48 6388 1006</span>
              </a>

              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
                </svg>
                <span>WeChat: RipCrack</span>
              </div>

              <a href="https://t.me/ripcrack" target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-slate-900">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 5 10 12" />
                  <path d="m21 5-7 16-4-9-8-3z" />
                </svg>
                <span>Telegram: @ripcrack</span>
              </a>

              <a href="https://ripcrack.net/contact" target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-slate-900">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 1 0-7l.5-.5a5 5 0 0 1 7 7L17 13" />
                  <path d="M14 11a5 5 0 0 1 0 7l-.5.5a5 5 0 0 1-7-7L7 11" />
                </svg>
                <span>Contact Form</span>
              </a>
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-slate-900">{t("footer.resources")}</div>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              {footerLinks
                .filter((l) => String(l?.group || "") === "RESOURCES")
                .map((l) => {
                  const labels = (l?.labels || {}) as any;
                  const label = String(labels?.[lang] || labels?.EN || "").trim() || "-";
                  const targetType = String(l?.targetType || "");
                  const targetPage = String(l?.targetPage || "").trim();
                  const targetUrl = String(l?.targetUrl || "").trim();
                  return (
                    <button
                      key={l.id}
                      onClick={() => {
                        if (targetType === "PAGE" && targetPage) setPage(targetPage as any);
                        else if (targetType === "URL" && targetUrl) window.open(targetUrl, "_blank", "noopener,noreferrer");
                      }}
                      className="block hover:text-slate-900"
                    >
                      {label}
                    </button>
                  );
                })}
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-slate-900">{t("footer.information")}</div>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              {footerLinks
                .filter((l) => String(l?.group || "") === "INFORMATION")
                .map((l) => {
                  const labels = (l?.labels || {}) as any;
                  const label = String(labels?.[lang] || labels?.EN || "").trim() || "-";
                  const targetType = String(l?.targetType || "");
                  const targetPage = String(l?.targetPage || "").trim();
                  const targetUrl = String(l?.targetUrl || "").trim();
                  return (
                    <button
                      key={l.id}
                      onClick={() => {
                        if (targetType === "PAGE" && targetPage) setPage(targetPage as any);
                        else if (targetType === "URL" && targetUrl) window.open(targetUrl, "_blank", "noopener,noreferrer");
                      }}
                      className="block hover:text-slate-900"
                    >
                      {label}
                    </button>
                  );
                })}
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-slate-900">{t("footer.subscribe")}</div>
            <div className="text-sm text-slate-600 mt-2">{t("footer.subscriptionHint")}</div>
            <div className="mt-3 flex gap-2">
              <input
                type="email"
                placeholder={t("footer.subscriptionPlaceholder")}
                value={subscriptionEmail}
                onChange={(e) => setSubscriptionEmail(e.target.value)}
                disabled={subscriptionStatus === "loading"}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm disabled:opacity-60"
              />
              <button
                type="button"
                disabled={subscriptionStatus === "loading"}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const email = subscriptionEmail.trim();
                  if (!email) {
                    const msg = t("footer.subscriptionErrorInvalid") || "Please enter a valid email address.";
                    setSubscriptionStatus("error");
                    setSubscriptionMessage(msg);
                    alert(msg);
                    return;
                  }
                  setSubscriptionStatus("loading");
                  setSubscriptionMessage("");
                  (async () => {
                    try {
                      await gatewayFetch("/subscribe", { method: "POST", body: JSON.stringify({ email }) });
                      const successMsg =  "Subscribed successfully.";
                      setSubscriptionStatus("success");
                      setSubscriptionMessage(successMsg);
                      setSubscriptionEmail("");
                      //alert(successMsg);
                    } catch (err: any) {
                      const errorMsg = err?.message || "Failed to subscribe. Please try again.";
                      setSubscriptionStatus("error");
                      setSubscriptionMessage(errorMsg);
                      //alert(errorMsg);
                    } finally {
                      setSubscriptionStatus((s) => (s === "loading" ? "idle" : s));
                    }
                  })();
                }}
                className="rounded-xl bg-emerald-600 text-white px-4 py-3 text-sm hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {subscriptionStatus === "loading" ? ( "Subscribing...") : t("footer.subscriptionCta")}
              </button>
            </div>
            {subscriptionMessage && (
              <div className={`mt-2 text-sm ${subscriptionStatus === "success" ? "text-emerald-600" : subscriptionStatus === "error" ? "text-red-600" : "text-slate-600"}`}>
                {subscriptionMessage}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-slate-200">
          <div className="max-w-7xl mx-auto px-6 py-4 text-xs text-slate-500 flex justify-between">
            <span>© {new Date().getFullYear()} {siteSettings.siteName}. All rights reserved.</span>
            <span>
              {t("footer.language")}: {lang}
            </span>
          </div>
        </div>
      </footer>
      )}

      {/* Cookie Consent Banner */}
      {cookieConsent === "pending" && (
        <div className="fixed bottom-0 left-0 right-0 z-50 md:bottom-6 md:left-6 md:right-auto md:max-w-md">
          <div className="bg-slate-900 text-white p-5 md:rounded-2xl shadow-2xl border border-slate-700">
            <div className="flex items-start gap-4">
              {/* Cookie SVG Icon */}
              <div className="flex-shrink-0">
                <svg className="w-12 h-12 text-amber-400" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="32" cy="32" r="28" fill="currentColor"/>
                  <circle cx="20" cy="24" r="4" fill="#78350f"/>
                  <circle cx="38" cy="20" r="3" fill="#78350f"/>
                  <circle cx="44" cy="34" r="4" fill="#78350f"/>
                  <circle cx="26" cy="40" r="3" fill="#78350f"/>
                  <circle cx="36" cy="44" r="2" fill="#78350f"/>
                  <circle cx="18" cy="36" r="2" fill="#78350f"/>
                  <circle cx="28" cy="28" r="2" fill="#78350f"/>
                </svg>
              </div>
              <div className="flex-1">
                <div className="font-semibold text-lg">🍪 Cookie Notice</div>
                <p className="text-sm text-slate-300 mt-2">
                  We use cookies to enhance your browsing experience, analyze site traffic, and personalize content. 
                  By clicking "Accept", you consent to our use of cookies.
                </p>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => handleCookieConsent("accepted")}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2 px-4 rounded-xl text-sm transition"
                  >
                    Accept All
                  </button>
                  <button
                    onClick={() => handleCookieConsent("rejected")}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-xl text-sm transition"
                  >
                    Reject All
                  </button>
                </div>
                <button
                  onClick={() => setPage("cookies")}
                  className="mt-3 text-xs text-slate-400 hover:text-white underline"
                >
                  Learn more about our Cookie Policy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add to Cart Modal */}
      {addToCartModal.product && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setAddToCartModal({ product: null, qty: 1 })}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-semibold text-slate-900">Select License Type</div>
              <button onClick={() => setAddToCartModal({ product: null, qty: 1 })} className="text-slate-400 hover:text-slate-600">
                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="text-sm text-slate-600 mb-4">{addToCartModal.product.title}</div>
            
            <div className="space-y-3 mb-6">
              <button
                onClick={() => setAddToCartType("Personal")}
                className={`w-full p-4 rounded-xl border-2 text-left transition ${
                  addToCartType === "Personal"
                    ? "border-emerald-600 bg-emerald-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">Personal License</div>
                    <div className="text-sm text-slate-600 mt-1">License for one PC</div>
                  </div>
                  <div className="text-lg font-semibold text-emerald-700">
                    {addToCartModal.product.personalPrice || addToCartModal.product.price}
                  </div>
                </div>
              </button>
              
              {addToCartModal.product.businessPrice && (
                <button
                  onClick={() => setAddToCartType("Business")}
                  className={`w-full p-4 rounded-xl border-2 text-left transition ${
                    addToCartType === "Business"
                      ? "border-emerald-600 bg-emerald-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-900">Business License</div>
                      <div className="text-sm text-slate-600 mt-1">License for multiple PCs</div>
                    </div>
                    <div className="text-lg font-semibold text-emerald-700">
                      {addToCartModal.product.businessPrice}
                    </div>
                  </div>
                </button>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setAddToCartModal({ product: null, qty: 1 })}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmAddToCart();
                  setPage("cart");
                }}
                className="flex-1 rounded-xl bg-emerald-600 text-white px-4 py-3 text-sm hover:bg-emerald-700"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40">
        <div className="max-w-7xl mx-auto px-4 py-2 flex justify-around text-xs">
          <button onClick={() => setPage("home")} className="py-2">{t("nav.home")}</button>
          <button onClick={() => setPage("shop")} className="py-2">{t("nav.shop")}</button>
          <button onClick={() => setPage("pricing")} className="py-2">{t("nav.pricing")}</button>
          <button onClick={() => setPage("fraud")} className="py-2">{t("nav.fraud")}</button>
        </div>
      </div>
    </div>
  );
}

function ChatWidget({ onClose, getDeviceId }: { onClose: () => void; getDeviceId: () => string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [email, setEmail] = useState("");
  const [needsEmail, setNeedsEmail] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chatStatus, setChatStatus] = useState<"BOT" | "WAITING_FOR_HUMAN" | "HUMAN">("BOT");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const deviceId = getDeviceId();
  const currentPage = typeof window !== "undefined" ? window.location.pathname : "";

  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant" | "admin"; text: string; timestamp?: Date }>>([
    { role: "assistant", text: "Hi! 👋 How can I help you today?", timestamp: new Date() },
  ]);

  const scrollToBottom = () => {
    // Check if ref and node exist before scrolling
    if (messagesEndRef.current && messagesEndRef.current.isConnected) {
      try {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      } catch (err) {
        // Silently ignore if node is not available
        console.debug("Scroll failed:", err);
      }
    }
  };

  useEffect(() => {
    // Use a small delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      scrollToBottom();
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [messages, typing]);

  // Track page changes (silent, no message sent)
  useEffect(() => {
    if (sessionId && currentPage) {
      // Just update the session silently without sending a message
      // This is handled by the backend when a real message is sent
    }
  }, [currentPage, sessionId, deviceId, email]);

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || busy) return;

    setError(null);
    setBusy(true);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: trimmed, timestamp: new Date() }]);

    // Check if user is asking for support - if so, request email
    const lowerMessage = trimmed.toLowerCase();
    const supportKeywords = ["ask support", "contact support", "support", "help", "human", "agent", "speak with", "talk to"];
    const isAskingForSupport = supportKeywords.some(keyword => lowerMessage.includes(keyword));
    
    // If asking for support and no email provided, request it
    if (isAskingForSupport && !email.trim()) {
      setNeedsEmail(true);
      setBusy(false);
      setMessages((prev) => [...prev, { 
        role: "assistant", 
        text: "I'd be happy to connect you with our support team! Please provide your email address so we can assist you better.", 
        timestamp: new Date() 
      }]);
      return;
    }

    try {
      setTyping(true);
      const base = window.location.hostname !== "localhost" ? "/api" : "http://localhost:3003";
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const res = await fetch(`${base}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: controller.signal,
        body: JSON.stringify({ 
          message: trimmed,
          deviceId,
          email: email.trim() || undefined,
          currentPage,
        }),
      }).catch((fetchErr: any) => {
        clearTimeout(timeoutId);
        if (fetchErr.name === 'AbortError') {
          throw new Error("Request timeout. Please try again.");
        }
        throw new Error(fetchErr.message || "Failed to connect to server");
      });
      
      clearTimeout(timeoutId);
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const errorMsg = json?.error || `Chat failed (${res.status})`;
        throw new Error(errorMsg);
      }
      
      if (json.sessionId) setSessionId(json.sessionId);
      if (json.status) setChatStatus(json.status);
      if (json.needsEmail !== undefined) {
        setNeedsEmail(json.needsEmail);
      }
      
      // Simulate typing delay for better UX
      await new Promise(resolve => setTimeout(resolve, 500));
      setMessages((prev) => [...prev, { role: "assistant", text: json.reply || "", timestamp: new Date() }]);
    } catch (e: any) {
      console.error("Chat error:", e);
      setError(e?.message || "Chat failed");
      setMessages((prev) => [...prev, { 
        role: "assistant", 
        text: "Sorry, I'm having trouble connecting. Please try WhatsApp or email for immediate support.", 
        timestamp: new Date() 
      }]);
    } finally {
      setBusy(false);
      setTyping(false);
    }
  };

  const transferToHuman = async () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const base = window.location.hostname !== "localhost" ? "/api" : "http://localhost:3003";
      
      // If no session exists, create one by sending a message with email
      if (!sessionId) {
        const res = await fetch(`${base}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ 
            message: "Contact support",
            deviceId,
            email: email.trim(),
            currentPage,
          }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || "Failed to create session");
        
        if (json.sessionId) setSessionId(json.sessionId);
        if (json.status) setChatStatus(json.status);
        if (json.reply) {
          setMessages((prev) => [...prev, { 
            role: "assistant", 
            text: json.reply, 
            timestamp: new Date() 
          }]);
        }
        setNeedsEmail(false);
        setBusy(false);
        return;
      }
      
      // If session exists, transfer to human
      const res = await fetch(`${base}/chat/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId, email: email.trim() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Transfer failed");
      
      setChatStatus("WAITING_FOR_HUMAN");
      setNeedsEmail(false);
      setMessages((prev) => [...prev, { 
        role: "assistant", 
        text: "Thank you! Your request has been sent to our support team. An agent will respond shortly.", 
        timestamp: new Date() 
      }]);
    } catch (e: any) {
      setError(e?.message || "Transfer failed");
    } finally {
      setBusy(false);
    }
  };

  const quickActions = [
    { label: "📱 WhatsApp", action: () => window.open("https://wa.me/4863881006", "_blank") },
    { label: "✉️ Email", action: () => window.open("mailto:support@ripcrack.net", "_blank") },
    { label: "💬 Telegram", action: () => window.open("https://t.me/ripcrack", "_blank") },
  ];

  const quickQuestions = [
    "How do orders work?",
    "What payment methods?",
    "Refund policy?",
    "Contact support",
  ];

  const formatTime = (date?: Date) => {
    if (!date) return "";
    return new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit" }).format(date);
  };

  return (
    <div className="w-[360px] bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[500px]">
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-300 animate-pulse"></div>
        <div className="text-sm font-semibold">Support Chat</div>
      </div>
        <button onClick={onClose} className="text-sm hover:bg-white/20 rounded p-1 transition">✕</button>
      </div>
      
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="p-4 space-y-3 text-sm flex-1 overflow-y-auto">
          {error ? (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          ) : null}

          {/* Welcome message with quick actions */}
          {messages.length === 1 && (
            <div className="space-y-3">
              <div className="bg-gradient-to-br from-emerald-50 to-slate-50 border border-emerald-100 rounded-xl p-4">
                <div className="font-medium text-emerald-900 mb-2">Quick Actions</div>
                <div className="flex flex-wrap gap-2">
                  {quickActions.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={action.action}
                      className="text-xs px-3 py-1.5 bg-white border border-emerald-200 rounded-lg hover:bg-emerald-50 text-emerald-700 transition"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="text-xs text-slate-600 mb-2">💡 Try asking:</div>
                <div className="space-y-1.5">
                  {quickQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => setInput(q)}
                      className="block w-full text-left text-xs px-2 py-1.5 bg-white rounded-lg hover:bg-emerald-50 text-slate-700 transition"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="space-y-2">
          {messages.map((m, idx) => (
            <div
              key={idx}
                className={`flex flex-col gap-1 ${
                  m.role === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
              className={
                m.role === "user"
                      ? "ml-auto max-w-[80%] rounded-2xl bg-emerald-600 text-white px-3 py-2 text-sm"
                      : "mr-auto max-w-[80%] rounded-2xl bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-700"
              }
            >
              {m.text}
                </div>
                {m.timestamp && (
                  <div className={`text-xs text-slate-400 px-1 ${m.role === "user" ? "text-right" : "text-left"}`}>
                    {formatTime(m.timestamp)}
                  </div>
                )}
            </div>
          ))}
            
            {typing && (
              <div className="flex items-center gap-1 text-slate-500 text-xs">
                <span>Support is typing</span>
                <div className="flex gap-1">
                  <div className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                  <div className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                  <div className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Email input if needed */}
        {needsEmail && chatStatus === "BOT" && (
          <div className="px-4 pt-2 pb-2 border-t border-slate-200 bg-amber-50">
            <div className="text-xs font-medium text-amber-900 mb-2">Email required to speak with human agent</div>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="flex-1 rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    transferToHuman();
                  }
                }}
              />
              <button
                onClick={transferToHuman}
                disabled={busy || !email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())}
                className="rounded-xl bg-amber-600 text-white px-4 py-2 text-sm hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Transfer
              </button>
            </div>
          </div>
        )}

        {/* Status indicator */}
        {chatStatus === "WAITING_FOR_HUMAN" && (
          <div className="px-4 py-2 border-t border-slate-200 bg-blue-50">
            <div className="text-xs text-blue-700 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></div>
              Waiting for human agent...
            </div>
          </div>
        )}

        {chatStatus === "HUMAN" && (
          <div className="px-4 py-2 border-t border-slate-200 bg-green-50">
            <div className="text-xs text-green-700 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500"></div>
              Connected to human agent
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          {!email && chatStatus === "BOT" && (
            <div className="mb-2 text-xs text-slate-600">
              💡 Tip: Provide your email to speak with a human agent
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={chatStatus === "HUMAN" ? "Type your message..." : "Ask a question..."}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              disabled={busy}
            />
            <button 
              onClick={send} 
              disabled={busy || !input.trim()} 
              className="rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1"
            >
              {busy ? (
                <>
                  <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Sending</span>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                </>
              )}
            </button>
          </div>
          <div className="mt-2 text-xs text-slate-500 text-center">
            {chatStatus === "HUMAN" ? "Agent is online" : "Usually replies in a few minutes"}
          </div>
        </div>
      </div>
    </div>
  );
}
