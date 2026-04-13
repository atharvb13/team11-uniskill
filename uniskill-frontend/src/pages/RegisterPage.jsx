import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Lock, Mail, User } from "lucide-react";
import AuthLayout from "../components/AuthLayout";
import FormField from "../components/FormField";
import PasswordStrength from "../components/PasswordStrength";
import { registerUser } from "../utils/api";
import { validateRegister } from "../utils/validation";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [serverMessage, setServerMessage] = useState("");
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  /** Inline errors only after first submit attempt — avoids all-red empty form on load. */
  const [showFieldErrors, setShowFieldErrors] = useState(false);

  const errors = useMemo(
    () => (showFieldErrors ? validateRegister(formData) : {}),
    [formData, showFieldErrors],
  );

  useEffect(() => {
    if (!registrationSuccess) {
      return undefined;
    }
    const timer = setTimeout(() => navigate("/login", { replace: true }), 2000);
    return () => clearTimeout(timer);
  }, [registrationSuccess, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerMessage("");
    setRegistrationSuccess(false);

    const validationErrors = validateRegister(formData);
    if (Object.keys(validationErrors).length > 0) {
      setShowFieldErrors(true);
      return;
    }

    try {
      setSubmitting(true);
      await registerUser({
        firstName: formData.firstName,
        lastName: formData.lastName,
        username: formData.username,
        email: formData.email,
        password: formData.password,
      });
      setRegistrationSuccess(true);
    } catch (error) {
      setServerMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Join UniSkill with your verified UMass email."
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <FormField
          icon={User}
          placeholder="First name"
          value={formData.firstName}
          onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
          error={errors.firstName}
          disabled={registrationSuccess}
        />

        <FormField
          icon={User}
          placeholder="Last name"
          value={formData.lastName}
          onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
          error={errors.lastName}
          disabled={registrationSuccess}
        />

        <FormField
          icon={User}
          placeholder="Username"
          value={formData.username}
          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          error={errors.username}
          disabled={registrationSuccess}
        />

        <FormField
          icon={Mail}
          type="email"
          placeholder="yourname@umass.edu"
          autoComplete="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          error={errors.email}
          disabled={registrationSuccess}
        />

        <FormField
          icon={Lock}
          type="password"
          placeholder="Create password"
          autoComplete="new-password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          error={errors.password}
          disabled={registrationSuccess}
        />
        <PasswordStrength password={formData.password} />

        <FormField
          icon={Lock}
          type="password"
          placeholder="Confirm password"
          autoComplete="new-password"
          value={formData.confirmPassword}
          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
          error={errors.confirmPassword}
          disabled={registrationSuccess}
        />

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Registration is limited to email addresses ending in <span className="font-semibold">@umass.edu</span>.
        </div>

        <button
          type="submit"
          disabled={submitting || registrationSuccess}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:translate-y-[-1px] hover:bg-emerald-700 disabled:opacity-60"
        >
          {submitting ? "Creating..." : "Create account"} <ArrowRight className="h-4 w-4" />
        </button>

        {registrationSuccess ? (
          <p className="text-center text-sm font-medium text-emerald-600">Registration successful.</p>
        ) : null}
        {registrationSuccess ? (
          <p className="text-center text-xs text-slate-500">Redirecting to login…</p>
        ) : null}

        {!registrationSuccess && serverMessage ? (
          <p className="text-center text-sm text-red-600">{serverMessage}</p>
        ) : null}

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
