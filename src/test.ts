import { MovableType } from "./imports/movabletype.js";

const mt = new MovableType({ sqlDb: 'movabletype-2005' });
console.log(await mt.preload());
