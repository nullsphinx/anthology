import type { Json } from '../../database.types'
import type { LibraryEntry, MediaItem } from '../../domain'
import { getSupabaseBrowserClient } from './client'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function loadRemoteShelf(userId: string): Promise<{ items: MediaItem[]; entries: LibraryEntry[] }> {
  const client = getSupabaseBrowserClient()
  if (!client) return { items: [], entries: [] }
  const { data, error } = await client.rpc('get_my_library')
  if (error) throw error
  const rows = data.filter((row) => isRecord(row.item) && isRecord(row.entry))
  return {
    items: rows.map((row) => row.item as unknown as MediaItem),
    entries: rows.map((row) => ({ ...(row.entry as unknown as LibraryEntry), userId })),
  }
}

export async function saveRemoteEntry(item: MediaItem, entry: LibraryEntry): Promise<void> {
  const client = getSupabaseBrowserClient()
  if (!client) return
  const { error } = await client.rpc('save_library_item', {
    p_item: item as unknown as Json,
    p_entry: entry as unknown as Json,
  })
  if (error) throw error
}

export async function removeRemoteEntry(item: MediaItem): Promise<void> {
  const client = getSupabaseBrowserClient()
  if (!client) return
  const { error } = await client.rpc('remove_library_item', {
    p_provider: item.provider,
    p_type: item.type,
    p_external_id: item.externalId,
  })
  if (error) throw error
}
