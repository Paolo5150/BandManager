import type { ReactNode } from "react";

type IconProps = { className?: string };

function Svg({ className, children, strokeWidth = 2 }: IconProps & { children: ReactNode; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className ?? "h-5 w-5"}>
      {children}
    </svg>
  );
}

export const PlusIcon = (props: IconProps) => <Svg {...props}><path d="M12 5v14M5 12h14" /></Svg>;
export const PencilIcon = (props: IconProps) => <Svg {...props}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></Svg>;
export const PrinterIcon = (props: IconProps) => <Svg {...props}><path d="M6 9V3h12v6" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v7H6z" /><path d="M18 12h.01" /></Svg>;
export const TrashIcon = (props: IconProps) => <Svg {...props}><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="m19 6-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /></Svg>;
export const CloseIcon = (props: IconProps) => <Svg {...props}><path d="M18 6 6 18M6 6l12 12" /></Svg>;
export const ChevronLeftIcon = (props: IconProps) => <Svg {...props}><path d="m15 18-6-6 6-6" /></Svg>;
export const ChevronRightIcon = (props: IconProps) => <Svg {...props}><path d="m9 18 6-6-6-6" /></Svg>;
export const ChevronUpIcon = (props: IconProps) => <Svg {...props}><path d="m18 15-6-6-6 6" /></Svg>;
export const ChevronDownIcon = (props: IconProps) => <Svg {...props}><path d="m6 9 6 6 6-6" /></Svg>;
export const GripIcon = (props: IconProps) => <Svg {...props} strokeWidth={3}><path d="M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01" /></Svg>;
export const AccountIcon = (props: IconProps) => <Svg {...props}><circle cx="12" cy="8" r="4" /><path d="M5 21a7 7 0 0 1 14 0" /></Svg>;
export const LogoutIcon = (props: IconProps) => <Svg {...props}><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M12 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" /></Svg>;