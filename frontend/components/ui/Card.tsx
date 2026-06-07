import { clsx } from "clsx";
import { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        "bg-slate-900 border border-slate-800 rounded-lg p-5",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
