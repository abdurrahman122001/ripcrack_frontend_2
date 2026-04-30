import React, { useEffect, useMemo, useRef, useState, memo } from "react";
import { io, Socket } from "socket.io-client";

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

type Page = "home" | "shop" | "product" | "account" | "cart" | "checkout" | "contact" | "pricing" | "fraud" | "admin" | "refund" | "privacy" | "cookies" | "disclaimer" | "terms" | "about" | "faq" | "special" | "coupons" | "track";
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

type CartItemT = {
  productId: number;
  title: string;
  unitPrice: number;
  qty: number;
};

type FraudItem = {
  id: number;
  name: string;
  handle: string;
  platform: string;
  note: string;
  details?: string;
  evidenceUrl?: string;
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
    "footer.subscribing": "Subscribing...",
    "footer.subscriptionSuccess": "Subscribed successfully.",
    "footer.subscriptionErrorInvalid": "Please enter a valid email address.",

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
    "footer.subscribing": "Подписка...",
    "footer.subscriptionSuccess": "Вы успешно подписались.",
    "footer.subscriptionErrorInvalid": "Введите действительный email.",

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

    "order.success": "Ваш заказ успешно размещен!",
    "order.error.selectProduct": "Пожалуйста, выберите товар",
    "order.error.fullNameRequired": "Требуется полное имя",
    "order.error.invalidEmail": "Пожалуйста, введите действительный email",
    "order.error.invalidPhone": "Пожалуйста, введите действительный номер телефона",
    "order.error.countryRequired": "Требуется страна",
    "order.error.cityRequired": "Требуется город",
    "order.error.streetRequired": "Требуется адрес улицы",
    "order.error.zipRequired": "Требуется почтовый индекс",
    "order.error.failed": "Заказ не выполнен",
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
    "footer.subscribing": "Iscrizione...",
    "footer.subscriptionSuccess": "Iscrizione completata.",
    "footer.subscriptionErrorInvalid": "Inserisci un indirizzo email valido.",

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

    "order.success": "Il tuo ordine è stato completato con successo!",
    "order.error.selectProduct": "Seleziona un prodotto",
    "order.error.fullNameRequired": "Nome completo richiesto",
    "order.error.invalidEmail": "Inserisci un'email valida",
    "order.error.invalidPhone": "Inserisci un numero di telefono valido",
    "order.error.countryRequired": "Paese richiesto",
    "order.error.cityRequired": "Città richiesta",
    "order.error.streetRequired": "Indirizzo richiesto",
    "order.error.zipRequired": "CAP richiesto",
    "order.error.failed": "Ordine fallito",
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
    "footer.subscribing": "جاري الاشتراك...",
    "footer.subscriptionSuccess": "تم الاشتراك بنجاح.",
    "footer.subscriptionErrorInvalid": "يرجى إدخال بريد إلكتروني صحيح.",

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

    "order.success": "تم تقديم طلبك بنجاح!",
    "order.error.selectProduct": "يرجى اختيار منتج",
    "order.error.fullNameRequired": "الاسم الكامل مطلوب",
    "order.error.invalidEmail": "يرجى إدخال بريد إلكتروني صالح",
    "order.error.invalidPhone": "يرجى إدخال رقم هاتف صالح",
    "order.error.countryRequired": "البلد مطلوب",
    "order.error.cityRequired": "المدينة مطلوبة",
    "order.error.streetRequired": "عنوان الشارع مطلوب",
    "order.error.zipRequired": "الرمز البريدي مطلوب",
    "order.error.failed": "فشل الطلب",
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

type HeaderSearchProps = {
  query: string;
  setQuery: React.Dispatch<React.SetStateAction<string>>;
  placeholder: string;
};

const HeaderSearch = memo(function HeaderSearch({
  query,
  setQuery,
  placeholder,
}: HeaderSearchProps) {
  return (
    <div className="hidden md:block relative">
      <input
        id="header-search"
        name="search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        autoComplete="search"
        className="rounded-xl border border-slate-200 bg-white pl-3 pr-10 py-2 text-sm w-56"
      />
      {query ? (
        <button
          type="button"
          onClick={() => setQuery("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full hover:bg-slate-100 text-slate-500"
          aria-label="Clear search"
        >
          ✕
        </button>
      ) : null}
    </div>
  );
});

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

  const [footerLinks, setFooterLinks] = useState<any[]>([]);
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

  const [cartItems, setCartItems] = useState<CartItemT[]>([]);

  const [subscriptionEmail, setSubscriptionEmail] = useState("");
  const [subscriptionStatus, setSubscriptionStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [subscriptionMessage, setSubscriptionMessage] = useState("");

  const cartCount = useMemo(() => cartItems.reduce((acc, it) => acc + (it.qty || 0), 0), [cartItems]);
  const cartTotal = useMemo(
    () => cartItems.reduce((acc, it) => acc + (it.unitPrice || 0) * (it.qty || 0), 0),
    [cartItems]
  );

  const addToCart = (p: ProductT, qty = 1) => {
    const effectivePriceText =
      selectedType === "Business" ? ((p as any).businessPrice || p.price) : ((p as any).personalPrice || p.price);
    const unitPrice = parsePriceToNumber(effectivePriceText);
    const safeQty = Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1;

    setCartItems((prev) => {
      const idx = prev.findIndex((x) => x.productId === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + safeQty };
        return next;
      }
      return [...prev, { productId: p.id, title: p.title, unitPrice, qty: safeQty }];
    });
  };

  const setCartQty = (productId: number, qty: number) => {
    const safeQty = Number.isFinite(qty) ? Math.floor(qty) : 1;
    setCartItems((prev) => {
      if (safeQty <= 0) return prev.filter((x) => x.productId !== productId);
      return prev.map((x) => (x.productId === productId ? { ...x, qty: safeQty } : x));
    });
  };

  const removeFromCart = (productId: number) => {
    setCartItems((prev) => prev.filter((x) => x.productId !== productId));
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
      { id: 1, name: "John Doe", handle: "@fake_support", platform: "Telegram", note: "Impersonating support and requesting prepayment.", reports: 50 },
      { id: 2, name: "RipCrack Support 2", handle: "support-ripcrack.com", platform: "Email", note: "Fake email domain asking for crypto payments.", reports: 12 },
      { id: 3, name: "WhatsApp Agent", handle: "+000 000 0000", platform: "WhatsApp", note: "Claims to be official, sends phishing links.", reports: 7 },
    ],
    []
  );

  const [fraudItems, setFraudItems] = useState<FraudItem[]>(initialFraudList);
  const [fraudBusy, setFraudBusy] = useState(false);
  const [fraudErr, setFraudErr] = useState<string | null>(null);

  const [fraudForm, setFraudForm] = useState({
    name: "",
    platform: "Telegram" as string,
    handle: "",
    details: "",
    evidenceLink: "",
  });

  const [fraudFormSent, setFraudFormSent] = useState(false);
  const [fraudSubmitEmail, setFraudSubmitEmail] = useState("");

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
                  addToCart(p, 1);
                  setPage("cart");
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

  function ManualBrandCarousel() {
    const scrollerRef = useRef<HTMLDivElement | null>(null);
    const scrollBy = (dx: number) => scrollerRef.current?.scrollBy({ left: dx, behavior: "smooth" });

    return (
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-3">
          <div className="text-xs font-semibold text-slate-500 min-w-[150px]">{t("brands.title")}</div>
          <button
            onClick={() => scrollBy(-280)}
            className="h-9 w-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
            aria-label="Scroll left"
          >
            ‹
          </button>
          <div ref={scrollerRef} className="flex-1 overflow-x-auto scroll-smooth no-scrollbar">
            <div className="flex gap-3 min-w-max">
              {headerBrands.map((b) => (
                <BrandChip key={b.id || b.name} b={b} />
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

  const Home = () => (
    <div>
      <section className="bg-gradient-to-b from-white to-slate-50">
        <div className="max-w-7xl mx-auto px-6 py-14 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-100 px-3 py-1 rounded-full text-xs font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-600" />
              {t("hero.kicker")}
            </div>
            <h1 className="text-4xl md:text-5xl font-semibold text-slate-900 mt-4 leading-tight">
              {t("hero.title")} <span className="text-emerald-700">{t("hero.titleAccent")}</span>
            </h1>
            <p className="text-slate-600 mt-4 max-w-xl">{t("hero.subtitle")}</p>

            <div className="mt-7 flex flex-wrap gap-3">
              <button onClick={() => setPage("shop")} className="rounded-xl bg-emerald-600 text-white px-6 py-3 text-sm font-medium hover:bg-emerald-700">
                {t("hero.ctaBrowse")}
              </button>
              <button onClick={() => setPage("pricing")} className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-medium hover:bg-slate-50">
                {t("hero.ctaPricing")}
              </button>
            </div>

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  title: "Free Shipping worldwide",
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
                  title: "Members gift weekly",
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
                  title: "Friendly support 24/7",
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
            <div className="rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 h-72 flex items-end justify-between p-6">
              <div>
                <div className="text-xs text-slate-500">{t("home.featured")}</div>
                <div className="text-xl font-semibold text-slate-900 mt-1">{products[0]?.title || "Featured"}</div>
                <div className="text-sm text-slate-600 mt-1">{products[0]?.price || ""}</div>
              </div>
              <button onClick={() => setPage("shop")} className="rounded-xl bg-white border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50">
                {t("home.shopNow")}
              </button>
            </div>

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

        <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
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

      <section className="max-w-7xl mx-auto px-6 pb-10">
        <SectionTitle title={t("home.testimonials")} />
        <TestimonialsSection testimonials={testimonials} idx={testimonialIdx} onIdxChange={setTestimonialIdx} />
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-16">
        <SectionTitle title={t("home.trusted")} />
        <BrandStripAuto />
      </section>
    </div>
  );

  const Shop = () => (
    <section className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <SectionTitle title={t("shop.title")} subtitle={t("shop.subtitle")} />
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="text-xs text-slate-500">{t("common.sort")}</div>
            <button className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm">{t("common.sort")} ▾</button>
          </div>
        </div>
      </div>

      {productsError ? <div className="mt-6 text-sm text-red-700">{productsError}</div> : null}
      {productsBusy ? <div className="mt-6 text-sm text-slate-600">Loading products…</div> : null}

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
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

    const handleSubmit = async () => {
      if (!formData.name || !formData.email || !formData.whatsapp || !formData.service || !formData.budget || !formData.message) {
        alert("Please fill all required fields");
        return;
      }
      setSubmitting(true);
      // Simulate submission
      await new Promise((r) => setTimeout(r, 1500));
      setSubmitting(false);
      setSubmitted(true);
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

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
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

  const FaqPage = () => (
    <section className="max-w-6xl mx-auto px-6 py-12">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <SectionTitle title={t("footer.faq")} subtitle="Quick answers to common questions." />
        <button onClick={() => setPage("home")} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50">
          Back
        </button>
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
    const effectivePrice = selectedType === "Business" ? ((selectedProduct as any).businessPrice || selectedProduct.price) : ((selectedProduct as any).personalPrice || selectedProduct.price);
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
                  addToCart(selectedProduct, 1);
                  setPage("cart");
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
    <section className="max-w-7xl mx-auto px-6 py-12">
      <SectionTitle title={t("nav.pricing")} subtitle="Pick a plan and request by email." />
      
      {/* Toggle Annual/Lifetime */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex rounded-full bg-slate-100 p-1">
          <button
            onClick={() => setPurchaseTerm("annual")}
            className={`px-6 py-2 rounded-full text-sm font-medium transition ${
              purchaseTerm === "annual" ? "bg-white shadow text-slate-900" : "text-slate-600"
            }`}
          >
            Annual
          </button>
          <button
            onClick={() => setPurchaseTerm("lifetime")}
            className={`px-6 py-2 rounded-full text-sm font-medium transition ${
              purchaseTerm === "lifetime" ? "bg-white shadow text-slate-900" : "text-slate-600"
            }`}
          >
            Lifetime
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-3 gap-6">
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
                  {purchaseTerm === "annual" ? plan.annualPrice : plan.lifetimePrice}
                </span>
                {purchaseTerm === "annual" && <span className="text-sm text-slate-500"> /year</span>}
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
              onClick={() => setPage("contact")}
              className={`mt-6 w-full py-3 rounded-xl text-sm font-medium transition ${
                plan.popular
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Request Quote
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
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [ok, setOk] = useState<string | null>(null);

    const [title, setTitle] = useState("");
    const [category, setCategory] = useState("Design");
    const [badge, setBadge] = useState("");
    const [personalPrice, setPersonalPrice] = useState("");
    const [businessPrice, setBusinessPrice] = useState("");
    const [description, setDescription] = useState("");
    const [seoTitle, setSeoTitle] = useState("");
    const [seoDescription, setSeoDescription] = useState("");
    const [images, setImages] = useState<File[]>([]);

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

    const [usersSearch, setUsersSearch] = useState("");
    const [ordersSearch, setOrdersSearch] = useState("");

    const [ordersExportStatus, setOrdersExportStatus] = useState<"ALL" | "REQUESTED" | "CONFIRMED" | "REJECTED">("ALL");
    const [ordersExportFrom, setOrdersExportFrom] = useState("");
    const [ordersExportTo, setOrdersExportTo] = useState("");

    const [fraudEntriesAdmin, setFraudEntriesAdmin] = useState<any[]>([]);
    const [fraudEntriesBusy, setFraudEntriesBusy] = useState(false);
    const [fraudEntriesErr, setFraudEntriesErr] = useState<string | null>(null);

    const [fraudEntryNew, setFraudEntryNew] = useState<any>({ name: "", platform: "Telegram", handle: "", note: "", details: "", evidenceUrl: "" });
    const [fraudEntryEditingId, setFraudEntryEditingId] = useState<number | null>(null);
    const [fraudEntryEdit, setFraudEntryEdit] = useState<any>({ name: "", platform: "Telegram", handle: "", note: "", details: "", evidenceUrl: "" });

    const [fraudSubmissionsAdmin, setFraudSubmissionsAdmin] = useState<any[]>([]);
    const [fraudSubmissionsBusy, setFraudSubmissionsBusy] = useState(false);
    const [fraudSubmissionsErr, setFraudSubmissionsErr] = useState<string | null>(null);

    const [footerLinksAdmin, setFooterLinksAdmin] = useState<any[]>([]);
    const [footerLinksBusy, setFooterLinksBusy] = useState(false);
    const [footerLinksErr, setFooterLinksErr] = useState<string | null>(null);
    const [footerLinksOk, setFooterLinksOk] = useState<string | null>(null);

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

    // Chat Inbox states (Tidio-like)
    const [conversations, setConversations] = useState<any[]>([]);
    const [conversationsBusy, setConversationsBusy] = useState(false);
    const [selectedConversation, setSelectedConversation] = useState<any | null>(null);
    const [inboxStatusFilter, setInboxStatusFilter] = useState<"UNASSIGNED" | "OPEN" | "SOLVED" | "">("");
    const [inboxAssigneeFilter, setInboxAssigneeFilter] = useState<string>("");
    const [inboxMessageInput, setInboxMessageInput] = useState("");
    const [inboxSending, setInboxSending] = useState(false);
    const [inboxSocket, setInboxSocket] = useState<Socket | null>(null);
    const [activeTab, setActiveTab] = useState<"info" | "pages" | "notes">("info");
    const [noteText, setNoteText] = useState("");

    // Chat management states
    const [chatSessions, setChatSessions] = useState<any[]>([]);
    const [chatSessionsBusy, setChatSessionsBusy] = useState(false);
    const [chatSessionsErr, setChatSessionsErr] = useState<string | null>(null);
    const [selectedChatSession, setSelectedChatSession] = useState<any | null>(null);
    const [chatMessages, setChatMessages] = useState<any[]>([]);
    const [chatMessageInput, setChatMessageInput] = useState("");
    const [chatSending, setChatSending] = useState(false);
    const [chatStatusFilter, setChatStatusFilter] = useState<string>("");

    // FAQ management states
    const [chatFAQs, setChatFAQs] = useState<any[]>([]);
    const [chatFAQsBusy, setChatFAQsBusy] = useState(false);
    const [chatFAQsErr, setChatFAQsErr] = useState<string | null>(null);
    const [newFAQ, setNewFAQ] = useState({ question: "", answer: "", keywords: "", sortOrder: 0, active: true });
    const [editingFAQId, setEditingFAQId] = useState<number | null>(null);
    const [editFAQ, setEditFAQ] = useState({ question: "", answer: "", keywords: "", sortOrder: 0, active: true });

    const canView = me?.role === "ADMIN";

    const availablePages = ["home", "shop", "pricing", "fraud", "contact", "about", "faq", "special", "coupons", "refund", "privacy", "cookies", "disclaimer", "terms"];

    const refreshOrders = async () => {
      if (!canView) return;
      setErr(null);
      try {
        const json = await gatewayFetch("/admin/orders", { method: "GET" });
        setOrders(json?.items || []);
      } catch (e: any) {
        setErr(e?.message || "Failed to load orders");
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
        setFooterLinksAdmin([]);
        setFooterLinksErr(e?.message || "Failed to load footer links");
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
        setUsers([]);
        setUsersErr(e?.message || "Failed to load users");
      } finally {
        setUsersBusy(false);
      }
    };

    const refreshFraudEntriesAdmin = async () => {
      if (!canView) return;
      setFraudEntriesBusy(true);
      setFraudEntriesErr(null);
      try {
        const json = await gatewayFetch("/admin/fraud/entries", { method: "GET" });
        setFraudEntriesAdmin(json?.items || []);
      } catch (e: any) {
        setFraudEntriesAdmin([]);
        setFraudEntriesErr(e?.message || "Failed to load fraud entries");
      } finally {
        setFraudEntriesBusy(false);
      }
    };

    const refreshFraudSubmissionsAdmin = async () => {
      if (!canView) return;
      setFraudSubmissionsBusy(true);
      setFraudSubmissionsErr(null);
      try {
        const json = await gatewayFetch("/admin/fraud/submissions", { method: "GET" });
        setFraudSubmissionsAdmin(json?.items || []);
      } catch (e: any) {
        setFraudSubmissionsAdmin([]);
        setFraudSubmissionsErr(e?.message || "Failed to load fraud submissions");
      } finally {
        setFraudSubmissionsBusy(false);
      }
    };

    // Chat functions
    const refreshChatSessions = async () => {
      if (!canView) return;
      setChatSessionsBusy(true);
      setChatSessionsErr(null);
      try {
        const params = chatStatusFilter ? `?status=${chatStatusFilter}` : "";
        const json = await gatewayFetch(`/admin/chat/sessions${params}`, { method: "GET" });
        setChatSessions(json?.items || []);
      } catch (e: any) {
        setChatSessionsErr(e?.message || "Failed to load chat sessions");
      } finally {
        setChatSessionsBusy(false);
      }
    };

    // Chat Inbox functions
    const refreshConversations = async () => {
      if (!canView) return;
      setConversationsBusy(true);
      try {
        const params = new URLSearchParams();
        if (inboxStatusFilter) params.append("status", inboxStatusFilter);
        if (inboxAssigneeFilter) params.append("assigneeId", inboxAssigneeFilter);
        const json = await gatewayFetch(`/admin/chat/conversations?${params.toString()}`, { method: "GET" });
        setConversations(json?.items || []);
      } catch (e: any) {
        console.error("Failed to load conversations:", e);
      } finally {
        setConversationsBusy(false);
      }
    };

    const loadConversation = async (conversationId: string, skipSocketSetup = false) => {
      if (!canView) return;
      try {
        const json = await gatewayFetch(`/admin/chat/conversations/${conversationId}`, { method: "GET" });
        setSelectedConversation(json?.item || null);
        
        // Only setup socket once, not on every reload
        if (!skipSocketSetup) {
          // Disconnect old socket and remove all listeners
          if (inboxSocket) {
            inboxSocket.removeAllListeners();
            inboxSocket.disconnect();
          }
          const socketUrl = window.location.hostname === "localhost" ? "http://localhost:8080" : "";
          const socket = io(socketUrl, { transports: ["websocket", "polling"] });
          socket.on("connect", () => {
            socket.emit("join-conversation", { conversationId, userType: "agent" });
          });
          socket.on("new-message", () => {
            loadConversation(conversationId, true); // Skip socket setup on reload
          });
          socket.on("conversation-updated", () => {
            refreshConversations();
            loadConversation(conversationId, true); // Skip socket setup on reload
          });
          setInboxSocket(socket);
        }
      } catch (e: any) {
        console.error("Failed to load conversation:", e);
      }
    };

    const assignConversation = async (conversationId: string, assigneeId?: string) => {
      if (!canView) return;
      try {
        await gatewayFetch(`/admin/chat/conversations/${conversationId}/assign`, {
          method: "PATCH",
          body: JSON.stringify({ assigneeId: assigneeId || me?.id }),
        });
        await refreshConversations();
        if (selectedConversation?.id === conversationId) {
          await loadConversation(conversationId);
        }
      } catch (e: any) {
        console.error("Failed to assign:", e);
      }
    };

    const solveConversation = async (conversationId: string) => {
      if (!canView) return;
      try {
        await gatewayFetch(`/admin/chat/conversations/${conversationId}/solve`, { method: "PATCH" });
        await refreshConversations();
        if (selectedConversation?.id === conversationId) {
          await loadConversation(conversationId);
        }
      } catch (e: any) {
        console.error("Failed to solve:", e);
      }
    };

    const sendInboxMessage = async () => {
      if (!selectedConversation || !inboxMessageInput.trim() || inboxSending) return;
      setInboxSending(true);
      try {
        if (inboxSocket) {
          inboxSocket.emit("agent-message", {
            conversationId: selectedConversation.id,
            text: inboxMessageInput.trim(),
            agentId: me?.id,
          });
        }
        setInboxMessageInput("");
        setTimeout(() => loadConversation(selectedConversation.id), 500);
      } catch (e: any) {
        console.error("Failed to send message:", e);
      } finally {
        setInboxSending(false);
      }
    };

    const loadChatSession = async (sessionId: string) => {
      if (!canView) return;
      try {
        const json = await gatewayFetch(`/admin/chat/sessions/${sessionId}`, { method: "GET" });
        setSelectedChatSession(json?.item || null);
        setChatMessages(json?.item?.messages || []);
      } catch (e: any) {
        setChatSessionsErr(e?.message || "Failed to load chat session");
      }
    };

    const sendChatMessage = async () => {
      if (!selectedChatSession || !chatMessageInput.trim() || chatSending) return;
      setChatSending(true);
      try {
        await gatewayFetch(`/admin/chat/sessions/${selectedChatSession.id}/message`, {
          method: "POST",
          body: JSON.stringify({ text: chatMessageInput.trim() }),
        });
        setChatMessageInput("");
        await loadChatSession(selectedChatSession.id);
        await refreshChatSessions();
      } catch (e: any) {
        setChatSessionsErr(e?.message || "Failed to send message");
      } finally {
        setChatSending(false);
      }
    };

    const updateChatStatus = async (sessionId: string, status: "BOT" | "WAITING_FOR_HUMAN" | "HUMAN" | "CLOSED") => {
      if (!canView) return;
      try {
        await gatewayFetch(`/admin/chat/sessions/${sessionId}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        });
        await refreshChatSessions();
        if (selectedChatSession?.id === sessionId) {
          await loadChatSession(sessionId);
        }
      } catch (e: any) {
        setChatSessionsErr(e?.message || "Failed to update status");
      }
    };

    // FAQ functions
    const refreshChatFAQs = async () => {
      if (!canView) return;
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
      } finally {
        setChatFAQsBusy(false);
      }
    };

    const createFAQ = async () => {
      if (!canView || !newFAQ.question.trim() || !newFAQ.answer.trim()) return;
      setChatFAQsBusy(true);
      try {
        const keywords = newFAQ.keywords.split(",").map(k => k.trim()).filter(k => k);
        await gatewayFetch("/admin/chat/faqs", {
          method: "POST",
          body: JSON.stringify({ ...newFAQ, keywords }),
        });
        setNewFAQ({ question: "", answer: "", keywords: "", sortOrder: 0, active: true });
        await refreshChatFAQs();
      } catch (e: any) {
        setChatFAQsErr(e?.message || "Failed to create FAQ");
      } finally {
        setChatFAQsBusy(false);
      }
    };

    const updateFAQ = async () => {
      if (!canView || !editingFAQId || !editFAQ.question.trim() || !editFAQ.answer.trim()) return;
      setChatFAQsBusy(true);
      try {
        const keywords = editFAQ.keywords.split(",").map(k => k.trim()).filter(k => k);
        await gatewayFetch(`/admin/chat/faqs/${editingFAQId}`, {
          method: "PATCH",
          body: JSON.stringify({ ...editFAQ, keywords }),
        });
        setEditingFAQId(null);
        await refreshChatFAQs();
      } catch (e: any) {
        setChatFAQsErr(e?.message || "Failed to update FAQ");
      } finally {
        setChatFAQsBusy(false);
      }
    };

    const deleteFAQ = async (id: number) => {
      if (!canView) return;
      if (!confirm("Delete this FAQ?")) return;
      setChatFAQsBusy(true);
      try {
        await gatewayFetch(`/admin/chat/faqs/${id}`, { method: "DELETE" });
        await refreshChatFAQs();
      } catch (e: any) {
        setChatFAQsErr(e?.message || "Failed to delete FAQ");
      } finally {
        setChatFAQsBusy(false);
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
      // Only load data on mount, no auto-refresh to prevent form input resets
      refreshOrders();
      refreshAnalytics();
      refreshUsers();
      refreshFooterLinksAdmin();
      refreshFraudEntriesAdmin();
      refreshFraudSubmissionsAdmin();
      
      // REMOVED: Auto-refresh polling to prevent form inputs from being reset
      // Users can manually refresh using the Refresh button if needed
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canView]);

    // Load chat data on mount
    useEffect(() => {
      if (canView) {
        refreshChatSessions();
        refreshChatFAQs();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canView]);

    // Auto-refresh chat sessions every 5 seconds if a session is selected
    useEffect(() => {
      if (!canView || !selectedChatSession) return;
      const interval = setInterval(() => {
        loadChatSession(selectedChatSession.id);
        refreshChatSessions();
      }, 5000);
      return () => clearInterval(interval);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canView, selectedChatSession?.id]);

    // Cleanup socket on unmount or when leaving inbox
    useEffect(() => {
      return () => {
        if (inboxSocket) {
          inboxSocket.removeAllListeners();
          inboxSocket.disconnect();
          setInboxSocket(null);
        }
      };
    }, [inboxSocket]);

    const startEditFooterLink = (l: any) => {
      setFooterLinksOk(null);
      setFooterLinksErr(null);
      setFlEditingId(Number(l?.id || 0) || null);
      const labels = (l?.labels || {}) as any;
      setFlEditForm({
        group: String(l?.group || "RESOURCES"),
        targetType: String(l?.targetType || "PAGE"),
        targetPage: String(l?.targetPage || "").trim(),
        targetUrl: String(l?.targetUrl || "").trim(),
        sortOrder: Number(l?.sortOrder || 0),
        enabled: !!l?.enabled,
        labels: {
          EN: String(labels?.EN || ""),
          RU: String(labels?.RU || ""),
          IT: String(labels?.IT || ""),
          AR: String(labels?.AR || "")
        }
      });
    };

    const createFooterLink = async () => {
      if (!canView) return;
      setFooterLinksErr(null);
      setFooterLinksOk(null);
      const labels: any = {};
      if (flNewLabelEN.trim()) labels.EN = flNewLabelEN.trim();
      if (flNewLabelRU.trim()) labels.RU = flNewLabelRU.trim();
      if (flNewLabelIT.trim()) labels.IT = flNewLabelIT.trim();
      if (flNewLabelAR.trim()) labels.AR = flNewLabelAR.trim();
      if (!labels.EN) return setFooterLinksErr("EN label is required");
      setFooterLinksBusy(true);
      try {
        await gatewayFetch("/admin/footer-links", {
          method: "POST",
          body: JSON.stringify({
            group: flNewGroup,
            labels,
            targetType: flNewTargetType,
            targetPage: flNewTargetType === "PAGE" ? flNewTargetPage : "",
            targetUrl: flNewTargetType === "URL" ? flNewTargetUrl : "",
            sortOrder: Number(flNewSortOrder || 0),
            enabled: !!flNewEnabled
          })
        });
        setFooterLinksOk("Footer link created");
        setFlNewLabelEN("");
        setFlNewLabelRU("");
        setFlNewLabelIT("");
        setFlNewLabelAR("");
        await refreshFooterLinksAdmin();
        await refreshFooterLinks();
      } catch (e: any) {
        setFooterLinksErr(e?.message || "Failed to create footer link");
      } finally {
        setFooterLinksBusy(false);
      }
    };

    const saveFooterLinkEdit = async () => {
      if (!canView) return;
      if (!flEditingId) return;
      setFooterLinksErr(null);
      setFooterLinksOk(null);
      const labels: any = {};
      if (String(flEditForm?.labels?.EN || "").trim()) labels.EN = String(flEditForm.labels.EN).trim();
      if (String(flEditForm?.labels?.RU || "").trim()) labels.RU = String(flEditForm.labels.RU).trim();
      if (String(flEditForm?.labels?.IT || "").trim()) labels.IT = String(flEditForm.labels.IT).trim();
      if (String(flEditForm?.labels?.AR || "").trim()) labels.AR = String(flEditForm.labels.AR).trim();
      if (!labels.EN) return setFooterLinksErr("EN label is required");
      setFooterLinksBusy(true);
      try {
        await gatewayFetch(`/admin/footer-links/${flEditingId}`, {
          method: "PUT",
          body: JSON.stringify({
            group: flEditForm.group,
            labels,
            targetType: flEditForm.targetType,
            targetPage: flEditForm.targetType === "PAGE" ? String(flEditForm.targetPage || "") : "",
            targetUrl: flEditForm.targetType === "URL" ? String(flEditForm.targetUrl || "") : "",
            sortOrder: Number(flEditForm.sortOrder || 0),
            enabled: !!flEditForm.enabled
          })
        });
        setFooterLinksOk("Footer link updated");
        setFlEditingId(null);
        await refreshFooterLinksAdmin();
        await refreshFooterLinks();
      } catch (e: any) {
        setFooterLinksErr(e?.message || "Failed to update footer link");
      } finally {
        setFooterLinksBusy(false);
      }
    };

    const deleteFooterLink = async (id: number) => {
      if (!canView) return;
      if (!confirm("Delete this footer link?")) return;
      setFooterLinksBusy(true);
      setFooterLinksErr(null);
      setFooterLinksOk(null);
      try {
        await gatewayFetch(`/admin/footer-links/${id}`, { method: "DELETE" });
        setFooterLinksOk("Footer link deleted");
        if (flEditingId === id) setFlEditingId(null);
        await refreshFooterLinksAdmin();
        await refreshFooterLinks();
      } catch (e: any) {
        setFooterLinksErr(e?.message || "Failed to delete footer link");
      } finally {
        setFooterLinksBusy(false);
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
          for (const f of images) form.append("images", f);

          await gatewayFetch("/admin/products-multipart", {
            method: "POST",
            body: form,
          });
        } else {
          await gatewayFetch("/admin/products", {
            method: "POST",
            body: JSON.stringify({ title, category, description, badge, personalPrice, businessPrice, seoTitle, seoDescription }),
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
        setImages([]);
        await refreshProducts();
      } catch (e: any) {
        setErr(e?.message || "Failed to create product");
      } finally {
        setBusy(false);
      }
    };

    const ProductManagement = () => {
      const [allProducts, setAllProducts] = useState<ProductT[]>([]);
      const [pmBusy, setPmBusy] = useState(false);
      const [pmErr, setPmErr] = useState<string | null>(null);
      const [pmOk, setPmOk] = useState<string | null>(null);

      const [editingId, setEditingId] = useState<number | null>(null);
      const [editForm, setEditForm] = useState({ title: "", category: "Design", badge: "", personalPrice: "", businessPrice: "", description: "", seoTitle: "", seoDescription: "" });

      const refreshAll = async () => {
        setPmErr(null);
        try {
          const json = await gatewayFetch("/admin/products", { method: "GET" });
          setAllProducts(json?.items || []);
        } catch (e: any) {
          setPmErr(e?.message || "Failed to load products");
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
        });
        setPmOk(null);
        setPmErr(null);
      };

      const saveEdit = async () => {
        if (!editingId) return;
        setPmBusy(true);
        setPmErr(null);
        setPmOk(null);
        try {
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
            }),
          });
          setPmOk("Product updated");
          setEditingId(null);
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
        <Card className="p-6 mt-8">
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
                  {categories.filter((c) => c !== "All").map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <input value={editForm.badge} onChange={(e) => setEditForm((s) => ({ ...s, badge: e.target.value }))} placeholder="Badge (optional)" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                <input value={(editForm as any).personalPrice} onChange={(e) => setEditForm((s) => ({ ...(s as any), personalPrice: e.target.value }))} placeholder="Personal price" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                <input value={(editForm as any).businessPrice} onChange={(e) => setEditForm((s) => ({ ...(s as any), businessPrice: e.target.value }))} placeholder="Business price" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                <input value={editForm.seoTitle} onChange={(e) => setEditForm((s) => ({ ...s, seoTitle: e.target.value }))} placeholder="SEO title (optional)" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                <input value={editForm.seoDescription} onChange={(e) => setEditForm((s) => ({ ...s, seoDescription: e.target.value }))} placeholder="SEO description (optional)" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
              </div>
              <textarea value={editForm.description} onChange={(e) => setEditForm((s) => ({ ...s, description: e.target.value }))} placeholder="Description" className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm min-h-[110px]" />
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

          <div className="mt-5 grid md:grid-cols-2 gap-3">
            {allProducts.length === 0 ? (
              <div className="text-sm text-slate-600">No products.</div>
            ) : (
              allProducts.slice(0, 20).map((p) => (
                <div key={p.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">{p.title}</div>
                      <div className="text-xs text-slate-500">{p.category} · Personal: {(p as any).personalPrice || "-"} · Business: {(p as any).businessPrice || "-"}</div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => startEdit(p)} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs hover:bg-slate-50">
                        Edit
                      </button>
                      <button onClick={() => deleteProduct(p.id)} className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs text-red-700 hover:bg-red-50">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      );
    };

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
        setAnalytics(null);
        setAnalyticsErr(e?.message || "Failed to load analytics");
      } finally {
        setAnalyticsBusy(false);
      }
    };

    const totals = analytics?.totals || {};
    const topPages = Array.isArray(analytics?.topPages) ? analytics.topPages : [];
    const topCountries = Array.isArray(analytics?.topCountries) ? analytics.topCountries : [];
    const topProductsViewed = Array.isArray(analytics?.topProductsViewed) ? analytics.topProductsViewed : [];
    const topProductsSold = Array.isArray(analytics?.topProductsSold) ? analytics.topProductsSold : [];

    // Chat Management Component
    // Chat Inbox Component (Tidio-like)
    const ChatInbox = () => {
      useEffect(() => {
        if (canView) {
          refreshConversations();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [canView, inboxStatusFilter, inboxAssigneeFilter]);

      useEffect(() => {
        if (canView && selectedConversation) {
          const interval = setInterval(() => {
            loadConversation(selectedConversation.id);
            refreshConversations();
          }, 3000);
          return () => clearInterval(interval);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [canView, selectedConversation?.id]);

      const unassignedCount = conversations.filter((c: any) => c.status === "UNASSIGNED").length;
      const myOpenCount = conversations.filter((c: any) => c.status === "OPEN" && c.assigneeId === me?.id).length;
      const solvedCount = conversations.filter((c: any) => c.status === "SOLVED").length;

      return (
        <div className="mt-6">
          <Card className="p-0 overflow-hidden">
            <div className="flex h-[700px]">
              {/* Left Sidebar */}
              <div className="w-64 border-r border-slate-200 bg-slate-50 flex flex-col">
                <div className="p-4 border-b border-slate-200 bg-white">
                  <div className="text-lg font-semibold text-slate-900">Inbox</div>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-slate-500 uppercase px-3 py-2">Live Conversations</div>
                    <button
                      onClick={() => setInboxStatusFilter("UNASSIGNED")}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between ${
                        inboxStatusFilter === "UNASSIGNED" ? "bg-blue-100 text-blue-900" : "hover:bg-slate-100 text-slate-700"
                      }`}
                    >
                      <span>Unassigned</span>
                      {unassignedCount > 0 && <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{unassignedCount}</span>}
                    </button>
                    <button
                      onClick={() => {
                        setInboxStatusFilter("OPEN");
                        setInboxAssigneeFilter(me?.id || "");
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between ${
                        inboxStatusFilter === "OPEN" && inboxAssigneeFilter === me?.id ? "bg-blue-100 text-blue-900" : "hover:bg-slate-100 text-slate-700"
                      }`}
                    >
                      <span>My open</span>
                      {myOpenCount > 0 && <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{myOpenCount}</span>}
                    </button>
                    <button
                      onClick={() => setInboxStatusFilter("SOLVED")}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between ${
                        inboxStatusFilter === "SOLVED" ? "bg-blue-100 text-blue-900" : "hover:bg-slate-100 text-slate-700"
                      }`}
                    >
                      <span>Solved</span>
                      {solvedCount > 0 && <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">{solvedCount}</span>}
                    </button>
                  </div>
                </div>
              </div>

              {/* Middle: Conversation List */}
              <div className="w-80 border-r border-slate-200 flex flex-col">
                <div className="p-4 border-b border-slate-200 bg-white">
                  <input
                    type="text"
                    placeholder="Search conversations..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex-1 overflow-y-auto">
                  {conversationsBusy ? (
                    <div className="p-4 text-sm text-slate-600">Loading...</div>
                  ) : conversations.length === 0 ? (
                    <div className="p-4 text-sm text-slate-600">No conversations</div>
                  ) : (
                    conversations.map((conv: any) => {
                      const lastMessage = conv.messages?.[0];
                      return (
                        <div
                          key={conv.id}
                          onClick={() => loadConversation(conv.id)}
                          className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-slate-50 ${
                            selectedConversation?.id === conv.id ? "bg-blue-50 border-l-4 border-l-blue-500" : ""
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-slate-900 truncate">
                                {conv.visitor?.email || conv.visitor?.visitorId || "Anonymous"}
                              </div>
                              {lastMessage && (
                                <div className="text-xs text-slate-600 mt-1 truncate">{lastMessage.text}</div>
                              )}
                              <div className="text-xs text-slate-500 mt-1">
                                {conv.visitor?.country && `${conv.visitor.country}${conv.visitor.city ? `, ${conv.visitor.city}` : ""}`}
                              </div>
                            </div>
                            <div className="text-xs text-slate-500">
                              {new Date(conv.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </div>
                          {conv.status === "UNASSIGNED" && (
                            <div className="mt-2">
                              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">Unassigned</span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right: Chat Panel + Visitor Info */}
              <div className="flex-1 flex flex-col">
                {selectedConversation ? (
                  <>
                    {/* Chat Header */}
                    <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            {selectedConversation.visitor?.email || selectedConversation.visitor?.visitorId || "Anonymous"}
                          </div>
                          {selectedConversation.assignee ? (
                            <div className="text-xs text-slate-500">
                              Assigned to: {selectedConversation.assignee.firstName} {selectedConversation.assignee.lastName}
                            </div>
                          ) : (
                            <div className="text-xs text-slate-500">Unassigned</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!selectedConversation.assignee && (
                          <button
                            onClick={() => assignConversation(selectedConversation.id)}
                            className="rounded-lg bg-blue-600 text-white px-3 py-1.5 text-xs hover:bg-blue-700"
                          >
                            Assign to me
                          </button>
                        )}
                        {selectedConversation.status !== "SOLVED" && (
                          <button
                            onClick={() => solveConversation(selectedConversation.id)}
                            className="rounded-lg bg-green-600 text-white px-3 py-1.5 text-xs hover:bg-green-700"
                          >
                            Solve
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 flex overflow-hidden">
                      {/* Messages */}
                      <div className="flex-1 flex flex-col">
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                          {selectedConversation.messages?.map((msg: any) => (
                            <div
                              key={msg.id}
                              className={`flex ${msg.senderType === "VISITOR" ? "justify-end" : "justify-start"}`}
                            >
                              <div
                                className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                                  msg.senderType === "VISITOR"
                                    ? "bg-emerald-600 text-white"
                                    : msg.senderType === "AGENT"
                                    ? "bg-blue-600 text-white"
                                    : "bg-slate-100 text-slate-900"
                                }`}
                              >
                                {msg.text}
                              </div>
                            </div>
                          ))}
                        </div>
                        {selectedConversation.status !== "SOLVED" && (
                          <div className="p-4 border-t border-slate-200">
                            <div className="flex gap-2">
                              <input
                                value={inboxMessageInput}
                                onChange={(e) => setInboxMessageInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && !inboxSending && sendInboxMessage()}
                                placeholder="Write a message..."
                                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                disabled={inboxSending}
                              />
                              <button
                                onClick={sendInboxMessage}
                                disabled={inboxSending || !inboxMessageInput.trim()}
                                className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm hover:bg-emerald-700 disabled:opacity-60"
                              >
                                Send
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Visitor Info Sidebar */}
                      <div className="w-80 border-l border-slate-200 bg-slate-50 flex flex-col">
                        <div className="p-3 border-b border-slate-200 bg-white flex gap-2">
                          <button
                            onClick={() => setActiveTab("info")}
                            className={`flex-1 px-3 py-1.5 text-xs rounded-lg ${
                              activeTab === "info" ? "bg-blue-100 text-blue-900" : "hover:bg-slate-100"
                            }`}
                          >
                            Info
                          </button>
                          <button
                            onClick={() => setActiveTab("pages")}
                            className={`flex-1 px-3 py-1.5 text-xs rounded-lg ${
                              activeTab === "pages" ? "bg-blue-100 text-blue-900" : "hover:bg-slate-100"
                            }`}
                          >
                            Pages
                          </button>
                          <button
                            onClick={() => setActiveTab("notes")}
                            className={`flex-1 px-3 py-1.5 text-xs rounded-lg ${
                              activeTab === "notes" ? "bg-blue-100 text-blue-900" : "hover:bg-slate-100"
                            }`}
                          >
                            Notes
                          </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                          {activeTab === "info" && selectedConversation.visitor && (
                            <div className="space-y-4">
                              <div>
                                <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Customer Data</div>
                                <div className="space-y-2 text-sm">
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-500">Email:</span>
                                    <span className="text-slate-900">{selectedConversation.visitor.email || "—"}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-500">IP:</span>
                                    <span className="text-slate-900">{selectedConversation.visitor.ip}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-500">Location:</span>
                                    <span className="text-slate-900">
                                      {selectedConversation.visitor.country || "—"}
                                      {selectedConversation.visitor.city && `, ${selectedConversation.visitor.city}`}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-500">Device:</span>
                                    <span className="text-slate-900">{selectedConversation.visitor.device || "—"}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-500">Browser:</span>
                                    <span className="text-slate-900">{selectedConversation.visitor.browser || "—"}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-500">First seen:</span>
                                    <span className="text-slate-900">
                                      {new Date(selectedConversation.visitor.firstSeenAt).toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-500">Last seen:</span>
                                    <span className="text-slate-900">
                                      {new Date(selectedConversation.visitor.lastSeenAt).toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              {selectedConversation.visitor.currentPage && (
                                <div>
                                  <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Current Page</div>
                                  <div className="text-sm text-slate-900">{selectedConversation.visitor.currentPage}</div>
                                </div>
                              )}
                            </div>
                          )}
                          {activeTab === "pages" && selectedConversation.visitor?.viewedPages && (
                            <div className="space-y-2">
                              <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Viewed Pages</div>
                              {selectedConversation.visitor.viewedPages.length === 0 ? (
                                <div className="text-sm text-slate-600">No pages viewed</div>
                              ) : (
                                selectedConversation.visitor.viewedPages.map((page: any, idx: number) => (
                                  <div key={idx} className="text-sm border-b border-slate-200 pb-2">
                                    <div className="text-slate-900 truncate">{page.url}</div>
                                    <div className="text-xs text-slate-500 mt-1">
                                      {new Date(page.timestamp).toLocaleString()}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                          {activeTab === "notes" && (
                            <div className="space-y-3">
                              <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Notes</div>
                              <textarea
                                value={noteText}
                                onChange={(e) => setNoteText(e.target.value)}
                                placeholder="Add a note..."
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[100px]"
                              />
                              <button
                                onClick={async () => {
                                  if (!noteText.trim()) return;
                                  try {
                                    await gatewayFetch("/admin/chat/notes", {
                                      method: "POST",
                                      body: JSON.stringify({
                                        conversationId: selectedConversation.id,
                                        text: noteText.trim(),
                                      }),
                                    });
                                    setNoteText("");
                                    await loadConversation(selectedConversation.id);
                                  } catch (e: any) {
                                    console.error("Failed to add note:", e);
                                  }
                                }}
                                className="w-full rounded-lg bg-blue-600 text-white px-3 py-2 text-sm hover:bg-blue-700"
                              >
                                Add Note
                              </button>
                              <div className="space-y-2 mt-4">
                                {selectedConversation.notes?.map((note: any) => (
                                  <div key={note.id} className="text-sm border-l-2 border-blue-500 pl-3 py-2 bg-slate-50 rounded">
                                    <div className="text-slate-900">{note.text}</div>
                                    <div className="text-xs text-slate-500 mt-1">
                                      {note.author?.firstName} {note.author?.lastName} · {new Date(note.createdAt).toLocaleString()}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-slate-500">
                    Select a conversation to view messages
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      );
    };

    const ChatManagement = () => {
      return (
        <div className="mt-6">
          <Card className="p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-slate-900">💬 Chat Sessions</div>
                <div className="text-sm text-slate-600 mt-1">Manage customer support chat sessions.</div>
              </div>
              <div className="flex gap-2">
                <select
                  value={chatStatusFilter}
                  onChange={(e) => {
                    setChatStatusFilter(e.target.value);
                    refreshChatSessions();
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">All Status</option>
                  <option value="BOT">Bot</option>
                  <option value="WAITING_FOR_HUMAN">Waiting</option>
                  <option value="HUMAN">Human</option>
                  <option value="CLOSED">Closed</option>
                </select>
                <button onClick={refreshChatSessions} disabled={chatSessionsBusy} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50">
                  Refresh
                </button>
              </div>
            </div>

            {chatSessionsErr ? <div className="mt-4 text-sm text-red-700">{chatSessionsErr}</div> : null}

            <div className="mt-5 grid lg:grid-cols-2 gap-6">
              {/* Sessions List */}
              <div className="space-y-2 max-h-[600px] overflow-auto">
                {chatSessionsBusy && chatSessions.length === 0 ? (
                  <div className="text-sm text-slate-600">Loading...</div>
                ) : chatSessions.length === 0 ? (
                  <div className="text-sm text-slate-600">No chat sessions.</div>
                ) : (
                  chatSessions.map((s: any) => (
                    <div
                      key={s.id}
                      onClick={() => loadChatSession(s.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition ${
                        selectedChatSession?.id === s.id ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-900 truncate">{s.email || s.deviceId || "Anonymous"}</div>
                          <div className="text-xs text-slate-500 mt-1">
                            {s.status} · {s.country || "Unknown"}
                          </div>
                        </div>
                        <div className="text-xs text-slate-500">{new Date(s.createdAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Chat Messages */}
              {selectedChatSession ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-900">Chat Messages</div>
                    <select
                      value={selectedChatSession.status}
                      onChange={(e) => updateChatStatus(selectedChatSession.id, e.target.value as any)}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                    >
                      <option value="BOT">Bot</option>
                      <option value="WAITING_FOR_HUMAN">Waiting</option>
                      <option value="HUMAN">Human</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                  </div>
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 max-h-[400px] overflow-auto space-y-2">
                    {chatMessages.map((m: any) => (
                      <div key={m.id} className={`flex ${m.role === "USER" ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                            m.role === "USER" ? "bg-emerald-600 text-white" : m.role === "ADMIN" ? "bg-blue-600 text-white" : "bg-white text-slate-900 border border-slate-200"
                          }`}
                        >
                          {m.text}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={chatMessageInput}
                      onChange={(e) => setChatMessageInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !chatSending && sendChatMessage()}
                      placeholder="Type a message..."
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      disabled={chatSending || selectedChatSession.status === "CLOSED"}
                    />
                    <button
                      onClick={sendChatMessage}
                      disabled={chatSending || !chatMessageInput.trim() || selectedChatSession.status === "CLOSED"}
                      className="rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm hover:bg-emerald-700 disabled:opacity-60"
                    >
                      Send
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-500 flex items-center justify-center h-full">Select a session to view messages</div>
              )}
            </div>
          </Card>
        </div>
      );
    };

    // FAQ Management Component
    const FAQsManagement = () => {
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
              <button
                onClick={refreshChatFAQs}
                disabled={chatFAQsBusy}
                className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                {chatFAQsBusy ? "Loading..." : "Refresh"}
              </button>
            </div>

            {chatFAQsBusy && chatFAQs.length === 0 ? (
              <div className="text-center py-8 text-slate-500">Loading FAQs...</div>
            ) : chatFAQs.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No FAQs found. Create one above.</div>
            ) : (
              <div className="space-y-4">
                {chatFAQs.map((faq: any) => (
                  <div key={faq.id} className="border border-slate-200 rounded-lg p-4">
                    {editingFAQId === faq.id ? (
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
                        <div className="flex items-center gap-4">
                          <button
                            onClick={updateFAQ}
                            disabled={chatFAQsBusy}
                            className="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingFAQId(null)}
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
                                setEditingFAQId(faq.id);
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
                              onClick={async () => {
                                if (!confirm("Delete this FAQ?")) return;
                                try {
                                  await gatewayFetch(`/admin/chat/faqs/${faq.id}`, { method: "DELETE" });
                                  await refreshChatFAQs();
                                } catch (e: any) {
                                  setChatFAQsErr(e?.message || "Failed to delete FAQ");
                                }
                              }}
                              className="px-3 py-1 text-xs border border-red-300 text-red-600 rounded hover:bg-red-50"
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

    return (
      <section className="max-w-7xl mx-auto px-6 py-12">
        <SectionTitle title="Admin panel" subtitle="Create products and review orders." />

        <div className="grid lg:grid-cols-2 gap-8 items-start">
          <Card className="p-6">
            <div className="text-lg font-semibold text-slate-900">Create product</div>
            <div className="text-sm text-slate-600 mt-1">Adds a product to the catalog.</div>

            {err ? <div className="mt-4 text-sm text-red-700">{err}</div> : null}
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
                orders
                  .filter((o) => {
                    // Status filter
                    if (ordersExportStatus !== "ALL" && o?.status !== ordersExportStatus) {
                      return false;
                    }
                    
                    // Date filters
                    if (ordersExportFrom) {
                      const orderDate = new Date(o?.createdAt || 0);
                      const fromDate = new Date(ordersExportFrom + "T00:00:00.000Z");
                      if (orderDate < fromDate) return false;
                    }
                    if (ordersExportTo) {
                      const orderDate = new Date(o?.createdAt || 0);
                      const toDate = new Date(ordersExportTo + "T23:59:59.999Z");
                      if (orderDate > toDate) return false;
                    }
                    
                    // Search filter
                    const q = ordersSearch.trim().toLowerCase();
                    if (q) {
                      const hay = `${o?.id || ""} ${o?.product?.title || ""} ${o?.user?.email || ""} ${o?.customerName || ""} ${o?.customerEmail || ""} ${o?.customerPhone || ""} ${o?.country || ""} ${o?.city || ""} ${o?.street || ""} ${o?.zip || ""} ${o?.status || ""} ${o?.purchaseTerm || ""} ${o?.selectedType || ""}`.toLowerCase();
                      if (!hay.includes(q)) return false;
                    }
                    
                    return true;
                  })
                  .slice(0, 12)
                  .map((o) => (
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
          </Card>
        </div>

        <Card className="p-6 mt-8">
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

        <Card className="p-6 mt-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-slate-900">Footer links</div>
              <div className="text-sm text-slate-600 mt-1">Manage footer links (Resources/Information) with multi-language labels.</div>
            </div>
            <button onClick={refreshFooterLinksAdmin} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50">
              Refresh
            </button>
          </div>

          {footerLinksErr ? <div className="mt-4 text-sm text-red-700">{footerLinksErr}</div> : null}
          {footerLinksOk ? <div className="mt-4 text-sm text-emerald-700">{footerLinksOk}</div> : null}

          {flEditingId ? (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">Editing #{flEditingId}</div>
                <button onClick={() => setFlEditingId(null)} className="text-sm text-slate-600 hover:text-slate-900">
                  Cancel
                </button>
              </div>

              <div className="mt-4 grid md:grid-cols-2 gap-3">
                <select value={flEditForm.group} onChange={(e) => setFlEditForm((s: any) => ({ ...s, group: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                  <option value="RESOURCES">Resources</option>
                  <option value="INFORMATION">Information</option>
                </select>
                <input value={String(flEditForm.sortOrder)} onChange={(e) => setFlEditForm((s: any) => ({ ...s, sortOrder: e.target.value }))} placeholder="Sort order" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                <select value={flEditForm.targetType} onChange={(e) => setFlEditForm((s: any) => ({ ...s, targetType: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                  <option value="PAGE">Internal page</option>
                  <option value="URL">External URL</option>
                </select>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={!!flEditForm.enabled} onChange={(e) => setFlEditForm((s: any) => ({ ...s, enabled: e.target.checked }))} />
                  Enabled
                </label>
              </div>

              {String(flEditForm.targetType) === "PAGE" ? (
                <select value={flEditForm.targetPage} onChange={(e) => setFlEditForm((s: any) => ({ ...s, targetPage: e.target.value }))} className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                  {availablePages.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              ) : (
                <input value={flEditForm.targetUrl} onChange={(e) => setFlEditForm((s: any) => ({ ...s, targetUrl: e.target.value }))} placeholder="https://..." className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
              )}

              <div className="mt-3 grid md:grid-cols-2 gap-3">
                <input value={String(flEditForm?.labels?.EN || "")} onChange={(e) => setFlEditForm((s: any) => ({ ...s, labels: { ...(s.labels || {}), EN: e.target.value } }))} placeholder="Label (EN)" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                <input value={String(flEditForm?.labels?.RU || "")} onChange={(e) => setFlEditForm((s: any) => ({ ...s, labels: { ...(s.labels || {}), RU: e.target.value } }))} placeholder="Label (RU)" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                <input value={String(flEditForm?.labels?.IT || "")} onChange={(e) => setFlEditForm((s: any) => ({ ...s, labels: { ...(s.labels || {}), IT: e.target.value } }))} placeholder="Label (IT)" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                <input value={String(flEditForm?.labels?.AR || "")} onChange={(e) => setFlEditForm((s: any) => ({ ...s, labels: { ...(s.labels || {}), AR: e.target.value } }))} placeholder="Label (AR)" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
              </div>

              <div className="mt-4 flex gap-2">
                <button disabled={footerLinksBusy || !String(flEditForm?.labels?.EN || "").trim()} onClick={saveFooterLinkEdit} className="flex-1 rounded-xl bg-emerald-600 text-white py-3 text-sm hover:bg-emerald-700 disabled:opacity-60">
                  Save
                </button>
                <button disabled={footerLinksBusy} onClick={() => setFlEditingId(null)} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm hover:bg-slate-50 disabled:opacity-60">
                  Close
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-medium text-slate-700">Add footer link</div>
            <div className="mt-3 grid md:grid-cols-2 gap-3">
              <select value={flNewGroup} onChange={(e) => setFlNewGroup(e.target.value as any)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                <option value="RESOURCES">Resources</option>
                <option value="INFORMATION">Information</option>
              </select>
              <input value={flNewSortOrder} onChange={(e) => setFlNewSortOrder(e.target.value)} placeholder="Sort order" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
              <select value={flNewTargetType} onChange={(e) => setFlNewTargetType(e.target.value as any)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                <option value="PAGE">Internal page</option>
                <option value="URL">External URL</option>
              </select>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={flNewEnabled} onChange={(e) => setFlNewEnabled(e.target.checked)} />
                Enabled
              </label>
            </div>

            {flNewTargetType === "PAGE" ? (
              <select value={flNewTargetPage} onChange={(e) => setFlNewTargetPage(e.target.value)} className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                {availablePages.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            ) : (
              <input value={flNewTargetUrl} onChange={(e) => setFlNewTargetUrl(e.target.value)} placeholder="https://..." className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
            )}

            <div className="mt-3 grid md:grid-cols-2 gap-3">
              <input value={flNewLabelEN} onChange={(e) => setFlNewLabelEN(e.target.value)} placeholder="Label (EN)" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
              <input value={flNewLabelRU} onChange={(e) => setFlNewLabelRU(e.target.value)} placeholder="Label (RU)" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
              <input value={flNewLabelIT} onChange={(e) => setFlNewLabelIT(e.target.value)} placeholder="Label (IT)" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
              <input value={flNewLabelAR} onChange={(e) => setFlNewLabelAR(e.target.value)} placeholder="Label (AR)" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
            </div>

            <button disabled={footerLinksBusy || !flNewLabelEN.trim()} onClick={createFooterLink} className="mt-3 w-full rounded-xl bg-slate-900 text-white py-3 text-sm hover:bg-black disabled:opacity-60">
              Add
            </button>
          </div>

          <div className="mt-5 grid md:grid-cols-2 gap-3">
            {footerLinksBusy ? (
              <div className="text-sm text-slate-600">Loading...</div>
            ) : footerLinksAdmin.length === 0 ? (
              <div className="text-sm text-slate-600">No footer links.</div>
            ) : (
              footerLinksAdmin.map((l) => {
                const labels = (l?.labels || {}) as any;
                const preview = String(labels?.EN || "").trim() || "-";
                return (
                  <div key={l.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate">{preview}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          Group: {l.group} · Enabled: {String(!!l.enabled)} · Sort: {l.sortOrder}
                        </div>
                        <div className="mt-1 text-xs text-slate-500 truncate">
                          Target: {l.targetType === "PAGE" ? `page:${l.targetPage}` : `url:${l.targetUrl}`}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => startEditFooterLink(l)} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs hover:bg-slate-50">
                          Edit
                        </button>
                        <button onClick={() => deleteFooterLink(l.id)} className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs text-red-700 hover:bg-red-50">
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

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

        {/* Chat Inbox (Tidio-like) */}
        <ChatInbox />

        {/* Chat Management Section */}
        <ChatManagement />

        {/* FAQ Management Section */}
        <FAQsManagement />

        {/* Product Management Section */}
        <ProductManagement />

        <Card className="p-6 mt-8">
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
        </Card>
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

    // Only initialize form field once on mount, don't reset when siteSettings changes
    // This prevents form input from being cleared when refreshSiteSettings() is called
    useEffect(() => {
      // Only set if field is empty (initial load)
      if (!siteName && siteSettings.siteName) setSiteName(siteSettings.siteName);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run once on mount

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
    const [openIdx, setOpenIdx] = useState<number | null>(null);

    const [fraudCaptchaToken, setFraudCaptchaToken] = useState("");
    const [fraudCaptchaOpen, setFraudCaptchaOpen] = useState(false);
    const fraudWidgetIdRef = useRef<any>(null);
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
          w.turnstile.reset(fraudWidgetIdRef.current);
        } catch {
          // ignore
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
        setFraudVerifyEmail(email);
        setFraudVerifySubmissionId(submissionId);
        setFraudVerifyCode("");
        setFraudVerifyErr(null);
        setFraudVerifyOk("Please enter the 6-digit code sent to your email.");
        setFraudVerifyOpen(true);

        const untilRaw = window.localStorage.getItem("fraudResendUntil") || "";
        const until = Number(untilRaw || 0);
        const left = until > 0 ? Math.ceil((until - Date.now()) / 1000) : 0;
        setFraudResendLeft(left > 0 ? left : 0);
      } catch {
        // ignore
      }
    }, []);

    const refreshFraudEntries = async () => {
      setFraudBusy(true);
      setFraudErr(null);
      try {
        const json = await gatewayFetch("/fraud/entries", { method: "GET" });
        const items = (json?.items || []) as any[];
        if (Array.isArray(items) && items.length) {
          setFraudItems(
            items.map((x) => ({
              id: Number(x?.id || 0),
              name: String(x?.name || ""),
              handle: String(x?.handle || ""),
              platform: String(x?.platform || ""),
              note: String(x?.note || ""),
              details: String(x?.details || ""),
              evidenceUrl: String(x?.evidenceUrl || ""),
              reports: Number(x?.reports || 0),
            }))
          );
        }
      } catch (e: any) {
        setFraudErr(e?.message || "Failed to load fraud list");
      } finally {
        setFraudBusy(false);
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
        setTimeout(() => {
          setFraudVerifyOpen(false);
          setFraudVerifyOk(null);
          setFraudVerifyCode("");
          setFraudVerifySubmissionId("");
        }, 800);
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
      refreshFraudEntries();
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
      if (!fraudSubmitEmail.trim() || !fraudForm.name.trim() || !fraudForm.handle.trim() || !fraudForm.details.trim()) {
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
        const email = fraudSubmitEmail.trim().toLowerCase();
        const json = await gatewayFetch("/fraud/submit", {
          method: "POST",
          body: JSON.stringify({
            email,
            name: fraudForm.name.trim(),
            platform: String(fraudForm.platform || "").trim(),
            handle: fraudForm.handle.trim(),
            details: fraudForm.details.trim(),
            evidenceUrl: String(fraudForm.evidenceLink || "").trim(),
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
        setFraudVerifyOk("A verification code was sent to your email.");
        setFraudVerifyOpen(true);
        startFraudResendCooldown(30);

        setFraudFormSent(true);
        setFraudForm({ name: "", platform: "Telegram", handle: "", details: "", evidenceLink: "" });
        setFraudSubmitEmail("");
        resetFraudCaptcha();
        setTimeout(() => setFraudFormSent(false), 2500);
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

        {fraudVerifyOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-5" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-slate-900">Verify email</div>
                  <div className="text-sm text-slate-600 mt-1">Enter the 6-digit code sent to {fraudVerifyEmail || "your email"}.</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFraudVerifyOpen(false);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50"
                >
                  Close
                </button>
              </div>

              {fraudVerifyErr ? <div className="mt-3 text-sm text-red-700">{fraudVerifyErr}</div> : null}
              {fraudVerifyOk ? <div className="mt-3 text-sm text-emerald-700">{fraudVerifyOk}</div> : null}

              <div className="mt-4 space-y-2">
                <input value={fraudVerifyEmail} onChange={(e) => setFraudVerifyEmail(e.target.value)} placeholder="Email" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                <input value={fraudVerifyCode} onChange={(e) => setFraudVerifyCode(e.target.value)} placeholder="6-digit code" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                <div className="flex gap-2">
                  <button
                    disabled={fraudVerifyBusy || !fraudVerifyEmail.trim() || fraudVerifyCode.trim().length !== 6}
                    onClick={doFraudVerify}
                    className="flex-1 rounded-xl bg-slate-900 text-white py-3 text-sm hover:bg-black disabled:opacity-60"
                  >
                    Verify
                  </button>
                  <button
                    disabled={fraudVerifyBusy || !fraudVerifyEmail.trim() || fraudResendLeft > 0}
                    onClick={doFraudResend}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm hover:bg-slate-50 disabled:opacity-60"
                  >
                    {fraudResendLeft > 0 ? `Resend (${fraudResendLeft}s)` : "Resend"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <Card className="p-6 mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-lg font-semibold text-slate-900">Report a fraud account</div>
              <div className="text-sm text-slate-600 mt-1">Fill the form — we will review and add it to the list.</div>
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
            <button onClick={submitNewFraud} className="rounded-xl bg-slate-900 text-white px-5 py-3 text-sm hover:bg-black">
              Submit report
            </button>
            <button onClick={() => setFraudForm({ name: "", platform: "Telegram", handle: "", details: "", evidenceLink: "" })} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm hover:bg-slate-50">
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

    // Ensure verify panel is visible when verifyOpen is true
    useEffect(() => {
      if (verifyOpen && typeof document !== "undefined") {
        // Force panel to be visible
        const panel = document.querySelector('[data-verify-panel]') as HTMLElement;
        if (panel) {
          panel.style.display = 'flex';
          panel.style.visibility = 'visible';
          panel.style.zIndex = '9999';
        }
      }
    }, [verifyOpen]);

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
        // Email verification no longer required for login - removed verification flow
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
            <div data-verify-panel className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', visibility: 'visible' }}>
              <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-5 shadow-2xl">
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
                    <button disabled={verifyBusy || !verifyEmail.trim() || verifyCode.trim().length !== 6} onClick={doVerifyEmail} className="flex-1 rounded-xl bg-slate-900 text-white py-3 text-sm hover:bg-black disabled:opacity-60">
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

            {authError ? <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{authError}</div> : null}
            
            {!me && turnstileSiteKey && !loginCaptchaToken && (
              <div className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <strong>Step 1:</strong> Click "Click to Verify" below to complete security verification.<br />
                <strong>Step 2:</strong> Then enter your email and password to sign in.
              </div>
            )}

            {me ? (
              <div className="mt-5 space-y-3">
                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                  <div className="text-sm font-semibold text-slate-900">{(me as any).firstName || me.email}</div>
                  <div className="text-xs text-slate-500 mt-1">{me.email}</div>

                  {/* ✅ FIX: role from me.role */}
                  <div className="text-xs text-slate-500 mt-1">{me.role === "ADMIN" ? "Role: Admin" : "Role: Customer"}</div>
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
                  <div className="mt-3 space-y-2">
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
                    <button disabled={pwBusy} onClick={doChangePassword} className="w-full rounded-xl bg-slate-900 text-white py-3 text-sm hover:bg-black disabled:opacity-60">
                      Update password
                    </button>
                  </div>
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

                  {!myOrdersBusy && myOrders.length === 0 ? (
                    <div className="mt-3 text-sm text-slate-600">No orders yet.</div>
                  ) : null}

                  <div className="mt-3 space-y-2">
                    {myOrders.map((o) => (
                      <div key={o.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 truncate">{o?.product?.title || "Order"}</div>
                            <div className="text-xs text-slate-500 mt-1">
                              Order #{o.id}
                              {o?.createdAt ? ` • ${new Date(o.createdAt).toLocaleString()}` : ""}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              {o?.purchaseTerm ? `Term: ${o.purchaseTerm}` : ""}
                              {o?.selectedType ? ` • Plan: ${o.selectedType}` : ""}
                            </div>
                          </div>
                          <div className="shrink-0">
                            <div
                              className={`text-xs font-medium px-2 py-1 rounded-full border ${
                                o.status === "CONFIRMED"
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-100"
                                  : o.status === "REJECTED"
                                    ? "bg-red-50 text-red-800 border-red-100"
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
              <div className="mt-5 space-y-3">
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
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      {loginCaptchaToken ? (
                        <div className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-1 rounded-full">Verified ✅</div>
                      ) : (
                        <div className="text-xs text-amber-600 font-medium">⚠️ Verification required before login</div>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            resetLoginCaptcha();
                            setLoginCaptchaOpen(true);
                          }}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50 font-medium"
                        >
                          {loginCaptchaToken ? "Re-verify" : "Click to Verify"}
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
                    {!loginCaptchaToken && (
                      <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                        Please click "Click to Verify" above to complete the security check before signing in.
                      </div>
                    )}
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
                  type="button"
                  disabled={authBusy}
                  onClick={() => {
                    if (turnstileSiteKey && !loginCaptchaToken) {
                      setLoginCaptchaOpen(true);
                      return;
                    }
                    doLogin();
                  }}
                  className="w-full rounded-xl bg-slate-900 text-white py-3 text-sm hover:bg-black disabled:opacity-60"
                >
                  {turnstileSiteKey && !loginCaptchaToken ? "Complete Verification First" : authBusy ? "Signing in..." : "Sign in"}
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
                      <input value={rpToken} onChange={(e) => setRpToken(e.target.value)} placeholder="Reset code" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                      <div className="relative">
                        <input
                          value={rpPw1}
                          onChange={(e) => setRpPw1(e.target.value)}
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
                      <button disabled={rpBusy} onClick={doResetPassword} className="w-full rounded-xl bg-slate-900 text-white py-3 text-sm hover:bg-black disabled:opacity-60">
                        Set new password
                      </button>
                    </div>
                  </div>
                ) : null}
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
                type="button"
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

  const Cart = () => {
    const lines = cartItems.map((it) => ({
      ...it,
      subtotal: (it.unitPrice || 0) * (it.qty || 0),
    }));

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
                  {lines.map((it) => (
                    <div key={it.productId} className="flex items-center justify-between gap-4 border border-slate-200 rounded-2xl p-4 bg-white">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate">{it.title}</div>
                        <div className="text-xs text-slate-500 mt-1">Unit: {formatMoney(it.unitPrice)}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCartQty(it.productId, (it.qty || 1) - 1)}
                          className="h-9 w-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                          aria-label="Decrease"
                        >
                          −
                        </button>
                        <input
                          value={String(it.qty)}
                          onChange={(e) => setCartQty(it.productId, Number(e.target.value))}
                          className="w-16 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-center"
                          inputMode="numeric"
                        />
                        <button
                          onClick={() => setCartQty(it.productId, (it.qty || 0) + 1)}
                          className="h-9 w-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                          aria-label="Increase"
                        >
                          +
                        </button>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-semibold text-slate-900">{formatMoney(it.subtotal)}</div>
                        <button onClick={() => removeFromCart(it.productId)} className="mt-1 text-xs text-red-600 hover:underline">
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
                  Order ver
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
    const [checkoutSelectedType, setCheckoutSelectedType] = useState<"Personal" | "Business">(() => {
      if (cartItems.length > 0 && cartItems[0].productType) return cartItems[0].productType;
      return selectedType;
    });

    useEffect(() => {
      if (cartItems.length === 0) return;
      const types = [...new Set(cartItems.map((it) => it.productType).filter(Boolean))];
      if (types.length === 1 && (types[0] === "Personal" || types[0] === "Business")) {
        setCheckoutSelectedType(types[0]);
      }
    }, [cartItems]);

    // Coupon state
    const [couponCode, setCouponCode] = useState("");
    const [appliedCoupon, setAppliedCoupon] = useState<CouponT | null>(null);
    const [couponLoading, setCouponLoading] = useState(false);
    const [couponError, setCouponError] = useState<string | null>(null);

    const checkoutLines = cartItems.map((it) => ({
      ...it,
      subtotal: (it.unitPrice || 0) * (it.qty || 0),
    }));
    const checkoutTotal = checkoutLines.reduce((acc, it) => acc + it.subtotal, 0);

    const applyCoupon = async () => {
      if (!couponCode.trim()) return;
      setCouponLoading(true);
      setCouponError(null);
      try {
        const json = await gatewayFetch("/coupons/validate", {
          method: "POST",
          body: JSON.stringify({ code: couponCode.trim(), productId: checkoutLines[0]?.productId || undefined }),
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
        const licenseLine = checkoutSelectedType === "Business" ? "This license is for multiple PCs." : "License for one PC.";

        await gatewayFetch("/orders", {
          method: "POST",
          body: JSON.stringify({
            items: cartItems.map((it) => ({ productId: it.productId, qty: it.qty })),
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
          }),
        });
        
        // Show success message first
        setSent(true);
        setErr(null);
        
        // Scroll to top to show success message
        window.scrollTo({ top: 0, behavior: "smooth" });

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
        clearCart();
      } catch (e: any) {
        alert(e?.message || t("order.error.failed"));
        setErr(e?.message || t("order.error.failed"));
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
      zip.trim().length >= 3;

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
                <select value={checkoutSelectedType} onChange={(e) => setCheckoutSelectedType(e.target.value as "Personal" | "Business")} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                  <option value="Personal">Personal</option>
                  <option value="Business">Business</option>
                </select>
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
                {checkoutLines.length ? (
                  <div className="space-y-2">
                    {checkoutLines.map((it) => (
                      <div key={it.productId} className="flex justify-between gap-3">
                        <span className="text-slate-600 truncate">{it.title} × {it.qty}</span>
                        <span className="text-slate-900 font-medium">{formatMoney(it.subtotal)}</span>
                      </div>
                    ))}
                    <div className="h-px bg-slate-200" />
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
                  <span className="text-slate-900 font-medium">{checkoutSelectedType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">License</span>
                  <span className="text-slate-900 font-medium">{checkoutSelectedType === "Business" ? "This license is for multiple PCs." : "License for one PC."}</span>
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
          <button disabled={busy} onClick={doTrack} className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm hover:bg-black disabled:opacity-60">
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
    if (page === "fraud") return <Fraud />;
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
            <HeaderSearch query={query} setQuery={setQuery} placeholder={t("common.search")} />

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
                setPage("cart");
              }}
              className="rounded-xl bg-slate-900 text-white px-3 py-2 text-sm hover:bg-black"
            >
              {t("header.cart")} · {cartCount}
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
                      const successMsg = "Subscribed successfully.";
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
                {subscriptionStatus === "loading" ? ("Subscribing...") : t("footer.subscriptionCta")}
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

      {/* Cookie Consent Banner */}
      {cookieConsent === "pending" && (
        <div className="fixed bottom-0 left-0 right-0 z-40 md:bottom-6 md:left-6 md:right-auto md:max-w-md">
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
      <div className={`fixed ${cookieConsent === "pending" ? "bottom-48 md:bottom-6" : "bottom-6"} right-6 z-[60] transition-all`}>
        {isChatOpen ? <ChatWidget me={me} gatewayFetch={gatewayFetch} onClose={() => setIsChatOpen(false)} /> : (
          <button onClick={() => setIsChatOpen(true)} className="h-14 w-14 rounded-full bg-emerald-600 text-white shadow-lg hover:bg-emerald-700 flex items-center justify-center text-2xl" title="Chat">
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

function ChatWidget({ me, gatewayFetch, onClose }: { me: any; gatewayFetch: (path: string, init?: RequestInit) => Promise<any>; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [needsEmail, setNeedsEmail] = useState(false);
  const [chatStatus, setChatStatus] = useState<"BOT" | "WAITING_FOR_HUMAN" | "HUMAN" | "CLOSED">("BOT");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([
    { role: "assistant", text: "Hi! How can I help you?" },
  ]);

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

  const getCurrentPage = () => {
    if (typeof window === "undefined") return "";
    return window.location.pathname || "";
  };

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || busy) return;

    setError(null);
    setBusy(true);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);

    try {
      const json = await gatewayFetch("/chat", {
        method: "POST",
        body: JSON.stringify({
          message: trimmed,
          deviceId: getDeviceId(),
          email: needsEmail ? emailInput.trim() : me?.email || undefined,
          currentPage: getCurrentPage(),
        }),
      });

      if (json?.sessionId) setSessionId(json.sessionId);
      if (json?.status) setChatStatus(json.status);
      if (json?.needsEmail) {
        setNeedsEmail(true);
      }
      
      if (json?.reply) {
        setMessages((prev) => [...prev, { role: "assistant", text: json.reply }]);
      }

      if (needsEmail && emailInput.trim()) {
        setEmailInput("");
        setNeedsEmail(false);
      }
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
        {error ? <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div> : null}
        {chatStatus === "WAITING_FOR_HUMAN" && (
          <div className="text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded-lg px-3 py-2">
            ⏳ Waiting for human agent...
          </div>
        )}
        {chatStatus === "HUMAN" && (
          <div className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg px-3 py-2">
            💬 Chatting with support agent
          </div>
        )}
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
          {needsEmail ? (
            <>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !busy && emailInput.trim()) {
                    setNeedsEmail(false);
                    send();
                  }
                }}
                placeholder="Enter your email to contact support..."
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                disabled={busy}
              />
              <button onClick={() => { setNeedsEmail(false); send(); }} disabled={busy || !emailInput.trim()} className="rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm hover:bg-emerald-700 disabled:opacity-60">
                Send
              </button>
            </>
          ) : (
            <>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !busy) send();
                }}
                placeholder="Type your message..."
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                disabled={busy || chatStatus === "WAITING_FOR_HUMAN" || chatStatus === "HUMAN"}
              />
              <button onClick={send} disabled={busy || chatStatus === "WAITING_FOR_HUMAN" || chatStatus === "HUMAN"} className="rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm hover:bg-emerald-700 disabled:opacity-60">
                {busy ? "..." : "Send"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
