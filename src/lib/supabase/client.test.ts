import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc, signInWithOtp } = vi.hoisted(() => ({ rpc: vi.fn(), signInWithOtp: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc, auth: { signInWithOtp } }) }))
import { sendSupabaseMagicLink } from './client'

beforeEach(() => {
  vi.clearAllMocks()
  rpc.mockResolvedValue({ error: null })
  signInWithOtp.mockResolvedValue({ error: null })
})

describe('email invitations', () => {
  it('registers normalized signup eligibility before sending the email', async () => {
    await sendSupabaseMagicLink(' NEW@Example.com ', 'https://example.com/auth/callback', true)
    expect(rpc).toHaveBeenCalledWith('request_invite', { p_email: 'new@example.com' })
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(signInWithOtp.mock.invocationCallOrder[0])
    expect(signInWithOtp).toHaveBeenCalledWith({ email: 'new@example.com', options: { shouldCreateUser: true, emailRedirectTo: 'https://example.com/auth/callback' } })
  })
  it('does not send an email when invite registration fails', async () => {
    const error = { message: 'unavailable' }
    rpc.mockResolvedValue({ error })
    expect(await sendSupabaseMagicLink('new@example.com', 'https://example.com/auth/callback', true)).toEqual({ error })
    expect(signInWithOtp).not.toHaveBeenCalled()
  })
  it('keeps existing sign-in and manually issued invites working without registering an invite', async () => {
    await sendSupabaseMagicLink('existing@example.com', 'https://example.com/auth/callback')
    expect(rpc).not.toHaveBeenCalled()
    expect(signInWithOtp).toHaveBeenCalledOnce()
  })
  it('returns delivery failures instead of reporting success', async () => {
    const error = { code: 'over_email_send_rate_limit', message: 'rate limit' }
    signInWithOtp.mockResolvedValue({ error })
    expect(await sendSupabaseMagicLink('new@example.com', 'https://example.com/auth/callback', true)).toEqual({ error })
  })
})
