export const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#0f5a9f,#1a7fd4)',
  'linear-gradient(135deg,#10b981,#34d399)',
  'linear-gradient(135deg,#7c3aed,#a78bfa)',
  'linear-gradient(135deg,#f59e0b,#fbbf24)',
  'linear-gradient(135deg,#0891b2,#22d3ee)',
  'linear-gradient(135deg,#e11d48,#fb7185)',
];

export function initials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

export function avatarGradient(uid: string, index: number): string {
  let hash = 0;
  for (const c of uid) hash = ((hash << 5) - hash) + c.charCodeAt(0);
  return AVATAR_GRADIENTS[Math.abs(hash || index) % AVATAR_GRADIENTS.length];
}
