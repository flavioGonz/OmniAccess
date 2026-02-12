import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const secretKey = process.env.JWT_SECRET || 'omniaccess-secret-key-2026'
const key = new TextEncoder().encode(secretKey)

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // PUBLIC ROUTES (No Auth Required)
    if (
        pathname.startsWith('/api') || // Allow all API routes (including webhooks)
        pathname.startsWith('/_next') ||
        pathname === '/favicon.ico' ||
        pathname.startsWith('/branding') ||
        pathname.startsWith('/guards') ||
        pathname.startsWith('/sounds') ||
        pathname === '/login' ||
        pathname === '/guard' || // Allow guard console (authorized by internal PIN)
        pathname.startsWith('/guard-iphone') // Allow iphone guard console
    ) {
        return NextResponse.next()
    }

    // PROTECTED ROUTES (/admin/*)
    if (pathname.startsWith('/admin')) {
        const session = request.cookies.get('session')?.value
        if (!session) {
            return NextResponse.redirect(new URL('/login', request.url))
        }

        try {
            await jwtVerify(session, key, { algorithms: ['HS256'] })
            return NextResponse.next()
        } catch (e) {
            return NextResponse.redirect(new URL('/login', request.url))
        }
    }

    // Default: Allow if not explicitly protected (e.g. public pages)
    // But ideally we should protect everything else or redirect to login?
    // Let's assume root / redirects to /login if no session?
    if (pathname === '/') {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    return NextResponse.next()
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
