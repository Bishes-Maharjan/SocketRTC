import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  IsStrongPassword,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SignUpDTO {
  @ApiProperty({ type: String, required: true, example: 'bishes@gmail.com' })
  @IsEmail()
  @MinLength(5)
  @MaxLength(50)
  email: string;

  @ApiProperty({ type: String, required: true, example: 'haliburt' })
  @IsString()
  @MinLength(5)
  @MaxLength(50)
  fullName: string;

  @ApiProperty({ type: String, required: true, example: '123' })
  @IsString()
  @MinLength(5)
  @MaxLength(50)
  @IsStrongPassword()
  password: string;

  @ApiProperty({ type: String, required: true, example: '123' })
  @IsString()
  image: string;
}

export class SignInDTO {
  @ApiProperty({ type: String, required: true, example: 'bishes@gmail.com' })
  @IsString()
  @IsEmail()
  @MinLength(5)
  @MaxLength(50)
  email: string;

  @ApiProperty({ type: String, required: true, example: '123' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  password: string;
}

export class OnBoardingDTO {
  @ApiProperty({ type: String, required: true, example: 'Bishes Maharjan' })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  fullName: string;

  @ApiProperty({
    type: String,
    required: true,
    example: 'Something about yourself',
  })
  @IsString()
  @MinLength(5)
  @MaxLength(50)
  bio: string;

  @ApiProperty({ type: String, required: true, example: 'Nepali' })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  nativeLanguage: string;

  @ApiProperty({ type: String, required: true, example: 'Japanese' })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  learningLanguage: string;

  @ApiProperty({ type: String, required: true, example: 'Nepal' })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  location: string;

  @ApiProperty({ type: String, required: true, example: 'Nepal' })
  @IsString()
  image: string;
}
