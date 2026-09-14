import { describe, expect, it } from 'vitest'
import { avatarPresets, defaultAvatarPreset, normalizeAvatarPreset } from './avatars'

describe('avatar presets', () => {
  it('offers twenty safe built-in portraits and designs', () => {
    expect(avatarPresets).toHaveLength(20)
    expect(new Set(avatarPresets.map((preset) => preset.id)).size).toBe(20)
    expect(avatarPresets.filter((preset) => preset.symbol)).toHaveLength(10)
  })

  it('accepts stored preset tokens and rejects arbitrary URLs', () => {
    expect(normalizeAvatarPreset('preset:sky')).toBe('sky')
    expect(normalizeAvatarPreset('https://example.test/tracker.png')).toBe(defaultAvatarPreset)
  })
})
