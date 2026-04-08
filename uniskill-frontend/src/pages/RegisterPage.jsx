import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Lock, Mail, User } from "lucide-react";
import AuthLayout from "../components/AuthLayout";
import FormField from "../components/FormField";
import PasswordStrength from "../components/PasswordStrength";
import { validateRegister } from "../utils/validation";

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const errors = useMemo(() => validateRegister(formData), [formData]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const validationErrors = validateRegister(formData);
    if (Object.keys(validationErrors).length > 0) {
      alert("Please fix the highlighted fields.");
      return;
    }

    console.log("Register payload:", formData);
    alert(`Account created for ${formData.email}`);
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Join UniSkill with your verified UMass email."
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <FormField
          icon={User}
          placeholder="Full name"
          value={formData.fullName}
          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
          error={errors.fullName}
        />

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
          placeholder="Create password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          error={errors.password}
        />
        <PasswordStrength password={formData.password} />

        <FormField
          icon={Lock}
          type="password"
          placeholder="Confirm password"
          value={formData.confirmPassword}
          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
          error={errors.confirmPassword}
        />

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Registration is limited to email addresses ending in <span className="font-semibold">@umass.edu</span>.
        </div>

        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:translate-y-[-1px] hover:bg-emerald-700"
        >
          Create account <ArrowRight className="h-4 w-4" />
        </button>

        <p className="text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-emerald-600 hover:text-emerald-700">
            Login
          </Link>
        </p>
      </form>
    </AuthLayout>
  );

}