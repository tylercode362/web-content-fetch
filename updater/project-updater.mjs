#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {repositoryMain, PROJECT_IDS, safeRepositoryError} from './lib/repository-polling.mjs';
const identity=JSON.parse(await readFile(new URL('./project.json',import.meta.url),'utf8'));
if(Object.keys(identity).sort().join(',')!=='project,version'||identity.version!==1||!PROJECT_IDS.includes(identity.project))throw new Error('invalid_project_identity');
repositoryMain(process.argv.slice(2),{projectId:identity.project}).catch(error=>{process.stderr.write(JSON.stringify(safeRepositoryError(error))+'\n');process.exitCode=1;});
