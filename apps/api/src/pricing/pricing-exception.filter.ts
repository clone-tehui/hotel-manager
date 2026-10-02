import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';

@Catch(HttpException)
export class PricingExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const body: any = exception.getResponse();
    const status = exception.getStatus();
    host.switchToHttp().getResponse().status(status).json(body?.ok === false && body?.error?.code ? body : {
      ok: false, statusCode: status, code: status === 400 ? 'INVALID_REQUEST' : status === 401 ? 'INVALID_API_KEY' : status === 403 ? 'INSUFFICIENT_SCOPE' : 'REQUEST_FAILED', error: { code: status === 400 ? 'INVALID_REQUEST' : status === 401 ? 'INVALID_API_KEY' : status === 403 ? 'INSUFFICIENT_SCOPE' : 'REQUEST_FAILED', message: Array.isArray(body?.message) ? body.message.join('; ') : body?.message ?? 'Request failed' },
    });
  }
}
