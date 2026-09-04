import { describe, expect, test } from "bun:test";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { createSupabaseVerifier } from "../../src/notos/auth/supabase-jwt";

/**
 * NOTOS: verifying a Supabase access token against a key set (stap 1).
 *
 * A self-signed ES256 pair stands in for the project's JWKS. What is held here is the contract
 * `mge-platform/src/api/auth.py` holds too: ES256 only, the issuer and audience must match, and a
 * token from another project (another key) is refused.
 */

const ISSUER = "https://project.supabase.test/auth/v1";
const SETTINGS = {
  issuer: ISSUER,
  audience: "authenticated",
  jwksUrl: `${ISSUER}/.well-known/jwks.json`,
};

async function keyed() {
  const { publicKey, privateKey } = await generateKeyPair("ES256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "ES256" };
  const getKey = createLocalJWKSet({ keys: [jwk] });
  const sign = (
    claims: Record<string, unknown>,
    options: { issuer?: string; audience?: string; alg?: string } = {},
  ) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: "ES256", kid: "k1" })
      .setIssuer(options.issuer ?? ISSUER)
      .setAudience(options.audience ?? "authenticated")
      .setSubject(String(claims.sub ?? "user-1"))
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);
  return { getKey, sign, privateKey };
}

describe("verifying a NOTOS token", () => {
  test("a good token yields the person, lower-cased, with what the metadata says about them", async () => {
    const { getKey, sign } = await keyed();
    const verify = createSupabaseVerifier(SETTINGS, getKey);
    const token = await sign({
      sub: "user-1",
      email: "Mitch@ZUID.com",
      session_id: "sess-1",
      user_metadata: {
        full_name: "Mitch Verkuil",
        avatar_url: "https://example.test/mitch.png",
      },
    });
    await expect(verify(token)).resolves.toEqual({
      id: "user-1",
      email: "mitch@zuid.com",
      sessionId: "sess-1",
      name: "Mitch Verkuil",
      image: "https://example.test/mitch.png",
    });
  });

  test("a token signed by another project is refused", async () => {
    const ours = await keyed();
    const theirs = await keyed();
    const verify = createSupabaseVerifier(SETTINGS, ours.getKey);
    const token = await theirs.sign({ sub: "user-1", email: "x@zuid.com" });
    await expect(verify(token)).rejects.toThrow();
  });

  test("the wrong issuer or audience is refused", async () => {
    const { getKey, sign } = await keyed();
    const verify = createSupabaseVerifier(SETTINGS, getKey);
    await expect(
      verify(
        await sign(
          { sub: "user-1", email: "x@zuid.com" },
          { issuer: "https://other.supabase.test/auth/v1" },
        ),
      ),
    ).rejects.toThrow();
    await expect(
      verify(
        await sign(
          { sub: "user-1", email: "x@zuid.com" },
          { audience: "anon" },
        ),
      ),
    ).rejects.toThrow();
  });

  test("a token without an email is refused, even when otherwise valid", async () => {
    const { getKey, sign } = await keyed();
    const verify = createSupabaseVerifier(SETTINGS, getKey);
    await expect(verify(await sign({ sub: "user-1" }))).rejects.toThrow(
      "no subject or no email",
    );
  });

  test("an expired token is refused", async () => {
    const { getKey, privateKey } = await keyed();
    const verify = createSupabaseVerifier(SETTINGS, getKey);
    const token = await new SignJWT({ email: "x@zuid.com" })
      .setProtectedHeader({ alg: "ES256", kid: "k1" })
      .setIssuer(ISSUER)
      .setAudience("authenticated")
      .setSubject("user-1")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 300)
      .sign(privateKey);
    await expect(verify(token)).rejects.toThrow();
  });
});
