import 'dotenv/config';
import * as Joi from 'joi';

interface EnvVars {
  PORT: number;
  STATE: string;
  DATABASE_URL: string;
  NATS_SERVERS: string[];
  JWT_SECRET: string;
  REDIS_URL: string;
  CACHE_TTL: number;
  REDIS_DB: number;
}

const envSchema = Joi.object({
  PORT: Joi.number().required(),
  STATE: Joi.string().required(),
  DATABASE_URL: Joi.string().required(),
  NATS_SERVERS: Joi.array().items(Joi.string()).required(),
  JWT_SECRET: Joi.string().required(),
  REDIS_URL: Joi.string().required(),
  CACHE_TTL: Joi.number().required(),
  REDIS_DB: Joi.number().required(),
}).unknown(true);

const { error, value } = envSchema.validate({ ...process.env, NATS_SERVERS: process.env.NATS_SERVERS?.split(',') });

if (error) throw new Error(`Config validation error: ${error.message}`);

const envVars: EnvVars = value;

export const envs = {
  port: envVars.PORT,
  state: envVars.STATE,
  databaseUrl: envVars.DATABASE_URL,
  natsServers: envVars.NATS_SERVERS,
  jwtSecret: envVars.JWT_SECRET,
  redisUrl: envVars.REDIS_URL,
  cacheTtl: envVars.CACHE_TTL,
  redisDb: envVars.REDIS_DB,
};
