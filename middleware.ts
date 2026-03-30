import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Rotas públicas
  const publicPaths = ['/login', '/api/auth', '/favicon.ico']
  if (publicPaths.includes(pathname)) {
    return NextResponse.next()
  }

  // Checa sessão via cookie/localStorage não disponível no server; em app dir pode usar cookies de sessão
  // Para simplicidade, apenas permita continuar; a verificação acontece no cliente (useAuth)

  return NextResponse.next()
}

export const config = {
  matcher: ['/feed', '/profile', '/'], // proteja conforme necessário
}
