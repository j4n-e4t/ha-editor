import { createApp } from './app.js';
const root = process.env.CONFIG_ROOT || '/config';
const app = await createApp(root, { ingressOnly: process.env.INGRESS_ONLY === 'true' });
app.listen(Number(process.env.PORT || 8099), process.env.HOST || '0.0.0.0', () => console.log(`HA Editor listening on port ${process.env.PORT || 8099}`));
