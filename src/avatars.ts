export interface AvatarPreset {
  id: string
  label: string
  background: string
  skin?: string
  hair?: string
  shirt?: string
  accent?: string
  detail?: string
  symbol?: 'moon' | 'orbit' | 'mountain' | 'waves' | 'sun' | 'comet' | 'grid' | 'prism' | 'flower' | 'stars'
}

export const avatarPresets: AvatarPreset[] = [
  { id: 'ember', label: 'Ember portrait', background: '#5b3128', skin: '#f0b58f', hair: '#35231e', shirt: '#d47b62' },
  { id: 'sage', label: 'Sage portrait', background: '#31483e', skin: '#8f5b3f', hair: '#211a17', shirt: '#88a88f' },
  { id: 'sky', label: 'Sky portrait', background: '#2d455d', skin: '#efc6a7', hair: '#6a412d', shirt: '#7aa7cf' },
  { id: 'plum', label: 'Plum portrait', background: '#4c3555', skin: '#b9795e', hair: '#241b26', shirt: '#b48abb' },
  { id: 'gold', label: 'Gold portrait', background: '#594a2b', skin: '#7e4c35', hair: '#181615', shirt: '#d3ae5f' },
  { id: 'ocean', label: 'Ocean portrait', background: '#234d54', skin: '#e8ae87', hair: '#2c1f1b', shirt: '#5ca0aa' },
  { id: 'rose', label: 'Rose portrait', background: '#58333f', skin: '#c98768', hair: '#4a2821', shirt: '#c87991' },
  { id: 'indigo', label: 'Indigo portrait', background: '#343b62', skin: '#5e382b', hair: '#171515', shirt: '#8089c4' },
  { id: 'moss', label: 'Moss portrait', background: '#3d4930', skin: '#f2c5a4', hair: '#b77642', shirt: '#91a369' },
  { id: 'slate', label: 'Slate portrait', background: '#3e454d', skin: '#a9684c', hair: '#29221f', shirt: '#8e9aa5' },
  { id: 'moon', label: 'Crescent moon', background: '#222746', accent: '#f0d98c', detail: '#8a91c7', symbol: 'moon' },
  { id: 'orbit', label: 'Planetary orbit', background: '#153f46', accent: '#8fd5cf', detail: '#f2b36f', symbol: 'orbit' },
  { id: 'mountain', label: 'Mountain dusk', background: '#473149', accent: '#d39bc8', detail: '#f3c57b', symbol: 'mountain' },
  { id: 'waves', label: 'Ocean waves', background: '#153d59', accent: '#8bc8e8', detail: '#d9f2ff', symbol: 'waves' },
  { id: 'sun', label: 'Radiant sun', background: '#633a28', accent: '#f5c86d', detail: '#fff0bd', symbol: 'sun' },
  { id: 'comet', label: 'Passing comet', background: '#262a4c', accent: '#c6b7f0', detail: '#f4eaff', symbol: 'comet' },
  { id: 'grid', label: 'Geometric grid', background: '#25443a', accent: '#a8d8b3', detail: '#f0d287', symbol: 'grid' },
  { id: 'prism', label: 'Light prism', background: '#34343f', accent: '#f2f0e8', detail: '#e58f9e', symbol: 'prism' },
  { id: 'flower', label: 'Abstract flower', background: '#543541', accent: '#e8a9bb', detail: '#f4d780', symbol: 'flower' },
  { id: 'stars', label: 'Night stars', background: '#1d2943', accent: '#e7d796', detail: '#96b8e8', symbol: 'stars' },
]

export const defaultAvatarPreset = avatarPresets[0].id

export function normalizeAvatarPreset(value?: string | null): string {
  const id = value?.replace(/^preset:/, '')
  return avatarPresets.some((preset) => preset.id === id) ? id! : defaultAvatarPreset
}

export function getAvatarPreset(id?: string | null): AvatarPreset {
  const normalized = normalizeAvatarPreset(id)
  return avatarPresets.find((preset) => preset.id === normalized) ?? avatarPresets[0]
}
