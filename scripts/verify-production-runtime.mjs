process.env.DATABASE_URL ||= 'postgresql://runtime_check:runtime_check@127.0.0.1:5432/docscan';
process.env.JWT_SECRET ||= 'runtime-check-secret-not-for-production';
process.env.GEMINI_API_KEY ||= 'runtime-check-gemini-key';
process.env.INVITE_CODE ||= 'runtime-check-invite-code';

const application = await import('../src/index.js');
if (typeof application.startApplication !== 'function') {
  throw new Error('Artefato de produção não exporta startApplication.');
}

await import('../src/app.js');
await import('../src/routes.js');

process.stdout.write('Production runtime dependency graph loaded successfully.\n');
