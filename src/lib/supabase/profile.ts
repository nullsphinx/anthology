import type { LibraryEntry, MediaItem, Profile } from '../../domain'
import { normalizeAvatarPreset } from '../../avatars'
import { normalizeProfileShowcases } from '../../profile'
import { getSupabaseBrowserClient } from './client'

type SharedProfile = { profile: Profile; items: MediaItem[]; entries: LibraryEntry[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function loadPublicProfile(username: string): Promise<SharedProfile | null> {
  const normalized = username.trim().toLowerCase()
  if (!/^[a-z0-9_]{3,30}$/.test(normalized)) return null
  const client = getSupabaseBrowserClient()
  if (!client) return null
  const { data, error } = await client.rpc('get_public_profile', { p_username: normalized })
  if (error) throw error
  if (!isRecord(data) || !isRecord(data.profile) || !Array.isArray(data.library)) return null
  const stored = data.profile
  const userId = typeof stored.userId === 'string' ? stored.userId : ''
  const displayName = typeof stored.displayName === 'string' ? stored.displayName.trim() : ''
  const rows = (data.library as unknown[]).flatMap((row) => isRecord(row) && isRecord(row.item) && isRecord(row.entry) ? [{ item: row.item, entry: row.entry }] : [])
  if (!userId || !displayName) return null
  return {
    profile: {
      id: userId,
      name: displayName,
      handle: `@${normalized}`,
      initials: displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(),
      color: '#f1a36f',
      avatar: normalizeAvatarPreset(typeof stored.avatarUrl === 'string' ? stored.avatarUrl : undefined),
      visibility: 'public',
      showcaseItemIds: normalizeProfileShowcases(stored.showcaseItemIds),
    },
    items: rows.map((row) => row.item as unknown as MediaItem),
    entries: rows.map((row) => ({ ...(row.entry as unknown as LibraryEntry), userId })),
  }
}
