// Tracks PayHere checkout attempts so /api/payments/payhere/notify has
// something to look up and update when the webhook fires.

import mongoose, { Document, Schema, Model } from 'mongoose';

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'cancelled' | 'chargedback';

export interface IPayment extends Document {
  _id: mongoose.Types.ObjectId;
  orderId: string;
  userId: mongoose.Types.ObjectId;
  amount: number;
  currency: string;
  status: PaymentStatus;
  plan: 'plus';
  payherePaymentId?: string;
  payhereStatusCode?: number;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    orderId: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: 'LKR' },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'cancelled', 'chargedback'],
      default: 'pending',
    },
    plan: { type: String, enum: ['plus'], default: 'plus' },
    payherePaymentId: { type: String },
    payhereStatusCode: { type: Number },
  },
  { timestamps: true, versionKey: false }
);

paymentSchema.index({ userId: 1, createdAt: -1 });

const Payment: Model<IPayment> = mongoose.model<IPayment>('Payment', paymentSchema);
export default Payment;
