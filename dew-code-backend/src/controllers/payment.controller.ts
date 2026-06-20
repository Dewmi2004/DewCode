// ✅ NEW FILE: src/controllers/payment.controller.ts
// PayHere Checkout API integration — one-time payment that upgrades the
// signed-in user to the Plus plan.
//
// Flow:
//  1. Frontend calls POST /api/payments/payhere/initiate while signed in.
//  2. Backend creates a Payment(status: 'pending') row + computes the
//     PayHere hash (merchant_secret never leaves the server).
//  3. Frontend hands the returned params to window.payhere.startPayment().
//  4. PayHere calls our public notify_url server-to-server once the
//     payment finishes; we verify md5sig and flip the user's plan to 'plus'.
//  5. Frontend also polls GET /api/payments/status after onCompleted fires,
//     purely for UI feedback (the notify webhook is the source of truth).

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import User from '../models/User';
import Payment from '../models/Payment';
import { PLUS_PRICE } from '../config/plans';
import { sendSuccess, sendError } from '../utils/response';

const MERCHANT_ID = process.env.PAYHERE_MERCHANT_ID || '';
const MERCHANT_SECRET = process.env.PAYHERE_MERCHANT_SECRET || '';
const SANDBOX = (process.env.PAYHERE_MODE || 'sandbox') !== 'live';

const md5Upper = (input: string): string =>
  crypto.createHash('md5').update(input).digest('hex').toUpperCase();

// hash = upper(md5(merchant_id + order_id + amount(2dp) + currency + upper(md5(merchant_secret))))
const generateHash = (orderId: string, amount: string, currency: string): string => {
  const secretHash = md5Upper(MERCHANT_SECRET);
  return md5Upper(`${MERCHANT_ID}${orderId}${amount}${currency}${secretHash}`);
};

export const initiatePayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!MERCHANT_ID || !MERCHANT_SECRET) {
      sendError(res, 'PayHere is not configured on this server. Set PAYHERE_MERCHANT_ID / PAYHERE_MERCHANT_SECRET.', 500);
      return;
    }

    const user = req.user!;
    if (user.plan === 'plus') {
      sendError(res, 'You are already on the Plus plan.', 400);
      return;
    }

    const amount = PLUS_PRICE.amount.toFixed(2);
    const currency = PLUS_PRICE.currency;
    const orderId = `PLUS-${user._id.toString()}-${Date.now()}`;

    await Payment.create({
      orderId,
      userId: user._id,
      amount: PLUS_PRICE.amount,
      currency,
      status: 'pending',
      plan: 'plus',
    });

    const hash = generateHash(orderId, amount, currency);
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const apiUrl = process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 5000}`;

    sendSuccess(res, 'Payment initiated.', {
      sandbox: SANDBOX,
      merchant_id: MERCHANT_ID,
      order_id: orderId,
      items: 'DewCode Plus — lifetime upgrade',
      amount,
      currency,
      hash,
      return_url: `${clientUrl}/settings?upgrade=success`,
      cancel_url: `${clientUrl}/settings?upgrade=cancelled`,
      notify_url: `${apiUrl}/api/payments/payhere/notify`,
      first_name: user.name.split(' ')[0] || user.name,
      last_name: user.name.split(' ').slice(1).join(' ') || '-',
      email: user.email,
      phone: '0000000000',
      address: 'N/A',
      city: 'Colombo',
      country: 'Sri Lanka',
    });
  } catch (error) { next(error); }
};

// PayHere posts form-urlencoded data here. This endpoint must stay public
// (no `protect` middleware) — PayHere's servers can't send our JWT.
export const payhereNotify = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      merchant_id, order_id, payhere_amount, payhere_currency,
      status_code, md5sig, payment_id,
    } = req.body as Record<string, string>;

    if (!order_id || !md5sig) { res.status(400).end(); return; }

    const expectedSig = md5Upper(
      `${merchant_id}${order_id}${payhere_amount}${payhere_currency}${status_code}${md5Upper(MERCHANT_SECRET)}`
    );

    if (expectedSig !== md5sig) {
      // Invalid signature — possible spoofed request. Ignore silently.
      res.status(400).end();
      return;
    }

    const payment = await Payment.findOne({ orderId: order_id });
    if (!payment) { res.status(404).end(); return; }

    const code = Number(status_code);
    payment.payherePaymentId = payment_id;
    payment.payhereStatusCode = code;

    if (code === 2) {
      payment.status = 'completed';
      await User.findByIdAndUpdate(payment.userId, { plan: 'plus', planUpgradedAt: new Date() });
    } else if (code === 0) {
      payment.status = 'pending';
    } else if (code === -2) {
      payment.status = 'failed';
    } else if (code === -3) {
      payment.status = 'chargedback';
      await User.findByIdAndUpdate(payment.userId, { plan: 'free' });
    } else {
      payment.status = 'cancelled';
    }

    await payment.save();
    res.status(200).end();
  } catch {
    // PayHere retries on non-200, so don't leak error details — just 500.
    res.status(500).end();
  }
};

export const getPaymentStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findById(req.user!._id);
    if (!user) { sendError(res, 'User not found.', 404); return; }
    sendSuccess(res, 'Plan status fetched.', { plan: user.plan, planUpgradedAt: user.planUpgradedAt ?? null });
  } catch (error) { next(error); }
};
