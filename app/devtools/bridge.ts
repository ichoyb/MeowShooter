// Part of the local developer tools for testing the game; not part of the game itself. Official release, review and playtest builds leave it out.
import type {DevtoolsController} from './model';
let current:DevtoolsController|null=null;
let listener:((controller:DevtoolsController|null)=>void)|null=null;
export function attach(controller:DevtoolsController):void {current=controller;listener?.(current);}
export function publish():void {listener?.(current);}
export function detach():void {current=null;listener?.(null);}
export function subscribe(next:(controller:DevtoolsController|null)=>void):void {listener=next;if(current)next(current);}
