import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { validateEnvironment } from './common/config/env.validation';
import { StructuredLogger } from './common/logging/structured-logger';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Phase 9: Startup environment validation - fail-fast before serving any traffic
  validateEnvironment();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new StructuredLogger(),
  });

  // JSON/body size cap (file uploads use multipart and a separate Multer limit)
  app.useBodyParser('json', { limit: '1mb' });
  app.useBodyParser('urlencoded', { limit: '1mb', extended: true });

  // Needed so rate-limit keys use the real client IP behind a reverse proxy
  app.set('trust proxy', 1);

  // Phase 9: HTTP Security Headers via helmet
  // Sets: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection,
  //       Strict-Transport-Security, Referrer-Policy, etc.
  // contentSecurityPolicy is disabled here to allow Swagger UI to function
  // in development; enable it (with proper directives) for production.
  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production',
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Parse HTTP-only cookies
  app.use(cookieParser());

  // Global prefix for all API routes
  app.setGlobalPrefix('api');

  // Enable CORS for frontend clients
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      process.env.FRONTEND_URL || '',
    ].filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  });

  // Global validation pipe for strict DTO checking
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

  // Global exception filter for clean error responses
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger OpenAPI documentation
  const config = new DocumentBuilder()
    .setTitle('AI Customer Support Automation Platform API')
    .setDescription(
      'Production-grade REST API powering AI-driven RAG support, human escalation tickets, knowledge base ingestion, and analytics.',
    )
    .setVersion('1.0')
    .addTag('Health', 'System and database health monitoring')
    .addTag('Auth', 'Authentication, session management, and RBAC')
    .addTag('Conversations', 'Customer chat conversations')
    .addTag('Tickets', 'Human agent escalation tickets')
    .addTag('Knowledge', 'Knowledge base documents and semantic vectors')
    .addTag('Analytics', 'Platform metrics and feedback')
    .addBearerAuth()
    .addCookieAuth('jwt_token')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`Backend server running on http://localhost:${port}`);
  logger.log(`Swagger OpenAPI documentation at http://localhost:${port}/api/docs`);
  logger.log(`Health check available at http://localhost:${port}/api/health`);
}

bootstrap();
