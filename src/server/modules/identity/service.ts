import { createLocalAccountIssuer } from "@better-auth/core/db";
import { createEmailVerificationToken } from "better-auth/api";
import { and, eq, isNull, sql } from "drizzle-orm";

import { type AppDb } from "../../../db";
import {
  invitations,
  humanPrincipals,
  principals,
  systemRoleGrants,
  systemRoles,
} from "../../../db/domain-schema";
import { type AuthInstance } from "../../auth";
import { M1Error } from "../errors";
import { normalizeEmail, type ManagedUser } from "../../shared/infrastructure";

export type ExpireInvitation = (
  database: AppDb,
  invitationId: string,
  now: number,
) => Promise<void>;

export async function ensureControlledUser(
  auth: AuthInstance,
  email: string,
  name: string,
  password: string,
  existingUserId?: string | null,
  allowExistingCredential = false,
  existingSince?: number | null,
): Promise<ManagedUser> {
  const context = await auth.$context;
  let user = existingUserId ? await context.internalAdapter.findUserById(existingUserId) : null;

  if (!user) {
    const existing = await context.internalAdapter.findUserByEmail(email, {
      includeAccounts: true,
    });
    user = existing?.user ?? null;
    if (
      user &&
      !allowExistingCredential &&
      existing?.accounts.some((account) => account.providerId === "credential")
    ) {
      const createdAt = new Date(user.createdAt).getTime();
      if (!existingSince || createdAt < existingSince) throw new M1Error(409);
    }
  }
  if (user && normalizeEmail(user.email) !== email) throw new M1Error(409);

  if (!user) {
    const passwordHash = await context.password.hash(password);
    try {
      user = await context.internalAdapter.createUser(
        { email, emailVerified: false, name },
        { method: "email-password" },
      );
    } catch {
      user =
        (await context.internalAdapter.findUserByEmail(email, { includeAccounts: true }))?.user ??
        null;
      if (!user) throw new M1Error(500);
    }

    try {
      await context.internalAdapter.linkAccount({
        accountId: user.id,
        issuer: createLocalAccountIssuer("credential"),
        password: passwordHash,
        providerId: "credential",
        userId: user.id,
      });
    } catch {
      if (!(await context.internalAdapter.findCredentialAccount(user.id))) throw new M1Error(500);
    }
  } else {
    const credential = await context.internalAdapter.findCredentialAccount(user.id);
    if (!credential) {
      const passwordHash = await context.password.hash(password);
      try {
        await context.internalAdapter.linkAccount({
          accountId: user.id,
          issuer: createLocalAccountIssuer("credential"),
          password: passwordHash,
          providerId: "credential",
          userId: user.id,
        });
      } catch {
        if (!(await context.internalAdapter.findCredentialAccount(user.id))) throw new M1Error(500);
      }
    } else if (allowExistingCredential) {
      const passwordHash = await context.password.hash(password);
      await context.internalAdapter.updatePassword(user.id, passwordHash);
    }
  }

  return user as ManagedUser;
}

export async function sendVerificationEmail(auth: AuthInstance, user: ManagedUser) {
  if (user.emailVerified) return;
  const context = await auth.$context;
  const send = context.options.emailVerification?.sendVerificationEmail;
  if (!send) return;

  const token = await createEmailVerificationToken(context.secret, user.email);
  const callbackURL = encodeURIComponent("/sign-in");
  const url = `${context.baseURL}/verify-email?token=${token}&callbackURL=${callbackURL}`;
  await send({ user, token, url });
}

export async function readHumanMapping(database: AppDb, userId: string) {
  const row = await database
    .select({
      id: principals.id,
      type: principals.type,
      principalStatus: principals.status,
      userId: humanPrincipals.userId,
      humanStatus: humanPrincipals.status,
      disabled: humanPrincipals.disabled,
    })
    .from(humanPrincipals)
    .innerJoin(principals, eq(principals.id, humanPrincipals.principalId))
    .where(eq(humanPrincipals.userId, userId))
    .get();

  return row
    ? {
        id: row.id,
        type: row.type,
        principal_status: row.principalStatus,
        user_id: row.userId,
        human_status: row.humanStatus,
        disabled: row.disabled ? 1 : 0,
      }
    : undefined;
}

export async function ensureHumanPrincipal(
  database: AppDb,
  userId: string,
  now: number,
  allowDisabled = false,
  invitationId?: string,
  expireInvalidInvitation?: ExpireInvitation,
) {
  const principalId = `human_${userId}`;
  const existingMapping = await readHumanMapping(database, userId);
  if (existingMapping && existingMapping.id !== principalId) throw new M1Error(409);
  if (
    existingMapping &&
    (existingMapping.type !== "human" ||
      (!allowDisabled &&
        (existingMapping.principal_status !== "active" ||
          existingMapping.human_status !== "active" ||
          existingMapping.disabled !== 0)))
  ) {
    throw new M1Error(409);
  }

  const existingPrincipal = await database
    .select({ id: principals.id, type: principals.type, status: principals.status })
    .from(principals)
    .where(eq(principals.id, principalId))
    .get();
  if (
    existingPrincipal &&
    (existingPrincipal.type !== "human" ||
      (!allowDisabled && existingPrincipal.status !== "active"))
  ) {
    throw new M1Error(409);
  }
  const needsReactivation =
    existingPrincipal?.status === "disabled" ||
    Boolean(
      existingMapping &&
      (existingMapping.human_status !== "active" || existingMapping.disabled !== 0),
    );
  if (allowDisabled && needsReactivation && existingPrincipal) {
    const existingRootGrant = await database
      .select({ id: systemRoleGrants.id })
      .from(systemRoleGrants)
      .innerJoin(systemRoles, eq(systemRoles.id, systemRoleGrants.roleId))
      .where(
        and(
          eq(systemRoleGrants.principalId, principalId),
          isNull(systemRoleGrants.revokedAt),
          eq(systemRoles.key, "root"),
        ),
      )
      .get();
    if (existingRootGrant) throw new M1Error(409);
  }

  if (invitationId) {
    const activeClaim = database
      .select({ value: sql<number>`1` })
      .from(invitations)
      .where(
        and(
          eq(invitations.id, invitationId),
          eq(invitations.status, "claimed"),
          sql`${invitations.expiresAt} > ${now}`,
        ),
      );
    await database.batch([
      database
        .insert(principals)
        .select(
          sql`SELECT
            ${principalId},
            'human',
            'active',
            NULL,
            ${now},
            ${now}
           FROM (SELECT 1)
           WHERE EXISTS ${activeClaim}`,
        )
        .onConflictDoUpdate({
          target: principals.id,
          set: { status: "active", disabledAt: null, updatedAt: now },
        }),
      database
        .insert(humanPrincipals)
        .select(
          sql`SELECT
            ${principalId},
            ${userId},
            'active',
            0,
            NULL,
            ${now},
            ${now}
           FROM (SELECT 1)
           WHERE EXISTS ${activeClaim}`,
        )
        .onConflictDoUpdate({
          target: humanPrincipals.principalId,
          set: {
            userId,
            status: "active",
            disabled: false,
            disabledAt: null,
            updatedAt: now,
          },
        }),
    ]);
    const activeClaimResult = await database
      .select({ ok: sql<number>`1` })
      .from(invitations)
      .where(
        and(
          eq(invitations.id, invitationId),
          eq(invitations.status, "claimed"),
          sql`${invitations.expiresAt} > ${Date.now()}`,
        ),
      )
      .get();
    if (activeClaimResult?.ok !== 1) {
      if (!expireInvalidInvitation) throw new M1Error(500);
      await expireInvalidInvitation(database, invitationId, Date.now());
      throw new M1Error(409);
    }
  } else {
    await database.batch([
      database
        .insert(principals)
        .values({
          id: principalId,
          type: "human",
          status: "active",
          disabledAt: null,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: principals.id,
          set: { disabledAt: null, status: "active", updatedAt: now },
        }),
      database
        .insert(humanPrincipals)
        .values({
          principalId,
          userId,
          status: "active",
          disabled: false,
          disabledAt: null,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: humanPrincipals.principalId,
          set: { disabled: false, disabledAt: null, status: "active", userId, updatedAt: now },
        }),
    ]);
  }

  const mapping = await readHumanMapping(database, userId);
  if (
    !mapping ||
    mapping.id !== principalId ||
    mapping.principal_status !== "active" ||
    mapping.human_status !== "active" ||
    mapping.disabled !== 0
  ) {
    throw new M1Error(500);
  }

  return principalId;
}
