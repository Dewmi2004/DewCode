// Loads PayHere's onsite-checkout script once and exposes a typed
// startPayment() wrapper around the global `window.payhere` object it sets.

import type { PayHereInitiateResponse } from './paymentApi';

declare global {
  interface Window {
    payhere?: {
      onCompleted?: (orderId: string) => void;
      onDismissed?: () => void;
      onError?: (error: string) => void;
      startPayment: (payment: Record<string, unknown>) => void;
    };
  }
}

const SDK_URL = 'https://www.payhere.lk/lib/payhere.js';
let loadingPromise: Promise<void> | null = null;

const loadPayHereScript = (): Promise<void> => {
  if (window.payhere) return Promise.resolve();
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load the PayHere checkout script.'));
    document.body.appendChild(script);
  });

  return loadingPromise;
};

export const startPayHereCheckout = async (
  params: PayHereInitiateResponse,
  handlers: { onCompleted: (orderId: string) => void; onDismissed: () => void; onError: (error: string) => void }
): Promise<void> => {
  await loadPayHereScript();
  const payhere = window.payhere!;
  payhere.onCompleted = handlers.onCompleted;
  payhere.onDismissed = handlers.onDismissed;
  payhere.onError = handlers.onError;

  payhere.startPayment({
    sandbox: params.sandbox,
    merchant_id: params.merchant_id,
    return_url: params.return_url,
    cancel_url: params.cancel_url,
    notify_url: params.notify_url,
    order_id: params.order_id,
    items: params.items,
    amount: params.amount,
    currency: params.currency,
    hash: params.hash,
    first_name: params.first_name,
    last_name: params.last_name,
    email: params.email,
    phone: params.phone,
    address: params.address,
    city: params.city,
    country: params.country,
  });
};
