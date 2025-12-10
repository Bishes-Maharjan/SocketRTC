/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CookieOptions, Response } from 'express';
import { Grequest, Irequest } from 'src/globals/Req.dto';
import { OnBoardingDTO, SignInDTO, SignUpDTO } from 'src/user/dtos/user.dto';
import { AuthService } from './auth.service';
import { JwtGuard } from './guard/jwtGuard';
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  private cookieSetting: CookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV == 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
  };
  @UseGuards(AuthGuard('google'))
  @HttpCode(200)
  @Get('google')
  async googleAuth() {
    // initiates Google OAuth
  }

  @UseGuards(AuthGuard('google'))
  @Get('google/callback')
  @HttpCode(200)
  async googleAuthRedirect(@Req() req: Grequest, @Res() res: Response) {
    try {
      if (!req.user) {
        throw new Error('No user found in request');
      }

      const { user } = req;

      const token = await this.authService.createGoogleUser(user);

      // Redirect with success parameter
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

      res.redirect(`${frontendUrl}/oauth-success?token=${token}`);
    } catch (error) {
      console.error('=== GOOGLE CALLBACK ERROR ===');
      console.error('Error:', error.message);
      console.error('Stack:', error.stack);

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const errorRedirect = `${frontendUrl}/login?error=oauth_failed`;

      res.status(500).send(`
        <html>
          <body>
            <script>
              console.error('OAuth failed:', '${error.message}');
              window.location.href = '${errorRedirect}';
            </script>
            <p>Authentication failed. Redirecting...</p>
            <p>Error: ${error.message}</p>
          </body>
        </html>
      `);
    }
  }

  //SIGNUP
  @ApiOperation({ summary: 'Register API' })
  @HttpCode(201)
  @Post('signup')
  async signup(@Body() userDto: SignUpDTO, @Res() res: Response) {
    const token = await this.authService.signup(userDto);

    res.cookie('jwt', token, this.cookieSetting);

    return res.status(201).json({ token, success: true });
  }

  //SIGNIN
  @ApiOperation({ summary: 'Login API' })
  @Post('signin')
  async signin(@Body() userDto: SignInDTO, @Res() res: Response) {
    const token = await this.authService.signin(userDto);

    res.cookie('jwt', token, this.cookieSetting);

    return res.status(201).json({ token, success: true });
  }

  //LOGOUT
  @UseGuards(JwtGuard)
  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Logout' })
  logout(@Res() res: Response) {
    res.clearCookie('jwt', this.cookieSetting);
    return res
      .status(200)
      .json({ success: true, message: 'Successfully Logged out' });
  }

  //ME
  @UseGuards(JwtGuard)
  @Get('me')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get me' })
  getLoggedInUser(@Req() req: Irequest) {
    console.log(process.env.FRONTEND_URL);
    console.log(this.cookieSetting);
    return this.authService.getMe(req.user.id);
  }

  //onboard
  @UseGuards(JwtGuard)
  @Post('onboard')
  @ApiOperation({ summary: 'Complete onboarding' })
  onboard(@Req() req: Irequest, @Body() onBoardingDto: OnBoardingDTO) {
    const { id, email } = req.user;

    const { fullName, bio, nativeLanguage, learningLanguage, location } =
      onBoardingDto;

    if (!fullName || !bio || !nativeLanguage || !learningLanguage || !location)
      throw new BadRequestException('Enter values for given fields');
    return this.authService.onboard(id, email, onBoardingDto);
  }

  @Post('set-cookie')
  @ApiOperation({ summary: 'cookie redirect for oauth' })
  setCookie(@Body() body: { token: string }, @Res() res: Response) {
    const { token } = body;
    if (token) res.cookie('jwt', token, this.cookieSetting);
    return res
      .status(200)
      .json({ success: true, message: 'Successfully Logged in' });
  }
}
