import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from './password.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto, UserPayloadDto } from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const normalizedEmail = dto.email.toLowerCase().trim();

    // Check if user already exists
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      throw new ConflictException('An account with this email address already exists');
    }

    // Securely hash password
    const passwordHash = await this.passwordService.hash(dto.password);

    // Persist new user in database
    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email: normalizedEmail,
        passwordHash,
        role: dto.role || Role.CUSTOMER,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    this.logger.log(`New user registered: ${user.email} with role: ${user.role}`);

    // Generate JWT token
    const accessToken = this.generateToken(user);

    return {
      message: 'Registration successful',
      accessToken,
      user,
    };
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const normalizedEmail = dto.email.toLowerCase().trim();

    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      // Intentionally generic message to prevent email enumeration
      throw new UnauthorizedException('Invalid email or password');
    }

    // Verify password hash
    const isValid = await this.passwordService.compare(dto.password, user.passwordHash);
    if (!isValid) {
      this.logger.warn(`Failed login attempt for user: ${normalizedEmail}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    const sanitizedUser: UserPayloadDto = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    };

    const accessToken = this.generateToken(sanitizedUser);

    this.logger.log(`User logged in successfully: ${user.email}`);

    return {
      message: 'Login successful',
      accessToken,
      user: sanitizedUser,
    };
  }

  async getProfile(userId: string): Promise<UserPayloadDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    return user;
  }

  generateToken(user: { id: string; email: string; role: Role }): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return this.jwtService.sign(payload);
  }
}
