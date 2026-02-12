'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { SignJWT, jwtVerify } from 'jose'

const secretKey = process.env.JWT_SECRET || 'omniaccess-secret-key-2026'
const key = new TextEncoder().encode(secretKey)

export async function login(formData: FormData) {
    const username = formData.get('username') as string
    const password = formData.get('password') as string

    const user = await prisma.user.findFirst({
        where: {
            name: username,
            role: 'ADMIN' // Only admins can login to admin panel
        },
        include: {
            credentials: true
        }
    })

    if (!user) {
        return { error: 'Usuario no encontrado' }
    }

    const storedPassword = user.credentials.find(c => c.type === 'PASSWORD' || c.type === 'PIN')?.value

    if (storedPassword !== password) {
        return { error: 'Contraseña incorrecta' }
    }

    // Create session
    const expiresCtx = new Date(Date.now() + 24 * 60 * 60 * 1000) // 1 day

    const token = await new SignJWT({ sub: user.id, role: user.role, name: user.name })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(key)

    const cookieStore = await cookies()
    cookieStore.set('session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        expires: expiresCtx,
        sameSite: 'lax',
        path: '/'
    })

    redirect('/admin/dashboard')
}

export async function resetPassword(formData: FormData) {
    const email = formData.get('email') as string
    // Implementation for password reset (emailing, etc) would go here.
    // For now, we return a success mock message.
    console.log(`Password reset requested for: ${email}`);
    return { success: 'Se han enviado las instrucciones a su correo' }
}

export async function logout() {
    const cookieStore = await cookies()
    cookieStore.set('session', '', { expires: new Date(0) })
    redirect('/login')
}

export async function getSession() {
    const cookieStore = await cookies()
    const session = cookieStore.get('session')?.value
    if (!session) return null
    try {
        const { payload } = await jwtVerify(session, key, {
            algorithms: ['HS256'],
        })
        return payload
    } catch (error) {
        return null
    }
}
