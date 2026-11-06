import { createApp } from './app.js';
import { loadOptions } from './options.js';
const root = process.env.CONFIG_ROOT || '/config';
const options = await loadOptions();
const app = await createApp(root, { ingressOnly: process.env.INGRESS_ONLY === 'true', ...options });
app.listen(Number(process.env.PORT || 8099), process.env.HOST || '0.0.0.0', () => console.log(`HA Editor listening on port ${process.env.PORT || 8099}`));
