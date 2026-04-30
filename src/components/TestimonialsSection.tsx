import React, { useEffect, useLayoutEffect, useRef, useState, useMemo, useCallback, memo } from "react";
import type { TestimonialT } from "../types";

interface TestimonialsSectionProps {
  testimonials: TestimonialT[];
  idx: number;
  onIdxChange: (next: number | ((prev: number) => number)) => void;
}

// Memoized wrapper for the right side content - only updates when idx changes
const TestimonialDisplay = memo(({
  testimonial,
  idx,
  getInitials,
  goPrev,
  goNext
}: {
  testimonial: TestimonialT;
  idx: number;
  getInitials: (name: string) => string;
  goPrev: () => void;
  goNext: () => void;
}) => {
  const testimonialKey = `testimonial-${idx}-${testimonial.id || testimonial.name}`;
  
  return (
    <div 
      key={testimonialKey}
      style={{ 
        minHeight: "200px", // Prevent layout shift during updates
        position: "relative"
      }}
    >
      <TestimonialDetail 
        testimonial={testimonial}
        getInitials={getInitials}
        goPrev={goPrev}
        goNext={goNext}
      />
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if idx or testimonial actually changed
  return (
    prevProps.idx === nextProps.idx &&
    prevProps.testimonial.id === nextProps.testimonial.id &&
    prevProps.testimonial.name === nextProps.testimonial.name &&
    prevProps.testimonial.text === nextProps.testimonial.text
  );
});

// Memoized component for testimonial detail to prevent flickering
const TestimonialDetail = memo(({ 
  testimonial, 
  getInitials, 
  goPrev, 
  goNext 
}: { 
  testimonial: TestimonialT; 
  getInitials: (name: string) => string;
  goPrev: () => void;
  goNext: () => void;
}) => {
  // Memoize parsed data based on testimonial properties, not object reference
  const parsed = useMemo(() => {
    const raw = (testimonial.text || "").trim();
    const [firstLineRaw, ...rest] = raw.split("\n");
    const firstLine = (firstLineRaw || "").trim();
    const body = (rest.length ? rest.join("\n") : raw).trim();

    const looksLikeMeta = /^⭐{3,5}/.test(firstLine) && firstLine.includes("·");
    if (!looksLikeMeta) {
      return {
        rating: (testimonial as any).rating as string | undefined,
        date: (testimonial as any).date as string | undefined,
        text: raw,
      };
    }

    const [ratingPart, datePart] = firstLine.split("·").map((s) => s.trim());
    return {
      rating: ratingPart || (testimonial as any).rating,
      date: datePart || (testimonial as any).date,
      text: body,
    };
  }, [testimonial.text, testimonial.rating, testimonial.date]);

  return (
    <div>
      {testimonial.companyLogo && (
        <div className="mb-4">
          <img src={testimonial.companyLogo} alt={testimonial.company} className="h-8 w-auto object-contain opacity-60" />
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
        {testimonial.photo ? (
          <img src={testimonial.photo} alt={testimonial.name} className="h-12 w-12 rounded-full object-cover" />
        ) : (
          <div className="h-12 w-12 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-semibold">
            {getInitials(testimonial.name)}
          </div>
        )}
        <div>
          <div className="text-sm font-semibold text-slate-900">{testimonial.name}</div>
          <div className="text-xs text-slate-500">{testimonial.role}{testimonial.company ? ` (${testimonial.company})` : ""}</div>
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
  );
}, (prevProps, nextProps) => {
  // Only re-render if testimonial actually changed
  const prev = prevProps.testimonial;
  const next = nextProps.testimonial;
  
  // Compare by id if available, otherwise by name (which should be unique)
  const sameTestimonial = prev.id && next.id 
    ? prev.id === next.id 
    : prev.name === next.name;
  
  // Return true if props are equal (don't re-render), false if different (re-render)
  return sameTestimonial && 
         prev.text === next.text &&
         prev.role === next.role &&
         prev.company === next.company &&
         prev.photo === next.photo &&
         prev.companyLogo === next.companyLogo;
});

function TestimonialsSectionComponent({
  testimonials,
  idx,
  onIdxChange,
}: TestimonialsSectionProps) {
  const perPage = 4;
  
  // Memoize expensive calculations
  const pageCount = useMemo(() => Math.max(1, Math.ceil(testimonials.length / perPage)), [testimonials.length, perPage]);
  
  // Get current testimonial - use direct access to avoid unnecessary memoization overhead
  const t0 = testimonials[idx];
  
  if (!t0) return null;

  // Calculate the page that idx is currently on
  const currentPage = useMemo(() => 
    Math.min(pageCount - 1, Math.max(0, Math.floor(idx / perPage))),
    [idx, pageCount, perPage]
  );
  
  // Memoize the displayed testimonial to prevent flickering
  // Only recalculate when idx or testimonials actually change
  const displayedTestimonial = useMemo(() => {
    return testimonials[idx];
  }, [testimonials, idx]);
  
  // Use state for manual page changes, but derive from idx for autoplay
  const [manualListPage, setManualListPage] = useState<number | null>(null);
  const isManualPageChangeRef = useRef(false);
  const lastIdxRef = useRef(idx);

  // Determine which page to display: manual override or calculated from idx
  // For autoplay, derive directly from idx (no state update = no flicker)
  // For manual clicks, use manualListPage state
  const listPage = manualListPage !== null ? manualListPage : currentPage;

  // Reset manual page when idx changes from autoplay (not manual)
  useLayoutEffect(() => {
    if (isManualPageChangeRef.current) {
      isManualPageChangeRef.current = false;
      lastIdxRef.current = idx;
      return;
    }

    // If idx changed and it's not a manual change, reset manual page to null
    // This ensures listPage is derived from idx for autoplay
    if (idx !== lastIdxRef.current && manualListPage !== null) {
      setManualListPage(null);
    }
    
    lastIdxRef.current = idx;
  }, [idx, manualListPage]);

  // Parsed data is now handled in TestimonialDetail component

  // Memoize helper functions with stable references
  const getInitials = useCallback((name: string) => 
    name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase(), 
    []
  );

  const goPrev = useCallback(() => {
    onIdxChange((x) => (x - 1 + testimonials.length) % testimonials.length);
  }, [onIdxChange, testimonials.length]);

  const goNext = useCallback(() => {
    onIdxChange((x) => (x + 1) % testimonials.length);
  }, [onIdxChange, testimonials.length]);

  // Memoize the visible testimonials list
  const visibleTestimonials = useMemo(() => 
    testimonials.slice(listPage * perPage, listPage * perPage + perPage),
    [testimonials, listPage, perPage]
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl shadow-sm p-4 sm:p-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-start">
        <div className="md:col-span-2 order-2 md:order-1">
          <TestimonialDisplay
            testimonial={displayedTestimonial}
            idx={idx}
            getInitials={getInitials}
            goPrev={goPrev}
            goNext={goNext}
          />
        </div>

        <div className="space-y-3">
          {visibleTestimonials.map((x, i) => {
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
                onClick={() => {
                  const newPage = Math.max(0, listPage - 1);
                  isManualPageChangeRef.current = true;
                  setManualListPage(newPage);
                  const firstIdx = newPage * perPage;
                  if (Number.isFinite(firstIdx) && testimonials[firstIdx]) onIdxChange(firstIdx);
                }}
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
                      isManualPageChangeRef.current = true;
                      setManualListPage(p);
                      const firstIdx = p * perPage;
                      if (Number.isFinite(firstIdx) && testimonials[firstIdx]) {
                        onIdxChange(firstIdx);
                      }
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
                onClick={() => {
                  const newPage = Math.min(pageCount - 1, listPage + 1);
                  isManualPageChangeRef.current = true;
                  setManualListPage(newPage);
                  const firstIdx = newPage * perPage;
                  if (Number.isFinite(firstIdx) && testimonials[firstIdx]) onIdxChange(firstIdx);
                }}
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

// Memoize the component to prevent re-renders when props haven't changed
export const TestimonialsSection = memo(TestimonialsSectionComponent, (prevProps, nextProps) => {
  // Custom comparison: only re-render if idx actually changed or testimonials array changed
  // This prevents re-renders when only listPage state changes internally
  const idxChanged = prevProps.idx !== nextProps.idx;
  const testimonialsChanged = prevProps.testimonials !== nextProps.testimonials || 
                              prevProps.testimonials.length !== nextProps.testimonials.length;
  const onIdxChangeChanged = prevProps.onIdxChange !== nextProps.onIdxChange;
  
  // Return true if props are equal (don't re-render), false if different (re-render)
  return !idxChanged && !testimonialsChanged && !onIdxChangeChanged;
});
