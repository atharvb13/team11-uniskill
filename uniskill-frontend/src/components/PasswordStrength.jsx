import React from "react";

export default function PasswordStrength({ password }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /[0-9]/.test(password),
  ];

  const passed = checks.filter(Boolean).length;
  const label = passed <= 1 ? "Weak" : passed <= 3 ? "Medium" : "Strong";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Password strength</span>
        <span className="font-medium text-slate-700">{label}</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {checks.map((ok, i) => (
          <div key={i} className={`h-2 rounded-full ${ok ? "bg-emerald-500" : "bg-slate-200"}`} />
        ))}
      </div>
    </div>
  );
}