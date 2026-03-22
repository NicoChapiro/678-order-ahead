import type { SmsDeliveryRequest, SmsProvider } from '@/server/modules/customer-auth/types';

class ConsoleSmsProvider implements SmsProvider {
  async sendOtp(request: SmsDeliveryRequest) {
    console.info('customer-auth.sms.console', request);
  }
}

class TwilioSmsProvider implements SmsProvider {
  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly fromPhoneNumber: string,
  ) {}

  async sendOtp(request: SmsDeliveryRequest) {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: request.phoneNumber,
          From: this.fromPhoneNumber,
          Body: request.message,
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`Twilio SMS delivery failed with status ${response.status}: ${errorBody}`);
    }
  }
}

export function getSmsProvider(): SmsProvider {
  const provider = process.env.CUSTOMER_AUTH_SMS_PROVIDER?.trim() || 'console';

  if (provider === 'console') {
    return new ConsoleSmsProvider();
  }

  if (provider === 'twilio') {
    const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
    const fromPhoneNumber = process.env.TWILIO_FROM_PHONE_NUMBER?.trim();

    if (!accountSid || !authToken || !fromPhoneNumber) {
      throw new Error(
        'Twilio SMS delivery requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_PHONE_NUMBER.',
      );
    }

    return new TwilioSmsProvider(accountSid, authToken, fromPhoneNumber);
  }

  throw new Error(`Unsupported CUSTOMER_AUTH_SMS_PROVIDER '${provider}'.`);
}
