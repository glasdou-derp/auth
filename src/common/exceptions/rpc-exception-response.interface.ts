import { HttpStatus } from '@nestjs/common';

export interface RpcExceptionResponse {
  status: HttpStatus;
  message: string;
}
