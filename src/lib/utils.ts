import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Turn a stored site URL into a safe http(s) link, or null when it is not a usable web address. */
export function toSiteHref(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw || /\s/.test(raw)) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return null;
  if (/^(localhost|[\w-]+(\.[\w-]+)+)(:\d{1,5})?(\/\S*)?$/.test(raw)) return `https://${raw}`;
  return null;
}
