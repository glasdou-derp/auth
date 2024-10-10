import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { NatsModule } from 'src/transports/nats.module';
import { LoggerModule } from 'src/logger/logger.module';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, PrismaService],
  imports: [NatsModule, LoggerModule],
})
export class UsersModule {}
