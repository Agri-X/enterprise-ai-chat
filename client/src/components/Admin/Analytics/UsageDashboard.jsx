import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, RefreshCcw } from 'lucide-react';
import { SystemRoles } from 'librechat-data-provider';
import { Button, Spinner } from '@librechat/client';
import { useUsageAnalyticsQuery } from '~/data-provider';
import { useAuthContext } from '~/hooks';

const getDateInputValue = (date) => {
  const iso = date.toISOString();
  return iso.slice(0, 10);
};

const toISOStringRange = (value, isEnd) => {
  if (!value) {
    return '';
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (isEnd) {
    date.setUTCHours(23, 59, 59, 999);
  }

  return date.toISOString();
};

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const costFormatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 4,
});

const sortIcon = (active, direction) => {
  if (!active) return <ArrowUpDown className="h-4 w-4 text-muted-foreground" />;
  return direction === 'asc' ? (
    <ArrowUp className="h-4 w-4 text-text-primary" />
  ) : (
    <ArrowDown className="h-4 w-4 text-text-primary" />
  );
};

const UsageDashboard = () => {
  const { user, isAuthenticated } = useAuthContext();

  const defaultEnd = useMemo(() => new Date(), []);
  const defaultStart = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - 7);
    return start;
  }, []);

  const [startDate, setStartDate] = useState(getDateInputValue(defaultStart));
  const [endDate, setEndDate] = useState(getDateInputValue(defaultEnd));
  const [selectedUser, setSelectedUser] = useState('all');
  const [userOptions, setUserOptions] = useState([]);
  const [sortField, setSortField] = useState('totalCost');
  const [sortDirection, setSortDirection] = useState('desc');

  const queryParams = useMemo(
    () => ({
      startDate: toISOStringRange(startDate, false),
      endDate: toISOStringRange(endDate, true),
      ...(selectedUser !== 'all' ? { userId: selectedUser } : {}),
    }),
    [endDate, selectedUser, startDate],
  );

  const analyticsQuery = useUsageAnalyticsQuery(queryParams, {
    keepPreviousData: true,
    enabled: Boolean(queryParams.startDate && queryParams.endDate && isAuthenticated),
  });

  useEffect(() => {
    if (analyticsQuery.data?.users?.length) {
      setUserOptions((prev) => {
        const map = new Map(prev.map((entry) => [entry.userId, entry]));

        analyticsQuery.data.users.forEach((entry) => {
          if (entry.userId) {
            map.set(entry.userId, {
              userId: entry.userId,
              name: entry.name || entry.email || 'Unknown user',
              email: entry.email,
            });
          }
        });

        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
      });
    }
  }, [analyticsQuery.data]);

  const rows = useMemo(() => {
    if (!analyticsQuery.data?.users) {
      return [];
    }

    return [...analyticsQuery.data.users].sort((a, b) => {
      const first = Number(a[sortField] || 0);
      const second = Number(b[sortField] || 0);

      if (first === second) return 0;
      return sortDirection === 'asc' ? first - second : second - first;
    });
  }, [analyticsQuery.data, sortDirection, sortField]);

  const summary = analyticsQuery.data?.summary ?? {
    totalTokens: 0,
    totalCost: 0,
    startDate: queryParams.startDate,
    endDate: queryParams.endDate,
  };

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortField(field);
    setSortDirection('desc');
  };

  const refresh = () => {
    analyticsQuery.refetch?.();
  };

  if (!isAuthenticated) {
    return null;
  }

  if (user?.role !== SystemRoles.ADMIN) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-lg font-semibold text-text-primary">Admin access required</p>
        <p className="text-sm text-muted-foreground">
          You need an administrator account to view usage analytics.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Usage Analytics
          </p>
          <h1 className="text-2xl font-semibold text-text-primary">Token Usage &amp; Cost</h1>
          <p className="text-sm text-muted-foreground">
            {summary.startDate && summary.endDate
              ? `${new Date(summary.startDate).toLocaleDateString()} - ${new Date(summary.endDate).toLocaleDateString()}`
              : 'Select a date range to begin'}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="inline-flex items-center gap-2 self-start"
          onClick={refresh}
          disabled={analyticsQuery.isFetching}
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-border-medium bg-surface-primary p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Cost</p>
          <p className="mt-2 text-2xl font-semibold text-text-primary">
            {costFormatter.format(summary.totalCost ?? 0)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Sum of all token charges in the selected range.
          </p>
        </div>

        <div className="rounded-xl border border-border-medium bg-surface-primary p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Tokens</p>
          <p className="mt-2 text-2xl font-semibold text-text-primary">
            {numberFormatter.format(summary.totalTokens ?? 0)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Includes prompts and completions.</p>
        </div>

        <div className="rounded-xl border border-border-medium bg-surface-primary p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Filters</p>
          <div className="mt-2 text-sm text-text-primary">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">User:</span>
              <span className="font-medium">{selectedUser === 'all' ? 'All Users' : 'Filtered'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Range:</span>
              <span className="font-medium">{startDate} -> {endDate}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border-medium bg-surface-primary p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4 md:items-end">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text-primary" htmlFor="start-date">
              Start Date
            </label>
            <input
              id="start-date"
              type="date"
              className="rounded-lg border border-border-medium bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:border-border-strong focus:outline-none"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text-primary" htmlFor="end-date">
              End Date
            </label>
            <input
              id="end-date"
              type="date"
              className="rounded-lg border border-border-medium bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:border-border-strong focus:outline-none"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text-primary" htmlFor="user-filter">
              User
            </label>
            <select
              id="user-filter"
              className="rounded-lg border border-border-medium bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:border-border-strong focus:outline-none"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
            >
              <option value="all">All Users</option>
              {userOptions.map((option) => (
                <option key={option.userId} value={option.userId}>
                  {option.name} {option.email ? `(${option.email})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <Button
              className="w-full"
              variant="secondary"
              disabled={analyticsQuery.isFetching}
              onClick={refresh}
            >
              {analyticsQuery.isFetching ? 'Updating...' : 'Update'}
            </Button>
          </div>
        </div>

        <div className="mt-6">
          {analyticsQuery.isLoading ? (
            <div className="flex items-center justify-center py-10" aria-live="polite">
              <Spinner className="text-text-primary" />
            </div>
          ) : analyticsQuery.error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Failed to load analytics. Please adjust your filters and try again.
            </div>
          ) : rows.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              No transactions found for the selected range.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border-medium">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="pb-3">User</th>
                    <th className="pb-3">Email</th>
                    <th
                      className="cursor-pointer pb-3"
                      onClick={() => toggleSort('totalTokens')}
                    >
                      <div className="flex items-center gap-2">
                        Total Tokens
                        {sortIcon(sortField === 'totalTokens', sortDirection)}
                      </div>
                    </th>
                    <th
                      className="cursor-pointer pb-3"
                      onClick={() => toggleSort('totalCost')}
                    >
                      <div className="flex items-center gap-2">
                        Total Cost
                        {sortIcon(sortField === 'totalCost', sortDirection)}
                      </div>
                    </th>
                    <th className="pb-3">Top Models</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light text-sm">
                  {rows.map((row) => (
                    <tr key={row.userId ?? row.email} className="hover:bg-surface-secondary/60">
                      <td className="py-3 font-medium text-text-primary">{row.name}</td>
                      <td className="py-3 text-muted-foreground">{row.email || 'N/A'}</td>
                      <td className="py-3 font-semibold text-text-primary">
                        {numberFormatter.format(row.totalTokens ?? 0)}
                      </td>
                      <td className="py-3 font-semibold text-text-primary">
                        {costFormatter.format(row.totalCost ?? 0)}
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {(row.usageByModel || []).slice(0, 3).map((usage) => (
                            <span
                              key={`${row.userId}-${usage.model}`}
                              className="rounded-full bg-surface-secondary px-2 py-1"
                            >
                              {usage.model}: {costFormatter.format(usage.totalCost ?? 0)}
                            </span>
                          ))}
                          {!row.usageByModel?.length && <span className="text-muted-foreground">N/A</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UsageDashboard;
