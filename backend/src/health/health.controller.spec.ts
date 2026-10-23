import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthController', () => {
  let controller: HealthController;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: {
            isHealthy: jest.fn().mockResolvedValue({ status: 'healthy', database: 'connected' }),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return health status', async () => {
    const result = await controller.getHealth();
    expect(result.service).toBe('ai-customer-support-backend');
    expect(result.status).toBe('ok');
    expect(result.database.database).toBe('connected');
  });
});
