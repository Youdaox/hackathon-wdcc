type XpRewardProps = {
  amount: number;
  label?: string;
  className?: string;
};

/** A consistent, compact receipt for XP earned or available from an action. */
export function XpReward({ amount, label = "XP", className = "" }: XpRewardProps) {
  return (
    <span className={`tabular inline-flex items-center rounded-full bg-citrus/15 px-2.5 py-1 text-xs font-bold text-citrus ${className}`}>
      +{amount} {label}
    </span>
  );
}
