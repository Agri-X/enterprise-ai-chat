import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QueryKeys, dataService } from 'librechat-data-provider';
import type { UseQueryOptions, UseMutationResult } from '@tanstack/react-query';
import type t from 'librechat-data-provider';

export const useGroupsQuery = (
  params: t.GroupListParams,
  config?: UseQueryOptions<t.GroupListResponse>,
) => {
  return useQuery<t.GroupListResponse>(
    [QueryKeys.groups, params],
    () => dataService.listGroups(params),
    {
      keepPreviousData: true,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      ...config,
    },
  );
};

export const useGroupDetailsQuery = (
  groupId: string | null,
  config?: UseQueryOptions<t.GroupDetailsResponse>,
) => {
  return useQuery<t.GroupDetailsResponse>(
    [QueryKeys.group, groupId],
    () => dataService.getGroup(groupId as string),
    {
      enabled: Boolean(groupId),
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      ...config,
    },
  );
};

export const useCreateGroupMutation = (
  options?: t.MutationOptions<{ group: t.Group }, t.CreateGroupRequest>,
): UseMutationResult<{ group: t.Group }, unknown, t.CreateGroupRequest, unknown> => {
  const queryClient = useQueryClient();
  const { onSuccess, onError, onSettled, onMutate } = options || {};

  return useMutation((payload: t.CreateGroupRequest) => dataService.createGroup(payload), {
    onMutate,
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries([QueryKeys.groups]);
      if (data?.group?._id) {
        queryClient.invalidateQueries([QueryKeys.group, data.group._id]);
      }
      onSuccess?.(data, variables, context);
    },
    onError,
    onSettled,
  });
};

export const useUpdateGroupMutation = (
  groupId: string,
  options?: t.MutationOptions<{ group: t.Group }, t.UpdateGroupRequest>,
): UseMutationResult<{ group: t.Group }, unknown, t.UpdateGroupRequest, unknown> => {
  const queryClient = useQueryClient();
  const { onSuccess, onError, onSettled, onMutate } = options || {};

  return useMutation(
    (payload: t.UpdateGroupRequest) => dataService.updateGroup(groupId, payload),
    {
      onMutate,
      onSuccess: (data, variables, context) => {
        queryClient.invalidateQueries([QueryKeys.groups]);
        queryClient.invalidateQueries([QueryKeys.group, groupId]);
        onSuccess?.(data, variables, context);
      },
      onError,
      onSettled,
    },
  );
};

export const useDeleteGroupMutation = (
  options?: t.MutationOptions<{ message: string; groupId: string }, string>,
): UseMutationResult<{ message: string; groupId: string }, unknown, string, unknown> => {
  const queryClient = useQueryClient();
  const { onSuccess, onError, onSettled, onMutate } = options || {};

  return useMutation((groupId: string) => dataService.deleteGroup(groupId), {
    onMutate,
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries([QueryKeys.groups]);
      queryClient.invalidateQueries([QueryKeys.group, variables]);
      onSuccess?.(data, variables, context);
    },
    onError,
    onSettled,
  });
};

export const useAddGroupMembersMutation = (
  options?: t.MutationOptions<t.GroupDetailsResponse, t.AddGroupMembersRequest>,
): UseMutationResult<t.GroupDetailsResponse, unknown, t.AddGroupMembersRequest, unknown> => {
  const queryClient = useQueryClient();
  const { onSuccess, onError, onSettled, onMutate } = options || {};

  return useMutation(
    (payload: t.AddGroupMembersRequest) => dataService.addGroupMembers(payload),
    {
      onMutate,
      onSuccess: (data, variables, context) => {
        queryClient.invalidateQueries([QueryKeys.groups]);
        queryClient.setQueryData([QueryKeys.group, variables.groupId], data);
        onSuccess?.(data, variables, context);
      },
      onError,
      onSettled,
    },
  );
};

export const useRemoveGroupMemberMutation = (
  options?: t.MutationOptions<t.GroupDetailsResponse, { groupId: string; userId: string }>,
): UseMutationResult<t.GroupDetailsResponse, unknown, { groupId: string; userId: string }, unknown> => {
  const queryClient = useQueryClient();
  const { onSuccess, onError, onSettled, onMutate } = options || {};

  return useMutation(
    (payload: { groupId: string; userId: string }) =>
      dataService.removeGroupMember(payload.groupId, payload.userId),
    {
      onMutate,
      onSuccess: (data, variables, context) => {
        queryClient.invalidateQueries([QueryKeys.groups]);
        queryClient.setQueryData([QueryKeys.group, variables.groupId], data);
        onSuccess?.(data, variables, context);
      },
      onError,
      onSettled,
    },
  );
};
