/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
// google.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { GoogleUser } from 'src/globals/googleUser.dto';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:
        process.env.NODE_ENV == 'production'
          ? process.env.GOOGLE_CALLBACK_URL
          : 'http://localhost:3001/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: {displayName: string; emails: {value: string}[]; photos: {value: string}[]; provider: string},
    done: VerifyCallback,
  ) {
    const { displayName, emails, photos } = profile;

    const user: GoogleUser = {
      email: emails[0]?.value,
      name: displayName,
      picture: photos[0].value,
      provider: profile.provider,
    };

    done(null, user);
  }
}
