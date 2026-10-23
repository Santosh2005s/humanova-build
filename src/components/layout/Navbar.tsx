import React from 'react';
import { HeartHandshake, Layers, Shield, Sparkles, User, Users } from 'lucide-react';

interface NavbarProps {
  activeTab: 'coordinator' | 'volunteer' | 'seeker';
  onChangeTab: (tab: 'coordinator' | 'volunteer' | 'seeker') => void;
  onOpenNewRequest: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onChangeTab,
  onOpenNewRequest
}) => {
  return (
    <header className="bg-slate-950/95 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Tagline */}
          <div
            onClick={() => onChangeTab('coordinator')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-400 p-0.5 flex items-center justify-center shadow-lg shadow-teal-500/10 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <HeartHandshake className="w-5 h-5 text-teal-400" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-base tracking-wider text-slate-100 uppercase font-mono group-hover:text-teal-300 transition-colors">
                  HUMANOVA
                </h1>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] font-mono font-medium text-slate-400 border border-slate-800 px-1.5 py-0.2 rounded hidden md:inline-block">
                  AI COORDINATION ENGINE
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Every Need Deserves an Action. Every Action Deserves an Outcome.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* 3 Core Interfaces Role Selector */}
            <nav className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => onChangeTab('coordinator')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'coordinator'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Coordinator</span> Command
              </button>

              <button
                type="button"
                onClick={() => onChangeTab('volunteer')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'volunteer'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Volunteer <span className="hidden md:inline">Portal</span>
              </button>

              <button
                type="button"
                onClick={() => onChangeTab('seeker')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'seeker'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <HeartHandshake className="w-3.5 h-3.5" />
                Help Seeker <span className="hidden md:inline">Portal</span>
              </button>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
};
