// ✅ NEW FILE: src/services/paymentApi.ts
// Talks to the backend's PayHere endpoints. The actual checkout popup is
// driven by the PayHere JS SDK in components/billing/UpgradeModal.tsx —
// this file only fetches the signed hash + plan status.

import apiFetch from './api';

interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

export interface PayHereInitiateResponse {
  sandbox: boolean;
  merchant_id: string;
  order_id: string;
  items: string;
  amount: string;
  currency: string;
  hash: string;
  return_url: string;
  cancel_url: string;
  notify_url: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
}

export const paymentApi = {
  initiatePlusUpgrade: () =>
    apiFetch<ApiResponse<PayHereInitiateResponse>>('/api/payments/payhere/initiate', {
      method: 'POST',
    }),

  getStatus: () =>
    apiFetch<ApiResponse<{ plan: 'free' | 'plus'; planUpgradedAt: string | null }>>('/api/payments/status'),
};
