#!/usr/bin/env node
const { randomBytes, scrypt: scryptCallback } = require('node:crypto');
const { promisify } = require('node:util');
const postgres = require('postgres');

const scrypt = promisify(scryptCallback);

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

async function main() {
  const {
    DATABASE_URL,
    ADMIN_BOOTSTRAP_EMAIL,
    ADMIN_BOOTSTRAP_PASSWORD,
    ADMIN_BOOTSTRAP_NAME,
  } = process.env;

  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL is required.');
  }

  const sql = postgres(DATABASE_URL, { prepare: false });

  try {
    const existingOwner = await sql`
      select id
      from staff_users
      where role = 'owner'
      limit 1
    `;

    if (existingOwner.length > 0) {
      console.log('Bootstrap skipped: an owner already exists.');
      return;
    }

    if (!ADMIN_BOOTSTRAP_EMAIL || !ADMIN_BOOTSTRAP_PASSWORD || !ADMIN_BOOTSTRAP_NAME) {
      console.log('Bootstrap skipped: ADMIN_BOOTSTRAP_EMAIL/PASSWORD/NAME are required.');
      return;
    }

    const passwordHash = await hashPassword(ADMIN_BOOTSTRAP_PASSWORD);

    await sql`
      insert into staff_users (email, name, role, password_hash, is_active)
      values (${ADMIN_BOOTSTRAP_EMAIL.toLowerCase()}, ${ADMIN_BOOTSTRAP_NAME}, 'owner', ${passwordHash}, true)
    `;

    console.log('Bootstrap owner created.');
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
