import {buildConfig} from './build-config.mjs';
import {buildApp} from './build-app.mjs';
export const buildOptions = await buildApp(buildConfig());
