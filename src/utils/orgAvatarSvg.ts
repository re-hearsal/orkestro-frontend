const GRADIENTS = [
  ["#0f3eb5", "#7795de"],
  ["#1f5fbf", "#8db6ff"],
  ["#0d47a1", "#6d8ed8"],
  ["#1248b3", "#9ab7ec"],
];

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function getInitials(name: string): string {
  const normalized = normalizeName(name);
  if (!normalized) {
    return "OR";
  }

  const parts = normalized.split(" ");
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function getGradient(name: string) {
  const normalized = normalizeName(name);
  if (!normalized) {
    return GRADIENTS[0];
  }

  const hash = Array.from(normalized).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return GRADIENTS[hash % GRADIENTS.length];
}

export function getOrgAvatarSvgDataUri(name: string, size = 512): string {
  const initials = getInitials(name);
  const [startColor, endColor] = getGradient(name);

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="organization avatar">
  <defs>
    <linearGradient id="org-grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${startColor}" />
      <stop offset="100%" stop-color="${endColor}" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#org-grad)" />
  <circle cx="${size / 2}" cy="${size / 2}" r="${Math.round(size * 0.32)}" fill="rgba(255,255,255,0.14)" />
  <text
    x="50%"
    y="52%"
    dominant-baseline="middle"
    text-anchor="middle"
    fill="#ffffff"
    font-family="Century Gothic, sans-serif"
    font-size="${Math.round(size * 0.23)}"
    font-weight="700"
    letter-spacing="1"
  >${initials}</text>
</svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
