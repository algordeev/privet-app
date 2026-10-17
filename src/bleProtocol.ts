// Version 1 wire format; commands 2–4 require updated firmware. Canonical UUIDs are shared by the transport and firmware docs.
export const BLE_SERVICE='7b5e0001-6d8a-4f3b-9c2e-1a0d8f6b4c91';
export const BLE_COMMAND='7b5e0002-6d8a-4f3b-9c2e-1a0d8f6b4c91';
export const BLE_STATUS='7b5e0003-6d8a-4f3b-9c2e-1a0d8f6b4c91';
export const BLE_NAME='Privet-ESP32';
let lastRequestId=0;
export function nextRequestId(){
 if(lastRequestId===0xffffffff)throw new Error('Request IDs exhausted. Restart Privet before testing again.');
 return ++lastRequestId;
}
export const COMMAND={HAPPY:1,ENCOURAGE:2,CELEBRATE:3,IDLE:4} as const;
export type CommandCode=typeof COMMAND[keyof typeof COMMAND];
export function encodeCommand(requestId:number,command:CommandCode):DataView {
 if(![1,2,3,4].includes(command))throw new Error('Invalid command');
 if(!Number.isInteger(requestId)||requestId<1||requestId>0xffffffff)throw new Error('Invalid request ID');
 const packet=new DataView(new ArrayBuffer(8));
 packet.setUint8(0,1);packet.setUint8(1,1);packet.setUint32(2,requestId,true);packet.setUint8(6,command);packet.setUint8(7,0);
 return packet;
}
export const encodeHappy=(requestId:number)=>encodeCommand(requestId,COMMAND.HAPPY);
export type Acknowledgement={requestId:number;command:CommandCode;result:0|1|2};
export function decodeAcknowledgement(packet:DataView):Acknowledgement|null {
 if(packet.byteLength!==8||packet.getUint8(0)!==1||packet.getUint8(1)!==2||![1,2,3,4].includes(packet.getUint8(6))||packet.getUint8(7)>2)return null;
 return {requestId:packet.getUint32(2,true),command:packet.getUint8(6) as CommandCode,result:packet.getUint8(7) as 0|1|2};
}
