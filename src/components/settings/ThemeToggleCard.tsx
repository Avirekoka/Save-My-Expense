import React from 'react';
import { Sun, Moon, Laptop, Check, Sparkles, Eye } from 'lucide-react';
import { ThemeMode } from '../../types';
import { useTheme } from '../../services/theme/ThemeContext';

export const ThemeToggleCard: React.FC = () => {
  const { theme, effectiveTheme, setTheme } = useTheme();
  const isDark = effectiveTheme === 'dark';

  const options: Array<{
    id: ThemeMode;
    title: string;
    description: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    accentColorDark: string;
    accentColorLight: string;
    badgeLabel?: string;
  }> = [
    {
      id: 'system',
      title: 'System Default',
      description: 'Automatically matches your operating system day/night display schedule.',
      icon: Laptop,
      accentColorDark: 'text-indigo-400',
      accentColorLight: 'text-indigo-600',
    },
    {
      id: 'light',
      title: 'Light Mode',
      description: 'Crisp surfaces and high-contrast dark typography optimized for daylight and clarity.',
      icon: Sun,
      accentColorDark: 'text-amber-400',
      accentColorLight: 'text-amber-600',
    },
    {
      id: 'dark',
      title: 'Dark Mode',
      description: 'Deep charcoal canvas engineered for low eye strain, battery savings, and night comfort.',
      icon: Moon,
      accentColorDark: 'text-blue-400',
      accentColorLight: 'text-blue-600',
    },
  ];

  return (
    <div
      id="theme-display-settings-card"
      className={`rounded-xl border p-5 sm:p-6 relative overflow-hidden transition-colors ${
        isDark
          ? 'border-[#262626] bg-[#141414] shadow-xs'
          : 'border-slate-200 bg-white shadow-sm'
      }`}
    >
      {/* Decorative ambient radial glow */}
      <div
        className={`absolute -top-16 -right-16 h-44 w-44 rounded-full blur-3xl pointer-events-none ${
          isDark ? 'bg-blue-500/5' : 'bg-blue-500/10'
        }`}
      />

      {/* Header with Title and Current Status */}
      <div
        className={`flex flex-col sm:flex-row sm:items-center justify-between border-b pb-4 mb-5 gap-3 ${
          isDark ? 'border-[#262626]' : 'border-slate-100'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl border shrink-0 ${
              isDark
                ? 'bg-blue-600/10 border-blue-500/20 text-blue-400'
                : 'bg-blue-50 border-blue-200 text-blue-600'
            }`}
          >
            <Eye size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2
                className={`text-base sm:text-lg font-bold tracking-tight ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                Theme & Visual Accessibility
              </h2>
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-bold border ${
                  isDark
                    ? 'bg-blue-500/10 border-blue-500/25 text-blue-400'
                    : 'bg-blue-50 border-blue-200 text-blue-700'
                }`}
              >
                WCAG AA
              </span>
            </div>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              Switch between System, Light, and Dark appearance modes with high-contrast accessibility.
            </p>
          </div>
        </div>

        {/* Live Active Status Chip */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className={`text-[11px] font-medium ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
            Active Theme:
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold capitalize ${
              isDark
                ? 'border-[#262626] bg-[#0f0f0f] text-white'
                : 'border-slate-200 bg-slate-50 text-slate-800'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                effectiveTheme === 'dark' ? 'bg-blue-500' : 'bg-amber-500'
              }`}
            />
            {theme === 'system' ? `System (${effectiveTheme})` : `${theme} mode`}
          </span>
        </div>
      </div>

      {/* Theme Options Selector (Accessible Radio Group) */}
      <div
        role="radiogroup"
        aria-label="Theme mode options"
        className="grid grid-cols-1 md:grid-cols-3 gap-3.5"
      >
        {options.map((opt) => {
          const isSelected = theme === opt.id;
          const Icon = opt.icon;

          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              id={`theme-option-${opt.id}`}
              onClick={() => setTheme(opt.id)}
              className={`relative flex flex-col justify-between text-left rounded-xl p-4 transition-all cursor-pointer border focus:outline-hidden focus:ring-2 focus:ring-blue-500/50 ${
                isSelected
                  ? isDark
                    ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30'
                    : 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20 shadow-xs'
                  : isDark
                  ? 'border-[#262626] bg-[#0f0f0f] hover:border-[#404040] hover:bg-[#1a1a1a]'
                  : 'border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-slate-100/80'
              }`}
            >
              <div>
                {/* Top row: Icon + Radio Indicator */}
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
                      isSelected
                        ? isDark
                          ? 'border-blue-500/30 bg-blue-500/20 text-white'
                          : 'border-blue-200 bg-white text-blue-600 shadow-xs'
                        : isDark
                        ? 'border-[#262626] bg-[#141414] text-gray-400'
                        : 'border-slate-200 bg-white text-slate-500'
                    }`}
                  >
                    <Icon
                      size={18}
                      className={
                        isSelected
                          ? isDark
                            ? opt.accentColorDark
                            : opt.accentColorLight
                          : isDark
                          ? 'text-gray-400'
                          : 'text-slate-400'
                      }
                    />
                  </div>

                  {/* Radio Indicator */}
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
                      isSelected
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : isDark
                        ? 'border-gray-600 bg-transparent'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isSelected && <Check size={12} strokeWidth={3} className="text-white" />}
                  </div>
                </div>

                {/* Title */}
                <h3
                  className={`text-sm font-bold mb-1 ${
                    isSelected
                      ? isDark
                        ? 'text-white'
                        : 'text-blue-950'
                      : isDark
                      ? 'text-white'
                      : 'text-slate-900'
                  }`}
                >
                  {opt.title}
                </h3>

                {/* Description */}
                <p
                  className={`text-xs leading-relaxed ${
                    isDark ? 'text-gray-400' : 'text-slate-600'
                  }`}
                >
                  {opt.description}
                </p>
              </div>

              {/* Dynamic tag if system mode */}
              {opt.id === 'system' && (
                <div
                  className={`mt-3 pt-2.5 border-t flex items-center justify-between text-[11px] ${
                    isDark ? 'border-[#262626]/70 text-gray-400' : 'border-slate-200/80 text-slate-500'
                  }`}
                >
                  <span>Resolved as:</span>
                  <span
                    className={`font-semibold capitalize ${
                      isDark ? 'text-indigo-400' : 'text-indigo-600'
                    }`}
                  >
                    {effectiveTheme} mode
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Accessibility Contrast Guidance Footer */}
      <div
        className={`mt-5 pt-4 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs ${
          isDark ? 'border-[#262626] text-gray-400' : 'border-slate-100 text-slate-500'
        }`}
      >
        <div className="flex items-center gap-2">
          <Sparkles size={14} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
          <span>
            Preference automatically persists across your sessions and synchronizes with your profile.
          </span>
        </div>
        <span className={`text-[11px] font-medium ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>
          High Contrast • WCAG AA Compliant
        </span>
      </div>
    </div>
  );
};
