import React from "react";

const inputBase =
  "w-full rounded-2xl border border-slate-200 bg-white/80 px-11 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100";

export default function FormField({ icon: Icon, type = "text", placeholder, value, onChange, error }) {
  return (
    <div>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className={`${inputBase} ${error ? "border-red-400 focus:border-red-500 focus:ring-red-100" : ""}`}
        />
      </div>
      {error ? <p className="mt-2 text-xs text-red-500">{error}</p> : null}
    </div>
  );
}