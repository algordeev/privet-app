// Scene windows (seconds) and the voiceover lines, which are also the subtitles.
// The voice lines are timed to the recorded voiceover (promo/audio.py writes out/voice.json; the
// starts here are where each line begins).
export const FPS=30,DURATION=60;
export const TIMELINE={
 open:[0,6.2],
 lesson:[6.2,16],right:8.6,miss:11.4,
 print:[16,21.6],
 printer:[21.6,25.6],
 fridge:[25.6,30.4],
 celebrate:[30.4,37],
 miniHome:[37,40],
 mini:[40,51],flip:43.4,knew:46,sync:47,
 montage:[51,56],
 end:[56,60],
 subtitles:[
  [0.5,4.8,'Meet Privet. Real Russian, in just a few minutes a day.'],
  [6.3,9.6,'Bite-sized lessons teach phrases you’ll actually use.'],
  [9.7,12.4,'Get one right, and your desk buddy cheers you on.'],
  [12.6,15.4,'Miss one? It’s got your back.'],
  [16.4,18.6,'Love a word? Print it.'],
  [18.8,24.6,'Your little printer turns it into a card for the fridge, so you see it every morning.'],
  [30.6,33.4,'Finish a lesson, and celebrate together.'],
  [37.2,40.6,'On the go? Meet Privet Mini, the keychain version.'],
  [41.6,46.6,'It carries your review words, so you can practice anywhere,'],
  [46.9,50.4,'and it syncs back when you’re home.'],
  [51.2,54.8,'No account. No ads. Just a little progress every day.'],
  [56.4,59.6,'Privet. A little Russian. A little every day.'],
 ] as [number,number,string][],
} as const;
