"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pick = pick;
function pick(obj, keys) {
    const out = {};
    keys.forEach((k) => {
        if (Object.prototype.hasOwnProperty.call(obj, k))
            out[k] = obj[k];
    });
    return out;
}
