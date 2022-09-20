import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
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

  @Post('/register')
  async register(@Body() userData: { email: string; password: string }) {
    return this.userService.register(userData);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getUsers(@Request() req) {
    if (req.user.role !== 'ADMIN') throw new BadRequestException();
    return this.userService.users({ where: { enabled: false } });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteUser(@Param('id') id, @Request() req) {
    if (req.user.role !== 'ADMIN') throw new BadRequestException();
    return this.userService.deleteUser(id);
  }

  @Post(':id/accept')
  @UseGuards(JwtAuthGuard)
  async acceptUser(@Param('id') id, @Request() req) {
    if (req.user.role !== 'ADMIN') throw new BadRequestException();
    return this.userService.acceptUser(id);
  }
}
