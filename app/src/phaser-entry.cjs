// Select existing Phaser modules; no game-engine functionality is reimplemented here.
const P = require('phaser/src/const');
P.Game = require('phaser/src/core/Game');
P.Scene = require('phaser/src/scene/Scene');
P.Scale = require('phaser/src/scale');
if (__BUILD_PROFILE__ === 'playtest') {
  P.Sound = { WebAudioSoundManager: require('phaser/src/sound/webaudio/WebAudioSoundManager') };
  P.Curves = { CubicBezier: require('phaser/src/curves/CubicBezierCurve') };
  P.Math = { RotateAroundDistance:require('phaser/src/math/RotateAroundDistance'), Distance:{BetweenPoints:require('phaser/src/math/distance/DistanceBetweenPoints'),BetweenPointsSquared:require('phaser/src/math/distance/DistanceBetweenPointsSquared')}, RandomDataGenerator: require('phaser/src/math/random-data-generator/RandomDataGenerator'), Vector2: require('phaser/src/math/Vector2'), Clamp: require('phaser/src/math/Clamp'), FloatBetween: require('phaser/src/math/FloatBetween'), Angle: { Between: require('phaser/src/math/angle/Between') } };
  require('phaser/src/tweens/TweenManager');
  require('phaser/src/gameobjects/tilesprite/TileSpriteFactory');
  require('phaser/src/gameobjects/text/TextFactory');
  require('phaser/src/gameobjects/container/ContainerFactory');
  require('phaser/src/gameobjects/particles/ParticleEmitterFactory');
  P.Geom = { Line: require('phaser/src/geom/line/Line'), Circle: require('phaser/src/geom/circle/Circle'),
    Intersects: { LineToCircle: require('phaser/src/geom/intersects/LineToCircle'), RectangleToRectangle:require('phaser/src/geom/intersects/RectangleToRectangle') } };
}
if (__BUILD_PROFILE__ === 'playtest') P.GameObjects={Image:require('phaser/src/gameobjects/image/Image')};
P.Physics = { Arcade: { Sprite: require('phaser/src/physics/arcade/ArcadeSprite') } };
if (__BUILD_PROFILE__ === 'playtest') {
  P.Geom.Circle.Contains = require('phaser/src/geom/circle/Contains');
  P.Geom.Line.GetNearestPoint = require('phaser/src/geom/line/GetNearestPoint');
}
P.Geom = Object.assign(P.Geom || {}, { Rectangle: require('phaser/src/geom/rectangle/Rectangle') });
P.Geom.Rectangle.Contains = require('phaser/src/geom/rectangle/Contains');
P.Geom.Rectangle.ContainsRect = require('phaser/src/geom/rectangle/ContainsRect');
require('phaser/src/physics/arcade/ArcadePhysics');
require('phaser/src/events/EventEmitter');
require('phaser/src/cameras/2d/CameraManager');
require('phaser/src/gameobjects/GameObjectCreator');
require('phaser/src/gameobjects/GameObjectFactory');
require('phaser/src/gameobjects/DisplayList');
require('phaser/src/gameobjects/UpdateList');
require('phaser/src/scene/ScenePlugin');
require('phaser/src/input/InputPlugin');
require('phaser/src/input/keyboard/KeyboardPlugin');
require('phaser/src/time/Clock');
require('phaser/src/gameobjects/graphics/GraphicsFactory');
require('phaser/src/gameobjects/sprite/SpriteFactory');
require('phaser/src/gameobjects/image/ImageFactory');
require('phaser/src/gameobjects/group/GroupFactory');
module.exports = P;
