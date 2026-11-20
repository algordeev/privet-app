// Which shell to render: the iPhone app, or the website with the café demo.
// Inside the native app it is always the phone layout. In a browser, adding
// ?native=1 to the URL previews the phone screens too, so they can be tested
// without a Mac (Bluetooth is not available in that preview).
export function wantsPhoneLayout(isNative:boolean,search:string):boolean{
 if(isNative)return true;
 return new URLSearchParams(search).get('native')==='1';
}
