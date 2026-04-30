import React, { useEffect, useMemo, useRef, useState } from "react";

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
  if (opts.pricingPlans.some((p) => p.features.length === 0)) errors.push("each pricing plan must have features");
  if (opts.pricingPlans.some((p) => !p.annualPrice || !p.lifetimePrice))
    errors.push("pricingPlans must have annualPrice and lifetimePrice");
  if (errors.length) throw new Error(`SelfTests failed: ${errors.join(", ")}`);
}

type Page = "home" | "shop" | "product" | "account" | "checkout" | "contact" | "pricing" | "fraud" | "admin" | "refund" | "privacy" | "cookies" | "disclaimer" | "terms" | "about" | "faq" | "special" | "coupons";
type PurchaseTerm = "annual" | "lifetime";

type Brand = { id?: number; name: string; logo?: string; sortOrder?: number; type?: "HEADER" | "TRUSTED" };

type ProductT = {
  id: number;
  title: string;
  category: string;
  badge: string;
  price: string;
  personalPrice?: string;
  businessPrice?: string;
  description?: string;
  seoTitle?: string;
  seoDescription?: string;
  images?: string[];
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

type TestimonialT = {
  id?: number;
  name: string;
  role: string;
  company: string;
  rating?: string;
  date?: string;
  text: string;
  photo: string;
  companyLogo: string;
  sortOrder?: number;
  active?: boolean;
};

type Lang = "EN" | "RU" | "IT" | "AR";

const translations: Record<Lang, Record<string, string>> = {
  EN: {
    "nav.home": "Home",
    "nav.shop": "Shop",
    "nav.pricing": "Pricing",
    "nav.fraud": "Attention Fraud",
    "nav.contact": "Contact",

    "topbar.noPayment": "No online payment",
    "topbar.emailConfirm": "Email confirmation",

    "header.changeLanguage": "Change language",
    "header.account": "Account",
    "header.cart": "Cart",

    "common.search": "Search...",
    "common.sort": "Sort",

    "product.view": "View",
    "product.request": "Buy now",

    "brands.title": "Brands we sell",

    "hero.kicker": "Payment-free checkout · Email confirmation",
    "hero.title": "Clean, fast catalog platform",
    "hero.titleAccent": " with login & chatbot",
    "hero.subtitle": "Marketplace-like layout, premium light UI. Users request orders; your team confirms by email.",
    "hero.ctaBrowse": "Browse products",
    "hero.ctaPricing": "View pricing",
    "hero.feature1": "Multi-language",
    "hero.feature2": "Fast",
    "hero.feature3": "Admin panel",

    "home.featured": "Featured",
    "home.shopNow": "Shop now",
    "home.bannerLabel": "Banner",
    "home.testimonials": "What our clients say",
    "home.trusted": "Trusted by teams",
    "home.trustedSubtitle": "Auto moving brand strip (SVG supported).",

    "shop.title": "Shop",
    "shop.subtitle": "Search + category select.",

    "footer.resources": "Resources",
    "footer.information": "Information",
    "footer.about": "About",
    "footer.faq": "F.A.Q",
    "footer.privacy": "Privacy Policy",
    "footer.refund": "Return & Refund Policy",
    "footer.disclaimer": "Disclaimer",
    "footer.terms": "Terms & Conditions",
    "footer.subscribe": "Subscribe",
    "footer.subscriptionHint": "Please enter email address to manage subscriptions.",
    "footer.subscriptionPlaceholder": "example@domain.com",
    "footer.subscriptionCta": "Subscribe",

    "cat.all": "All",
    "cat.design": "Design",
    "cat.security": "Security",
    "cat.marketing": "Marketing",
    "cat.automation": "Automation",
    "cat.aiTools": "AI Tools",

    "category.title": "Browse by category",
    "category.subtitle": "Tab-style navigation.",
    "category.viewAll": "View all products",

    "footer.language": "Language",
  },
  RU: {
    "nav.home": "Главная",
    "nav.shop": "Магазин",
    "nav.pricing": "Цены",
    "nav.fraud": "Осторожно: мошенники",
    "nav.contact": "Контакты",

    "topbar.noPayment": "Без онлайн-оплаты",
    "topbar.emailConfirm": "Подтверждение по email",

    "header.changeLanguage": "Сменить язык",
    "header.account": "Аккаунт",
    "header.cart": "Корзина",

    "common.search": "Поиск...",
    "common.sort": "Сортировать",

    "product.view": "Открыть",
    "product.request": "Купить",

    "brands.title": "Бренды",

    "hero.kicker": "Без оплаты · Подтверждение по email",
    "hero.title": "Быстрая платформа каталога",
    "hero.titleAccent": " с логином и чат-ботом",
    "hero.subtitle": "Интерфейс как маркетплейс. Пользователи отправляют запрос; команда подтверждает по email.",
    "hero.ctaBrowse": "Смотреть товары",
    "hero.ctaPricing": "Смотреть цены",
    "hero.feature1": "Мультиязычность",
    "hero.feature2": "Быстро",
    "hero.feature3": "Админ-панель",

    "home.featured": "Рекомендуем",
    "home.shopNow": "В магазин",
    "home.bannerLabel": "Баннер",
    "home.testimonials": "Отзывы клиентов",
    "home.trusted": "Нам доверяют",
    "home.trustedSubtitle": "Авто-лента брендов (SVG поддерживается).",

    "shop.title": "Магазин",
    "shop.subtitle": "Поиск + выбор категории.",

    "footer.resources": "Ресурсы",
    "footer.information": "Информация",
    "footer.about": "О нас",
    "footer.faq": "Вопросы",
    "footer.privacy": "Политика конфиденциальности",
    "footer.refund": "Возврат и возврат средств",
    "footer.disclaimer": "Дисклеймер",
    "footer.terms": "Условия использования",
    "footer.subscribe": "Подписка",
    "footer.subscriptionHint": "Введите email для управления подпиской.",
    "footer.subscriptionPlaceholder": "example@domain.com",
    "footer.subscriptionCta": "Подписаться",

    "cat.all": "Все",
    "cat.design": "Дизайн",
    "cat.security": "Безопасность",
    "cat.marketing": "Маркетинг",
    "cat.automation": "Автоматизация",
    "cat.aiTools": "AI инструменты",

    "category.title": "Категории",
    "category.subtitle": "Навигация по вкладкам.",
    "category.viewAll": "Все товары",

    "footer.language": "Язык",
  },
  IT: {
    "nav.home": "Home",
    "nav.shop": "Negozio",
    "nav.pricing": "Prezzi",
    "nav.fraud": "Attenzione frodi",
    "nav.contact": "Contatti",

    "topbar.noPayment": "Nessun pagamento online",
    "topbar.emailConfirm": "Conferma via email",

    "header.changeLanguage": "Cambia lingua",
    "header.account": "Account",
    "header.cart": "Carrello",

    "common.search": "Cerca...",
    "common.sort": "Ordina",

    "product.view": "Vedi",
    "product.request": "Acquista ora",

    "brands.title": "Marchi",

    "hero.kicker": "Checkout senza pagamento · Conferma email",
    "hero.title": "Catalogo veloce",
    "hero.titleAccent": " con login e chatbot",
    "hero.subtitle": "Layout tipo marketplace. Gli utenti inviano richieste; il team conferma via email.",
    "hero.ctaBrowse": "Sfoglia prodotti",
    "hero.ctaPricing": "Vedi prezzi",
    "hero.feature1": "Multilingua",
    "hero.feature2": "Veloce",
    "hero.feature3": "Pannello admin",

    "home.featured": "In evidenza",
    "home.shopNow": "Acquista ora",
    "home.bannerLabel": "Banner",
    "home.testimonials": "Cosa dicono i clienti",
    "home.trusted": "Scelto dai team",
    "home.trustedSubtitle": "Striscia brand automatica (supporta SVG).",

    "shop.title": "Negozio",
    "shop.subtitle": "Ricerca + categoria.",

    "footer.resources": "Risorse",
    "footer.information": "Informazioni",
    "footer.about": "Chi siamo",
    "footer.faq": "F.A.Q",
    "footer.privacy": "Privacy Policy",
    "footer.refund": "Resi e rimborsi",
    "footer.disclaimer": "Disclaimer",
    "footer.terms": "Termini e Condizioni",
    "footer.subscribe": "Iscriviti",
    "footer.subscriptionHint": "Inserisci l'email per gestire le iscrizioni.",
    "footer.subscriptionPlaceholder": "example@domain.com",
    "footer.subscriptionCta": "Iscriviti",

    "cat.all": "Tutti",
    "cat.design": "Design",
    "cat.security": "Sicurezza",
    "cat.marketing": "Marketing",
    "cat.automation": "Automazione",
    "cat.aiTools": "Strumenti AI",

    "category.title": "Sfoglia per categoria",
    "category.subtitle": "Navigazione a schede.",
    "category.viewAll": "Vedi tutti i prodotti",

    "footer.language": "Lingua",
  },
  AR: {
    "nav.home": "الرئيسية",
    "nav.shop": "المتجر",
    "nav.pricing": "الأسعار",
    "nav.fraud": "تحذير احتيال",
    "nav.contact": "تواصل",

    "topbar.noPayment": "لا يوجد دفع إلكتروني",
    "topbar.emailConfirm": "تأكيد عبر البريد",

    "header.changeLanguage": "تغيير اللغة",
    "header.account": "الحساب",
    "header.cart": "السلة",

    "common.search": "بحث...",
    "common.sort": "ترتيب",

    "product.view": "عرض",
    "product.request": "اشتري الآن",

    "brands.title": "العلامات",

    "hero.kicker": "بدون دفع · تأكيد عبر البريد",
    "hero.title": "منصة كتالوج سريعة",
    "hero.titleAccent": " مع تسجيل دخول وروبوت محادثة",
    "hero.subtitle": "تصميم مثل المتاجر الكبيرة. المستخدم يرسل طلباً وفريقك يؤكد عبر البريد.",
    "hero.ctaBrowse": "تصفح المنتجات",
    "hero.ctaPricing": "عرض الأسعار",
    "hero.feature1": "متعدد اللغات",
    "hero.feature2": "سريع",
    "hero.feature3": "لوحة إدارة",

    "home.featured": "مميز",
    "home.shopNow": "تسوق الآن",
    "home.bannerLabel": "لافتة",
    "home.testimonials": "آراء العملاء",
    "home.trusted": "موثوق من الفرق",
    "home.trustedSubtitle": "شريط علامات تلقائي (يدعم SVG).",

    "shop.title": "المتجر",
    "shop.subtitle": "بحث + فئة.",

    "footer.resources": "الموارد",
    "footer.information": "معلومات",
    "footer.about": "مَن نحن",
    "footer.faq": "الأسئلة الشائعة",
    "footer.privacy": "سياسة الخصوصية",
    "footer.refund": "سياسة الإرجاع والاسترداد",
    "footer.disclaimer": "إخلاء المسؤولية",
    "footer.terms": "الشروط والأحكام",
    "footer.subscribe": "اشترك",
    "footer.subscriptionHint": "أدخل البريد الإلكتروني لإدارة الاشتراكات.",
    "footer.subscriptionPlaceholder": "example@domain.com",
    "footer.subscriptionCta": "اشترك",

    "cat.all": "الكل",
    "cat.design": "تصميم",
    "cat.security": "أمان",
    "cat.marketing": "تسويق",
    "cat.automation": "أتمتة",
    "cat.aiTools": "أدوات الذكاء الاصطناعي",

    "category.title": "تصفّح حسب الفئة",
    "category.subtitle": "تنقّل بعلامات تبويب.",
    "category.viewAll": "عرض كل المنتجات",

    "footer.language": "اللغة",
  },
};

function TestimonialsSection({
  testimonials,
  idx,
  onIdxChange,
}: {
  testimonials: TestimonialT[];
  idx: number;
  onIdxChange: (next: number | ((prev: number) => number)) => void;
}) {
  const t0 = testimonials[idx];
  if (!t0) return null;

  const perPage = 4;
  const pageCount = Math.max(1, Math.ceil(testimonials.length / perPage));
  const [listPage, setListPage] = useState(0);

  useEffect(() => {
    const nextPage = Math.min(pageCount - 1, Math.max(0, Math.floor(idx / perPage)));
    if (nextPage !== listPage) setListPage(nextPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, pageCount]);

  const parsed = (() => {
    const raw = (t0.text || "").trim();
    const [firstLineRaw, ...rest] = raw.split("\n");
    const firstLine = (firstLineRaw || "").trim();
    const body = (rest.length ? rest.join("\n") : raw).trim();

    const looksLikeMeta = /^⭐{3,5}/.test(firstLine) && firstLine.includes("·");
    if (!looksLikeMeta) {
      return {
        rating: (t0 as any).rating as string | undefined,
        date: (t0 as any).date as string | undefined,
        text: raw,
      };

    }

    const [ratingPart, datePart] = firstLine.split("·").map((s) => s.trim());
    return {
      rating: ratingPart || (t0 as any).rating,
      date: datePart || (t0 as any).date,
      text: body,
    };
  })();

  const getInitials = (name: string) => name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const goPrev = () => onIdxChange((x) => (x - 1 + testimonials.length) % testimonials.length);
  const goNext = () => onIdxChange((x) => (x + 1) % testimonials.length);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
      <div className="grid md:grid-cols-3 gap-6 items-start">
        <div className="md:col-span-2">
          <style>{`
            @keyframes testimonialIn {
              from { opacity: 0; transform: translateY(6px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          <div key={idx} style={{ animation: "testimonialIn 260ms ease-out" }}>
            {t0.companyLogo && (
              <div className="mb-4">
                <img src={t0.companyLogo} alt={t0.company} className="h-8 w-auto object-contain opacity-60" />
              </div>
            )}

            {parsed.rating || parsed.date ? (
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                {parsed.rating ? <div className="text-amber-600">{parsed.rating}</div> : null}
                {parsed.date ? <div>{parsed.date}</div> : null}
              </div>
            ) : null}

            <div
              className="mt-3 text-slate-600 text-sm leading-relaxed"
              style={{
                display: "-webkit-box",
                WebkitBoxOrient: "vertical" as any,
                WebkitLineClamp: 5 as any,
                overflow: "hidden",
              }}
            >
              {parsed.text}
            </div>

            <div className="mt-5 flex items-center gap-3">
              {t0.photo ? (
                <img src={t0.photo} alt={t0.name} className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <div className="h-12 w-12 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-semibold">
                  {getInitials(t0.name)}
                </div>
              )}
              <div>
                <div className="text-sm font-semibold text-slate-900">{t0.name}</div>
                <div className="text-xs text-slate-500">{t0.role}{t0.company ? ` (${t0.company})` : ""}</div>
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
        </div>

        <div className="space-y-3">
          {testimonials.slice(listPage * perPage, listPage * perPage + perPage).map((x, i) => {
            const globalIdx = listPage * perPage + i;
            return (
              <button
                key={x.id || x.name}
                onClick={() => onIdxChange(globalIdx)}
                className={`w-full text-left rounded-2xl border p-4 transition ${
                  globalIdx === idx ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  {x.photo ? (
                    <img src={x.photo} alt={x.name} className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-semibold">
                      {getInitials(x.name)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{x.name}</div>
                    <div className="text-xs text-slate-500 truncate">{x.role}{x.company ? ` (${x.company})` : ""}</div>
                  </div>
                </div>
              </button>
            );
          })}

          {pageCount > 1 ? (
            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                onClick={() => setListPage((p) => Math.max(0, p - 1))}
                className="h-9 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm"
                disabled={listPage === 0}
              >
                Prev
              </button>

              <div className="flex flex-wrap items-center justify-center gap-2">
                {Array.from({ length: pageCount }).map((_, p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setListPage(p);
                      const firstIdx = p * perPage;
                      if (Number.isFinite(firstIdx) && testimonials[firstIdx]) onIdxChange(firstIdx);
                    }}
                    className={`h-9 w-9 rounded-xl border text-sm transition ${
                      p === listPage ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                    aria-label={`Page ${p + 1}`}
                  >
                    {p + 1}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setListPage((p) => Math.min(pageCount - 1, p + 1))}
                className="h-9 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm"
                disabled={listPage >= pageCount - 1}
              >
                Next
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function LightCatalogDemo(): JSX.Element {
  const [page, setPage] = useState<Page>("home");

  // Scroll to top when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  const [lang, setLang] = useState<Lang>("EN");
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedProductId, setSelectedProductId] = useState(1);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [bannerIdx, setBannerIdx] = useState(0);
  const [me, setMe] = useState<any>(null);

  const [testimonialIdx, setTestimonialIdx] = useState(0);
  
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
  type SiteSettingsT = { siteName: string; headerLogo: string; footerLogo: string; supportImage: string };
  const [siteSettings, setSiteSettings] = useState<SiteSettingsT>({
    siteName: "YourBrand",
    headerLogo: "",
    footerLogo: "",
    supportImage: "",
  });

  const refreshNavItems = async () => {
    try {
      const json = await gatewayFetch("/nav", { method: "GET" });
      const items = (json?.items || []) as NavItemT[];
      if (items.length > 0) setNavItems(items);
    } catch {
      // keep defaults
    }
  };

  const refreshSiteSettings = async () => {
    try {
      const json = await gatewayFetch("/settings", { method: "GET" });
      if (json?.settings) setSiteSettings(json.settings);
    } catch {
      // keep defaults
    }
  };

  useEffect(() => {
    refreshNavItems();
    refreshSiteSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const gatewayBase = "/api";
  const isProbablyJwt = (token: string) => token.split(".").length === 3;

  const getDeviceId = () => {
    if (typeof window === "undefined") return "";
    const key = "deviceId";
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const id = (typeof crypto !== "undefined" && "randomUUID" in crypto)
      ? // @ts-expect-error randomUUID exists in modern browsers
        crypto.randomUUID()
      : `dev_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem(key, id);
    return id;
  };

  const gatewayFetch = async (path: string, init?: RequestInit) => {
    const token = typeof window !== "undefined" ? window.localStorage.getItem("token") : null;
    if (token && !isProbablyJwt(token)) window.localStorage.removeItem("token");
    const effectiveToken = token && isProbablyJwt(token) ? token : null;

    const isFormDataBody = typeof FormData !== "undefined" && init?.body instanceof FormData;

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

    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
    return json;
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

  const refreshProducts = async () => {
    setProductsBusy(true);
    setProductsError(null);
    try {
      const json = await gatewayFetch(`/products?q=${encodeURIComponent(query)}&category=${encodeURIComponent(selectedCategory)}`, { method: "GET" });
      const items = (json?.items || []) as ProductT[];
      setProducts(items);
      if (items.length && !items.some((p) => p.id === selectedProductId)) {
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
        if (idx < 0) return prev;
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
    refreshProducts();
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

  useEffect(() => {
    if (page !== "product") return;
    refreshSelectedProduct(selectedProductId);
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

  const testimonialAutoplayMs = 3000;
  useEffect(() => {
    if (page !== "home") return;
    const len = testimonials.length;
    if (len <= 1) return;
    const timer = window.setTimeout(() => {
      setTestimonialIdx((x) => (x + 1) % len);
    }, testimonialAutoplayMs);
    return () => window.clearTimeout(timer);
  }, [page, testimonialIdx, testimonials.length]);

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

  const initialFraudList = useMemo<FraudItem[]>(
    () => [
      { name: "John Doe", handle: "@fake_support", platform: "Telegram", note: "Impersonating support and requesting prepayment.", reports: 50 },
      { name: "RipCrack Support 2", handle: "support-ripcrack.com", platform: "Email", note: "Fake email domain asking for crypto payments.", reports: 12 },
      { name: "WhatsApp Agent", handle: "+000 000 0000", platform: "WhatsApp", note: "Claims to be official, sends phishing links.", reports: 7 },
    ],
    []
  );

  const [fraudItems, setFraudItems] = useState<FraudItem[]>(initialFraudList);

  const [fraudForm, setFraudForm] = useState({
    name: "",
    platform: "Telegram" as FraudItem["platform"],
    handle: "",
    details: "",
    evidenceLink: "",
  });

  const [fraudFormSent, setFraudFormSent] = useState(false);

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

  const refreshPricingPlans = async () => {
    try {
      const json = await gatewayFetch("/pricing", { method: "GET" });
      const items = (json?.items || []) as PricingPlanT[];
      if (items.length > 0) setPricingPlans(items);
    } catch {
      // keep defaults on error
    }
  };

  useEffect(() => {
    refreshPricingPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const banners = useMemo(
    () => [
      { title: "Seasonal bundle", subtitle: "Limited-time offer", cta: "Shop now" },
      { title: "Support 24/7", subtitle: "Chat + WhatsApp", cta: "Contact" },
      { title: "Email orders", subtitle: "No payment gateway", cta: "Request" },
    ],
    []
  );

  useEffect(() => {
    try {
      runSelfTests({ categories, brands: headerBrands, banners, pricingPlans });
    } catch (e) {
      console.error(e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (page !== "home") return;
    const timer = setInterval(() => setBannerIdx((x) => (x + 1) % banners.length), 3000);
    return () => clearInterval(timer);
  }, [banners.length, page]);

  const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`}>{children}</div>
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

  function HeaderSearch() {
    return (
      <div className="hidden md:block relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("common.search")}
          className="rounded-xl border border-slate-200 bg-white pl-3 pr-10 py-2 text-sm w-56"
        />
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
    );
  }

  function BrandStripAuto() {
    const items = [...trustedBrands, ...trustedBrands, ...trustedBrands];
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

  function BrandChip({ b }: { b: Brand }) {
    return (
      <div className="h-14 min-w-[160px] rounded-2xl bg-slate-50 flex items-center justify-center px-5">
        {b.logo ? (
          <img src={b.logo} alt={b.name} className="h-10 w-auto max-w-[140px] object-contain" />
        ) : (
          <div className="text-sm font-semibold text-slate-600">{b.name}</div>
        )}
      </div>
    );
  }

  const ProductCard = ({ p }: { p: ProductT }) => {
    const stats = productStats[p.id] || { views: p.views, sold: p.sold };
    const cover = p.images?.[0];
    const effectivePrice = selectedType === "Business" ? (p.businessPrice || p.price) : (p.personalPrice || p.price);
    return (
      <div className="group">
        <Card className="overflow-hidden">
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
          <div className="p-4">
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
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  setSelectedProductId(p.id);
                  setPage("product");
                }}
                className="flex-1 rounded-xl border border-slate-200 text-slate-800 py-2 text-sm hover:bg-slate-50"
              >
                {t("product.view")}
              </button>
              <button
                onClick={() => {
                  setSelectedProductId(p.id);
                  setPage("product");
                }}
                className="flex-1 rounded-xl bg-emerald-600 text-white py-2 text-sm hover:bg-emerald-700"
              >
                {t("product.request")}
              </button>
            </div>
          </div>
        </Card>

      <Card className="p-6 mt-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-slate-900">Users</div>
            <div className="text-sm text-slate-600 mt-1">Registered users.</div>
          </div>
          <div className="flex gap-2">
            <button onClick={refreshUsers} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50">
              Refresh
            </button>
            <button onClick={downloadUsersCsv} className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm hover:bg-black">
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
            users.slice(0, 50).map((u) => (
              <div key={u.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900 truncate">{u.email}</div>
                <div className="mt-1 text-xs text-slate-500">Role: {u.role}</div>
                <div className="mt-1 text-xs text-slate-500">Created: {u.createdAt ? new Date(u.createdAt).toLocaleString() : "-"}</div>
                <div className="mt-1 text-xs text-slate-500 truncate">ID: {u.id}</div>
              </div>
            ))
          )}
        </div>
        {users.length > 50 ? <div className="mt-3 text-xs text-slate-500">Showing first 50 users. Use CSV download for full list.</div> : null}
      </Card>

      <Card className="p-6 mt-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-slate-900">Orders</div>
            <div className="text-sm text-slate-600 mt-1">Latest order requests.</div>
          </div>
          <button onClick={refreshOrders} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50">
            Refresh
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">Download orders</div>
          <div className="mt-3 grid md:grid-cols-3 gap-3">
            <select value={ordersExportStatus} onChange={(e) => setOrdersExportStatus(e.target.value as any)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
              <option value="ALL">All</option>
              <option value="REQUESTED">Requested</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="REJECTED">Rejected</option>
            </select>
            <input value={ordersExportFrom} onChange={(e) => setOrdersExportFrom(e.target.value)} type="date" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
            <input value={ordersExportTo} onChange={(e) => setOrdersExportTo(e.target.value)} type="date" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
          </div>
          <button onClick={downloadOrdersCsv} className="mt-3 w-full rounded-xl bg-slate-900 text-white py-3 text-sm hover:bg-black">
            Download CSV
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {orders.length === 0 ? (
            <div className="text-sm text-slate-600">No orders yet.</div>
          ) : (
            orders.slice(0, 12).map((o) => (
              <button
                key={o.id}
                onClick={() => openOrder(o)}
                className={`w-full text-left rounded-2xl border p-4 hover:bg-slate-50 ${getOrderCardClass(o.status)}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900">#{o.id}</div>
                  <div className="text-xs text-slate-500">{new Date(o.createdAt).toLocaleString()}</div>
                </div>
                <div className="mt-2 text-sm text-slate-700">{o.product?.title}</div>
                <div className="mt-1 text-xs text-slate-500">User: {o.user?.email}</div>
                <div className="mt-1 text-xs text-slate-500">Status: {o.status} · Term: {o.purchaseTerm} · Plan: {o.selectedType}</div>
                {o.notes ? <div className="mt-2 text-xs text-slate-600">Note: {o.notes}</div> : null}
              </button>
            ))
          )}
        </div>

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

              <div className="p-5 space-y-3 text-sm">
                {orderStatusErr ? <div className="text-sm text-red-700">{orderStatusErr}</div> : null}
                {orderStatusOk ? <div className="text-sm text-emerald-700">{orderStatusOk}</div> : null}

                <div className="grid md:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Product</div>
                    <div className="font-medium text-slate-900">{activeOrder.product?.title || "-"}</div>
                    <div className="mt-1 text-xs text-slate-600">Plan: {activeOrder.selectedType} · Term: {activeOrder.purchaseTerm}</div>
            {ok ? <div className="mt-4 text-sm text-emerald-700">{ok}</div> : null}

            <div className="mt-5 space-y-3">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                {categories.filter((c) => c !== "All").map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => setImages(Array.from(e.target.files || []))}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
              />
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm min-h-[110px]" />
              <input value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="Badge (optional)" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
              <input value={personalPrice} onChange={(e) => setPersonalPrice(e.target.value)} placeholder="Personal price" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
              <input value={businessPrice} onChange={(e) => setBusinessPrice(e.target.value)} placeholder="Business price" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
              <input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder="SEO title (optional)" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
              <textarea value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} placeholder="SEO description (optional)" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm min-h-[90px]" />

              <button disabled={busy || !title.trim()} onClick={createProduct} className="w-full rounded-xl bg-slate-900 text-white py-3 text-sm hover:bg-black disabled:opacity-60">
                Create
              </button>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-slate-900">Orders</div>
                <div className="text-sm text-slate-600 mt-1">Latest order requests.</div>
              </div>
              <button onClick={refreshOrders} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50">
                Refresh
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Download orders</div>
              <div className="mt-3 grid md:grid-cols-3 gap-3">
                <select value={ordersExportStatus} onChange={(e) => setOrdersExportStatus(e.target.value as any)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                  <option value="ALL">All</option>
                  <option value="REQUESTED">Requested</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="REJECTED">Rejected</option>
                </select>
                <input value={ordersExportFrom} onChange={(e) => setOrdersExportFrom(e.target.value)} type="date" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                <input value={ordersExportTo} onChange={(e) => setOrdersExportTo(e.target.value)} type="date" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
              </div>
              <button onClick={downloadOrdersCsv} className="mt-3 w-full rounded-xl bg-slate-900 text-white py-3 text-sm hover:bg-black">
                Download CSV
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {orders.length === 0 ? (
                <div className="text-sm text-slate-600">No orders yet.</div>
              ) : (
                orders.slice(0, 12).map((o) => (
                  <button
                    key={o.id}
                    onClick={() => openOrder(o)}
                    className={`w-full text-left rounded-2xl border p-4 hover:bg-slate-50 ${getOrderCardClass(o.status)}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-900">#{o.id}</div>
                      <div className="text-xs text-slate-500">{new Date(o.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="mt-2 text-sm text-slate-700">{o.product?.title}</div>
                    <div className="mt-1 text-xs text-slate-500">User: {o.user?.email}</div>
                    <div className="mt-1 text-xs text-slate-500">Status: {o.status} · Term: {o.purchaseTerm} · Plan: {o.selectedType}</div>
                    {o.notes ? <div className="mt-2 text-xs text-slate-600">Note: {o.notes}</div> : null}
                  </button>
                ))
              )}
            </div>

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

                  <div className="p-5 space-y-3 text-sm">
                    {orderStatusErr ? <div className="text-sm text-red-700">{orderStatusErr}</div> : null}
                    {orderStatusOk ? <div className="text-sm text-emerald-700">{orderStatusOk}</div> : null}

                    <div className="grid md:grid-cols-2 gap-3">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="text-xs text-slate-500">Product</div>
                        <div className="font-medium text-slate-900">{activeOrder.product?.title || "-"}</div>
                        <div className="mt-1 text-xs text-slate-600">Plan: {activeOrder.selectedType} · Term: {activeOrder.purchaseTerm}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="text-xs text-slate-500">User account</div>
                        <div className="font-medium text-slate-900">{activeOrder.user?.email || "-"}</div>
                        <div className="mt-1 text-xs text-slate-600">Status: {activeOrder.status}</div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="text-xs text-slate-500">Customer info</div>
                      <div className="mt-1 text-slate-900"><b>Name:</b> {activeOrder.customerName || "-"}</div>
                      <div className="text-slate-900"><b>Email:</b> {activeOrder.customerEmail || "-"}</div>
                      <div className="text-slate-900"><b>Phone:</b> {activeOrder.customerPhone || "-"}</div>
                      <div className="text-slate-900"><b>Address:</b> {[activeOrder.street, activeOrder.city, activeOrder.zip, activeOrder.country].filter(Boolean).join(", ") || "-"}</div>
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
          </Card>
        </div>

        {/* Brand Management Section */}
        <BrandManagement />

        {/* Category Management Section */}
        <CategoryManagement />

        {/* Pricing Management Section */}
        <PricingManagement />

        {/* Navigation Management Section */}
        <NavManagement />

        {/* Site Settings Section */}
        <SiteSettingsManagement />

        {/* Coupon Management Section */}
        <CouponManagement />

        {/* Testimonial Management Section */}
        <TestimonialManagement />

        {/* Product Management Section */}
        <ProductManagement />
      </section>
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
            <button onClick={createTestimonial} disabled={testimonialBusy || !newT.name.trim() || !newT.text.trim()} className="mt-3 rounded-xl bg-cyan-600 text-white px-6 py-2 text-sm hover:bg-cyan-700 disabled:opacity-60">
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
                <div className="col-span-2 md:col-span-4 rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-xs text-slate-500 mb-2">Select products this coupon applies to</div>
                  <div className="max-h-44 overflow-auto grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {couponProducts.map((p) => {
                      const checked = newCoupon.applicableProductIds.includes(p.id);
                      return (
                        <label key={p.id} className="flex items-center gap-2 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? Array.from(new Set([...newCoupon.applicableProductIds, p.id]))
                                : newCoupon.applicableProductIds.filter((x) => x !== p.id);
                              setNewCoupon({ ...newCoupon, applicableProductIds: next });
                            }}
                          />
                          <span className="truncate" title={p.title}>
                            {p.title}
                          </span>
                        </label>
                      );
                    })}
                    {couponProducts.length === 0 ? (
                      <div className="text-xs text-slate-500">No products loaded.</div>
                    ) : null}
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
                          ? `Applies to products: ${(c.applicableProductIds || []).join(", ") || "(none)"}`
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
    const [catName, setCatName] = useState("");
    const [catBusy, setCatBusy] = useState(false);
    const [catErr, setCatErr] = useState<string | null>(null);
    const [catOk, setCatOk] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState("");

    const createCategory = async () => {
      if (!catName.trim()) return;
      setCatBusy(true);
      setCatErr(null);
      setCatOk(null);
      try {
        await gatewayFetch("/admin/categories", {
          method: "POST",
          body: JSON.stringify({ name: catName.trim(), sortOrder: categoryItems.length }),
        });
        setCatOk("Category added!");
        setCatName("");
        await refreshCategories();
      } catch (e: any) {
        setCatErr(e?.message || "Failed");
      } finally {
        setCatBusy(false);
      }
    };

    const updateCategory = async (id: number) => {
      if (!editName.trim()) return;
      try {
        await gatewayFetch(`/admin/categories/${id}`, {
          method: "PUT",
          body: JSON.stringify({ name: editName.trim() }),
        });
        setEditingId(null);
        setEditName("");
        await refreshCategories();
      } catch (e: any) {
        alert(e?.message || "Failed to update");
      }
    };

    const deleteCategory = async (id: number) => {
      if (!confirm("Delete this category?")) return;
      try {
        await gatewayFetch(`/admin/categories/${id}`, { method: "DELETE" });
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
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">Browse by category</span>
          </div>
          <div className="text-sm text-slate-600 mt-1">Manage product categories shown in the shop.</div>

          {catErr ? <div className="mt-4 text-sm text-red-700">{catErr}</div> : null}
          {catOk ? <div className="mt-4 text-sm text-emerald-700">{catOk}</div> : null}

          <div className="mt-5 flex gap-3">
            <input
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="New category name"
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
              onKeyDown={(e) => e.key === "Enter" && createCategory()}
            />
            <button
              disabled={catBusy || !catName.trim()}
              onClick={createCategory}
              className="rounded-xl bg-purple-600 text-white px-6 py-3 text-sm hover:bg-purple-700 disabled:opacity-60 whitespace-nowrap"
            >
              Add Category
            </button>
          </div>

          <div className="mt-6">
            <div className="text-sm font-medium text-slate-700 mb-3">Current Categories</div>
            <div className="flex flex-wrap gap-2">
              {categoryItems.map((c) => (
                <div key={c.id} className="flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-3 py-2">
                  {editingId === c.id ? (
                    <>
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-24 rounded border border-purple-300 px-2 py-1 text-sm"
                        onKeyDown={(e) => e.key === "Enter" && updateCategory(c.id)}
                        autoFocus
                      />
                      <button onClick={() => updateCategory(c.id)} className="text-emerald-600 hover:text-emerald-700 text-xs">✓</button>
                      <button onClick={() => setEditingId(null)} className="text-slate-500 hover:text-slate-700 text-xs">✕</button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-slate-700">{c.name}</span>
                      <button
                        onClick={() => { setEditingId(c.id); setEditName(c.name); }}
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
              {categoryItems.length === 0 && (
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
            <button disabled={pricingBusy || !newName.trim()} onClick={createPlan} className="mt-3 rounded-xl bg-amber-600 text-white px-6 py-2 text-sm hover:bg-amber-700 disabled:opacity-60">
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

    const availablePages = ["home", "shop", "pricing", "fraud", "contact", "about", "faq", "special", "coupons", "refund", "privacy", "cookies", "disclaimer", "terms"];

    return (
      <div className="mt-6">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="text-lg font-semibold text-slate-900">🔗 Navigation Menu</div>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">Header nav</span>
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
            <button disabled={navBusy || !navLabel.trim() || !navPage} onClick={createNav} className="rounded-xl bg-indigo-600 text-white px-6 py-3 text-sm hover:bg-indigo-700 disabled:opacity-60">
              Add
            </button>
          </div>

          <div className="mt-6 space-y-2">
            {allNavItems.map((item) => (
              <div key={item.id} className={`rounded-xl border p-3 flex items-center justify-between ${item.visible ? "border-indigo-200 bg-indigo-50" : "border-slate-200 bg-slate-50 opacity-60"}`}>
                {editingNavId === item.id ? (
                  <div className="flex-1 flex gap-2 items-center">
                    <input value={editNavForm.label} onChange={(e) => setEditNavForm({ ...editNavForm, label: e.target.value })} className="rounded border px-2 py-1 text-sm w-32" />
                    <select value={editNavForm.page} onChange={(e) => setEditNavForm({ ...editNavForm, page: e.target.value })} className="rounded border px-2 py-1 text-sm">
                      {availablePages.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <label className="flex items-center gap-1 text-xs">
                      <input type="checkbox" checked={editNavForm.visible} onChange={(e) => setEditNavForm({ ...editNavForm, visible: e.target.checked })} />
                      Visible
                    </label>
                    <button onClick={updateNav} className="text-emerald-600 text-sm">Save</button>
                    <button onClick={() => setEditingNavId(null)} className="text-slate-500 text-sm">Cancel</button>
                  </div>
                ) : (
                  <>
                    <div>
                      <span className="font-medium text-slate-900">{item.label}</span>
                      <span className="text-xs text-slate-500 ml-2">→ {item.page}</span>
                      {!item.visible && <span className="text-xs text-red-500 ml-2">(hidden)</span>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingNavId(item.id!); setEditNavForm({ label: item.label, page: item.page, visible: item.visible ?? true }); }} className="text-blue-600 text-sm">Edit</button>
                      <button onClick={() => deleteNav(item.id!)} className="text-red-600 text-sm">Delete</button>
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
    const [settingsBusy, setSettingsBusy] = useState(false);
    const [settingsOk, setSettingsOk] = useState<string | null>(null);
    const [settingsErr, setSettingsErr] = useState<string | null>(null);

    useEffect(() => {
      setSiteName(siteSettings.siteName);
    }, [siteSettings.siteName]);

    const saveSettings = async () => {
      setSettingsBusy(true);
      setSettingsErr(null);
      setSettingsOk(null);
      try {
        const form = new FormData();
        form.append("siteName", siteName.trim());
        if (headerLogoFile) form.append("headerLogo", headerLogoFile);
        if (footerLogoFile) form.append("footerLogo", footerLogoFile);

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
            <span className="text-xs bg-rose-100 text-rose-700 px-2 py-1 rounded-full">Logo & Name</span>
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

            <button disabled={settingsBusy} onClick={saveSettings} className="rounded-xl bg-rose-600 text-white px-6 py-3 text-sm hover:bg-rose-700 disabled:opacity-60">
              Save Settings
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

    // Trusted brands state
    const [trustedName, setTrustedName] = useState("");
    const [trustedLogo, setTrustedLogo] = useState<File | null>(null);
    const [trustedBusy, setTrustedBusy] = useState(false);
    const [trustedErr, setTrustedErr] = useState<string | null>(null);
    const [trustedOk, setTrustedOk] = useState<string | null>(null);

    const createHeaderBrand = async () => {
      if (!headerName.trim()) return;
      setHeaderBusy(true);
      setHeaderErr(null);
      setHeaderOk(null);
      try {
        const form = new FormData();
        form.append("name", headerName.trim());
        form.append("sortOrder", String(headerBrands.length));
        form.append("type", "HEADER");
        if (headerLogo) form.append("logo", headerLogo);

        await gatewayFetch("/admin/brands", { method: "POST", body: form });
        setHeaderOk("Brand added!");
        setHeaderName("");
        setHeaderLogo(null);
        await refreshHeaderBrands();
      } catch (e: any) {
        setHeaderErr(e?.message || "Failed");
      } finally {
        setHeaderBusy(false);
      }
    };

    const createTrustedBrand = async () => {
      if (!trustedName.trim()) return;
      setTrustedBusy(true);
      setTrustedErr(null);
      setTrustedOk(null);
      try {
        const form = new FormData();
        form.append("name", trustedName.trim());
        form.append("sortOrder", String(trustedBrands.length));
        form.append("type", "TRUSTED");
        if (trustedLogo) form.append("logo", trustedLogo);

        await gatewayFetch("/admin/brands", { method: "POST", body: form });
        setTrustedOk("Brand added!");
        setTrustedName("");
        setTrustedLogo(null);
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
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">Header carousel</span>
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
                type="file"
                accept=".svg,.png,.jpg,.jpeg,.webp"
                onChange={(e) => setHeaderLogo(e.target.files?.[0] || null)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm"
              />
            </div>
            <button
              disabled={headerBusy || !headerName.trim()}
              onClick={createHeaderBrand}
              className="rounded-xl bg-blue-600 text-white px-6 py-3 text-sm hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap"
            >
              Add Brand
            </button>
          </div>

          <div className="mt-6">
            <div className="text-sm font-medium text-slate-700 mb-3">Current Brands</div>
            <div className="flex flex-wrap gap-3">
              {headerBrands.map((b) => (
                <div key={b.id || b.name} className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
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
                type="file"
                accept=".svg,.png,.jpg,.jpeg,.webp"
                onChange={(e) => setTrustedLogo(e.target.files?.[0] || null)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm"
              />
            </div>
            <button
              disabled={trustedBusy || !trustedName.trim()}
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

  const Fraud = () => {
    const [openIdx, setOpenIdx] = useState<number | null>(0);

    const reportExisting = (idx: number) => {
      setFraudItems((prev) => prev.map((it, i) => (i === idx ? { ...it, reports: it.reports + 1 } : it)));
    };

    const submitNewFraud = () => {
      if (!fraudForm.name.trim() || !fraudForm.handle.trim() || !fraudForm.details.trim()) {
        alert("Please fill: Name, Handle/Contact, Details");
        return;
      }
      setFraudItems((prev) => [{ name: fraudForm.name.trim(), platform: fraudForm.platform, handle: fraudForm.handle.trim(), note: fraudForm.details.trim().slice(0, 140), reports: 1 }, ...prev]);
      setFraudFormSent(true);
      setFraudForm({ name: "", platform: "Telegram", handle: "", details: "", evidenceLink: "" });
      setTimeout(() => setFraudFormSent(false), 2500);
    };

    return (
      <section className="max-w-7xl mx-auto px-6 py-12">
        <SectionTitle title="Attention Fraud" subtitle="If you see fraud accounts, report them here." />

        <Card className="p-6 mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-lg font-semibold text-slate-900">Report a fraud account</div>
              <div className="text-sm text-slate-600 mt-1">Fill the form — we will review and add it to the list.</div>
            </div>
            {fraudFormSent ? <div className="text-sm bg-emerald-50 text-emerald-800 border border-emerald-100 px-3 py-2 rounded-xl">Submitted ✅</div> : null}
          </div>

          <div className="mt-5 grid md:grid-cols-2 gap-4">
            <input value={fraudForm.name} onChange={(e) => setFraudForm((s) => ({ ...s, name: e.target.value }))} placeholder="Fraud name / title" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
            <select value={fraudForm.platform} onChange={(e) => setFraudForm((s) => ({ ...s, platform: e.target.value as FraudItem["platform"] }))} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
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
            <button onClick={submitNewFraud} className="rounded-xl bg-slate-900 text-white px-5 py-3 text-sm hover:bg-black">
              Submit report
            </button>
            <button onClick={() => setFraudForm({ name: "", platform: "Telegram", handle: "", details: "", evidenceLink: "" })} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm hover:bg-slate-50">
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
              <div key={`${x.name}-${x.handle}-${i}`} role="button" tabIndex={0} onClick={() => setOpenIdx((cur) => (cur === i ? null : i))} className="text-left cursor-pointer">
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
                        <div className="mt-2 text-sm text-slate-600 leading-relaxed">Example extra info: scam method, date reported, links/screenshots.</div>

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

  const Account = () => {
    const [loginEmail, setLoginEmail] = useState("");
    const [loginPassword, setLoginPassword] = useState("");
    const [loginPwVisible, setLoginPwVisible] = useState(false);
    const [loginCaptchaToken, setLoginCaptchaToken] = useState("");
    const [loginCaptchaOpen, setLoginCaptchaOpen] = useState(false);
    const [fullName, setFullName] = useState("");
    const [regEmail, setRegEmail] = useState("");
    const [regPassword, setRegPassword] = useState("");
    const [regPwVisible, setRegPwVisible] = useState(false);
    const [regCaptchaToken, setRegCaptchaToken] = useState("");
    const [regCaptchaOpen, setRegCaptchaOpen] = useState(false);

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
    }, [turnstileSiteKey, me, loginCaptchaOpen, regCaptchaOpen]);

    const resetLoginCaptcha = () => {
      setLoginCaptchaToken("");
      const w = window as any;
      if (w?.turnstile && loginWidgetIdRef.current != null) {
        try {
          w.turnstile.reset(loginWidgetIdRef.current);
        } catch {
          // ignore
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
          w.turnstile.reset(regWidgetIdRef.current);
        } catch {
          // ignore
        }
      }
      const el = document.getElementById("turnstile-register");
      if (el) el.removeAttribute("data-rendered");
    };

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

        await refreshMe();
      } catch (e: any) {
        setAuthError(e?.message || "Login failed");
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

        if (json?.token) window.localStorage.setItem("token", json.token);

        await refreshMe();
      } catch (e: any) {
        setAuthError(e?.message || "Register failed");
      } finally {
        setAuthBusy(false);
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

    return (
      <section className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-2 gap-8 items-start">
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
                  <div className="text-sm font-semibold text-slate-900">{me.first_name || me.email}</div>
                  <div className="text-xs text-slate-500 mt-1">{me.email}</div>

                  {/* ✅ FIX: role from me.role */}
                  <div className="text-xs text-slate-500 mt-1">{me.role === "ADMIN" ? "Role: Admin" : "Role: Customer"}</div>
                </div>

                <button disabled={authBusy} onClick={doLogout} className="w-full rounded-xl border border-slate-200 bg-white py-3 text-sm hover:bg-slate-50 disabled:opacity-60">
                  Logout
                </button>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                <input value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="Email" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                <div className="relative">
                  <input
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
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
                  <div className="text-xs text-slate-500">CAPTCHA is not configured (missing VITE_TURNSTILE_SITE_KEY).</div>
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
                  disabled={authBusy || (turnstileSiteKey ? !loginCaptchaToken : false)}
                  onClick={doLogin}
                  className="w-full rounded-xl bg-slate-900 text-white py-3 text-sm hover:bg-black disabled:opacity-60"
                >
                  Sign in
                </button>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <div className="text-xl font-semibold text-slate-900">Create account</div>
            <div className="text-sm text-slate-600 mt-1">Register to save your order history.</div>
            <div className="mt-5 space-y-3">
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
                <div className="text-xs text-slate-500">CAPTCHA is not configured (missing VITE_TURNSTILE_SITE_KEY).</div>
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
                disabled={authBusy || (turnstileSiteKey ? !regCaptchaToken : false)}
                onClick={doRegister}
                className="w-full rounded-xl bg-emerald-600 text-white py-3 text-sm hover:bg-emerald-700 disabled:opacity-60"
              >
                Create account
              </button>
            </div>
          </Card>
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
    
    // Coupon state
    const [couponCode, setCouponCode] = useState("");
    const [appliedCoupon, setAppliedCoupon] = useState<CouponT | null>(null);
    const [couponLoading, setCouponLoading] = useState(false);
    const [couponError, setCouponError] = useState<string | null>(null);

    const applyCoupon = async () => {
      if (!couponCode.trim()) return;
      setCouponLoading(true);
      setCouponError(null);
      try {
        const json = await gatewayFetch("/coupons/validate", {
          method: "POST",
          body: JSON.stringify({ code: couponCode.trim(), productId: selectedProduct?.id || undefined }),
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
      setBusy(true);
      setErr(null);
      setSent(false);
      try {
        if (!selectedProduct?.id) throw new Error("Please select a product");
        if (!fullName.trim()) throw new Error("Full name is required");
        if (!email.trim() || !isEmailValid(email)) throw new Error("Please enter a valid email");
        if (!phone.trim() || !isPhoneValid(phone)) throw new Error("Please enter a valid phone number");
        if (!country.trim()) throw new Error("Country is required");
        if (!city.trim()) throw new Error("City is required");
        if (!street.trim()) throw new Error("Street address is required");
        if (!zip.trim() || zip.trim().length < 3) throw new Error("ZIP/Postal code is required");
        const licenseLine = selectedType === "Business" ? "This license is for multiple PCs." : "License for one PC.";
        await gatewayFetch("/orders", {
          method: "POST",
          body: JSON.stringify({
            productId: selectedProduct.id,
            purchaseTerm: purchaseTerm === "annual" ? "ANNUAL" : "LIFETIME",
            selectedType,
            customerName: fullName.trim(),
            customerEmail: email.trim(),
            customerPhone: phone.trim(),
            country: country.trim(),
            city: city.trim(),
            street: street.trim(),
            zip: zip.trim(),
            notes: `${licenseLine}${notes.trim() ? `\n${notes}` : ""}${appliedCoupon ? `\n[Coupon: ${appliedCoupon.code}]` : ""}`,
          }),
        });
        setSent(true);
        setTimeout(() => setSent(false), 2500);
      } catch (e: any) {
        setErr(e?.message || "Order failed");
      } finally {
        setBusy(false);
      }
    };

    const canSubmit =
      !!selectedProduct?.id &&
      !!fullName.trim() &&
      !!email.trim() &&
      isEmailValid(email) &&
      !!phone.trim() &&
      isPhoneValid(phone) &&
      !!country.trim() &&
      !!city.trim() &&
      !!street.trim() &&
      !!zip.trim() &&
      zip.trim().length >= 3;

    return (
      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2">
            <SectionTitle title="Checkout" subtitle="No payment — order is confirmed via email." />
            <Card className="p-6">
              {err ? <div className="text-sm text-red-700 mb-4">{err}</div> : null}
              {sent ? <div className="text-sm bg-emerald-50 text-emerald-800 border border-emerald-100 px-3 py-2 rounded-xl mb-4">Submitted ✅</div> : null}

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
                <select value={selectedType} onChange={(e) => setSelectedType(e.target.value as "Personal" | "Business")} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                  <option value="Personal">Personal</option>
                  <option value="Business">Business</option>
                </select>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  {selectedType === "Business" ? "This license is for multiple PCs." : "License for one PC."}
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

              <div className="mt-5 flex flex-wrap gap-3">
                <button disabled={busy || !canSubmit} onClick={submit} className="rounded-xl bg-emerald-600 text-white px-6 py-3 text-sm font-medium hover:bg-emerald-700 disabled:opacity-60">
                  Place order (Email confirmation)
                </button>
                <button onClick={() => setPage("shop")} className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm hover:bg-slate-50">
                  Back to shop
                </button>
              </div>
            </Card>
          </div>

          <div>
            <SectionTitle title="Order summary" />
            <Card className="p-6">
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Product</span>
                  <span className="text-slate-900 font-medium">{selectedProduct.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Type</span>
                  <span className="text-slate-900 font-medium">{selectedType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">License</span>
                  <span className="text-slate-900 font-medium">{selectedType === "Business" ? "This license is for multiple PCs." : "License for one PC."}</span>
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
          w.turnstile.reset(contactWidgetIdRef.current);
        } catch {
          // ignore
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
                <div className="text-xs text-slate-500">CAPTCHA is not configured (missing VITE_TURNSTILE_SITE_KEY).</div>
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

            {me?.role === "ADMIN" ? (
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

  const PageBody = () => {
    if (page === "home") return <Home />;
    if (page === "shop") return <Shop />;
    if (page === "product") return <Product />;
    if (page === "pricing") return <Pricing />;
    if (page === "fraud") return <Fraud />;
    if (page === "account") return <Account />;
    if (page === "admin") return <Admin />;
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
      {/* Topbar */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-between text-xs text-slate-600">
          <div className="flex gap-3 items-center">
            <a href="mailto:support@ripcrack.net" className="hover:text-slate-900">support@ripcrack.net</a>
            <span className="h-3 w-px bg-slate-200" />
            <a href="https://wa.me/4863881006" target="_blank" rel="noreferrer" className="hover:text-slate-900">
              WhatsApp · 24/7 (+48 6388 1006)
            </a>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-emerald-700 font-medium">{t("topbar.noPayment")}</span>
            <span className="h-3 w-px bg-slate-200" />
            <span>{t("topbar.emailConfirm")}</span>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <button onClick={() => setPage("home")} className="flex items-center gap-2">
            {siteSettings.headerLogo ? (
              <img src={siteSettings.headerLogo} alt={siteSettings.siteName} className="h-8 max-h-8 w-auto max-w-[120px] object-contain" />
            ) : (
              <div className="h-8 w-8 rounded-xl bg-emerald-600" />
            )}
            <div className="text-lg font-semibold text-slate-900">{siteSettings.siteName}</div>
          </button>

          <nav className="hidden md:flex items-center gap-4">
            {navItems.map((item) => (
              <NavLink key={item.id || item.page} id={item.page as Page} label={item.label} />
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <HeaderSearch />

            <button
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
              onClick={() => setLang((x) => (x === "EN" ? "RU" : x === "RU" ? "IT" : x === "IT" ? "AR" : "EN"))}
              title={t("header.changeLanguage")}
            >
              {lang} ▾
            </button>

            <button onClick={() => setPage("account")} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50">
              {t("header.account")}
            </button>

            {me?.role === "ADMIN" ? (
              <button onClick={() => setPage("admin")} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50">
                Admin
              </button>
            ) : null}

            <button
              onClick={() => {
                if (!guardCheckout()) return;
                setPage("checkout");
              }}
              className="rounded-xl bg-slate-900 text-white px-3 py-2 text-sm hover:bg-black"
            >
              {t("header.cart")} · 2
            </button>
          </div>
        </div>
      </header>

      {/* Brand carousel */}
      <ManualBrandCarousel />

      {/* Content */}
      <PageBody />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-10 grid md:grid-cols-4 gap-8">
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
              <button onClick={() => setPage("pricing")} className="block hover:text-slate-900">
                {t("nav.pricing")}
              </button>
              <button onClick={() => setPage("fraud")} className="block hover:text-slate-900">
                {t("nav.fraud")}
              </button>
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-slate-900">{t("footer.information")}</div>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <button onClick={() => setPage("about")} className="block hover:text-slate-900">
                {t("footer.about")}
              </button>
              <button onClick={() => setPage("faq")} className="block hover:text-slate-900">
                {t("footer.faq")}
              </button>
              <button onClick={() => setPage("privacy")} className="block hover:text-slate-900">
                {t("footer.privacy")}
              </button>
              <button onClick={() => setPage("cookies")} className="block hover:text-slate-900">
                Cookie Policy
              </button>
              <button onClick={() => setPage("refund")} className="block hover:text-slate-900">
                {t("footer.refund")}
              </button>
              <button onClick={() => setPage("disclaimer")} className="block hover:text-slate-900">
                {t("footer.disclaimer")}
              </button>
              <button onClick={() => setPage("terms")} className="block hover:text-slate-900">
                {t("footer.terms")}
              </button>
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-slate-900">{t("footer.subscribe")}</div>
            <div className="text-sm text-slate-600 mt-2">{t("footer.subscriptionHint")}</div>
            <div className="mt-3 flex gap-2">
              <input placeholder={t("footer.subscriptionPlaceholder")} className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
              <button className="rounded-xl bg-emerald-600 text-white px-4 py-3 text-sm hover:bg-emerald-700">{t("footer.subscriptionCta")}</button>
            </div>
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

      {/* Chat widget */}
      <div className={`fixed ${cookieConsent === "pending" ? "bottom-48 md:bottom-6" : "bottom-6"} right-6 z-50 transition-all`}>
        {isChatOpen ? <ChatWidget onClose={() => setIsChatOpen(false)} /> : (
          <button onClick={() => setIsChatOpen(true)} className="h-14 w-14 rounded-full bg-emerald-600 text-white shadow-lg hover:bg-emerald-700" title="Chat">
            💬
          </button>
        )}
      </div>

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

function ChatWidget({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([
    { role: "assistant", text: "Hi! How can I help you?" },
    { role: "assistant", text: 'Try: "How do orders work?"' },
  ]);

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || busy) return;

    setError(null);
    setBusy(true);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);

    try {
      const base = window.location.hostname !== "localhost" ? "/api" : "http://localhost:3003";
      const res = await fetch(`${base}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: trimmed }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Chat failed");
      setMessages((prev) => [...prev, { role: "assistant", text: json.reply || "" }]);
    } catch (e: any) {
      setError(e?.message || "Chat failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-[320px] bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 text-white">
        <div className="text-sm font-semibold">Support Chat</div>
        <button onClick={onClose} className="text-sm">✕</button>
      </div>
      <div className="p-4 space-y-3 text-sm">
        {error ? <div className="text-sm text-red-700">{error}</div> : null}
        <div className="space-y-2 max-h-[220px] overflow-auto">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={
                m.role === "user"
                  ? "ml-auto max-w-[85%] rounded-2xl bg-emerald-600 text-white px-3 py-2"
                  : "mr-auto max-w-[85%] rounded-2xl bg-slate-50 border border-slate-200 px-3 py-2 text-slate-700"
              }
            >
              {m.text}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            placeholder="Type your message..."
            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <button onClick={send} disabled={busy} className="rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm hover:bg-emerald-700 disabled:opacity-60">
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
