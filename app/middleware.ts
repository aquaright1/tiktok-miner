import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Routes that require login to access
const protectedRoutes = [
  '/candidates',
  '/ats',
  '/repos',
  '/job-description',
  '/settings',
]

// API routes that require login to access
const protectedApiRoutes = [
  '/api/candidates',
  '/api/ats',
  '/api/repos',
  '/api/job-description',
  '/api/settings',
  '/api/generate-email',
]

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make your server
  // vulnerable to CSRF attacks.

  const { data: { user } } = await supabase.auth.getUser()

  // Check if it's a protected route
  const isProtectedRoute = protectedRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  )

  // Check if it's a protected API route
  const isProtectedApiRoute = protectedApiRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  )

  // If user is not logged in and accesses protected route, redirect to login page
  if (!user && isProtectedRoute) {
    const redirectUrl = new URL('/auth/login', request.url)
    redirectUrl.searchParams.set('redirectedFrom', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // If user is not logged in and accesses protected API route, return 401 error
  if (!user && isProtectedApiRoute) {
    return new NextResponse(
      JSON.stringify({ error: 'Unauthorized' }),
      { 
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    )
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're trying to modify the response (e.g. adding custom headers),
  // you must use the supabaseResponse object from the first closure.
  return supabaseResponse
}

// Configure middleware matching routes
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}