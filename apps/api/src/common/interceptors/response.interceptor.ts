import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        // Already wrapped (e.g. from an explicit wrapper)
        if (data && typeof data === 'object' && 'ok' in data) return data;

        // Paginated list: service returns { items, total, page, limit, totalPages }
        if (data && typeof data === 'object' && 'items' in data) {
          const { items, ...meta } = data;
          return { ok: true, data: items, meta };
        }

        return { ok: true, data };
      }),
    );
  }
}
