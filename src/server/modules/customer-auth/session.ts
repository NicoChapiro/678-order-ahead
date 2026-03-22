import { NextRequest, NextResponse } from 'next/server';

export const CUSTOMER_AUTH_SESSION_COOKIE_NAME = 'customer_auth_session';
const THIRTY_DAYS_IN_SECONDS = 60 * 60 * 24 * 30;

type ResponseWithCookies = Pick<NextResponse, 'cookies'>;

export function getCustomerSessionTokenFromRequest(request: NextRequest) {
  return request.cookies.get(CUSTOMER_AUTH_SESSION_COOKIE_NAME)?.value ?? null;
}

export function setCustomerSessionCookie(response: ResponseWithCookies, sessionToken: string) {
  response.cookies.set({
    name: CUSTOMER_AUTH_SESSION_COOKIE_NAME,
    value: sessionToken,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: THIRTY_DAYS_IN_SECONDS,
  });
}

export function clearCustomerSessionCookie(response: ResponseWithCookies) {
  response.cookies.set({
    name: CUSTOMER_AUTH_SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}
