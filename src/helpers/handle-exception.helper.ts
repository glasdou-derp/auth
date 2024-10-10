import { HttpStatus, LoggerService } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';

interface Props {
  error: any;
  message: string;
  context: string;
  logger: LoggerService;
}

/**
 * Handles exceptions by logging the error and throwing an appropriate RpcException.
 *
 * @param {Object} params - The parameters for handling the exception.
 * @param {Error} params.error - The error that occurred.
 * @param {string} params.context - The context in which the error occurred.
 * @param {Logger} params.logger - The logger to use for logging the error.
 * @param {string} [params.message='[ERROR] Unexpected Error, check logs'] - The message to include in the thrown exception if the error is not an instance of RpcException.
 *
 * @throws {RpcException} Throws the original RpcException if the error is an instance of RpcException and its message includes '[ERROR]'.
 * @throws {RpcException} Throws a new RpcException with a BAD_REQUEST status and the provided message if the error is not an instance of RpcException.
 *
 * @example
 * handleException({
 *   error: new Error('Something went wrong'),
 *   context: 'UserService',
 *   logger: console,
 *   message: 'Failed to process user data',
 * });
 */
export const handleException = ({
  error,
  context,
  logger,
  message = '[ERROR] Unexpected Error, check logs',
}: Props): void => {
  logger.log(error, { context });

  if (error instanceof RpcException && error.message.includes('[ERROR]')) throw error;

  throw new RpcException({ status: HttpStatus.BAD_REQUEST, message: `[ERROR] ${message}` });
};
