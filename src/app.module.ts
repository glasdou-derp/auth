import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PrismaService } from './prisma/prisma.service';
import { RedisModule } from './redis/redis.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [RedisModule, AuthModule, UserModule],
  providers: [PrismaService],
})
export class AppModule {}
