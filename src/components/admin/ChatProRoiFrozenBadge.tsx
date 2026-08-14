type ChatProRoiFrozenBadgeProps = {
  label: string;
  hint: string;
};

/** Marks leads whose paid-acquisition journey closed and no longer feed Claude ROI. */
export function ChatProRoiFrozenBadge(props: ChatProRoiFrozenBadgeProps) {
  return (
    <span
      className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-900"
      title={props.hint}
    >
      {props.label}
    </span>
  );
}
