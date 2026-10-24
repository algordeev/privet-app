// Optional font-accurate check using an existing U8g2 installation. Nothing is
// downloaded or copied into the repository; all build output goes to temp.
import {companionCardFixtures} from './companion-card-fixtures.ts';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
const lib=process.argv[2]??process.env.PRIVET_U8G2_DIR;
if(!lib)throw Error('Pass the installed U8g2 library folder or set PRIVET_U8G2_DIR.');
const dir=mkdtempSync(join(tmpdir(),'privet-fonts-'));
function run(command,args,extra={}){const result=spawnSync(command,args,{encoding:'utf8',...extra});if(result.status!==0)throw Error(result.stdout+result.stderr+String(result.error??''));return result.stdout;}
try{
 const clib=resolve(lib,'src/clib'),objects=[];
 for(const name of ['u8g2_font','u8g2_fonts','u8x8_8x8']){const object=join(dir,name+'.o');run('cc',['-std=c99','-O2','-ffunction-sections','-fdata-sections','-I'+clib,'-c',join(clib,name+'.c'),'-o',object]);objects.push(object);}
 const binary=join(dir,'layout');run('c++',['-std=c++11','-I'+clib,'-Ifirmware/PrivetBLE_Servo_New_Emotions_v2','scripts/check-oled-layout.cpp',...objects,process.platform==='darwin'?'-Wl,-dead_strip':'-Wl,--gc-sections','-o',binary]);
 const input=companionCardFixtures().map(c=>c.primary+'\t'+c.secondary).join('\n')+'\n';process.stdout.write(run(binary,[],{input}));
}finally{rmSync(dir,{recursive:true,force:true});}
