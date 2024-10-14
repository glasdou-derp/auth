import 'dotenv/config';
import * as Joi from 'joi';

interface EnvVars {
  PORT: number;
  STATE: string;
  DATABASE_URL: string;
  NATS_SERVERS: string[];
  JWT_SECRET: string;
  LOG_DB_HOST: string;
  LOG_DB_PORT: number;
  LOG_DB_KEY: string;
}

const envSchema = Joi.object({
  PORT: Joi.number().required(),
  STATE: Joi.string().required(),
  DATABASE_URL: Joi.string().required(),
  NATS_SERVERS: Joi.array().items(Joi.string()).required(),
  JWT_SECRET: Joi.string().required(),
  LOG_DB_HOST: Joi.string().required(),
  LOG_DB_PORT: Joi.number().required(),
  LOG_DB_KEY: Joi.string().required(),
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
  logDbHost: envVars.LOG_DB_HOST,
  logDbPort: envVars.LOG_DB_PORT,
  logDbKey: envVars.LOG_DB_KEY,
};
