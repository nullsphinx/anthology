import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '../../../src/lib/supabase/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const destination = new URL('/', request.url)
  if (!code) return NextResponse.redirect(destination)

  const supabase = await getSupabaseServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) destination.searchParams.set('auth_error', 'callback')
  return NextResponse.redirect(destination)
}
