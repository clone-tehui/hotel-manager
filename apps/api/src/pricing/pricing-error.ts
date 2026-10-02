import { HttpException } from '@nestjs/common';

export function pricingError(code: string, status = 400): never {
  throw new HttpException({ ok: false, statusCode: status, code, message: code, error: { code, message: code } }, status);
}
