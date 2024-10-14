import type { RedisClientOptions } from 'redis';
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { redisStore } from 'cache-manager-redis-yet';
import { envs } from 'src/config';

@Module({
  imports: [
    CacheModule.register<RedisClientOptions>({
      store: redisStore,
      url: envs.redisUrl,
      ttl: envs.cacheTtl,
      database: envs.redisDb,
    }),
  ],
  exports: [CacheModule],
})
export class RedisModule {}
