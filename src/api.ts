export type User = {
  id: string;
  email: string;
  name: string;
  role: "EARNER" | "ADVERTISER" | "ADMIN";
  isEmailVerified: boolean;
  createdAt: string;
};
let csrf = "";
export function setCsrf(value: string) {
  csrf = value;
}
export async function api<T = any>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`/api${url}`, {
    ...options,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "PappyWeb",
      "X-CSRF-Token": csrf,
      ...options.headers,
    },
  });
  const body = await res
    .json()
    .catch(() => ({ error: "The server returned an unexpected response" }));
  if (res.status === 401 && csrf) {
    csrf = "";
    window.dispatchEvent(new Event("pappy-session-expired"));
  }
  if (!res.ok) throw new Error(body.error || "Request failed");
  return body;
}
export const send = (url: string, body: unknown, method = "POST") =>
  api(url, { method, body: JSON.stringify(body) });
export const coins = (milli: number) =>
  (milli / 1000).toLocaleString("en-NG", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
export const money = (n: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(n);
export const date = (s: string) =>
  new Date(s).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
export function go(path: string) {
  window.location.hash = path;
  window.scrollTo({ top: 0, behavior: "instant" });
}

// User-facing planning values remain Coins; internal backing and accounting are unchanged.
export const coinValue = (units: number) =>
  `${units.toLocaleString("en", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} Coins`;
