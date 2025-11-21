jest.mock(
  'librechat-data-provider',
  () => ({
    SystemRoles: {
      ADMIN: 'ADMIN',
      USER: 'USER',
    },
  }),
  { virtual: true },
);

const { SystemRoles } = require('librechat-data-provider');
jest.mock(
  '@librechat/data-schemas',
  () => ({
    logger: {
      error: jest.fn(),
    },
  }),
  { virtual: true },
);

jest.mock('~/db/models', () => {
  const mockAggregate = jest.fn();
  return {
    Transaction: {
      aggregate: mockAggregate,
    },
  };
});

const { Transaction } = require('~/db/models');

const { getUsageAnalytics } = require('./AnalyticsController');

describe('AnalyticsController.getUsageAnalytics', () => {
  let res;

  beforeEach(() => {
    Transaction.aggregate.mockReset();
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  it('returns aggregated usage for all users', async () => {
    Transaction.aggregate.mockResolvedValue([
      {
        userId: '507f1f77bcf86cd799439011',
        name: 'Admin One',
        email: 'admin@example.com',
        totalTokens: 100,
        totalCost: 2,
        usageByModel: [{ model: 'gpt-4', totalTokens: 100, totalCost: 2 }],
      },
      {
        userId: '507f1f77bcf86cd799439012',
        name: 'Admin Two',
        email: 'admin2@example.com',
        totalTokens: 200,
        totalCost: 5,
        usageByModel: [{ model: 'gpt-3.5', totalTokens: 200, totalCost: 5 }],
      },
    ]);

    const req = {
      user: { role: SystemRoles.ADMIN },
      query: { startDate: '2024-01-01', endDate: '2024-01-31' },
    };

    await getUsageAnalytics(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.users).toHaveLength(2);
    expect(payload.summary.totalTokens).toBe(300);
    expect(payload.summary.totalCost).toBe(7);
  });

  it('applies user filter when userId is provided', async () => {
    Transaction.aggregate.mockResolvedValue([
      {
        userId: '507f1f77bcf86cd799439011',
        name: 'Admin One',
        email: 'admin@example.com',
        totalTokens: 50,
        totalCost: 1,
        usageByModel: [{ model: 'gpt-4', totalTokens: 50, totalCost: 1 }],
      },
    ]);

    const req = {
      user: { role: SystemRoles.ADMIN },
      query: {
        startDate: '2024-01-01',
        endDate: '2024-01-10',
        userId: '507f1f77bcf86cd799439011',
      },
    };

    await getUsageAnalytics(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const pipeline = Transaction.aggregate.mock.calls[0][0];
    const matchStage = pipeline.find((stage) => stage.$match);
    expect(matchStage.$match.user.toString()).toBe(req.query.userId);
  });

  it('returns 400 for invalid dates', async () => {
    const req = {
      user: { role: SystemRoles.ADMIN },
      query: { startDate: 'invalid', endDate: '2024-01-01' },
    };

    await getUsageAnalytics(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Transaction.aggregate).not.toHaveBeenCalled();
  });

  it('returns 400 when startDate is after endDate', async () => {
    const req = {
      user: { role: SystemRoles.ADMIN },
      query: { startDate: '2024-02-01', endDate: '2024-01-01' },
    };

    await getUsageAnalytics(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Transaction.aggregate).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid userId', async () => {
    const req = {
      user: { role: SystemRoles.ADMIN },
      query: { startDate: '2024-01-01', endDate: '2024-01-31', userId: 'not-an-id' },
    };

    await getUsageAnalytics(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Transaction.aggregate).not.toHaveBeenCalled();
  });

  it('returns 403 when user is not an admin', async () => {
    const req = {
      user: { role: SystemRoles.USER },
      query: { startDate: '2024-01-01', endDate: '2024-01-31' },
    };

    await getUsageAnalytics(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Transaction.aggregate).not.toHaveBeenCalled();
  });
});
