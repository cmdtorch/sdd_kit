// Fake OpenAPI export for sdd-kit tests: copies the file named in fake-openapi-current.txt to argv[2].
import { copyFileSync, readFileSync } from 'node:fs';
copyFileSync(readFileSync('fake-openapi-current.txt', 'utf8').trim(), process.argv[2]);
