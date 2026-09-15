'use client'

import { useEffect, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { ProfileView } from './ProfileView'
import type { LibraryEntry, MediaItem, Profile } from './domain'
import { loadPublicProfile } from './lib/supabase/profile'

type SharedProfileState = { profile: Profile; items: MediaItem[]; entries: LibraryEntry[] }

export function SharedProfileRoute({ username }: { username: string }) {
  const [state, setState] = useState<SharedProfileState | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    loadPublicProfile(username)
      .then((result) => { if (active) { setState(result); setFailed(!result) } })
      .catch(() => { if (active) setFailed(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [username])

  return <div className="shared-profile-page">
    <header className="shared-profile-header"><a href="/">Anthology</a></header>
    {loading ? <div className="shared-profile-state"><LoaderCircle className="spin" /> Loading profile…</div>
      : failed || !state ? <div className="shared-profile-state"><p>This profile is private or does not exist.</p></div>
        : <main><ProfileView profile={state.profile} items={state.items} entries={state.entries} /></main>}
  </div>
}
