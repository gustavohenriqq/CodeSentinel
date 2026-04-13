import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(authService) {
    this.authService = authService;
  }

  @Post('register')
  async register(@Body() body) {
    const { email, password, name } = body;
    if (!email || !password || !name) {
      throw new Error('email, password and name are required');
    }
    return this.authService.register(email, password, name);
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() body) {
    const { email, password } = body;
    if (!email || !password) {
      throw new Error('email and password are required');
    }
    return this.authService.login(email, password);
  }
}
