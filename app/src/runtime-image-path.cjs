// Keep the existing image identity used by the UI and atlases while selecting
// the compressed file served by the normal build.
exports.runtimeImagePath = path => path.replace(/\.png$/, '.webp');
