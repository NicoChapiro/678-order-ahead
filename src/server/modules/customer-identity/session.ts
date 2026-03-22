import { NextRequest, NextResponse } from 'next/server';

export const CUSTOMER_SESSION_COOKIE_NAME = 'customer_session';
const CUSTOMER_SESSION_PREFIX = 'customer_';
const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;
const CUSTOMER_IDENTIFIER_PATTERN =
  /^customer_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ResponseWithCookies = Pick<NextResponse, 'cookies'>;

function isValidCustomerIdentifier(value: string | undefined) {
  return typeof value === 'string' && CUSTOMER_IDENTIFIER_PATTERN.test(value);
}

export function createCustomerIdentifier() {
  return `${CUSTOMER_SESSION_PREFIX}${crypto.randomUUID()}`;
}

export function getCustomerIdentifierFromRequest(request: NextRequest) {
  const cookieValue = request.cookies.get(CUSTOMER_SESSION_COOKIE_NAME)?.value;
  return isValidCustomerIdentifier(cookieValue) ? cookieValue : null;
}

export function resolveCustomerIdentifier(request: NextRequest) {
  const existingIdentifier = getCustomerIdentifierFromRequest(request);
  if (existingIdentifier) {
    return { customerIdentifier: existingIdentifier, isNew: false };
  }

  return {
    customerIdentifier: createCustomerIdentifier(),
    isNew: true,
  };
}

export function setCustomerIdentifierCookie(
  response: ResponseWithCookies,
  customerIdentifier: string,
) {
  response.cookies.set({
    name: CUSTOMER_SESSION_COOKIE_NAME,
    value: customerIdentifier,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ONE_YEAR_IN_SECONDS,
  });
}

export function applyCustomerIdentifierCookie(request: NextRequest, response: NextResponse) {
  const resolved = resolveCustomerIdentifier(request);
  if (resolved.isNew) {
    setCustomerIdentifierCookie(response, resolved.customerIdentifier);
  }

  return resolved.customerIdentifier;
}
