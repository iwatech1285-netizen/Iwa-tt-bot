import crypto from 'crypto';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface ValidatedInitData {
  user: TelegramUser;
  auth_date: number;
  query_id?: string;
  start_param?: string;
}

/**
 * Validates Telegram WebApp initData according to Telegram's official specification:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateTelegramInitData(
  initData: string,
  botToken: string
): ValidatedInitData | null {
  try {
    if (!initData) return null;

    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    if (!hash) return null;

    // Check auth_date for expiration (max 24 hours)
    const authDateStr = urlParams.get('auth_date');
    if (!authDateStr) return null;
    const authDate = parseInt(authDateStr, 10);
    const nowInSeconds = Math.floor(Date.now() / 1000);
    if (isNaN(authDate) || nowInSeconds - authDate > 86400) {
      // Expired initData
      return null;
    }

    // Prepare data-check-string
    const dataCheckArr: string[] = [];
    urlParams.delete('hash');

    const keys = Array.from(urlParams.keys()).sort();
    for (const key of keys) {
      dataCheckArr.push(`${key}=${urlParams.get(key)}`);
    }
    const dataCheckString = dataCheckArr.join('\n');

    // If bot token is configured, perform strict HMAC-SHA256 validation
    if (botToken && botToken.trim() !== '') {
      const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(botToken)
        .digest();

      const calculatedHash = crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

      const hashBuffer = Buffer.from(hash, 'hex');
      const calculatedBuffer = Buffer.from(calculatedHash, 'hex');

      if (hashBuffer.length !== calculatedBuffer.length) {
        return null;
      }

      if (!crypto.timingSafeEqual(hashBuffer, calculatedBuffer)) {
        return null;
      }
    }

    // Extract user payload safely
    const userStr = urlParams.get('user');
    if (!userStr) return null;

    const user = JSON.parse(userStr) as TelegramUser;
    if (!user || !user.id || !user.first_name) {
      return null;
    }

    return {
      user,
      auth_date: authDate,
      query_id: urlParams.get('query_id') || undefined,
      start_param: urlParams.get('start_param') || undefined,
    };
  } catch (err) {
    console.error('Error validating Telegram initData:', err instanceof Error ? err.message : String(err));
    return null;
  }
}
