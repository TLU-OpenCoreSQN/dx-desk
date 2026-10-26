// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { required } from './config';
import type { UserClaims } from './auth';

@Injectable()
export class Database implements OnModuleInit, OnModuleDestroy {
  readonly pool = new Pool({
    connectionString: required('DATABASE_URL'),
    max: Number(process.env.DB_POOL_MAX ?? 10),
    connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000,
  });
  constructor() {
    this.pool.on('error', () => {
      // Do not log SQL, connection strings or user claims.
      console.error('Idle PostgreSQL connection failed.');
    });
  }
  async onModuleInit() {
    const result = await this.pool.query(
      `SELECT r.rolsuper, r.rolbypassrls, r.rolinherit,
        pg_has_role(current_user, 'authenticated', 'MEMBER') AS member
       FROM pg_roles r WHERE r.rolname = current_user`,
    );
    const role = result.rows[0];
    if (!role || role.rolsuper || role.rolbypassrls || role.rolinherit || !role.member) {
      throw new Error('API database login must be NOINHERIT, NOBYPASSRLS, non-superuser and a member of authenticated.');
    }
  }
  async asUser<T>(claims: UserClaims, operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    let discard = false;
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE authenticated');
      // set_config(..., true) is the parameterized equivalent of SET LOCAL.
      await client.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
      await client.query("SET LOCAL statement_timeout = '5s'");
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { discard = true; }
      throw error;
    } finally {
      client.release(discard);
    }
  }
  async onModuleDestroy() { await this.pool.end(); }
}
