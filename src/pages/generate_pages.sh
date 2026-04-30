#!/bin/bash
# Generate placeholder page components

pages=(
  "ShopPage:Shop"
  "ProductPage:Product"
  "PricingPage:Pricing"
  "ContactPage:Contact"
  "FraudPage:Fraud"
  "AccountPage:Account"
  "CartPage:Cart"
  "CheckoutPage:Checkout"
  "OrderTrackingPage:OrderTracking"
  "RefundPolicyPage:RefundPolicy"
  "PrivacyPolicyPage:PrivacyPolicy"
  "CookiePolicyPage:CookiePolicy"
  "DisclaimerPage:Disclaimer"
  "TermsPage:Terms"
  "AboutPage:About"
  "FaqPage:Faq"
  "SpecialCrackPage:SpecialCrack"
  "CouponsPage:Coupons"
)

for page_info in "${pages[@]}"; do
  IFS=':' read -r filename component <<< "$page_info"
  cat > "${filename}.tsx" << EOL
import React from "react";

export const ${component}: React.FC = () => {
  // TODO: Extract ${component} component from index.tsx
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-4">${component}</h1>
      <p className="text-slate-600">This component needs to be extracted from index.tsx</p>
    </div>
  );
};
EOL
done

chmod +x generate_pages.sh
./generate_pages.sh
