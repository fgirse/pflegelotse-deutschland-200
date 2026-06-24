// Test-Umgebungsvariablen, damit module-weite env-Validierung (src/lib/env.ts)
// in Unit-Tests nicht scheitert. Werte sind reine Dummys.
process.env.DATABASE_URI ||=
  'mongodb://localhost:27018/pflege_test?replicaSet=rs0&directConnection=true'
process.env.PAYLOAD_SECRET ||= 'test-secret'
// 32 Null-Bytes als Base64 — gültige Länge für AES-256.
process.env.ENCRYPTION_MASTER_KEY ||= Buffer.alloc(32, 7).toString('base64')
process.env.AUDIT_PEPPER ||= 'test-pepper'
process.env.AUDIT_PEPPER_VERSION ||= '2026-test'
