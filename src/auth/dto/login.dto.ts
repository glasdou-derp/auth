import { Transform } from 'class-transformer';
import { IsString } from 'class-validator';

/**
 * Data Transfer Object (DTO) for handling login requests.
 * Validates that the `username` and `password` fields are strings.
 * The `username` is transformed to lowercase.
 */
export class LoginDto {
  /**
   * The username of the user.
   * This field is transformed to lowercase.
   *
   * @type {string}
   */
  @IsString()
  @Transform(({ value }) => value.toLowerCase())
  username: string;

  /**
   * The password of the user.
   *
   * @type {string}
   */
  @IsString()
  password: string;
}
