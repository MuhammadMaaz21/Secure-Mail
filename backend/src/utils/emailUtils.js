const TemporaryEmail = require('../models/TemporaryEmail');

function normalizeAddressList(list) {
  return (Array.isArray(list) ? list : []).map((e) => String(e).toLowerCase());
}

function getAllRecipientAddresses(email) {
  return [
    ...normalizeAddressList(email.to),
    ...normalizeAddressList(email.cc),
    ...normalizeAddressList(email.bcc),
  ];
}

async function getUserTempAddresses(userId, activeOnly = false) {
  const query = { userId };
  if (activeOnly) query.expiresAt = { $gt: new Date() };
  const temps = await TemporaryEmail.find(query).select('tempAddress');
  return temps.map((t) => t.tempAddress.toLowerCase());
}

/** User received this email on their main address or a disposable address they own. */
async function userIsRecipient(email, userId, userEmail) {
  const userEmailLower = (userEmail || '').toLowerCase();
  const addresses = getAllRecipientAddresses(email);
  if (addresses.includes(userEmailLower)) return true;
  if (addresses.length === 0) return false;

  const owned = await TemporaryEmail.findOne({
    userId,
    tempAddress: { $in: addresses },
  }).select('_id');

  return !!owned;
}

/** Sender or recipient (including disposable/temporary mail). */
async function userCanAccessEmail(email, userId, userEmail) {
  if (!email) return false;
  if (email.senderId && email.senderId.toString() === userId.toString()) return true;
  return userIsRecipient(email, userId, userEmail);
}

/** Mongo $or conditions for inbox/trash queries. */
async function buildRecipientAccessOr(userId, userEmail) {
  const tempAddresses = await getUserTempAddresses(userId, false);
  const conditions = [
    { to: userEmail.toLowerCase() },
    { cc: userEmail.toLowerCase() },
    { bcc: userEmail.toLowerCase() },
  ];
  if (tempAddresses.length > 0) {
    conditions.push(
      { to: { $in: tempAddresses } },
      { cc: { $in: tempAddresses } },
      { bcc: { $in: tempAddresses } }
    );
  }
  return conditions;
}

module.exports = {
  userIsRecipient,
  userCanAccessEmail,
  getUserTempAddresses,
  buildRecipientAccessOr,
};
