import bcrypt from "bcryptjs";
import express from "express";
import { supabaseAdminClient, supabaseAuthClient } from "../config/supabase.js";
import { isAutoConfirmEmailEnabled } from "../utils/authEnv.js";
import { validateLoginInput, validateRegistrationInput } from "../utils/validation.js";

const BCRYPT_ROUNDS = 12;
const DEFAULT_FRONTEND_ORIGIN = "http://localhost:5173";

const router = express.Router();

router.post("/register", async (req, res) => {
  const validation = validateRegistrationInput(req.body);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.message });
  }

  const { email, password, firstName, lastName, username } = validation;

  const autoConfirm = isAutoConfirmEmailEnabled();
  const frontendOrigin = (process.env.FRONTEND_ORIGIN || DEFAULT_FRONTEND_ORIGIN).replace(/\/$/, "");
  const emailRedirectTo = `${frontendOrigin}/email-confirmed`;

  let userId;

  if (autoConfirm) {
    const { data: created, error: createError } = await supabaseAdminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username,
        first_name: firstName,
        last_name: lastName,
      },
    });

    if (createError) {
      return res.status(400).json({ error: createError.message });
    }

    userId = created?.user?.id;
    if (!userId) {
      return res.status(500).json({ error: "Failed to create auth user." });
    }

    const { error: confirmError } = await supabaseAdminClient.auth.admin.updateUserById(userId, {
      email_confirm: true,
    });
    if (confirmError) {
      return res.status(500).json({ error: confirmError.message });
    }
  } else {
    // Anon signUp triggers Supabase “confirm email” mail when enabled in the dashboard.
    // admin.createUser never sends that email.
    const signUpResult = await supabaseAuthClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: {
          username,
          first_name: firstName,
          last_name: lastName,
        },
      },
    });

    if (signUpResult.error) {
      return res.status(400).json({ error: signUpResult.error.message });
    }

    userId = signUpResult.data.user?.id;
    if (!userId) {
      return res.status(500).json({ error: "Failed to create auth user." });
    }
  }

  // Ensure `public.users` has a row even if the auth trigger is missing or fails.
  // (A plain UPDATE only touches existing rows and silently affects 0 rows if none exist.)
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const { error: profileUpsertError } = await supabaseAdminClient.from("users").upsert(
    {
      id: userId,
      username,
      first_name: firstName,
      last_name: lastName,
      contact_email: email,
      password_hash: passwordHash,
    },
    { onConflict: "id" }
  );

  if (profileUpsertError) {
    return res.status(500).json({ error: profileUpsertError.message });
  }

  const payload = {
    message: "Registration successful.",
    user: {
      id: userId,
      email,
      firstName,
      lastName,
      username,
    },
  };
  if (!autoConfirm) {
    payload.nextStep =
      "Check your email for a confirmation link from Supabase. After you confirm, you can sign in. Ensure Supabase → Authentication → URL configuration includes your app URL and the redirect: " +
      emailRedirectTo;
  }
  return res.status(201).json(payload);
});

router.post("/login", async (req, res) => {
  const validation = validateLoginInput(req.body);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.message });
  }

  const { password } = validation;
  let email;

  if (validation.mode === "email") {
    email = validation.email;
  } else {
    const { data: profile, error: profileError } = await supabaseAdminClient
      .from("users")
      .select("contact_email")
      .eq("username", validation.username)
      .maybeSingle();

    if (profileError) {
      return res.status(500).json({ error: profileError.message });
    }

    const resolved = profile?.contact_email?.trim();
    if (!resolved) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    email = resolved.toLowerCase();
  }

  const signInResult = await supabaseAuthClient.auth.signInWithPassword({
    email,
    password,
  });

  if (signInResult.error) {
    const { data: profileRow } = await supabaseAdminClient
      .from("users")
      .select("id")
      .eq("contact_email", email)
      .maybeSingle();

    if (profileRow?.id) {
      const { data: authUserData } = await supabaseAdminClient.auth.admin.getUserById(profileRow.id);
      const authUser = authUserData?.user;
      if (authUser && !authUser.email_confirmed_at) {
        return res.status(401).json({
          error:
            "Your email is not confirmed yet. Open the confirmation link from Supabase, or in the dashboard go to Authentication → Users and confirm this user. For local dev, set AUTO_CONFIRM_EMAIL=true in uniskill-backend/.env and restart the server.",
        });
      }
    }

    return res.status(401).json({ error: signInResult.error.message });
  }

  return res.status(200).json({
    message: "Login successful.",
    session: {
      accessToken: signInResult.data.session?.access_token,
      refreshToken: signInResult.data.session?.refresh_token,
      expiresAt: signInResult.data.session?.expires_at,
    },
    user: {
      id: signInResult.data.user?.id,
      email: signInResult.data.user?.email,
    },
  });
});

export default router;
