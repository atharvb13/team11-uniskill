/** Shared by dashboard modals and onboarding (button grid with hints). */
export const TEACH_PROFICIENCY_OPTIONS = [
  { value: "beginner", label: "Beginner", hint: "Learning to teach this" },
  { value: "intermediate", label: "Intermediate", hint: "Comfortable mentoring" },
  { value: "advanced", label: "Advanced", hint: "Very strong" },
  { value: "expert", label: "Expert", hint: "Deep experience" },
];

/** Goal level for “want to learn” (same DB field as teach: `proficiency_level` when can_teach is false). */
export const LEARN_TARGET_LEVEL_OPTIONS = [
  { value: "beginner", label: "Beginner", hint: "Start from the basics" },
  { value: "intermediate", label: "Intermediate", hint: "Know some — want to go deeper" },
  { value: "advanced", label: "Advanced", hint: "Strong — polish or specialize" },
  { value: "expert", label: "Expert", hint: "Near the top of the topic" },
];
