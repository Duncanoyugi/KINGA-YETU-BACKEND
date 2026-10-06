import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import compression from 'compression';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Keep default error/warn/log; disable noisy debug/verbose in prod.
    logger: process.env.NODE_ENV === 'production' ? ['error', 'warn', 'log'] : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const isProduction = configService.get('NODE_ENV') === 'production';

  // The app is typically deployed behind a platform proxy/load balancer
  // (Render, etc). Trusting the proxy is required for: rate limiting to
  // see the real client IP (not the proxy's), secure cookies, and the
  // HTTPS-redirect middleware below to read X-Forwarded-Proto correctly.
  app.set('trust proxy', 1);

  // Security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options,
  // etc). This is a JSON API, not a page-serving app, so we keep the
  // default helmet CSP (which is safe for API responses) rather than
  // trying to author a content policy for pages we don't render here.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      hsts: isProduction
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
    }),
  );

  // Gzip/Brotli response compression — meaningfully improves API latency
  // and payload size for the dashboards' larger JSON/report responses.
  app.use(compression());

  // Force HTTPS in production. Render/Heroku-style platforms terminate
  // TLS at the load balancer and forward `x-forwarded-proto`, so we
  // check that header rather than `req.secure`.
  if (isProduction) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.headers['x-forwarded-proto'] === 'http') {
        return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
      }
      next();
    });
  }

  // CORS: only allow known, explicitly-configured origins to send
  // credentialed requests. `origin: true` (the previous setting)
  // reflects *any* request origin back with credentials allowed, which
  // is equivalent to having no CORS policy at all.
  const allowedOrigins = (
    configService.get<string>('ALLOWED_ORIGINS') ||
    configService.get<string>('CLIENT_URL') ||
    'http://localhost:5173'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // Allow non-browser requests (curl, server-to-server, health
      // checks) which don't send an Origin header at all.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      logger.warn(`Blocked CORS request from unrecognized origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'), false);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type,Authorization,X-Requested-With,Accept,Origin',
  });

  // Set global API prefix
  app.setGlobalPrefix('api');

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false, // Allow extra fields to avoid issues with frontend sending extra data
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      // Never echo back the invalid values the client sent — only the
      // field/constraint names. Prevents accidental leakage of things
      // like passwords typed into a field that failed validation.
      disableErrorMessages: false,
    }),
  );

  // Consistent JSON error shape everywhere, and never leak stack traces
  // or internal error messages to clients in production.
  app.useGlobalFilters(new AllExceptionsFilter());

  // Ensure NestJS lifecycle hooks (onModuleDestroy, etc.) run on
  // SIGTERM/SIGINT so the Prisma connection pool closes cleanly instead
  // of the process being killed mid-request during deploys/restarts.
  app.enableShutdownHooks();

  const port = configService.get('PORT') || 5000;
  await app.listen(port);

  logger.log(`Application is running on port ${port} (${configService.get('NODE_ENV') || 'development'} mode)`);
  logger.log(`Allowed CORS origins: ${allowedOrigins.join(', ')}`);
}
bootstrap();
