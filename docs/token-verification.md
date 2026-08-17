# Shui downstream token verification

This guide describes the checks a downstream Application should perform for tokens issued by Shui.

## Provider metadata

The canonical issuer is the Shui public base URL followed by `/api/auth`.

For an issuer such as `https://identity.example.com/api/auth`, use:

- OpenID configuration: `https://identity.example.com/api/auth/.well-known/openid-configuration`
- JWKS: `https://identity.example.com/api/auth/jwks`
- UserInfo: `https://identity.example.com/api/auth/oauth2/userinfo`

Load the issuer and JWKS from discovery, cache the JWKS according to its cache headers, and refresh it
when a token uses an unknown key ID. Do not copy signing keys into the downstream Application.

## Required JWT checks

The Application's OAuth Resource identifier is the Access Token audience. Verify all of the following
before accepting a request:

1. The JWT signature matches a key from the issuer's JWKS.
2. `iss` exactly matches the configured Shui issuer.
3. `aud` contains exactly the Application Resource identifier expected by this service.
4. `exp` is in the future; also reject a token with an invalid `nbf` or `iat` when the verifier checks
   those claims.
5. `scope` contains the scope required by the endpoint, such as `api:read`.
6. `typ` is the JWT access-token type advertised by discovery, when the verifier enforces it.

Do not use the ID Token as an API bearer token. ID Tokens are for the OIDC client and have the client ID
as their audience; API endpoints must accept an Access Token whose audience is the Application Resource.

Example with `jose`:

```ts
import { createRemoteJWKSet, jwtVerify } from "jose";

const issuer = "https://identity.example.com/api/auth";
const resource = "https://identity.example.com/api/resources/application_123";
const jwks = createRemoteJWKSet(new URL(`${issuer}/jwks`));

const { payload } = await jwtVerify(accessToken, jwks, {
  issuer,
  audience: resource,
});

if (typeof payload.scope !== "string" || !payload.scope.split(" ").includes("api:read")) {
  throw new Error("required scope is missing");
}
```

The verifier must reject an unknown resource, a token with another Application as its audience, and a
token without an audience. Shui rejects resource-less API token requests at the token endpoint as well.

## Shui claims

Shui claims use a URI namespace derived from the issuer's origin:

```text
https://identity.example.com/claims/
```

The claim names are:

| Claim                | Meaning                                           |
| -------------------- | ------------------------------------------------- |
| `.../application_id` | The target Shui Application ID                    |
| `.../principal_id`   | Stable Shui principal ID                          |
| `.../principal_type` | `user` or `service-account`                       |
| `.../roles`          | Effective Application Role keys                   |
| `.../teams`          | Team IDs relevant to this Application             |
| `.../authz_version`  | Authorization snapshot version used for the token |

Only the target Application's roles, teams, and identifier are emitted. A missing or suspended
Assignment, disabled Service Account, disabled credential, or disabled Application prevents new token
issuance.

For human authorization-code tokens, `sub` identifies the Better Auth User. For
`client_credentials`, `sub` identifies the OAuth Client credential. A Service Account integration must
use the namespaced `principal_id` claim for a stable machine identity: rotating a credential changes
`sub` but does not change `principal_id`.

## Service Account credential rotation

Service Account credentials use the OAuth `client_credentials` grant and `client_secret_basic`
authentication. The credential creation and rotation response contains the secret once; store it in a
secret manager and never log it. Listing credentials never returns a secret.

Rotation is deliberately overlapping:

1. Create or rotate to a new credential.
2. Deploy the new client ID and secret to the consumer.
3. Confirm the new credential is issuing tokens.
4. Disable the old credential.
5. Delete the old credential after the deployment has converged.

Request an access token with the Application Resource as `resource` and `api:read` (or another granted
scope). Always validate the resulting JWT using the same issuer and JWKS as human tokens.
