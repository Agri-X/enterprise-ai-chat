const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const {
  SystemRoles,
  PrincipalType,
  PrincipalModel,
  ResourceType,
  PermissionBits,
} = require('librechat-data-provider');

let mockCurrentTestUser;

jest.mock('~/server/middleware', () => {
  const original = jest.requireActual('~/server/middleware');
  return {
    ...original,
    requireJwtAuth: (req, _res, next) => {
      if (mockCurrentTestUser) {
        req.user = {
          ...(mockCurrentTestUser.toObject ? mockCurrentTestUser.toObject() : mockCurrentTestUser),
          id: mockCurrentTestUser._id?.toString?.() || mockCurrentTestUser.id,
          _id: mockCurrentTestUser._id,
          role: mockCurrentTestUser.role,
        };
      }
      next();
    },
    checkAdmin: (req, res, next) => {
      const { SystemRoles: MockSystemRoles } = require('librechat-data-provider');
      if (!req.user || req.user.role !== MockSystemRoles.ADMIN) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      next();
    },
  };
});

let app;
let mongoServer;
let Group, User, AclEntry;
let adminUser;
let normalUser;
let memberUser;
let localGroup;
let externalGroup;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({
    instance: {
      ip: '127.0.0.1',
    },
  });
  await mongoose.connect(mongoServer.getUri());

  const dbModels = require('~/db/models');
  Group = dbModels.Group;
  User = dbModels.User;
  AclEntry = dbModels.AclEntry;

  const groupRoutes = require('./groups');
  app = express();
  app.use(express.json());
  app.use('/api/groups', groupRoutes);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  await Promise.all([Group.deleteMany({}), User.deleteMany({}), AclEntry.deleteMany({})]);

  adminUser = await User.create({
    name: 'Admin User',
    email: 'admin@example.com',
    role: SystemRoles.ADMIN,
  });
  normalUser = await User.create({
    name: 'Normal User',
    email: 'user@example.com',
    role: SystemRoles.USER,
  });
  memberUser = await User.create({
    name: 'Member User',
    email: 'member@example.com',
    role: SystemRoles.USER,
  });

  localGroup = await Group.create({
    name: 'Team Alpha',
    description: 'Local team',
    source: 'local',
    memberIds: [],
  });

  externalGroup = await Group.create({
    name: 'Entra Team',
    source: 'entra',
    idOnTheSource: 'ext-1',
    memberIds: [],
  });

  mockCurrentTestUser = adminUser;
});

describe('Groups routes', () => {
  it('lists groups with pagination and member counts', async () => {
    // Add a member to verify memberCount
    localGroup.memberIds = [memberUser._id.toString()];
    await localGroup.save();

    const response = await request(app).get('/api/groups').query({ limit: 10, page: 1 });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.groups)).toBe(true);
    const foundLocal = response.body.groups.find((g) => g._id === localGroup._id.toString());
    expect(foundLocal).toBeDefined();
    expect(foundLocal.memberCount).toBe(1);
    expect(response.body.pagination.total).toBe(2);
  });

  it('creates a local group', async () => {
    const response = await request(app)
      .post('/api/groups')
      .send({ name: 'Finance', description: 'Handles budgets' });

    expect(response.status).toBe(201);
    expect(response.body.group.name).toBe('Finance');
    expect(response.body.group.source).toBe('local');
    expect(response.body.group.memberCount).toBe(0);
  });

  it('prevents non-admins from managing groups', async () => {
    mockCurrentTestUser = normalUser;

    const createResponse = await request(app)
      .post('/api/groups')
      .send({ name: 'Unauthorized Group' });
    expect(createResponse.status).toBe(403);

    const listResponse = await request(app).get('/api/groups');
    expect(listResponse.status).toBe(403);
  });

  it('updates and deletes a local group while cleaning ACL entries', async () => {
    // Seed ACL entry for the group
    await AclEntry.create({
      principalType: PrincipalType.GROUP,
      principalId: localGroup._id,
      principalModel: PrincipalModel.GROUP,
      resourceType: ResourceType.PROMPTGROUP,
      resourceId: new mongoose.Types.ObjectId(),
      permBits: PermissionBits.VIEW,
    });

    const updateResponse = await request(app)
      .put(`/api/groups/${localGroup._id}`)
      .send({ name: 'Team Beta', description: 'Updated description' });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.group.name).toBe('Team Beta');
    expect(updateResponse.body.group.description).toBe('Updated description');

    const deleteResponse = await request(app).delete(`/api/groups/${localGroup._id}`);
    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.groupId).toBe(localGroup._id.toString());

    const aclCount = await AclEntry.countDocuments({ principalId: localGroup._id });
    expect(aclCount).toBe(0);
  });

  it('adds and removes members from a local group', async () => {
    const addResponse = await request(app)
      .post(`/api/groups/${localGroup._id}/members`)
      .send({ userIds: [memberUser._id.toString()] });

    expect(addResponse.status).toBe(200);
    expect(addResponse.body.group.memberCount).toBe(1);
    expect(addResponse.body.members).toHaveLength(1);
    expect(addResponse.body.members[0].email).toBe(memberUser.email);

    const removeResponse = await request(app).delete(
      `/api/groups/${localGroup._id}/members/${memberUser._id}`,
    );

    expect(removeResponse.status).toBe(200);
    expect(removeResponse.body.group.memberCount).toBe(0);
    expect(removeResponse.body.members).toHaveLength(0);
  });

  it('blocks editing non-local groups', async () => {
    const response = await request(app)
      .put(`/api/groups/${externalGroup._id}`)
      .send({ name: 'Should Fail' });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/Only local groups/);
  });
});
