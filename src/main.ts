import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Debug: Log loaded environment variables
  const configService = app.get(ConfigService);
  console.log('='.repeat(50));
  console.log('[Bootstrap] Environment Configuration:');
  console.log('  PORT:', configService.get('PORT') || '5000 (default)');
  console.log('  DATABASE_URL:', configService.get('DATABASE_URL') ? '✓ configured' : '✗ NOT SET');
  console.log('  JWT_ACCESS_SECRET:', configService.get('JWT_ACCESS_SECRET') ? '✓ configured' : '✗ NOT SET');
  console.log('  JWT_REFRESH_SECRET:', configService.get('JWT_REFRESH_SECRET') ? '✓ configured' : '✗ NOT SET');
  console.log('  JWT_ACCESS_EXPIRY:', configService.get('JWT_ACCESS_EXPIRY') || '15m (default)');
  console.log('='.repeat(50));
  
  // Enable CORS for frontend
  app.enableCors({
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  });
  
  // Set global API prefix
  app.setGlobalPrefix('api');
  
  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  
  await app.listen(process.env.PORT || 5000);
  console.log(`Application is running on: http://localhost:${process.env.PORT || 5000}`);
}
bootstrap();