import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcrypt';
import { Strings, Types } from 'cafe-utility';
import { getOnlyUsersRowOrNull } from 'src/DatabaseExtra';
import { OrganizationService } from '../organization/organization.service';

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;

  constructor(
    configService: ConfigService,
    private organizationService: OrganizationService,
    private jwtService: JwtService,
  ) {
    this.jwtSecret = Types.asString(configService.get<string>('JWT_SECRET'), { name: 'JWT_SECRET' });
  }

  async login(email: string, password: string): Promise<{ access_token: string }> {
    email = Strings.normalizeEmail(email);
    const user = await getOnlyUsersRowOrNull({ email });
    if (!user || !user.enabled) {
      throw new UnauthorizedException();
    }
    const org = await this.organizationService.getOrganization(user.organizationId);
    if (!org || !org.enabled) {
      throw new UnauthorizedException();
    }
    const matches = await compare(password, user.password);
    if (!matches) {
      throw new UnauthorizedException();
    }
    const payload = { email: user.email };
    return {
      access_token: await this.jwtService.signAsync(payload, { secret: this.jwtSecret }),
    };
  }
}
