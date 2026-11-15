import { createHmac } from "node:crypto"

export type JwtClaims = Record<string, string | number>

export function signJwt(claims: JwtClaims, secret: string) {
  const header = encode({ alg: "HS256", typ: "JWT" })
  const payload = encode(claims)
  const signature = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url")
  const token = `${header}.${payload}.${signature}`
  return token
}

function encode(value: object) {
  const json = JSON.stringify(value)
  const encoded = Buffer.from(json).toString("base64url")
  return encoded
}
