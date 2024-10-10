import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PrismaService } from './prisma/prisma.service';
import { UsersModule } from './users/users.module';
import { LoggerModule } from './logger/logger.module';

@Module({
  imports: [LoggerModule, AuthModule, UsersModule],
  providers: [PrismaService],
})
export class AppModule {}
