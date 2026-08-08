/* Turning a user-agent string into something a person recognises.
 *
 * For the "where you are signed in" list. Someone deciding whether to
 * revoke a session needs to know if it is theirs, and "Mozilla/5.0" —
 * which is how every user-agent on earth begins — tells them nothing.
 *
 * Deliberately crude. Full UA parsing is a losing game and a dependency;
 * this covers the browsers and platforms an actual member uses and says
 * "Unknown device" for everything else, which is honest. It is never
 * used for anything but a label, so being wrong is cosmetic.
 */

const BROWSERS: [RegExp, string][] = [
  /* Order matters: Edge and Opera both claim to be Chrome, and Chrome
   * claims to be Safari. Most specific first. */
  [/\bEdg(?:e|A|iOS)?\//, "Edge"],
  [/\bOPR\/|\bOpera\//, "Opera"],
  [/\bSamsungBrowser\//, "Samsung Internet"],
  [/\bFirefox\/|\bFxiOS\//, "Firefox"],
  [/\bCriOS\//, "Chrome"],
  [/\bChrome\//, "Chrome"],
  [/\bSafari\//, "Safari"],
];

const PLATFORMS: [RegExp, string][] = [
  [/\biPhone\b/, "iPhone"],
  [/\biPad\b/, "iPad"],
  [/\bAndroid\b/, "Android"],
  [/\bWindows NT\b/, "Windows"],
  [/\bMac OS X\b/, "Mac"],
  [/\bCrOS\b/, "ChromeOS"],
  [/\bLinux\b/, "Linux"],
];

function match(pairs: [RegExp, string][], value: string): string | null {
  for (const [pattern, name] of pairs) if (pattern.test(value)) return name;
  return null;
}

/** "Chrome on Windows", "Safari on iPhone", or "Unknown device". */
export function describeDevice(userAgent: string | null | undefined): string {
  const ua = (userAgent ?? "").trim();
  if (!ua) return "Unknown device";

  const browser = match(BROWSERS, ua);
  const platform = match(PLATFORMS, ua);

  if (browser && platform) return `${browser} on ${platform}`;
  if (browser) return browser;
  if (platform) return platform;
  return "Unknown device";
}
