// Mirrors dew-code-backend/src/config/plans.ts for UI display purposes only.
// The backend is the source of truth/enforcement — this is just copy.

export const PLAN_LIMITS = {
  free: {
    label: 'Free',
    maxProjects: 3,
    maxFoldersPerProject: 15,
    maxFilesPerProject: 25,
    maxFileSizeKB: 200,
  },
  plus: {
    label: 'Plus',
    maxProjects: 'Unlimited',
    maxFoldersPerProject: 'Unlimited',
    maxFilesPerProject: 'Unlimited',
    maxFileSizeKB: 5120,
  },
} as const;

export const PLUS_PRICE_LKR = 1500;

export const PLUS_FEATURES: string[] = [
  'Unlimited projects',
  'Unlimited folders & files per project',
  'Larger file size limit (5MB vs 200KB)',
  'Priority AI suggestions & corrections',
  'Support DewCode\u2019s development',
];
