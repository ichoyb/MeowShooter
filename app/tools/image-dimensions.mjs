import assert from 'node:assert/strict';

// Build-time metadata only. The browser must still decode the actual image.
export function imageDimensions(data, extension) {
  let width, height;
  const invalid = () => assert.fail('Invalid image metadata: ' + extension);
  try {
    if (extension === '.png') {
      if (data.subarray(0,8).toString('hex') !== '89504e470d0a1a0a' || data.toString('ascii',12,16) !== 'IHDR') invalid();
      width=data.readUInt32BE(16);height=data.readUInt32BE(20);
    } else if (extension === '.svg') {
      const tag=data.toString().match(/<svg\b[^>]*>/)?.[0]||'';
      width=Number(tag.match(/\bwidth="(\d+)"/)?.[1]);height=Number(tag.match(/\bheight="(\d+)"/)?.[1]);
    } else if (extension === '.gif') {
      if (!/^GIF8[79]a$/.test(data.toString('ascii',0,6))) invalid();
      width=data.readUInt16LE(6);height=data.readUInt16LE(8);
    } else if (extension === '.webp') {
      if (data.toString('ascii',0,4)!=='RIFF'||data.toString('ascii',8,12)!=='WEBP') invalid();
      for(let p=12;p+8<=data.length;){
        const kind=data.toString('ascii',p,p+4),size=data.readUInt32LE(p+4),start=p+8;
        if(start+size>data.length)invalid();
        if(kind==='VP8X'){width=1+data.readUIntLE(start+4,3);height=1+data.readUIntLE(start+7,3);break;}
        if(kind==='VP8 '){
          if(data.toString('hex',start+3,start+6)!=='9d012a')invalid();
          width=data.readUInt16LE(start+6)&0x3fff;height=data.readUInt16LE(start+8)&0x3fff;break;
        }
        if(kind==='VP8L'){
          if(data[start]!==0x2f)invalid();
          const bits=data.readUInt32LE(start+1);width=(bits&0x3fff)+1;height=((bits>>>14)&0x3fff)+1;break;
        }
        p=start+size+(size&1);
      }
    } else if (extension === '.jpg'||extension === '.jpeg') {
      if(data[0]!==0xff||data[1]!==0xd8)invalid();
      for(let p=2;p+3<data.length;){
        if(data[p++]!==0xff)invalid();
        while(data[p]===0xff)p++;
        const marker=data[p++];
        if(marker===0xd9||marker===0xda)break;
        if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
        const size=data.readUInt16BE(p);
        if(size<2||p+size>data.length)invalid();
        if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){
          height=data.readUInt16BE(p+3);width=data.readUInt16BE(p+5);break;
        }
        p+=size;
      }
    } else invalid();
  } catch(error) {
    if(error.code==='ERR_ASSERTION')throw error;
    invalid();
  }
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<=0||height<=0)invalid();
  return {width,height};
}
