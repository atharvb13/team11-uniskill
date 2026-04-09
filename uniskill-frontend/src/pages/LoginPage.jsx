import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Lock, User } from "lucide-react";
import AuthLayout from "../components/AuthLayout";
import FormField from "../components/FormField";
import { loginUser } from "../utils/api";
import { hasActiveSession, saveSession } from "../utils/session";
import { validateLogin } from "../utils/validation";

export default function LoginPage() {
  const navigate = useNavigate();

  useEffect(() => {
    if (hasActiveSession()) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate]);
  const [formData, setFormData] = useState({ identifier: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [serverMessage, setServerMessage] = useState("");
  const errors = useMemo(() => validateLogin(formData), [formData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerMessage("");

    const validationErrors = validateLogin(formData);
    if (Object.keys(validationErrors).length > 0) {
      alert("Please fix the highlighted fields.");
      return;
    }

    try {
      setSubmitting(true);
      const response = await loginUser({
        identifier: formData.identifier,
        password: formData.password,
      });
      saveSession(response.session ?? null);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setServerMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in with your @umass.edu email or your UniSkill username."
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <FormField
          icon={User}
          type="text"
          placeholder="Email (yourname@umass.edu) or username"
          autoComplete="username"
          value={formData.identifier}
          onChange={(e) => setFormData({ ...formData, identifier: e.target.value })}
          error={errors.identifier}
        />

        <FormField
          icon={Lock}
          type="password"
          placeholder="Enter your password"
          autoComplete="current-password"
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
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:translate-y-[-1px] hover:bg-slate-800"
        >
          {submitting ? "Logging in..." : "Login"} <ArrowRight className="h-4 w-4" />
        </button>

        {serverMessage ? (
          <p className="text-center text-sm text-red-600">{serverMessage}</p>
        ) : null}

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
