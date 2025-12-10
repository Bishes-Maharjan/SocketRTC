import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import { AppModule } from './app.module';
import cookieParser = require('cookie-parser');

async function bootstrap() {
  // REMOVE CORS from here - don't configure it twice
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  // Trusted proxy is required for cookies to work on Render/Heroku behind a load balancer
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.use(cookieParser());
  app.useStaticAssets(join(__dirname, '..', 'public'));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Configure CORS only once, here
  app.enableCors({
    origin: [
      process.env.FRONTEND_URL||'https://socket-rtc-2-klxwjv4oz-bishes-maharjans-projects.vercel.app', 
      'https://socket-rtc.vercel.app',
      'https://socket-6bbczzs2g-bishes-maharjans-projects.vercel.app',
      'http://localhost:3000',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    exposedHeaders: ['Set-Cookie'], // Important for cookies
  });

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  
  console.log(`Application is running on: ${await app.getUrl()}`);
  console.log('The allowed frontend url for cors: ', process.env.FRONTEND_URL)
  const config = new DocumentBuilder()
    .setTitle('Streamify')
    .setVersion('1.0')
    .addCookieAuth()
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory, {
    swaggerOptions: {
      withCredentials: true,
    },
  });
}
bootstrap();