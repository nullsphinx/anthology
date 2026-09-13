import type { Profile, ShelfState } from './domain'

export const profiles: Profile[] = [
  { id: 'john', name: 'John', handle: '@john', initials: 'JH', color: '#f1a36f' },
  { id: 'maya', name: 'Maya', handle: '@mayawatches', initials: 'MK', color: '#b9d98c' },
  { id: 'leo', name: 'Leo', handle: '@leonights', initials: 'LR', color: '#8db7e8' },
  { id: 'noor', name: 'Noor', handle: '@noor', initials: 'NA', color: '#d4a5d8' },
]

export const initialState: ShelfState = {
  currentUserId: 'john',
  items: [],
  entries: [],
  activities: [],
}

export const group = {
  id: 'sunday-club',
  name: 'Sunday Club',
  description: 'Four friends, one screen, no endless scrolling.',
  memberIds: profiles.map((profile) => profile.id),
}
