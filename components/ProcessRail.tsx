export function ProcessRail({ active = 1 }: { active?: 1 | 2 | 3 | 4 }) {
  const steps = [
    { index: "01", label: "Identify" },
    { index: "02", label: "Verify" },
    { index: "03", label: "Decide" },
    { index: "04", label: "Act" },
  ];

  return (
    <div className="w-full bg-white border-b border-[#d8ddd7]">
      <ol className="process-rail mx-auto max-w-5xl" aria-label="How RE:LOOP works">
        {steps.map((step, idx) => {
          const stepNum = idx + 1;
          const isActive = stepNum === active;
          const isPast = stepNum < active;
          return (
            <li
              key={step.index}
              className={`flex items-center gap-2.5 py-3 border-r border-[#d8ddd7] text-[11px] font-semibold tracking-wider uppercase transition-colors ${
                idx === 0 ? "border-l" : ""
              } ${
                isActive
                  ? "text-[#2e7d57] font-bold"
                  : isPast
                  ? "text-[#151817]"
                  : "text-[#a1aaa4]"
              }`}
            >
              <span className="process-index font-display font-medium text-xs pl-3">
                {step.index}
              </span>
              <span>{step.label}</span>
              {isPast && <span className="text-[#2e7d57] text-xs">✓</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
