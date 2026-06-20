// ✅ NEW FILE: src/config/plans.ts
// Single source of truth for Free vs Plus plan limits + PayHere pricing.

export type PlanName = 'free' | 'plus';

export interface PlanLimits {
  maxProjects: number;
  maxFoldersPerProject: number;
  maxFilesPerProject: number;
  maxFileSizeBytes: number;
}

// Use Number.POSITIVE_INFINITY for "unlimited" so the same comparison
// logic (`count >= limit`) works for both plans without special-casing.
export const PLAN_LIMITS: Record<PlanName, PlanLimits> = {
  free: {
    maxProjects: 3,
    maxFoldersPerProject: 15,
    maxFilesPerProject: 25,
    maxFileSizeBytes: 200 * 1024, // 200KB per file
  },
  plus: {
    maxProjects: Infinity,
    maxFoldersPerProject: Infinity,
    maxFilesPerProject: Infinity,
    maxFileSizeBytes: 5 * 1024 * 1024, // 5MB per file
  },
};

export const getPlanLimits = (plan: PlanName): PlanLimits => PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

// ── PayHere pricing (one-time, lifetime Plus upgrade) ──────────────────────
// Override with PAYHERE_PLUS_PRICE in .env if you want a different price.
export const PLUS_PRICE = {
  amount: Number(process.env.PAYHERE_PLUS_PRICE || 1500), // LKR
  currency: 'LKR',
};