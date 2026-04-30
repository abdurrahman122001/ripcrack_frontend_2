import React, { memo } from "react";

interface HeaderSearchProps {
  query: string;
  setQuery: React.Dispatch<React.SetStateAction<string>>;
  placeholder: string;
  /** Called when user submits search (Enter key). Use to e.g. navigate to Shop. */
  onSubmit?: () => void;
}

export const HeaderSearch = memo(function HeaderSearch({
  query,
  setQuery,
  placeholder,
  onSubmit,
}: HeaderSearchProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSubmit?.();
    }
  };

  return (
    <div className="hidden md:block relative">
      {/* ✅ native search "x" gizlə */}
      <style>{`
        input[type="search"]::-webkit-search-cancel-button,
        input[type="search"]::-webkit-search-decoration {
          -webkit-appearance: none;
          appearance: none;
        }
        input[type="search"]::-ms-clear,
        input[type="search"]::-ms-reveal {
          display: none;
          width: 0;
          height: 0;
        }
      `}</style>

      <input
        id="header-search"
        name="search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
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
