import { Role } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional, IsString, IsStrongPassword, IsUUID, MinLength } from 'class-validator';

/**
 * Data Transfer Object (DTO) for updating a user's information.
 * Extends the `CreateUserDto` with optional fields and includes the `id` of the user to be updated.
 */
export class UpdateUserDto {
  /**
   * The unique identifier of the user to be updated.
   * Must be a valid UUID.
   *
   * @type {string}
   */
  @IsUUID()
  id: string;

  /**
   * The username of the user.
   * Must be a string with a minimum length of 2 characters.
   * Transformed to be trimmed and lowercase.
   *
   * @type {string}
   */
  @IsString()
  @MinLength(2)
  @Transform(({ value }) => value.trim().toLowerCase())
  @IsOptional()
  username?: string;

  /**
   * The email address of the user.
   * Must be a valid email string.
   * Transformed to be trimmed and lowercase.
   *
   * @type {string}
   */
  @IsString()
  @IsEmail()
  @Transform(({ value }) => value.trim().toLowerCase())
  @IsOptional()
  email?: string;

  /**
   * The password of the user.
   * Must be a string with a minimum length of 6 characters and meet strong password criteria.
   *
   * @type {string}
   */
  @IsString()
  @MinLength(6)
  @IsStrongPassword()
  @IsOptional()
  password?: string;

  /**
   * The roles assigned to the user.
   * Must be a valid array of roles and is optional.
   *
   * @type {Role[]}
   * @optional
   */
  @IsEnum(Role, { each: true })
  @IsOptional()
  roles: Role[];
}
