export type CustomerRecord = {
  id: string;
  phoneNumber: string;
  createdAt: string;
  updatedAt: string;
};

export type CustomerOtpChallenge = {
  id: string;
  customerId: string;
  phoneNumber: string;
  codeHash: string;
  expiresAt: string;
  consumedAt: string | null;
  invalidatedAt: string | null;
  attemptCount: number;
  lastAttemptAt: string | null;
  createdAt: string;
};

export type CustomerSessionRecord = {
  id: string;
  customerId: string;
  tokenHash: string;
  expiresAt: string;
  revokedAt: string | null;
  lastSeenAt: string | null;
  createdAt: string;
};

export type AuthenticatedCustomerSession = {
  session: CustomerSessionRecord;
  customer: CustomerRecord;
};

export type CreateCustomerInput = {
  phoneNumber: string;
};

export type CreateCustomerOtpChallengeInput = {
  customerId: string;
  phoneNumber: string;
  codeHash: string;
  expiresAt: string;
  createdAt: string;
};

export type CreateCustomerSessionInput = {
  customerId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
  lastSeenAt?: string | null;
};

export type CustomerAuthRepository = {
  findCustomerById(customerId: string): Promise<CustomerRecord | null>;
  findCustomerByPhoneNumber(phoneNumber: string): Promise<CustomerRecord | null>;
  createCustomer(input: CreateCustomerInput): Promise<CustomerRecord>;
  createOtpChallenge(input: CreateCustomerOtpChallengeInput): Promise<CustomerOtpChallenge>;
  findLatestOtpChallengeByPhoneNumber(phoneNumber: string): Promise<CustomerOtpChallenge | null>;
  incrementOtpChallengeAttempt(input: {
    challengeId: string;
    attemptedAt: string;
  }): Promise<CustomerOtpChallenge | null>;
  invalidateOtpChallengesForCustomer(customerId: string, invalidatedAt: string): Promise<void>;
  consumeOtpChallenge(input: {
    challengeId: string;
    consumedAt: string;
  }): Promise<CustomerOtpChallenge | null>;
  createSession(input: CreateCustomerSessionInput): Promise<CustomerSessionRecord>;
  findAuthenticatedSessionByTokenHash(tokenHash: string): Promise<AuthenticatedCustomerSession | null>;
  touchSession(input: { sessionId: string; seenAt: string }): Promise<CustomerSessionRecord | null>;
  revokeSessionByTokenHash(tokenHash: string, revokedAt: string): Promise<void>;
};

export type SmsDeliveryRequest = {
  phoneNumber: string;
  message: string;
};

export type SmsProvider = {
  sendOtp(request: SmsDeliveryRequest): Promise<void>;
};
