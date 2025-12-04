/* eslint-disable @typescript-eslint/no-unsafe-argument */

import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bycrpt from 'bcrypt';
import { Model } from 'mongoose';
import { GoogleUser } from 'src/globals/googleUser.dto';
import { OnBoardingDTO, SignInDTO, SignUpDTO } from 'src/user/dtos/user.dto';
import { User, UserDocument } from 'src/user/model/user.model';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwt: JwtService,
  ) {}

  async signup(userDto: SignUpDTO) {
    const existingUser = await this.userModel.findOne({
      email: userDto.email,
      isDeleted: false,
    });

    if (existingUser) {
      throw new BadRequestException('User already exists');
    }

    const user: UserDocument = new this.userModel(userDto);
    await user.save();
    return this.generateJwtToken(user.id, user.email);
  }

  async signin(userDto: SignInDTO) {
    const user = await this.userModel.findOne({ email: userDto.email });
    if (!user) throw new NotFoundException('User Doesnt Exist');
    if (!user.password)
      throw new UnauthorizedException('Password doesnt exist for OAuth users');
    const correctPassword = await bycrpt.compare(
      userDto.password,
      user.password,
    );
    if (!correctPassword) throw new BadRequestException('Incorrect Password');
    return this.generateJwtToken(user.id, user.email);
  }

  async createGoogleUser(googleUserDto: GoogleUser) {
    let user = await this.userModel // Change 'const' to 'let'
      .findOne({ email: googleUserDto.email })
      .exec();

    if (!user) {
      user = new this.userModel({
        // Remove 'const' - reassign to existing variable
        email: googleUserDto.email,
        fullName: googleUserDto.name,
        provider: 'google',
        image: googleUserDto.picture,
      });
      await user.save();
    }

    if (!user)
      throw new InternalServerErrorException(
        'something went wrong in creategoogle user',
      );

    const token = this.generateJwtToken(user.id, user.email);

    return token;
  }

  async getMe(id: string) {
    const user = await this.userModel.findById(id);
    if (!user) return { message: 'Unauthenticated' };
    return user;
  }

  async findUserById(id: string) {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  generateJwtToken(id: string, email: string) {
    const token = this.jwt.sign({
      id,
      email,
    });
    return token;
  }

  // async getMe(token: string) {
  //   const user = await this.jwt.verify(token);
  //   const dbUser = await this.userModel.findById(user.id);
  //   if (!dbUser) return { msg: 'User doesnt exist' };
  //   return dbUser;
  // }

  async onboard(id: string, email: string, onBoardDto: OnBoardingDTO) {
    const updatedUser = await this.userModel
      .findByIdAndUpdate(
        { _id: id, email },
        { ...onBoardDto, isOnBoarded: true },
        { new: true },
      )
      .select('-password');
    if (!updatedUser) throw new BadRequestException('User not found');

    return { success: true, user: updatedUser };
  }
}
