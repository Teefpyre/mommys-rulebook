import React from 'react';
import { FleuronSvg } from './Charms';

export const RunningHeader: React.FC<{
  left: React.ReactNode;
  right?: React.ReactNode;
}> = ({ left, right }) => (
  <div className="mb-4">
    <div className="flex items-center justify-between gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-cocoa-soft">
      <span>{left}</span>
      {right && <span className="shrink-0 normal-case tracking-normal">{right}</span>}
    </div>
    <div
      className="mt-2 h-px bg-gradient-to-r from-strawberry-200/80 via-strawberry-200/40 to-transparent"
      aria-hidden="true"
    />
  </div>
);

export const PageHeading: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  aside?: React.ReactNode;
  centered?: boolean;
}> = ({ title, subtitle, aside, centered = false }) => {
  if (centered) {
    return (
      <div className="text-center">
        <h2 className="type-press font-display text-[26px] font-bold leading-tight text-cocoa text-balance lg:text-[29px]">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-[14px] font-semibold leading-snug text-cocoa-soft">
            {subtitle}
          </p>
        )}
        <div className="mt-2 flex justify-center">
          <FleuronSvg className="h-3.5 w-24" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="type-press font-display text-[25px] font-bold leading-tight text-cocoa text-balance lg:text-[28px]">
            {title}
          </h2>
        </div>
        {aside && <div className="shrink-0 pt-1">{aside}</div>}
      </div>
      {subtitle && (
        <p className="mt-1 text-[14px] font-semibold leading-snug text-cocoa-soft">{subtitle}</p>
      )}
    </div>
  );
};

export const Folio: React.FC<{ page: number }> = ({ page }) => (
  <div className="mt-3 text-center">
    <span
      className="mx-auto mb-1.5 block h-px w-10 bg-gradient-to-r from-transparent via-strawberry-300 to-transparent"
      aria-hidden="true"
    />
    <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-cocoa-soft">Page {page}</p>
  </div>
);

export const LedgerRow: React.FC<{
  label: string;
  value: React.ReactNode;
  onClick?: () => void;
}> = ({ label, value, onClick }) => {
  const inner = (
    <>
      <span className="text-[14.5px] font-bold text-cocoa">{label}</span>
      <span
        className="mx-3 flex-1 translate-y-[-4px] border-b-2 border-dotted border-strawberry-200/80"
        aria-hidden="true"
      />
      <span className="font-display text-[16px] font-bold text-strawberry-600">{value}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group flex w-full items-baseline rounded-md py-0.5 text-left transition-colors hover:text-strawberry-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-strawberry-500"
      >
        {inner}
      </button>
    );
  }

  return <div className="flex items-baseline py-0.5">{inner}</div>;
};
