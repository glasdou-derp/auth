import { Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { format } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

type level = 'error' | 'info';
const getLogConfiguration = (level: level) => ({
  filename: `logs/%DATE%/${level}.log`,
  datePattern: 'YYYY-MM-DD',
  level,
  maxSize: '20m', // Max file size before rotation (20MB)
  maxFiles: '14d', // Keep logs for 14 days
  zippedArchive: true, // Compress the log files
});

@Module({
  imports: [
    WinstonModule.forRoot({
      level: 'info',
      format: format.combine(format.timestamp(), format.json()),
      transports: [
        // Daily rotate for error logs
        new DailyRotateFile(getLogConfiguration('error')),

        // Daily rotate for combined logs
        new DailyRotateFile(getLogConfiguration('info')),
      ],
    }),
  ],
})
export class LoggerModule {}
