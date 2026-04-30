import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { Lang, Brand, ProductT, CartItemT, FraudItem, TestimonialT } from "../types";
import { gatewayFetch } from "../services/api";

// Types
type NavItemT = { id?: number; label: string; page: string; sortOrder?: number; visible?: boolean };
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
type HomeFeaturedT = { id: number; productId: number; sortOrder: number; active: boolean; product: ProductT };

interface AppContextType {
  // State
  lang: Lang;
  setLang: (lang: Lang) => void;
  query: string;
  setQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  selectedProductId: number;
  setSelectedProductId: (id: number) => void;
  footerLinks: any[];
  setFooterLinks: (links: any[]) => void;
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
  bannerIdx: number;
  setBannerIdx: (idx: number) => void;
  me: any;
  setMe: (me: any) => void;
  testimonialIdx: number;
  setTestimonialIdx: (idx: number) => void;
  testimonialManualAt: number;
  setTestimonialManualAt: (at: number) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  navItems: NavItemT[];
  setNavItems: (items: NavItemT[]) => void;
  siteSettings: SiteSettingsT;
  setSiteSettings: (settings: SiteSettingsT) => void;
  homeFeatured: HomeFeaturedT[];
  setHomeFeatured: (featured: HomeFeaturedT[]) => void;
  featuredIdx: number;
  setFeaturedIdx: (idx: number) => void;
  products: ProductT[];
  setProducts: (products: ProductT[]) => void;
  categories: string[];
  setCategories: (categories: string[]) => void;
  brands: Brand[];
  setBrands: (brands: Brand[]) => void;
  banners: any[];
  setBanners: (banners: any[]) => void;
  pricingPlans: any[];
  setPricingPlans: (plans: any[]) => void;
  testimonials: TestimonialT[];
  setTestimonials: (testimonials: TestimonialT[]) => void;
  cart: CartItemT[];
  setCart: (cart: CartItemT[]) => void;
  fraudItems: FraudItem[];
  setFraudItems: (items: FraudItem[]) => void;
  coupons: any[];
  setCoupons: (coupons: any[]) => void;
  headerBrands: Brand[];
  setHeaderBrands: (brands: Brand[]) => void;
  trustedBrands: Brand[];
  setTrustedBrands: (brands: Brand[]) => void;
  
  // Methods
  refreshNavItems: () => Promise<void>;
  refreshHomeFeatured: () => Promise<void>;
  refreshProducts: () => Promise<void>;
  refreshCategories: () => Promise<void>;
  refreshBrands: () => Promise<void>;
  refreshBanners: () => Promise<void>;
  refreshPricingPlans: () => Promise<void>;
  refreshTestimonials: () => Promise<void>;
  refreshFraudItems: () => Promise<void>;
  refreshCoupons: () => Promise<void>;
  refreshSiteSettings: () => Promise<void>;
  refreshHeaderBrands: () => Promise<void>;
  refreshTrustedBrands: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Lang>("EN");
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedProductId, setSelectedProductId] = useState(1);
  const [footerLinks, setFooterLinks] = useState<any[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [bannerIdx, setBannerIdx] = useState(0);
  const [me, setMe] = useState<any>(null);
  const [testimonialIdx, setTestimonialIdx] = useState(0);
  const [testimonialManualAt, setTestimonialManualAt] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navItems, setNavItems] = useState<NavItemT[]>([
    { label: "Home", page: "home" },
    { label: "Shop", page: "shop" },
    { label: "Pricing", page: "pricing" },
    { label: "Attention Fraud", page: "fraud" },
    { label: "Contact", page: "contact" },
  ]);
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
  const [homeFeatured, setHomeFeatured] = useState<HomeFeaturedT[]>([]);
  const [featuredIdx, setFeaturedIdx] = useState(0);
  const [products, setProducts] = useState<ProductT[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [pricingPlans, setPricingPlans] = useState<any[]>([]);
  const [testimonials, setTestimonials] = useState<TestimonialT[]>([]);
  const [cart, setCart] = useState<CartItemT[]>([]);
  const [fraudItems, setFraudItems] = useState<FraudItem[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [headerBrands, setHeaderBrands] = useState<Brand[]>([]);
  const [trustedBrands, setTrustedBrands] = useState<Brand[]>([]);

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

  const refreshProducts = async () => {
    try {
      const json = await gatewayFetch("/products", { method: "GET" });
      const items = Array.isArray(json?.items) ? (json.items as ProductT[]) : [];
      setProducts(items);
      const cats = Array.from(new Set(items.map((p) => p.category).filter(Boolean)));
      setCategories(["All", ...cats]);
    } catch {
      setProducts([]);
      setCategories(["All"]);
    }
  };

  const refreshCategories = async () => {
    try {
      const json = await gatewayFetch("/categories", { method: "GET" });
      const items = Array.isArray(json?.items) ? (json.items as any[]) : [];
      const catNames = items.map((c) => c.name).filter(Boolean);
      setCategories(["All", ...catNames]);
    } catch {
      // keep existing
    }
  };

  const refreshBrands = async () => {
    try {
      const json = await gatewayFetch("/brands", { method: "GET" });
      const items = Array.isArray(json?.items) ? (json.items as Brand[]) : [];
      setBrands(items);
    } catch {
      setBrands([]);
    }
  };

  const refreshBanners = async () => {
    try {
      const json = await gatewayFetch("/banners", { method: "GET" });
      const items = Array.isArray(json?.items) ? (json.items as any[]) : [];
      setBanners(items.filter((b) => b.active));
    } catch {
      setBanners([]);
    }
  };

  const refreshPricingPlans = async () => {
    try {
      const json = await gatewayFetch("/pricing", { method: "GET" });
      const items = Array.isArray(json?.items) ? (json.items as any[]) : [];
      setPricingPlans(items);
    } catch {
      setPricingPlans([]);
    }
  };

  const refreshTestimonials = async () => {
    try {
      const json = await gatewayFetch("/testimonials", { method: "GET" });
      const items = Array.isArray(json?.items) ? (json.items as TestimonialT[]) : [];
      setTestimonials(items.filter((t) => t.active));
    } catch {
      setTestimonials([]);
    }
  };

  const refreshFraudItems = async () => {
    // Don't call this on mount - it's rate limited and should only be called when needed
    // The Fraud page component handles its own fraud entries fetching
    // This is kept for backward compatibility but won't auto-fetch
    try {
      const json = await gatewayFetch("/fraud/entries", { method: "GET" });
      const items = Array.isArray(json?.items) ? (json.items as FraudItem[]) : [];
      setFraudItems(items.filter((f) => f.active));
    } catch {
      // Silently fail - fraud entries are rate limited
      setFraudItems([]);
    }
  };

  const refreshCoupons = async () => {
    try {
      const json = await gatewayFetch("/coupons/active", { method: "GET" });
      const items = Array.isArray(json?.items) ? (json.items as any[]) : [];
      setCoupons(items);
    } catch {
      setCoupons([]);
    }
  };

  const refreshSiteSettings = async () => {
    try {
      const json = await gatewayFetch("/settings", { method: "GET" });
      if (json?.settings) {
        setSiteSettings((prev) => ({ ...prev, ...json.settings }));
      }
    } catch {
      // keep defaults
    }
  };

  const refreshHeaderBrands = async () => {
    try {
      const json = await gatewayFetch("/brands/header", { method: "GET" });
      const items = (json?.items || []) as Brand[];
      if (items.length > 0) setHeaderBrands(items);
    } catch {
      // keep defaults
    }
  };

  const refreshTrustedBrands = async () => {
    try {
      const json = await gatewayFetch("/brands/trusted", { method: "GET" });
      const items = (json?.items || []) as Brand[];
      if (items.length > 0) setTrustedBrands(items);
    } catch {
      // keep defaults
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

  // Initial load
  useEffect(() => {
    refreshNavItems();
    refreshHomeFeatured();
    refreshProducts();
    refreshCategories();
    refreshBrands();
    refreshBanners();
    refreshPricingPlans();
    refreshTestimonials();
    // Don't call refreshFraudItems on mount - it's rate limited and should only be called when needed
    // refreshFraudItems();
    refreshCoupons();
    refreshSiteSettings();
    refreshHeaderBrands();
    refreshTrustedBrands();
    refreshMe();
  }, []);

  const value: AppContextType = {
    lang,
    setLang,
    query,
    setQuery,
    selectedCategory,
    setSelectedCategory,
    selectedProductId,
    setSelectedProductId,
    footerLinks,
    setFooterLinks,
    isChatOpen,
    setIsChatOpen,
    bannerIdx,
    setBannerIdx,
    me,
    setMe,
    testimonialIdx,
    setTestimonialIdx,
    testimonialManualAt,
    setTestimonialManualAt,
    mobileMenuOpen,
    setMobileMenuOpen,
    navItems,
    setNavItems,
    siteSettings,
    setSiteSettings,
    homeFeatured,
    setHomeFeatured,
    featuredIdx,
    setFeaturedIdx,
    products,
    setProducts,
    categories,
    setCategories,
    brands,
    setBrands,
    banners,
    setBanners,
    pricingPlans,
    setPricingPlans,
    testimonials,
    setTestimonials,
    cart,
    setCart,
    fraudItems,
    setFraudItems,
    coupons,
    setCoupons,
    headerBrands,
    setHeaderBrands,
    trustedBrands,
    setTrustedBrands,
    refreshNavItems,
    refreshHomeFeatured,
    refreshProducts,
    refreshCategories,
    refreshBrands,
    refreshBanners,
    refreshPricingPlans,
    refreshTestimonials,
    refreshFraudItems,
    refreshCoupons,
    refreshSiteSettings,
    refreshHeaderBrands,
    refreshTrustedBrands,
    refreshMe,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
};
