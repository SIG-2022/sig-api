import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { User as UserModel } from '@prisma/client';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async signupUser(
    @Body() userData: { email: string; password: string; token: string },
  ): Promise<UserModel> {
    if (userData.token === process.env.MASTER_TOKEN) {
      const { token, ...data } = userData;
      return this.userService.createUser(data);
    } else throw new BadRequestException('Invalid token');
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getUsers() {
    return this.userService.users({});
  }
}
