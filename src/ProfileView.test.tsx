// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LibraryEntry, MediaItem, Profile, ProfileShowcases } from './domain'
import { ProfileView } from './ProfileView'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const profile: Profile = {
  id: 'john',
  name: 'John',
  handle: '@john',
  initials: 'J',
  color: '#f1a36f',
  visibility: 'private',
}

const item = (id: string, title: string): MediaItem => ({
  id,
  externalId: id,
  title,
  type: 'movie',
  year: 2026,
  releaseInfo: '2026',
  genres: [],
  summary: '',
  creator: '',
  communityRating: 8,
  provider: 'TMDB',
  providerUrl: '',
})

const entry = (itemId: string, status: LibraryEntry['status'], overrides: Partial<LibraryEntry> = {}): LibraryEntry => ({
  userId: 'john',
  itemId,
  status,
  progress: status === 'completed' ? 100 : 0,
  progressSource: 'manual',
  watchedEpisodes: [],
  rating: null,
  completionCount: 1,
  favorite: status === 'completed',
  priority: status === 'want',
  review: '',
  completedAt: status === 'completed' ? '2026-01-01T00:00:00Z' : null,
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
})

let root: Root | undefined
let container: HTMLDivElement | undefined

async function renderProfile(props: Partial<Parameters<typeof ProfileView>[0]> = {}) {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => {
    root!.render(<ProfileView
      profile={profile}
      items={[item('favorite-a', 'Favorite A'), item('favorite-b', 'Favorite B'), item('queue-a', 'Queue A'), item('queue-b', 'Queue B')]}
      entries={[entry('favorite-a', 'completed'), entry('favorite-b', 'completed'), entry('queue-a', 'want'), entry('queue-b', 'want', { priority: false })]}
      editable
      {...props}
    />)
  })
  return container
}

afterEach(async () => {
  if (root) await act(async () => root!.unmount())
  container?.remove()
  root = undefined
  container = undefined
})

describe('profile shelf controls', () => {
  it('customizes Next up independently after switching modes', async () => {
    const saveNextUp = vi.fn(async (_showcases: ProfileShowcases) => {})
    const view = await renderProfile({ onNextUpChange: saveNextUp })

    const nextUp = Array.from(view.querySelectorAll('button')).find((button) => button.textContent?.includes('Next up'))!
    await act(async () => nextUp.click())
    const customize = view.querySelector<HTMLButtonElement>('button[aria-label="Customize Movies Next up"]')!
    await act(async () => customize.click())

    expect(view.textContent).toContain('Choose up to twelve Next up titles')
    const queueB = Array.from(view.querySelectorAll<HTMLButtonElement>('.showcase-candidates button')).find((button) => button.textContent?.includes('Queue B'))!
    await act(async () => queueB.click())
    const save = Array.from(view.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Save display')!
    await act(async () => save.click())

    expect(saveNextUp).toHaveBeenCalledWith({ movie: ['queue-a'] })
  })

  it('marks favorite covers as draggable and saves their dropped order', async () => {
    const saveFavorites = vi.fn(async (_showcases: ProfileShowcases) => {})
    const view = await renderProfile({ onShowcasesChange: saveFavorites })
    const covers = Array.from(view.querySelectorAll<HTMLButtonElement>('.profile-cover-strip.reorderable button.profile-cover-slot'))
    expect(covers).toHaveLength(2)
    expect(covers[0].draggable).toBe(true)
    expect(covers[0].querySelector('.cover-drag-handle')).not.toBeNull()

    const transfer = { effectAllowed: '', dropEffect: '', setData: vi.fn(), getData: vi.fn(() => 'favorite-a') }
    const dragStart = new Event('dragstart', { bubbles: true })
    Object.defineProperty(dragStart, 'dataTransfer', { value: transfer })
    await act(async () => covers[0].dispatchEvent(dragStart))
    vi.spyOn(covers[1], 'getBoundingClientRect').mockReturnValue({ left: 0, right: 100, width: 100, top: 0, bottom: 150, height: 150, x: 0, y: 0, toJSON: () => ({}) })
    const drop = new Event('drop', { bubbles: true, cancelable: true })
    Object.defineProperties(drop, { dataTransfer: { value: transfer }, clientX: { value: 75 } })
    await act(async () => covers[1].dispatchEvent(drop))

    expect(saveFavorites).toHaveBeenCalledWith({ movie: ['favorite-b', 'favorite-a'] })
  })
})
