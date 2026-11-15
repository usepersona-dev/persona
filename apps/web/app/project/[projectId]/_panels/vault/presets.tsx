
export type StartField = { name: string; secret: boolean }

// What a new credential can start as, from the New menu. The fields and which ones are secret are set here, so nobody has to guess them, and all of it can change before the credential is saved.
// No field that is often left empty, since the vault counts empty fields as missing. A field named like API_KEY also goes into the sandbox as an environment variable.
export const PRESETS: { key: string; label: string; fields: StartField[] }[] = [
  { key: "login", label: "Login", fields: [{ name: "username", secret: false }, { name: "password", secret: true }] },
  { key: "card", label: "Card", fields: [{ name: "name on card", secret: false }, { name: "card number", secret: true }, { name: "exp month", secret: false }, { name: "exp year", secret: false }, { name: "cvv", secret: true }, { name: "billing zip", secret: false }] },
  { key: "address", label: "Address", fields: [{ name: "full name", secret: false }, { name: "street", secret: false }, { name: "city", secret: false }, { name: "state", secret: false }, { name: "zip", secret: false }, { name: "country", secret: false }, { name: "phone", secret: false }] },
  { key: "key", label: "API key", fields: [{ name: "API_KEY", secret: true }] },
]

// Blank starts with one field, secret until it is unlocked
export const BLANK: StartField[] = [{ name: "", secret: true }]
