import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

test('the budget reads real PNG, JPEG, SVG and WebP metadata instead of assuming SVG',async()=>{
  const url=new URL('../tools/image-dimensions.mjs',import.meta.url);
  assert.ok(existsSync(url),'all delivered raster formats require real dimensions');
  const {imageDimensions}=await import(url.href);
  assert.deepEqual(imageDimensions(readFileSync('assets/r1-restoration/native/courtyard-native-v01.png'),'.png'),{width:887,height:1774});
  assert.deepEqual(imageDimensions(readFileSync('assets/ui/W01.svg'),'.svg'),{width:84,height:84});
  assert.deepEqual(imageDimensions(readFileSync('assets/r1-restoration/entry-scene.jpeg'),'.jpeg'),{width:512,height:505});
  const webp=Buffer.alloc(30);webp.write('RIFF',0);webp.writeUInt32LE(22,4);webp.write('WEBPVP8X',8);webp.writeUInt32LE(10,16);webp.writeUIntLE(886,24,3);webp.writeUIntLE(1773,27,3);
  assert.deepEqual(imageDimensions(webp,'.webp'),{width:887,height:1774});
  assert.throws(()=>imageDimensions(Buffer.from('not an image'),'.png'),/image/i);
  assert.throws(()=>imageDimensions(Buffer.from('not an image'),'.webp'),/image/i);
});
