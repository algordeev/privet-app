import test from 'node:test';
import assert from 'node:assert/strict';
import {COLOUR_LABEL,DEFAULT_COLOUR,DEVICE_COLOURS,FIGURE_PALETTES,figurePalette,type FigureKind} from './figureColours.ts';

const kinds:FigureKind[]=['desk','mini','printer'];
test('every device has a warm white and a soft coral 3D palette, and they differ',()=>{
 for(const kind of kinds){
  for(const colour of DEVICE_COLOURS)assert.ok(Number.isInteger(FIGURE_PALETTES[kind][colour].plastic),`${kind} ${colour}`);
  const {white,coral}=FIGURE_PALETTES[kind];
  assert.notDeepEqual(white,coral,kind);
 }
 // The printer keeps its white front in both; only the shell, holes and LED body change.
 assert.equal(FIGURE_PALETTES.printer.white.plastic,FIGURE_PALETTES.printer.coral.plastic);
 assert.notEqual(FIGURE_PALETTES.printer.white.shell,FIGURE_PALETTES.printer.coral.shell);
 assert.deepEqual(COLOUR_LABEL,{white:'Warm white',coral:'Soft coral'});
});
test('without a reported colour each model keeps its usual look; a reported colour picks its palette',()=>{
 assert.deepEqual(DEFAULT_COLOUR,{desk:'coral',mini:'white',printer:'white'});
 for(const kind of kinds){
  assert.equal(figurePalette(kind),FIGURE_PALETTES[kind][DEFAULT_COLOUR[kind]]);
  for(const colour of DEVICE_COLOURS)assert.equal(figurePalette(kind,colour),FIGURE_PALETTES[kind][colour]);
 }
 // An unknown value (e.g. from newer firmware) falls back instead of breaking the figure.
 assert.equal(figurePalette('mini','teal' as never),FIGURE_PALETTES.mini.white);
});
