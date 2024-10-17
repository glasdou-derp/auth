import { HttpStatus, LoggerService } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';

export class ExceptionHandler {
  private logger: LoggerService;
  private context: string;

  constructor(logger: LoggerService, context: string) {
    this.logger = logger;
    this.context = context;
  }

  /**
   * Handles exceptions by logging the error and throwing an appropriate RpcException.
   *
   * @param {Error} error - The error that occurred.
   * @param {string} [msg='[ERROR] Unexpected Error, check logs'] - The message to include in the thrown exception if the error is not an instance of RpcException.
   *
   * @throws {RpcException} Throws the original RpcException if the error is an instance of RpcException and its message includes '[ERROR]'.
   * @throws {RpcException} Throws a new RpcException with a BAD_REQUEST status and the provided message if the error is not an instance of RpcException.
   *
   * @example
   * const handler = new ExceptionHandler(console, 'UserService');
   * handler.handleException(new Error('Something went wrong'), 'Failed to process user data');
   */
  public process(error: any, msg: string = 'Unexpected Error, check logs'): void {
    this.logger.error(error, { context: this.context });

    if (error instanceof RpcException && error.message.includes('[ERROR]')) throw error;

    throw new RpcException({ status: HttpStatus.BAD_REQUEST, message: `[ERROR] ${msg}` });
  }
}
