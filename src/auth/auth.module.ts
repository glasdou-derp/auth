import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { envs } from 'src/config';
import { LoggerModule } from 'src/logger/logger.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { NatsModule } from 'src/transports/nats.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, PrismaService],
  imports: [
    NatsModule,
    JwtModule.register({
      global: true,
      secret: envs.jwtSecret,
      signOptions: { expiresIn: '4h' },
    }),
    LoggerModule,
  ],
})
export class AuthModule {}
