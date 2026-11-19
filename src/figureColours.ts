// Body colours of the 3D device figures: every device comes in warm white and soft coral. The scene
// takes a colour per figure, so once a device reports its colour the app can show the right one;
// until then each model shows its usual colour (DEFAULT_COLOUR).
export type DeviceColour='white'|'coral';
export type FigureKind='desk'|'mini'|'printer';
export const DEVICE_COLOURS:readonly DeviceColour[]=['white','coral'];
export const COLOUR_LABEL:Record<DeviceColour,string>={white:'Warm white',coral:'Soft coral'};

// plastic: the printed body. Mini only: blush, the faint cheeks under its screen. Printer only:
// shell (the back, sides and ears behind the white front), with the vent holes and LED body toned
// to match it.
export type FigurePalette={plastic:number;blush?:number;shell?:number;holes?:number;led?:number};
const CORAL=0xd8684f,WHITE=0xf3f1ec;
export const FIGURE_PALETTES:Record<FigureKind,Record<DeviceColour,FigurePalette>>={
 desk:{white:{plastic:WHITE},coral:{plastic:CORAL}},
 mini:{white:{plastic:WHITE,blush:0xf2cfc4},coral:{plastic:CORAL,blush:0xe9846f}},
 printer:{
  white:{plastic:0xffffff,shell:0xa9e5e3,holes:0x5a6d6c,led:0xdff3f1},
  coral:{plastic:0xffffff,shell:0xec9a82,holes:0x7d5b52,led:0xf7e4dd},
 },
};
export const DEFAULT_COLOUR:Record<FigureKind,DeviceColour>={desk:'coral',mini:'white',printer:'white'};
export const figurePalette=(model:FigureKind,colour:DeviceColour=DEFAULT_COLOUR[model])=>FIGURE_PALETTES[model][colour]??FIGURE_PALETTES[model][DEFAULT_COLOUR[model]];
