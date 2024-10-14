import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { NatsModule } from 'src/transports/nats.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { RedisModule } from 'src/redis/redis.module';

@Module({
  controllers: [UserController],
  providers: [UserService, PrismaService],
  imports: [NatsModule, RedisModule],
})
export class UserModule {}
