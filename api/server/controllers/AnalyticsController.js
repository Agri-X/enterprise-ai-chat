const mongoose = require('mongoose');
const { SystemRoles } = require('librechat-data-provider');
const { logger } = require('@librechat/data-schemas');
const { Transaction } = require('~/db/models');

const parseDate = (value, isEnd = false) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (isNaN(date.getTime())) {
    return null;
  }

  // Ensure endDate captures the full day when a date string is provided without time
  if (isEnd && typeof value === 'string' && !value.includes('T')) {
    date.setUTCHours(23, 59, 59, 999);
  }

  return date;
};

const formatNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const getUsageAnalytics = async (req, res) => {
  if (!req?.user || req.user.role !== SystemRoles.ADMIN) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const { startDate, endDate, userId } = req.query;
  const start = parseDate(startDate);
  const end = parseDate(endDate, true);

  if (!start || !end) {
    return res.status(400).json({ message: 'startDate and endDate are required and must be valid dates' });
  }

  if (start > end) {
    return res.status(400).json({ message: 'startDate must be before endDate' });
  }

  const matchStage = {
    createdAt: {
      $gte: start,
      $lte: end,
    },
  };

  if (userId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid userId' });
    }

    matchStage.user = mongoose.Types.ObjectId.createFromHexString(userId);
  }

  try {
    const usage = await Transaction.aggregate([
      {
        $match: matchStage,
      },
      {
        $group: {
          _id: {
            user: '$user',
            model: '$model',
          },
          totalTokens: { $sum: { $abs: { $ifNull: ['$rawAmount', 0] } } },
          totalCost: { $sum: { $abs: { $ifNull: ['$tokenValue', 0] } } },
        },
      },
      {
        $group: {
          _id: '$_id.user',
          totalTokens: { $sum: '$totalTokens' },
          totalCost: { $sum: '$totalCost' },
          usageByModel: {
            $push: {
              model: '$_id.model',
              totalTokens: '$totalTokens',
              totalCost: '$totalCost',
            },
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          userId: { $cond: [{ $ifNull: ['$_id', false] }, { $toString: '$_id' }, null] },
          name: { $ifNull: ['$user.name', 'Unknown user'] },
          email: '$user.email',
          totalTokens: { $ifNull: ['$totalTokens', 0] },
          totalCost: { $ifNull: ['$totalCost', 0] },
          usageByModel: 1,
        },
      },
      {
        $sort: { totalCost: -1, totalTokens: -1 },
      },
    ]);

    const formattedUsage = usage.map((entry) => ({
      userId: entry.userId,
      name: entry.name || entry.email || 'Unknown user',
      email: entry.email ?? null,
      totalTokens: formatNumber(entry.totalTokens),
      totalCost: formatNumber(entry.totalCost),
      usageByModel: (entry.usageByModel || [])
        .map((usage) => ({
          model: usage?.model || 'unknown',
          totalTokens: formatNumber(usage?.totalTokens),
          totalCost: formatNumber(usage?.totalCost),
        }))
        .sort((a, b) => b.totalCost - a.totalCost),
    }));

    const totals = formattedUsage.reduce(
      (acc, curr) => ({
        totalTokens: acc.totalTokens + formatNumber(curr.totalTokens),
        totalCost: acc.totalCost + formatNumber(curr.totalCost),
      }),
      { totalTokens: 0, totalCost: 0 },
    );

    return res.status(200).json({
      summary: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        totalTokens: totals.totalTokens,
        totalCost: totals.totalCost,
        ...(userId ? { userId } : {}),
      },
      users: formattedUsage,
    });
  } catch (error) {
    logger.error('[AnalyticsController:getUsageAnalytics] Failed to fetch usage analytics', error);
    return res.status(500).json({ message: 'Failed to fetch analytics' });
  }
};

module.exports = {
  getUsageAnalytics,
};
