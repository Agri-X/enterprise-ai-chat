import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Users,
  Trash2,
  Search,
  ShieldAlert,
  Loader2,
  PencilLine,
  UserMinus,
} from 'lucide-react';
import { PrincipalType, SystemRoles } from 'librechat-data-provider';
import {
  Button,
  Spinner,
  OGDialog,
  OGDialogTitle,
  OGDialogContent,
  OGDialogTrigger,
  useToastContext,
} from '@librechat/client';
import type { TPrincipal } from 'librechat-data-provider';
import {
  useGroupsQuery,
  useGroupDetailsQuery,
  useCreateGroupMutation,
  useUpdateGroupMutation,
  useDeleteGroupMutation,
  useAddGroupMembersMutation,
  useRemoveGroupMemberMutation,
} from '~/data-provider';
import { useAuthContext, useLocalize } from '~/hooks';
import UnifiedPeopleSearch from '~/components/Sharing/PeoplePicker/UnifiedPeopleSearch';
import PrincipalAvatar from '~/components/Sharing/PrincipalAvatar';
import { cn } from '~/utils';

const emptyPagination = { page: 1, totalPages: 1, hasNextPage: false };

const GroupManagement = () => {
  const localize = useLocalize();
  const { user, isAuthenticated } = useAuthContext();
  const { showToast } = useToastContext();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const [createForm, setCreateForm] = useState({ name: '', description: '' });
  const [editForm, setEditForm] = useState({ name: '', description: '' });

  const groupsQuery = useGroupsQuery({ page, limit: 10, search: search || undefined });
  const groupDetails = useGroupDetailsQuery(selectedGroupId, { enabled: Boolean(selectedGroupId) });

  const createGroupMutation = useCreateGroupMutation({
    onSuccess: (data) => {
      setCreateForm({ name: '', description: '' });
      setSelectedGroupId(data.group._id);
      setCreateOpen(false);
      showToast({ status: 'success', message: 'Group created' });
    },
    onError: () => showToast({ status: 'error', message: 'Failed to create group' }),
  });

  const updateGroupMutation = useUpdateGroupMutation(selectedGroupId || '', {
    onSuccess: () => showToast({ status: 'success', message: 'Group updated' }),
    onError: () => showToast({ status: 'error', message: 'Failed to update group' }),
  });

  const deleteGroupMutation = useDeleteGroupMutation({
    onSuccess: () => {
      setSelectedGroupId(null);
      showToast({ status: 'success', message: 'Group deleted' });
    },
    onError: () => showToast({ status: 'error', message: 'Failed to delete group' }),
  });

  const addMembersMutation = useAddGroupMembersMutation({
    onSuccess: () => showToast({ status: 'success', message: 'Members updated' }),
    onError: () => showToast({ status: 'error', message: 'Failed to add members' }),
  });

  const removeMemberMutation = useRemoveGroupMemberMutation({
    onSuccess: () => showToast({ status: 'success', message: 'Member removed' }),
    onError: () => showToast({ status: 'error', message: 'Failed to remove member' }),
  });

  useEffect(() => {
    if (groupsQuery.data?.groups?.length && !selectedGroupId) {
      setSelectedGroupId(groupsQuery.data.groups[0]._id);
    }
  }, [groupsQuery.data?.groups, selectedGroupId]);

  useEffect(() => {
    if (groupDetails.data?.group) {
      setEditForm({
        name: groupDetails.data.group.name,
        description: groupDetails.data.group.description || '',
      });
    }
  }, [groupDetails.data?.group?._id]);

  const members = groupDetails.data?.members || [];
  const membersExcludeIds = useMemo(
    () => members.map((member) => member.idOnTheSource),
    [members],
  );
  const isLocalGroup = groupDetails.data?.group?.source === 'local';

  const pagination = groupsQuery.data?.pagination || emptyPagination;

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    createGroupMutation.mutate({
      name: createForm.name.trim(),
      description: createForm.description.trim(),
    });
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedGroupId) {
      return;
    }
    updateGroupMutation.mutate({
      name: editForm.name.trim(),
      description: editForm.description.trim(),
    });
  };

  const handleDelete = (groupId: string) => {
    if (!groupId) {
      return;
    }
    const confirmed = window.confirm('Delete this group? Permissions using it will be removed.');
    if (!confirmed) {
      return;
    }
    deleteGroupMutation.mutate(groupId);
  };

  const handleAddPeople = (principals: TPrincipal[]) => {
    if (!selectedGroupId) {
      return;
    }
    const userIds = principals
      .filter((principal) => principal.type === PrincipalType.USER && principal.id)
      .map((principal) => principal.id as string);

    if (userIds.length) {
      addMembersMutation.mutate({ groupId: selectedGroupId, userIds });
    }
  };

  const handleRemoveMember = (userId: string) => {
    if (!selectedGroupId) {
      return;
    }
    removeMemberMutation.mutate({ groupId: selectedGroupId, userId });
  };

  if (!isAuthenticated) {
    return null;
  }

  if (user?.role !== SystemRoles.ADMIN) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <ShieldAlert className="h-6 w-6 text-amber-500" aria-hidden="true" />
        <p className="text-lg font-semibold text-text-primary">Admin access required</p>
        <p className="text-sm text-muted-foreground">
          You need an administrator account to manage departments and groups.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-6">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Departments / Groups
          </p>
          <h1 className="text-2xl font-semibold text-text-primary">Department Access Control</h1>
          <p className="text-sm text-muted-foreground">
            Create local groups, manage members, and share prompts or agents by department.
          </p>
        </div>
        <OGDialog open={createOpen} onOpenChange={setCreateOpen}>
          <OGDialogTrigger asChild>
            <Button className="gap-2" variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              New Group
            </Button>
          </OGDialogTrigger>
          <OGDialogContent className="w-full max-w-lg border-border-light bg-surface-primary text-text-primary">
            <OGDialogTitle>Create Department / Group</OGDialogTitle>
            <form className="mt-4 space-y-4" onSubmit={handleCreate}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">Name</label>
                <input
                  className="w-full rounded-lg border border-border-medium bg-surface-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-primary"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Finance, HR, Engineering"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">Description</label>
                <textarea
                  className="w-full rounded-lg border border-border-medium bg-surface-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-primary"
                  rows={3}
                  value={createForm.description}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Optional context"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setCreateForm({ name: '', description: '' })}>
                  Clear
                </Button>
                <Button
                  type="submit"
                  disabled={createGroupMutation.isLoading || !createForm.name.trim()}
                  className="gap-2"
                >
                  {createGroupMutation.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create
                </Button>
              </div>
            </form>
          </OGDialogContent>
        </OGDialog>
      </div>

      <div className="grid h-full gap-4 lg:grid-cols-[1.05fr_1.4fr]">
        <div className="flex flex-col gap-3 rounded-xl border border-border-medium bg-surface-primary p-4 shadow-sm">
          <div className="flex items-center gap-2 rounded-lg border border-border-medium bg-surface-secondary px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <input
              className="w-full bg-transparent text-sm text-text-primary outline-none"
              placeholder="Search groups"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {groupsQuery.isLoading ? (
            <div className="flex flex-1 items-center justify-center py-10">
              <Spinner />
            </div>
          ) : (
            <div className="flex flex-1 flex-col gap-2 overflow-auto">
              {groupsQuery.data?.groups?.map((group) => {
                const isActive = group._id === selectedGroupId;
                return (
                  <button
                    key={group._id}
                    onClick={() => setSelectedGroupId(group._id)}
                    className={cn(
                      'w-full rounded-lg border px-3 py-3 text-left transition-colors',
                      'border-border-medium bg-surface-secondary hover:border-accent-primary/60',
                      isActive && 'border-accent-primary/80 shadow-sm',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-primary/10 text-accent-primary">
                          <Users className="h-4 w-4" aria-hidden="true" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-text-primary">{group.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {group.description || 'No description'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-medium',
                            group.source === 'local'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
                          )}
                        >
                          {group.source === 'local' ? 'Local' : 'Entra'}
                        </span>
                        <span className="rounded-full bg-surface-tertiary px-2 py-0.5 text-xs text-text-secondary">
                          {group.memberCount ?? 0} members
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}

              {!groupsQuery.data?.groups?.length && (
                <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border-medium p-6 text-sm text-muted-foreground">
                  No groups yet. Create one to get started.
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
            <div>
              Page {pagination.page} of {pagination.totalPages || 1}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!pagination.hasNextPage}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-border-medium bg-surface-primary p-4 shadow-sm">
          {groupDetails.isLoading && selectedGroupId ? (
            <div className="flex flex-1 items-center justify-center">
              <Spinner />
            </div>
          ) : groupDetails.data?.group ? (
            <>
              <div className="flex flex-col gap-4 rounded-lg border border-border-medium bg-surface-secondary p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Details
                    </p>
                    <h2 className="text-lg font-semibold text-text-primary">
                      {groupDetails.data.group.name}
                    </h2>
                    {groupDetails.data.group.source !== 'local' && (
                      <p className="text-xs text-amber-500">
                        External groups are read-only and managed at the source.
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(groupDetails.data.group._id)}
                    disabled={deleteGroupMutation.isLoading || !isLocalGroup}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">Delete group</span>
                  </Button>
                </div>
                <form className="space-y-3" onSubmit={handleUpdate}>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-primary">Name</label>
                    <div className="flex items-center gap-2 rounded-lg border border-border-medium bg-surface-primary px-3 py-2">
                      <PencilLine className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <input
                        className="w-full bg-transparent text-sm text-text-primary outline-none"
                        value={editForm.name}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, name: e.target.value }))
                        }
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-primary">Description</label>
                    <textarea
                      className="w-full rounded-lg border border-border-medium bg-surface-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-primary"
                      rows={3}
                      value={editForm.description}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, description: e.target.value }))
                      }
                      placeholder="Optional context for admins"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      className="gap-2"
                      disabled={updateGroupMutation.isLoading || !selectedGroupId || !isLocalGroup}
                    >
                      {updateGroupMutation.isLoading && (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      )}
                      Save changes
                    </Button>
                  </div>
                </form>
              </div>

              <div className="flex flex-1 flex-col gap-3 rounded-lg border border-border-medium bg-surface-secondary p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Members
                    </p>
                    <h3 className="text-base font-semibold text-text-primary">
                      {members.length} member{members.length === 1 ? '' : 's'}
                    </h3>
                  </div>
                </div>
                {isLocalGroup ? (
                  <UnifiedPeopleSearch
                    onAddPeople={handleAddPeople}
                    typeFilter={[PrincipalType.USER]}
                    excludeIds={membersExcludeIds}
                    placeholder={localize('com_ui_search_default_placeholder')}
                  />
                ) : (
                  <div className="rounded-lg border border-dashed border-border-medium px-3 py-2 text-sm text-muted-foreground">
                    Members for external groups are synced from the provider and cannot be edited
                    here.
                  </div>
                )}

                <div className="mt-2 flex flex-col gap-2 overflow-auto">
                  {members.map((member) => (
                    <div
                      key={member._id}
                      className="flex items-center justify-between rounded-lg border border-border-medium bg-surface-primary px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <PrincipalAvatar principal={{ ...member, type: PrincipalType.USER }} size="sm" />
                        <div>
                          <p className="text-sm font-medium text-text-primary">
                            {member.name || member.username || member.email}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {member.email || member.username || 'No email'}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleRemoveMember(member._id)}
                        disabled={removeMemberMutation.isLoading || !isLocalGroup}
                      >
                        <UserMinus className="h-4 w-4" aria-hidden="true" />
                        Remove
                      </Button>
                    </div>
                  ))}
                  {!members.length && (
                    <div className="flex items-center justify-center rounded-lg border border-dashed border-border-medium px-4 py-6 text-sm text-muted-foreground">
                      No members yet. Add team members to grant access via this group.
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border-medium p-6 text-sm text-muted-foreground">
              Select a group to view details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupManagement;
