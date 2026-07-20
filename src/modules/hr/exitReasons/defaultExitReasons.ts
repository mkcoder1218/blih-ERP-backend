export const DEFAULT_EXIT_REASONS = [
  {
    name: "Better opportunity",
    description:
      "The employee is leaving for another employment opportunity.",
    allowedInitiator: "employee",
    requiresExplanation: false,
    sortOrder: 10,
  },

  {
    name: "Personal reasons",
    description:
      "The employee is leaving for personal circumstances.",
    allowedInitiator: "employee",
    requiresExplanation: true,
    sortOrder: 20,
  },

  {
    name: "Relocation",
    description:
      "The employee is relocating and cannot continue employment.",
    allowedInitiator: "employee",
    requiresExplanation: false,
    sortOrder: 30,
  },

  {
    name: "Education",
    description:
      "The employee is leaving to continue education or training.",
    allowedInitiator: "employee",
    requiresExplanation: false,
    sortOrder: 40,
  },

  {
    name: "Medical reasons",
    description:
      "The exit is related to medical or health circumstances.",
    allowedInitiator: "both",
    requiresExplanation: true,
    sortOrder: 50,
  },

  {
    name: "Retirement",
    description:
      "The employment relationship is ending due to retirement.",
    allowedInitiator: "both",
    requiresExplanation: false,
    sortOrder: 60,
  },

  {
    name: "Performance",
    description:
      "The employer is ending employment due to performance.",
    allowedInitiator: "employer",
    requiresExplanation: true,
    sortOrder: 70,
  },

  {
    name: "Misconduct",
    description:
      "The employer is ending employment due to misconduct.",
    allowedInitiator: "employer",
    requiresExplanation: true,
    sortOrder: 80,
  },

  {
    name: "Redundancy",
    description:
      "The role is no longer required by the business.",
    allowedInitiator: "employer",
    requiresExplanation: true,
    sortOrder: 90,
  },

  {
    name: "Contract completed",
    description:
      "The agreed employment contract period has ended.",
    allowedInitiator: "both",
    requiresExplanation: false,
    sortOrder: 100,
  },

  {
    name: "Organizational restructuring",
    description:
      "The exit results from organizational restructuring.",
    allowedInitiator: "employer",
    requiresExplanation: true,
    sortOrder: 110,
  },

  {
    name: "Other",
    description:
      "A reason not covered by the available options.",
    allowedInitiator: "both",
    requiresExplanation: true,
    sortOrder: 999,
  },
] as const;