export type Page = "home" | "shop" | "product" | "account" | "cart" | "checkout" | "contact" | "pricing" | "fraud" | "admin" | "refund" | "privacy" | "cookies" | "disclaimer" | "terms" | "about" | "faq" | "special" | "coupons" | "track";

export type PurchaseTerm = "annual" | "lifetime";

export type Lang = "EN" | "RU" | "IT" | "AR";

export type Brand = { 
  id?: number; 
  name: string; 
  logo?: string; 
  sortOrder?: number; 
  type?: "HEADER" | "TRUSTED" 
};

export type CategoryAdminT = {
  id: number;
  name: string;
  sortOrder: number;
  seoTitle?: string;
  seoDescription?: string;
  seoSlug?: string;
  seoOgImage?: string;
  primaryKeyword?: string;
  secondaryKeywords?: string[];
};

export type ProductT = {
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
  seoSlug?: string;
  seoOgImage?: string;
  primaryKeyword?: string;
  secondaryKeywords?: string[];
  seoKeywords?: Array<{ keyword: string; strength: "strong" | "medium" | "weak" }>;
  images?: string[];
  views: number;
  sold: number;
};

export type CartItemT = {
  productId: number;
  title: string;
  unitPrice: number;
  personalUnitPrice?: number;
  businessUnitPrice?: number;
  qty: number;
  productType?: "Personal" | "Business";
};

export type FraudItem = {
  id: number;
  name: string;
  handle: string;
  platform: string;
  note: string;
  details?: string;
  evidenceUrl?: string;
  reports: number;
};

export type TestimonialT = {
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

// Chatwoot type definition
declare global {
  interface Window {
    $chatwoot?: {
      toggle: () => void;
      isOpen: () => boolean;
    };
  }
}
