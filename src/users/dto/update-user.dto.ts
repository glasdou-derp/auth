import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsUUID } from 'class-validator';

/**
 * Data Transfer Object (DTO) for updating a user's information.
 * Extends the `CreateUserDto` with optional fields and includes the `id` of the user to be updated.
 */
export class UpdateUserDto extends PartialType(CreateUserDto) {
  /**
   * The unique identifier of the user to be updated.
   * Must be a valid UUID.
   *
   * @type {string}
   */
  @IsUUID()
  id: string;
}
