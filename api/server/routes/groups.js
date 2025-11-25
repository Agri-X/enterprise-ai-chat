const express = require('express');
const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');
const { PrincipalType } = require('librechat-data-provider');
const { requireJwtAuth, checkAdmin } = require('~/server/middleware');
const { Group, User, AclEntry } = require('~/db/models');
const { createGroup, addUserToGroup, removeUserFromGroup } = require('~/models');

const router = express.Router();

router.use(requireJwtAuth);
router.use(checkAdmin);

const formatGroup = (groupDoc) => {
  if (!groupDoc) {
    return null;
  }

  const group = groupDoc.toObject ? groupDoc.toObject() : groupDoc;

  return {
    ...group,
    _id: group._id?.toString() ?? group._id,
    memberCount: Array.isArray(group.memberIds) ? group.memberIds.length : 0,
  };
};

const getGroupMembers = async (memberIds = []) => {
  if (!memberIds.length) {
    return [];
  }

  const objectIds = memberIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const queries = [];
  if (objectIds.length) {
    queries.push({ _id: { $in: objectIds } });
  }
  queries.push({ idOnTheSource: { $in: memberIds } });

  const users = await User.find(
    { $or: queries },
    'name email username avatar role idOnTheSource',
  ).lean();

  const memberMap = new Map();
  users.forEach((user) => {
    const idOnTheSource = user.idOnTheSource || user._id.toString();
    if (!memberMap.has(idOnTheSource)) {
      memberMap.set(idOnTheSource, {
        _id: user._id.toString(),
        name: user.name || user.username || user.email,
        email: user.email,
        username: user.username,
        avatar: user.avatar,
        role: user.role,
        idOnTheSource,
      });
    }
  });

  return Array.from(memberMap.values());
};

router.get('/', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const search = req.query.search?.trim();
    const source = req.query.source;

    const query = {};
    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [{ name: regex }, { description: regex }, { email: regex }];
    }

    if (source && ['local', 'entra'].includes(source)) {
      query.source = source;
    }

    const skip = (page - 1) * limit;

    const [groups, total] = await Promise.all([
      Group.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Group.countDocuments(query),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    res.status(200).json({
      groups: groups.map(formatGroup),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
      },
    });
  } catch (error) {
    logger.error('[groups] Failed to list groups:', error);
    res.status(500).json({ message: 'Failed to list groups' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'Group name is required' });
    }

    const group = await createGroup({
      name: name.trim(),
      description: description?.trim(),
      source: 'local',
      memberIds: [],
    });

    res.status(201).json({ group: formatGroup(group) });
  } catch (error) {
    logger.error('[groups] Failed to create group:', error);
    res.status(500).json({ message: 'Failed to create group' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid group id' });
    }

    const group = await Group.findById(id).lean();
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const members = await getGroupMembers(group.memberIds || []);

    res.status(200).json({ group: formatGroup(group), members });
  } catch (error) {
    logger.error('[groups] Failed to retrieve group:', error);
    res.status(500).json({ message: 'Failed to retrieve group' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid group id' });
    }

    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (group.source !== 'local') {
      return res.status(400).json({ message: 'Only local groups can be edited' });
    }

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ message: 'Group name is required' });
      }
      group.name = name.trim();
    }

    if (description !== undefined) {
      group.description = typeof description === 'string' ? description.trim() : description;
    }

    await group.save();
    res.status(200).json({ group: formatGroup(group) });
  } catch (error) {
    logger.error('[groups] Failed to update group:', error);
    res.status(500).json({ message: 'Failed to update group' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid group id' });
    }

    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (group.source !== 'local') {
      return res.status(400).json({ message: 'Only local groups can be deleted' });
    }

    await Promise.all([
      AclEntry.deleteMany({ principalType: PrincipalType.GROUP, principalId: group._id }),
      Group.deleteOne({ _id: id }),
    ]);

    res.status(200).json({ message: 'Group deleted', groupId: id });
  } catch (error) {
    logger.error('[groups] Failed to delete group:', error);
    res.status(500).json({ message: 'Failed to delete group' });
  }
});

router.post('/:id/members', async (req, res) => {
  try {
    const { id } = req.params;
    const { userIds } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid group id' });
    }

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'userIds array is required' });
    }

    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (group.source !== 'local') {
      return res.status(400).json({ message: 'Only local groups can be modified' });
    }

    for (const userId of userIds) {
      await addUserToGroup(userId, id);
    }

    const updatedGroup = await Group.findById(id).lean();
    const members = await getGroupMembers(updatedGroup?.memberIds || []);

    res.status(200).json({ group: formatGroup(updatedGroup), members });
  } catch (error) {
    if (error?.message?.includes('User not found')) {
      return res.status(404).json({ message: error.message });
    }
    logger.error('[groups] Failed to add members:', error);
    res.status(500).json({ message: 'Failed to add members' });
  }
});

router.delete('/:id/members/:userId', async (req, res) => {
  try {
    const { id, userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid group id' });
    }

    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (group.source !== 'local') {
      return res.status(400).json({ message: 'Only local groups can be modified' });
    }

    await removeUserFromGroup(userId, id);

    const updatedGroup = await Group.findById(id).lean();
    const members = await getGroupMembers(updatedGroup?.memberIds || []);

    res.status(200).json({ group: formatGroup(updatedGroup), members });
  } catch (error) {
    if (error?.message?.includes('User not found')) {
      return res.status(404).json({ message: error.message });
    }
    logger.error('[groups] Failed to remove member:', error);
    res.status(500).json({ message: 'Failed to remove member' });
  }
});

module.exports = router;
