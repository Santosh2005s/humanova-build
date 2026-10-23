import React, { useState } from 'react';
import { useHumanovaStore } from './services/store';
import { Navbar } from './components/layout/Navbar';
import { DemoScenarioBanner } from './components/layout/DemoScenarioBanner';
import { CoordinatorView } from './components/coordinator/CoordinatorView';
import { VolunteerView } from './components/volunteer/VolunteerView';
import { SeekerView } from './components/seeker/SeekerView';
import { ActionPlannerModal } from './components/planner/ActionPlannerModal';
import { RecipientConfirmModal } from './components/seeker/RecipientConfirmModal';
import { CommunityRequest } from './types';
import { HeartHandshake, ShieldCheck, Sparkles } from 'lucide-react';

export default function App() {
  const { requests, resources, volunteers, metrics } = useHumanovaStore();
  const [activeTab, setActiveTab] = useState<'coordinator' | 'volunteer' | 'seeker'>('coordinator');
  const [selectedVolunteerId, setSelectedVolunteerId] = useState<string>('vol-1'); // Elena Rostova default
  const [selectedPlannerRequestId, setSelectedPlannerRequestId] = useState<string | null>(null);
  const [confirmingRequestId, setConfirmingRequestId] = useState<string | null>(null);

  const selectedPlannerRequest = requests.find((r) => r.id === selectedPlannerRequestId) || null;
  const confirmingRequest = requests.find((r) => r.id === confirmingRequestId) || null;

  const handleOpenNewRequest = () => {
    setActiveTab('seeker');
  };

  return (
    <div className="min-h-screen bg-[#0c121e] text-slate-100 flex flex-col font-sans selection:bg-teal-500/30 selection:text-teal-200">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onOpenNewRequest={handleOpenNewRequest}
      />

      {/* Interactive 6-Step Hackathon Scenario Tour Banner */}
      <DemoScenarioBanner
        metrics={metrics}
        onNavigateToTab={setActiveTab}
        onSelectVolunteer={setSelectedVolunteerId}
        onOpenPlanner={(reqId) => setSelectedPlannerRequestId(reqId)}
      />

      {/* Main Page Workspace Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'coordinator' && (
          <CoordinatorView
            requests={requests}
            volunteers={volunteers}
            metrics={metrics}
            onOpenNewRequest={handleOpenNewRequest}
          />
        )}

        {activeTab === 'volunteer' && (
          <VolunteerView
            volunteers={volunteers}
            requests={requests}
            selectedVolunteerId={selectedVolunteerId}
            onSelectVolunteer={setSelectedVolunteerId}
          />
        )}

        {activeTab === 'seeker' && (
          <SeekerView
            requests={requests}
            onOpenPlanner={(req) => setSelectedPlannerRequestId(req.id)}
          />
        )}
      </main>

      {/* Action Planner Modal */}
      {selectedPlannerRequest && (
        <ActionPlannerModal
          request={selectedPlannerRequest}
          volunteers={volunteers}
          onClose={() => setSelectedPlannerRequestId(null)}
          onOpenConfirmModal={(req) => {
            setSelectedPlannerRequestId(null);
            setConfirmingRequestId(req.id);
          }}
          onOpenInventory={() => {
            setSelectedPlannerRequestId(null);
            setActiveTab('coordinator');
          }}
        />
      )}

      {/* Recipient Outcome Confirm Modal */}
      {confirmingRequest && (
        <RecipientConfirmModal
          request={confirmingRequest}
          onClose={() => setConfirmingRequestId(null)}
        />
      )}

      {/* Civic-Tech Footer */}
      <footer className="mt-auto border-t border-slate-800/80 bg-slate-950 py-6 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <HeartHandshake className="w-4 h-4 text-teal-400" />
            <span className="font-mono font-bold text-slate-200">HUMANOVA</span>
            <span className="text-slate-600">·</span>
            <span>Every Need Deserves an Action. Every Action Deserves an Outcome.</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400 font-mono text-[11px] flex-wrap justify-center">
            <span className="flex items-center gap-1 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" /> Dependency-Aware Engine
            </span>
            <span>·</span>
            <span>Deterministic Resource Allocation</span>
            <span>·</span>
            <span>Persistent Local Storage</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
