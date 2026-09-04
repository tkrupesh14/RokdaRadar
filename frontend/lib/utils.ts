import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class names, letting later classes win over earlier ones.
 * Required by the Aceternity UI components, which are authored against it.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
