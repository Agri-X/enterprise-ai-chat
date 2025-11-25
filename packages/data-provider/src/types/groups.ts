export type GroupSource = 'local' | 'entra';

export type GroupListParams = {
  page?: number;
  limit?: number;
  search?: string;
  source?: GroupSource;
};

export type GroupPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
};

export type Group = {
  _id: string;
  name: string;
  description?: string;
  email?: string;
  avatar?: string;
  source: GroupSource;
  memberIds?: string[];
  memberCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type GroupMember = {
  _id: string;
  name?: string;
  email?: string;
  username?: string;
  avatar?: string;
  role?: string;
  idOnTheSource: string;
};

export type GroupListResponse = {
  groups: Group[];
  pagination: GroupPagination;
};

export type GroupDetailResponse = {
  group: Group;
  members: GroupMember[];
};

export type CreateGroupRequest = {
  name: string;
  description?: string;
};

export type UpdateGroupRequest = {
  name?: string;
  description?: string;
};

export type AddGroupMembersRequest = {
  groupId: string;
  userIds: string[];
};
