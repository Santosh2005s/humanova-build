import React, { useState } from 'react';
import { ResourceItem } from '../../types';
import { HumanovaStore } from '../../services/store';
import { ResourceSummary } from '../../services/resourceEngine';
import { AlertTriangle, CheckCircle2, Package, Plus, Sparkles, X } from 'lucide-react';

interface InventoryModalProps {
  resourcesSummary: ResourceSummary[];
  onClose: () => void;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({ resourcesSummary, onClose }) => {
  const [selectedResId, setSelectedResId] = useState<string>(
    resourcesSummary.find((r) => r.hasShortage)?.resource.id || resourcesSummary[0]?.resource.id || ''
  );
  const [quantityToAdd, setQuantityToAdd] = useState<number>(10);
  const [successNote, setSuccessNote] = useState<string | null>(null);
  const [errorNote, setErrorNote] = useState<string | null>(null);

  const selectedSummary = resourcesSummary.find((s) => s.resource.id === selectedResId);

  const handleReplenish = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorNote(null);
    if (!selectedResId) {
      setErrorNote('Select a resource before recording stock.');
      return;
    }
    if (!Number.isInteger(quantityToAdd) || quantityToAdd <= 0 || quantityToAdd > 1000) {
      setErrorNote('Enter a whole-number quantity from 1 to 1,000.');
      return;
    }

    const result = await HumanovaStore.replenishResource(selectedResId, quantityToAdd);
    if (!result.success) {
      setErrorNote(result.reason || 'Inventory could not be updated.');
      return;
    }
    setSuccessNote(`Successfully replenished ${quantityToAdd} ${selectedSummary?.resource.unit || 'units'} of ${selectedSummary?.resource.name}!`);
    setTimeout(() => setSuccessNote(null), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-start justify-between bg-slate-900/90">
          <div>
            <span className="text-xs font-mono font-bold text-teal-400 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-800/40">
              SUPPLY INVENTORY INTELLIGENCE
            </span>
            <h2 className="text-base font-bold text-slate-100 mt-1">Community Resource Stock & Shortage Management</h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Live balances calculated from active community requests vs physically verified warehouse stock.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notice */}
        {successNote && (
          <div className="bg-emerald-950/80 border-b border-emerald-800/60 px-5 py-2.5 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successNote}</span>
          </div>
        )}
        {errorNote && (
          <div role="alert" className="bg-rose-950/80 border-b border-rose-800/60 px-5 py-2.5 text-xs text-rose-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorNote}</span>
          </div>
        )}

        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Resource Balance Cards */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Current Warehouse Stock & Deficits
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {resourcesSummary.map((item) => {
                const isSelected = selectedResId === item.resource.id;
                return (
                  <div
                    key={item.resource.id}
                    onClick={() => setSelectedResId(item.resource.id)}
                    className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-slate-800/90 border-teal-500 ring-1 ring-teal-500/50'
                        : item.hasShortage
                        ? 'bg-rose-950/20 border-rose-900/50 hover:border-rose-700/60'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="font-semibold text-xs text-slate-100">{item.resource.name}</div>
                      {item.hasShortage ? (
                        <span className="text-[10px] font-mono font-bold text-rose-400 bg-rose-950 px-1.5 py-0.5 rounded border border-rose-900">
                          -{item.shortageDeficit} {item.resource.unit} SHORTAGE
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-900">
                          BALANCED
                        </span>
                      )}
                    </div>

                    {/* Stock numbers breakdown */}
                    <div className="grid grid-cols-3 gap-2 mt-3 pt-2 border-t border-slate-800/60 text-center font-mono">
                      <div>
                        <div className="text-[10px] text-slate-400">Total Stock</div>
                        <div className="text-xs font-bold text-slate-200">{item.resource.totalAvailable}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">Allocated</div>
                        <div className="text-xs font-bold text-teal-300">{item.totalAllocated}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">Demand</div>
                        <div className={`text-xs font-bold ${item.hasShortage ? 'text-rose-400' : 'text-slate-300'}`}>
                          {item.totalRequested}
                        </div>
                      </div>
                    </div>

                    {item.hasShortage && (
                      <div className="mt-2.5 text-[11px] text-rose-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                        <span>Affects {item.affectedRequestCount} request(s) blocked from delivery</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Replenishment Form */}
          <form onSubmit={handleReplenish} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <Plus className="w-4 h-4 text-teal-400" />
                Record Inbound Supply Batch / Donation
              </h4>
              <span className="text-[11px] text-teal-400">Instant Recalculation</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Target Resource</label>
                <select
                  value={selectedResId}
                  onChange={(e) => setSelectedResId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                >
                  {resourcesSummary.map((s) => (
                    <option key={s.resource.id} value={s.resource.id}>
                      {s.resource.name} ({s.hasShortage ? `Shortage: -${s.shortageDeficit}` : 'Adequate'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Quantity Received ({selectedSummary?.resource.unit || 'units'})
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={quantityToAdd}
                    step="1"
                    onChange={(e) => setQuantityToAdd(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-teal-500"
                  />
                  {selectedSummary?.hasShortage && (
                    <button
                      type="button"
                      onClick={() => setQuantityToAdd(selectedSummary.shortageDeficit)}
                      className="px-2.5 py-1 text-[11px] bg-rose-950 border border-rose-800 text-rose-300 rounded hover:bg-rose-900 transition-colors"
                      title="Set to exact deficit"
                    >
                      Fill Deficit ({selectedSummary.shortageDeficit})
                    </button>
                  )}
                </div>
              </div>
            </div>

            {selectedSummary?.hasShortage && (
              <div className="p-3 bg-amber-950/30 border border-amber-900/50 rounded-lg text-xs text-amber-200 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  Adding <strong>{quantityToAdd} {selectedSummary.resource.unit}</strong> will satisfy the{' '}
                  <strong>{selectedSummary.shortageDeficit}-unit deficit</strong> and immediately transition blocked requests into{' '}
                  <strong className="text-emerald-400 font-mono">READY</strong> status for volunteer dispatch!
                </span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2 px-4 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <Package className="w-4 h-4" />
              Confirm Inbound Stock Arrival
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
