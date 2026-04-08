import React from "react";
import { motion } from "framer-motion";
import { ArrowRight, GraduationCap, ShieldCheck } from "lucide-react";

export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-900">
      <div className="relative isolate overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.22),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.18),_transparent_28%)]" />

        <div className="relative mx-auto grid min-h-screen max-w-7xl grid-cols-1 gap-8 px-6 py-8 lg:grid-cols-2 lg:px-10 lg:py-10">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45 }}
            className="flex flex-col justify-between rounded-[32px] border border-white/10 bg-white/5 p-8 text-white backdrop-blur-xl lg:p-10"
          >
            <div>
              <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-emerald-200">
                <GraduationCap className="h-4 w-4" />
                UniSkill for UMass Amherst
              </div>

              <h1 className="mt-6 max-w-xl text-4xl font-bold leading-tight lg:text-5xl">
                Learn, teach, and connect with students across campus.
              </h1>

              <p className="mt-5 max-w-lg text-sm leading-6 text-slate-300 lg:text-base">
                A clean and secure entry point for your skill-sharing platform. Students can sign in
                and register using only their UMass email address.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
                <ShieldCheck className="mb-3 h-8 w-8 text-emerald-300" />
                <h3 className="text-base font-semibold">Campus-only access</h3>
                <p className="mt-2 text-sm text-slate-300">
                  Only verified UMass email addresses can register and access the platform.
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
                <ArrowRight className="mb-3 h-8 w-8 text-sky-300" />
                <h3 className="text-base font-semibold">Quick onboarding</h3>
                <p className="mt-2 text-sm text-slate-300">
                  Dedicated pages for login and registration with a polished frontend flow.
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05 }}
            className="flex items-center justify-center"
          >
            <div className="w-full max-w-xl rounded-[32px] bg-white p-4 shadow-2xl shadow-black/20 sm:p-6 lg:p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
                <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
              </div>
              {children}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}