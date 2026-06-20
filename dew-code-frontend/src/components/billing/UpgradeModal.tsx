// ✅ NEW FILE: src/components/billing/UpgradeModal.tsx
// Free vs Plus pricing modal + PayHere "Onsite Checkout" upgrade flow.
//
// Flow: initiatePlusUpgrade() (backend creates the order + hash) ->
// startPayHereCheckout() (PayHere's own popup handles card entry) ->
// onCompleted -> poll /api/payments/status until the notify webhook has
// flipped the user's plan to 'plus' (it usually lands within a second or two).

import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { setPlan } from '../../store/slices/authSlice';
import { paymentApi } from '../../services/paymentApi';
import { startPayHereCheckout } from '../../services/payhereSdk';
import { ApiError } from '../../services/api';
import { PLAN_LIMITS, PLUS_PRICE_LKR, PLUS_FEATURES } from '../../config/plans';

interface UpgradeModalProps {
  onClose: () => void;
  reason?: string;
}

type Stage = 'pitch' | 'redirecting' | 'verifying' | 'success' | 'error';

const ROW_LABELS: { key: keyof typeof PLAN_LIMITS['free']; label: string }[] = [
  { key: 'maxProjects', label: 'Projects' },
  { key: 'maxFoldersPerProject', label: 'Folders per project' },
  { key: 'maxFilesPerProject', label: 'Files per project' },
  { key: 'maxFileSizeKB', label: 'Max file size' },
];

const formatLimit = (key: keyof typeof PLAN_LIMITS['free'], value: number | string): string => {
  if (key === 'maxFileSizeKB') return typeof value === 'number' ? `${value >= 1024 ? value / 1024 + 'MB' : value + 'KB'}` : String(value);
  return String(value);
};

const UpgradeModal: React.FC<UpgradeModalProps> = ({ onClose, reason }) => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const [stage, setStage] = useState<Stage>('pitch');
  const [error, setError] = useState('');

  const alreadyPlus = user?.plan === 'plus';

  const pollPlanStatus = async (attemptsLeft = 8): Promise<void> => {
    if (attemptsLeft <= 0) {
      setStage('error');
      setError('Payment completed, but confirmation is taking longer than expected. Refresh in a moment — your plan will update once PayHere\u2019s confirmation arrives.');
      return;
    }
    try {
      const resp = await paymentApi.getStatus();
      if (resp.data?.plan === 'plus') {
        dispatch(setPlan('plus'));
        setStage('success');
        return;
      }
    } catch {
      // ignore transient errors while polling
    }
    setTimeout(() => pollPlanStatus(attemptsLeft - 1), 1500);
  };

  const handleUpgrade = async () => {
    setError('');
    setStage('redirecting');
    try {
      const resp = await paymentApi.initiatePlusUpgrade();
      if (!resp.data) throw new Error(resp.message || 'Could not start checkout.');
      const params = resp.data;

      await startPayHereCheckout(params, {
        onCompleted: () => { setStage('verifying'); pollPlanStatus(); },
        onDismissed: () => setStage('pitch'),
        onError: (e) => { setStage('error'); setError(e || 'Payment failed.'); },
      });
    } catch (e: unknown) {
      setStage('error');
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Could not start checkout.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-2xl overflow-hidden"
        style={{ background: '#12121A', border: '1px solid #1E1E2E' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b flex items-start justify-between" style={{ borderColor: '#1E1E2E' }}>
          <div>
            <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              {alreadyPlus ? 'You\u2019re on DewCode Plus' : 'Upgrade to DewCode Plus'}
            </h2>
            {reason && !alreadyPlus && (
              <p className="text-xs mt-1" style={{ color: '#FBBF24' }}>{reason}</p>
            )}
          </div>
          <button onClick={onClose} className="text-sm" style={{ color: '#6B7280' }}>✕</button>
        </div>

        <div className="p-6">
          {alreadyPlus ? (
            <div className="text-center py-6">
              <p className="text-4xl mb-2">✨</p>
              <p className="text-sm" style={{ color: '#9CA3AF' }}>Thanks for supporting DewCode — enjoy unlimited projects, folders, and files.</p>
            </div>
          ) : stage === 'success' ? (
            <div className="text-center py-6">
              <p className="text-4xl mb-2">✅</p>
              <p className="text-sm font-semibold text-white">Payment successful — you're now on Plus!</p>
              <button onClick={onClose} className="mt-4 px-4 py-2 text-sm font-medium rounded-lg" style={{ background: '#00D4B8', color: '#0A0A0F' }}>
                Done
              </button>
            </div>
          ) : (
            <>
              {/* Comparison table */}
              <div className="grid grid-cols-3 gap-px rounded-xl overflow-hidden mb-5" style={{ background: '#1E1E2E' }}>
                <div className="p-3 text-xs font-semibold" style={{ background: '#0D0D16', color: '#6B7280' }}>Feature</div>
                <div className="p-3 text-xs font-semibold text-center" style={{ background: '#0D0D16', color: '#9CA3AF' }}>Free</div>
                <div className="p-3 text-xs font-semibold text-center" style={{ background: '#0D0D16', color: '#00D4B8' }}>Plus</div>

                {ROW_LABELS.map((row) => (
                  <React.Fragment key={row.key}>
                    <div className="p-3 text-xs" style={{ background: '#12121A', color: '#9CA3AF' }}>{row.label}</div>
                    <div className="p-3 text-xs text-center" style={{ background: '#12121A', color: '#CBD5E1' }}>
                      {formatLimit(row.key, PLAN_LIMITS.free[row.key])}
                    </div>
                    <div className="p-3 text-xs text-center font-medium" style={{ background: '#12121A', color: '#00D4B8' }}>
                      {formatLimit(row.key, PLAN_LIMITS.plus[row.key])}
                    </div>
                  </React.Fragment>
                ))}
              </div>

              <ul className="space-y-1.5 mb-6">
                {PLUS_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs" style={{ color: '#CBD5E1' }}>
                    <span style={{ color: '#00D4B8' }}>✓</span> {f}
                  </li>
                ))}
              </ul>

              {error && (
                <div className="mb-4 px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', color: '#F87171' }}>
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-2xl font-bold text-white">LKR {PLUS_PRICE_LKR.toLocaleString()}</span>
                  <span className="text-xs ml-1" style={{ color: '#6B7280' }}>one-time · lifetime</span>
                </div>
                <button
                  onClick={handleUpgrade}
                  disabled={stage === 'redirecting' || stage === 'verifying'}
                  className="px-5 py-2.5 text-sm font-semibold rounded-lg transition-all disabled:opacity-60"
                  style={{ background: '#00D4B8', color: '#0A0A0F' }}
                >
                  {stage === 'redirecting' ? 'Opening PayHere…' : stage === 'verifying' ? 'Confirming payment…' : 'Upgrade with PayHere'}
                </button>
              </div>
              <p className="text-xs mt-3 text-center" style={{ color: '#3A3A50' }}>
                Secured by PayHere · Cards, bank transfer &amp; mobile wallets
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpgradeModal;
