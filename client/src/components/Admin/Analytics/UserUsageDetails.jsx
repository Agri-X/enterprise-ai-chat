import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpDown, ArrowLeft, RefreshCcw } from 'lucide-react';
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

const UserUsageDetails = () => {
    const { userId } = useParams();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuthContext();

    const defaultEnd = useMemo(() => new Date(), []);
    const defaultStart = useMemo(() => {
        const start = new Date();
        start.setDate(start.getDate() - 30); // Default to last 30 days for detail view
        return start;
    }, []);

    const [startDate, setStartDate] = useState(getDateInputValue(defaultStart));
    const [endDate, setEndDate] = useState(getDateInputValue(defaultEnd));
    const [sortField, setSortField] = useState('totalCost');
    const [sortDirection, setSortDirection] = useState('desc');

    const queryParams = useMemo(
        () => ({
            startDate: toISOStringRange(startDate, false),
            endDate: toISOStringRange(endDate, true),
            userId,
        }),
        [endDate, userId, startDate],
    );

    const analyticsQuery = useUsageAnalyticsQuery(queryParams, {
        keepPreviousData: true,
        enabled: Boolean(queryParams.startDate && queryParams.endDate && isAuthenticated && userId),
    });

    const userData = useMemo(() => {
        if (!analyticsQuery.data?.users?.length) return null;
        return analyticsQuery.data.users[0];
    }, [analyticsQuery.data]);

    const rows = useMemo(() => {
        if (!userData?.usageByModel) {
            return [];
        }

        return [...userData.usageByModel].sort((a, b) => {
            const first = Number(a[sortField] || 0);
            const second = Number(b[sortField] || 0);

            if (first === second) return 0;
            return sortDirection === 'asc' ? first - second : second - first;
        });
    }, [userData, sortDirection, sortField]);

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

    return (
        <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => navigate('/admin/analytics')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            User Analytics
                        </p>
                        <h1 className="text-2xl font-semibold text-text-primary">
                            {userData?.name || 'Loading...'}
                        </h1>
                        <p className="text-sm text-muted-foreground">{userData?.email}</p>
                    </div>
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
                        {costFormatter.format(userData?.totalCost ?? 0)}
                    </p>
                </div>

                <div className="rounded-xl border border-border-medium bg-surface-primary p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Tokens</p>
                    <p className="mt-2 text-2xl font-semibold text-text-primary">
                        {numberFormatter.format(userData?.totalTokens ?? 0)}
                    </p>
                </div>

                <div className="rounded-xl border border-border-medium bg-surface-primary p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Date Range</p>
                    <div className="mt-2 flex flex-col gap-2">
                        <input
                            type="date"
                            className="rounded-lg border border-border-medium bg-surface-secondary px-2 py-1 text-xs text-text-primary focus:border-border-strong focus:outline-none"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                        <input
                            type="date"
                            className="rounded-lg border border-border-medium bg-surface-secondary px-2 py-1 text-xs text-text-primary focus:border-border-strong focus:outline-none"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-border-medium bg-surface-primary p-4 shadow-sm">
                <h2 className="mb-4 text-lg font-medium text-text-primary">Model Usage Breakdown</h2>

                {analyticsQuery.isLoading ? (
                    <div className="flex items-center justify-center py-10" aria-live="polite">
                        <Spinner className="text-text-primary" />
                    </div>
                ) : analyticsQuery.error ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        Failed to load analytics.
                    </div>
                ) : rows.length === 0 ? (
                    <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                        No usage data found for this user in the selected range.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-border-medium">
                            <thead>
                                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    <th className="pb-3">Model</th>
                                    <th
                                        className="cursor-pointer pb-3"
                                        onClick={() => toggleSort('totalTokens')}
                                    >
                                        <div className="flex items-center gap-2">
                                            Tokens
                                            {sortIcon(sortField === 'totalTokens', sortDirection)}
                                        </div>
                                    </th>
                                    <th
                                        className="cursor-pointer pb-3"
                                        onClick={() => toggleSort('totalCost')}
                                    >
                                        <div className="flex items-center gap-2">
                                            Cost
                                            {sortIcon(sortField === 'totalCost', sortDirection)}
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-light text-sm">
                                {rows.map((row) => (
                                    <tr key={row.model} className="hover:bg-surface-secondary/60">
                                        <td className="py-3 font-medium text-text-primary">{row.model}</td>
                                        <td className="py-3 font-semibold text-text-primary">
                                            {numberFormatter.format(row.totalTokens ?? 0)}
                                        </td>
                                        <td className="py-3 font-semibold text-text-primary">
                                            {costFormatter.format(row.totalCost ?? 0)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserUsageDetails;
