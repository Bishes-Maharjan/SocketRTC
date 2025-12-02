/* eslint-disable @typescript-eslint/no-require-imports */

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import { AppModule } from './app.module';
import cookieParser = require('cookie-parser');
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: {
      origin: [
        'http://localhost:5500',
        'http://127.0.0.1:5500',
        'http://127.0.0.1:5500/socket-connect.html',
      ],
      credentials: true,
    },
  });

  app.useStaticAssets(join(__dirname, '..', 'public'));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:5500',
      'htttps://localhost:5500',
      'http://127.0.0.1:5500/socket-connect.html',
      process.env.FRONTEND_URL || '', // Your production frontend URL
      // Add any other domains you need
    ], // Remove undefined values
    credentials: true, // This is ESSENTIAL for cookies
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.use(cookieParser());
  const config = new DocumentBuilder()
    .setTitle('Streamify')
    .setVersion('1.0')
    .addCookieAuth()
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory, {
    swaggerOptions: {
      withCredentials: true, // ✅ Sends cookies
    },
  });
  const port = process.env.PORT ?? 3001;

  await app.listen(port, () => {
    console.log('Listening in port: ', port);
  });
}
bootstrap();
