import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_ORDER_HOSTS = new Set([
  'menu.chiluxe.vn',
]);

function isPublicOrderHost(host: string) {
  return PUBLIC_ORDER_HOSTS.has(host.split(':')[0].toLowerCase());
}

function isAllowedPublicAsset(pathname: string) {
  return (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/order/') ||
    pathname === '/favicon.ico' ||
    pathname === '/icon.png' ||
    pathname === '/apple-icon.png' ||
    pathname === '/opengraph-image.png'
  );
}

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? '';
  if (!isPublicOrderHost(host)) return NextResponse.next();

  const { pathname, search } = request.nextUrl;

  if (isAllowedPublicAsset(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ ok: false, message: 'Not found' }, { status: 404 });
  }

  if (pathname === '/order') {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = '/order';
  url.search = search;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/:path*'],
};
