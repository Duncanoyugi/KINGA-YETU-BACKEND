import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Catches every unhandled exception and returns a consistent JSON error
 * shape. Crucially, in production it never leaks internal error messages,
 * stack traces, or (for Prisma/DB errors) query/schema details to the
 * client — those are logged server-side only. Without this, Nest's
 * default behaviour serializes raw Error objects (including stack
 * traces) for anything that isn't an HttpException, which is a common
 * source of information disclosure in production APIs.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');
  private readonly isProduction = process.env.NODE_ENV === 'production';

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        message = (resObj.message as string | string[]) ?? exception.message;
        error = (resObj.error as string) ?? error;
      }
    } else if (exception instanceof Error) {
      // Unknown/unexpected error (DB, network, programming error, etc.)
      // Log the full detail server-side, but never echo it to the client.
      message = this.isProduction ? 'Internal server error' : exception.message;
    }

    if (status >= 500) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(
        `${request.method} ${request.url} -> ${status}: ${
          exception instanceof Error ? exception.message : 'Unknown error'
        }`,
        stack,
      );
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
