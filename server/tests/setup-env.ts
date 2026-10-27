import os from 'node:os';
import path from 'node:path';

// Antes de importar la app: uploads a una carpeta temporal.
process.env.UPLOAD_DIR ??= path.join(os.tmpdir(), 'foro-utn-test-uploads');
