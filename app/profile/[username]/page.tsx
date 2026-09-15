import { SharedProfileRoute } from '../../../src/SharedProfileRoute'

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  return <SharedProfileRoute username={username} />
}
