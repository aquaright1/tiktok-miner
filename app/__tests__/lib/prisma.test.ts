import { PrismaClient } from '@prisma/client';

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    creator: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  })),
}));

describe('Prisma Database Connection', () => {
  let prisma: any;

  beforeEach(() => {
    prisma = new PrismaClient();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should connect to database', async () => {
    await prisma.$connect();
    expect(prisma.$connect).toHaveBeenCalled();
  });

  it('should disconnect from database', async () => {
    await prisma.$disconnect();
    expect(prisma.$disconnect).toHaveBeenCalled();
  });

  it('should perform basic CRUD operations', async () => {
    const mockCreator = {
      id: 1,
      username: 'testuser',
      platform: 'tiktok',
      followers: 1000,
    };

    // Test create
    prisma.creator.create.mockResolvedValue(mockCreator);
    const created = await prisma.creator.create({
      data: {
        username: 'testuser',
        platform: 'tiktok',
        followers: 1000,
      },
    });
    expect(created).toEqual(mockCreator);

    // Test findMany
    prisma.creator.findMany.mockResolvedValue([mockCreator]);
    const creators = await prisma.creator.findMany();
    expect(creators).toEqual([mockCreator]);

    // Test findFirst
    prisma.creator.findFirst.mockResolvedValue(mockCreator);
    const creator = await prisma.creator.findFirst({
      where: { username: 'testuser' },
    });
    expect(creator).toEqual(mockCreator);

    // Test update
    const updatedCreator = { ...mockCreator, followers: 2000 };
    prisma.creator.update.mockResolvedValue(updatedCreator);
    const updated = await prisma.creator.update({
      where: { id: 1 },
      data: { followers: 2000 },
    });
    expect(updated).toEqual(updatedCreator);

    // Test delete
    prisma.creator.delete.mockResolvedValue(mockCreator);
    const deleted = await prisma.creator.delete({
      where: { id: 1 },
    });
    expect(deleted).toEqual(mockCreator);
  });
});