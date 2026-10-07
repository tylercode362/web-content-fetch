// Owner-invoked host installation/migration only. Never included in runtime image.
import {constants} from 'node:fs';
import {access, lstat, mkdir, open, rename, rmdir, unlink} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {PROJECT_IDS, DEFAULT_PATHS, parseRepositoryEnv, validateHostKey, executeBounded, confirmOwner} from './repository-polling.mjs';

const fail = code => {throw new Error(code);};
async function directory(path) {
  if (!path.startsWith('/') || resolve(path)!==path) fail('unsafe_directory');
  for(let p=path;;p=dirname(p)) {
    const s=await lstat(p);
    if(!s.isDirectory()||s.isSymbolicLink()||![0,process.getuid()].includes(s.uid)||(s.mode&0o022)||(p===path&&(s.uid!==process.getuid()||(s.mode&0o7777)!==0o700))) fail('unsafe_directory');
    if(p==='/') break;
  }
}
async function read(path) {
  let before;try{before=await lstat(path);}catch(e){if(e.code==='ENOENT')return null;throw e;}
  if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1||before.uid!==process.getuid()||(before.mode&0o7777)!==0o600||before.size>32768)fail('unsafe_file');
  const fd=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try {
    const after=await fd.stat();
    if(after.ino!==before.ino||after.dev!==before.dev||after.size!==before.size||after.nlink!==1||(after.mode&0o7777)!==0o600||after.uid!==process.getuid())fail('unsafe_file');
    const buffer=Buffer.alloc(32769);const {bytesRead}=await fd.read(buffer,0,buffer.length,0);
    if(bytesRead!==before.size)fail('unsafe_file');return buffer.subarray(0,bytesRead);
  }finally{await fd.close();}
}
async function write(path,bytes) {
  await read(path);const tmp=join(dirname(path),'.pending-'+randomBytes(12).toString('hex'));
  let fd;
  try{fd=await open(tmp,constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW|constants.O_WRONLY,0o600);await fd.writeFile(bytes);await fd.sync();await fd.close();fd=null;await rename(tmp,path);const dir=await open(dirname(path),constants.O_RDONLY|constants.O_DIRECTORY);try{await dir.sync();}finally{await dir.close();}}
  finally{if(fd)await fd.close();await unlink(tmp).catch(e=>{if(e.code!=='ENOENT')throw e;});}
}
async function lock(path,action) {
  try{await mkdir(path,{mode:0o700});}catch(e){if(e.code==='EEXIST')fail('migration_busy');throw e;}
  try{return await action();}finally{await rmdir(path);}
}
export async function establishProjectOwnership({project,paths,legacyPaths,execute=executeBounded,confirmed=false,dockerPath='/usr/local/bin/docker'}) {
  if(!confirmed)fail('confirmation_required');if(!PROJECT_IDS.includes(project))fail('invalid_project');
  if(!['/usr/local/bin/docker','/usr/bin/docker','/var/packages/ContainerManager/target/usr/bin/docker'].includes(dockerPath))fail('invalid_docker_path');
  for(const p of Object.values(paths))await directory(p);
  // The retired service's label is checked across every Compose project name.
  const result=await execute(dockerPath,['ps','-a','--filter','label=com.docker.compose.service=repository_worker','--format','{{.State}}'],{cwd:'/',env:{PATH:'/usr/bin:/bin',HOME:'/nonexistent',LANG:'C'},timeout:10000,maxBuffer:32768});
  const states=result.stdout.trim().split('\n').filter(Boolean);
  if(states.some(s=>!['exited','created','dead'].includes(s)))fail('legacy_worker_not_stopped');
  let legacyExists=false;try{await lstat(legacyPaths.config);legacyExists=true;}catch(e){if(e.code!=='ENOENT')throw e;}
  if(legacyExists)for(const p of Object.values(legacyPaths))await directory(p);
  const transfer=async()=>lock(join(paths.state,'.repository.lock'),async()=>{
    if(await read(join(paths.state,'updater-owner.json')))fail('already_owned');
    if(await read(join(paths.config,project+'.env')))fail('destination_not_empty');
    let config=legacyExists?await read(join(legacyPaths.config,project+'.env')):null;
    if(config) {
      // No accepted, terminal, or ambiguous work is silently discarded by migration.
      for(const p of [join(legacyPaths.state,'deploy-inbox'),join(legacyPaths.state,'source')]) {
        try{await directory(p);}catch(e){if(e.code!=='ENOENT')throw e;}
      }
      if(await read(join(legacyPaths.state,'deploy-inbox',project+'.json')))fail('legacy_deployment_requires_reconciliation');
      const parsed=parseRepositoryEnv(config,DEFAULT_PATHS);
      if(parsed.REPO_PROJECT_ID!==project)fail('invalid_config');
      await directory(join(legacyPaths.keys,project));
      const privateKey=await read(join(legacyPaths.keys,project,'id_ed25519'));
      const publicKey=await read(join(legacyPaths.keys,project,'id_ed25519.pub'));
      const hostKey=await read(join(legacyPaths.keys,'github_known_hosts'));
      if(!privateKey?.length||!publicKey?.length||!hostKey?.length)fail('setup_incomplete');validateHostKey(hostKey.toString());
      // Retire legacy authority first, while holding its original operation lock.
      const retired=config.toString().replace(/^REPO_POLL_ENABLED=.*$/m,'REPO_POLL_ENABLED=false').replace(/^REPO_DEPLOY_MODE=.*$/m,'REPO_DEPLOY_MODE=disabled');
      await write(join(legacyPaths.config,project+'.env'),retired);
      await mkdir(join(paths.keys,project),{mode:0o700});
      await write(join(paths.keys,project,'id_ed25519'),privateKey);
      await write(join(paths.keys,project,'id_ed25519.pub'),publicKey);
      if(await read(join(paths.keys,'github_known_hosts')))fail('destination_not_empty');
      await write(join(paths.keys,'github_known_hosts'),hostKey);
      await write(join(paths.config,project+'.env'),retired);
      // No verification, approval, pending work, or health is copied. Reverify explicitly.
    }
    await write(join(paths.state,'updater-owner.json'),JSON.stringify({version:1,project,mode:'independent',legacyRetired:true})+'\n');
    return {ok:true,status:config?'migrated_disabled':'initialized_disabled',project,pollingEnabled:false,deploymentEnabled:false};
  });
  return legacyExists?lock(join(legacyPaths.state,'.repository.lock'),transfer):transfer();
}
export async function ownershipMain(project) {
  if(!PROJECT_IDS.includes(project)||process.getuid()!==0)fail('owner_root_required');
  await confirmOwner(`ESTABLISH INDEPENDENT UPDATER ${project}`);
  const root=`/volume1/docker/${project}-updater-store`,legacy='/volume1/docker/local-gateway-repositories';
  const paths=Object.fromEntries(['config','keys','state'].map(n=>[n,join(root,n)]));
  const legacyPaths=Object.fromEntries(['config','keys','state'].map(n=>[n,join(legacy,n)]));
  let dockerPath;
  for(const candidate of ['/var/packages/ContainerManager/target/usr/bin/docker','/usr/local/bin/docker','/usr/bin/docker']) {
    try { await access(candidate,constants.X_OK); dockerPath=candidate; break; } catch {}
  }
  if(!dockerPath)fail('docker_unavailable');
  const result=await establishProjectOwnership({project,paths,legacyPaths,confirmed:true,dockerPath});
  console.log(JSON.stringify(result));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))ownershipMain(process.argv[2]).catch(()=>{console.error(JSON.stringify({ok:false,status:'ownership_setup_failed'}));process.exitCode=1;});
