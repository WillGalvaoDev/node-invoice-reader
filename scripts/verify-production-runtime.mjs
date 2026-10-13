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

// O renderer de PDFs depende de dados de fonte do pdfkit: exercita-o com apenas
// dependencies instaladas, para que ausência de arquivo apareça no CI e não em /demo.
const { renderDemoDocument } = await import('../src/demo/demo-pdf.renderer.js');
const { buildDemoInvoice } = await import('../src/demo/demo-scenario.js');
const pdf = await renderDemoDocument(buildDemoInvoice('initial', 'runtime-check'));
if (pdf.subarray(0, 5).toString('latin1') !== '%PDF-') {
  throw new Error('Renderer de PDFs de demonstração não produziu um PDF válido.');
}

process.stdout.write('Production runtime dependency graph loaded successfully.\n');
