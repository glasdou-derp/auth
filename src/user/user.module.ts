import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { NatsModule } from 'src/transports/nats.module';
import { LoggerModule } from 'src/logger/logger.module';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [UserController],
  providers: [UserService, PrismaService],
  imports: [NatsModule, LoggerModule],
})
export class UserModule {}
