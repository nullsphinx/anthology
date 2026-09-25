// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AuthGate } from './AuthGate'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const mocks = vi.hoisted(() => ({ send: vi.fn(), getUser: vi.fn(), maybeSingle: vi.fn(), upsert: vi.fn(), inbox: vi.fn() }))
vi.mock('./App', () => ({ App: ({ account }: { account: { name: string } }) => <div>Your shelf: {account.name}</div> }))
vi.mock('./lib/supabase/client', () => ({
  isSupabaseConfigured: () => true,
  getLocalAuthInboxUrl: mocks.inbox,
  sendSupabaseMagicLink: mocks.send,
  getSupabaseBrowserClient: () => ({
    auth: { getUser: mocks.getUser, onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }), upsert: mocks.upsert }),
  }),
}))
let root: Root
let container: HTMLDivElement
beforeEach(() => {
  vi.clearAllMocks()
  mocks.inbox.mockReturnValue(null)
  mocks.send.mockResolvedValue({ error: null })
  mocks.getUser.mockResolvedValue({ data: { user: null } })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove() })
async function render() { await act(async () => root.render(<AuthGate />)) }
async function input(selector: string, value: string) {
  const element = container.querySelector(selector) as HTMLInputElement
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
async function submit() { await act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }) }
async function requestInvite() {
  await act(async () => { (container.querySelector('.auth-modes button:last-child') as HTMLButtonElement).click() })
  await input('input[type="email"]', 'new@example.com')
}

it('offers invitations on the sign-in page and confirms successful email delivery', async () => {
  await render()
  expect(container.querySelector('.auth-modes')!.textContent).toBe('Sign inSign up')
  await requestInvite()
  await submit()
  expect(mocks.send).toHaveBeenCalledWith('new@example.com', `${window.location.origin}/auth/callback`, true)
  expect(container.querySelector('[role="status"]')!.textContent).toContain('Check your email for your invite link')
})
it('handles network failures and lets users retry', async () => {
  mocks.send.mockRejectedValueOnce(new Error('Network down'))
  await render(); await requestInvite(); await submit()
  expect(container.textContent).toContain('Check your connection')
  expect((container.querySelector('form button') as HTMLButtonElement).disabled).toBe(false)
  await submit()
  expect(container.textContent).toContain('Check your email for your invite link')
})
it('reports email limits without promising an email', async () => {
  mocks.send.mockResolvedValue({ error: { code: 'over_email_send_rate_limit', message: 'rate limit' } })
  await render(); await requestInvite(); await submit()
  expect(container.textContent).toContain('Please wait a few minutes')
  expect(container.textContent).not.toContain('Check your email for your invite link')
})
it('takes a newly authenticated user through private profile setup into their shelf', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'new-user', email: 'new@example.com', user_metadata: {} } } })
  mocks.maybeSingle.mockResolvedValue({ data: { username: null } })
  mocks.upsert.mockResolvedValue({ error: null })
  await render()
  expect(container.textContent).toContain('Create your profile.')
  await input('input[maxlength="80"]', 'New Reader')
  await input('input[maxlength="30"]', 'new_reader')
  await submit()
  expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'new-user', username: 'new_reader', display_name: 'New Reader', visibility: 'private' }))
  expect(container.textContent).toContain('Your shelf: New Reader')
})

it('clearly identifies local delivery for both signup and sign-in', async () => {
  mocks.inbox.mockReturnValue('http://127.0.0.1:54324')
  await render()
  expect(container.querySelector('h1')!.textContent).toBe('Sign in to Anthology.')
  expect(container.textContent).toContain('Local accounts are separate')
  await requestInvite(); await submit()
  expect(container.querySelector('[role="status"]')!.textContent).toContain('Email delivered to the test inbox')
  expect(container.querySelector('[role="status"]')!.textContent).toContain('new@example.com')
  expect(container.querySelector('[role="status"] a')!.getAttribute('href')).toBe('http://127.0.0.1:54324')
  await act(async () => { (container.querySelector('.auth-modes button') as HTMLButtonElement).click() })
  await submit()
  expect(mocks.send).toHaveBeenLastCalledWith('new@example.com', `${window.location.origin}/auth/callback`, false)
  expect(container.querySelector('[role="status"]')!.textContent).toContain('Email delivered to the test inbox')
})
it('shows sending feedback while the request is pending', async () => {
  let finish!: (value: { error: null }) => void
  mocks.send.mockReturnValue(new Promise(resolve => { finish = resolve }))
  await render()
  await input('input[type="email"]', 'new@example.com')
  await submit()
  expect(container.querySelector('[role="status"]')!.textContent).toBe('Sending your email link…')
  expect((container.querySelector('form button') as HTMLButtonElement).disabled).toBe(true)
  await act(async () => finish({ error: null }))
  expect(container.querySelector('[role="status"]')!.textContent).toContain('Email link sent')
})
