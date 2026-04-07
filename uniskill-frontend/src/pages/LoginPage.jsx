import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Lock, Mail } from "lucide-react";
import AuthLayout from "../components/AuthLayout";
import FormField from "../components/FormField";
import { validateLogin } from "../utils/validation";

export default function LoginPage() {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const errors = useMemo(() => validateLogin(formData), [formData]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const validationErrors = validateLogin(formData);
    if (Object.keys(validationErrors).length > 0) {
      alert("Please fix the highlighted fields.");
      return;
    }

    console.log("Login payload:", formData);
    alert(`Login submitted for ${formData.email}`);
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in with your UMass Amherst account."
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <FormField
          icon={Mail}
          type="email"
          placeholder="yourname@umass.edu"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          error={errors.email}
        />

        <FormField
          icon={Lock}
          type="password"
          placeholder="Enter your password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          error={errors.password}
        />

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-slate-600">
            <input type="checkbox" className="rounded border-slate-300" />
            Remember me
          </label>
          <button type="button" className="font-medium text-emerald-600 hover:text-emerald-700">
            Forgot password?
          </button>
        </div>

        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:translate-y-[-1px] hover:bg-slate-800"
        >
          Login <ArrowRight className="h-4 w-4" />
        </button>

        <p className="text-center text-sm text-slate-500">
          Don&apos;t have an account?{" "}
          <Link to="/register" className="font-semibold text-emerald-600 hover:text-emerald-700">
            Register
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}