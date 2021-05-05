module.exports = function create(opts) {
  const options = { ...opts };

  return function mask(obj) {
    if (!options.enabled) {
      return obj;
    }

    const FieldNamesToMask = options.fields;
    const maskCharacter = options.maskWith ? options.maskWith : '*';

    const target = JSON.parse(JSON.safeStringify(obj));

    function traverseAndMask(target) {
      if (typeof target === 'object') {
        for (const key in target) {
          if (typeof target[key] === 'object') {
            target[key] = traverseAndMask(target[key]);
          } else if (Object.prototype.hasOwnProperty.call(target[key], key)) {
            // ignore
            // modifiedObjects.concat()
          } else if (FieldNamesToMask.indexOf(key) > -1) {
            const value = target[key];
            if (typeof value === 'string' || value instanceof String) {
              target[key] = maskString(value, maskCharacter);
            } else if (typeof value === 'number' || value instanceof Number) {
              target[key] = maskNumber(value, maskCharacter);
            }
          }
        }
      }

      return target;
    }

    return traverseAndMask(target);
  };
};

const digit = /\d/g;
const upperCaseLatin1 = /[A-Za-z]/g;
const notStars = /[^*]/g;

const maskString = (value, maskCharacter) =>
  value
    .replace(digit, maskCharacter)
    .replace(upperCaseLatin1, maskCharacter)
    .replace(notStars, maskCharacter);

const maskNumber = (value, maskCharacter) => {
  if (Number.isNaN(value) || !Number.isFinite(value.valueOf())) {
    return value;
  }
  return value.toString().replace(digit, maskCharacter);
};

JSON.safeStringify = (obj, indent = 2) => {
  let cache = [];
  const retVal = JSON.stringify(
    obj,
    (key, value) =>
      typeof value === 'object' && value !== null
        ? cache.includes(value)
          ? undefined // Duplicate reference found, discard key
          : cache.push(value) && value // Store value in our collection
        : value,
    indent,
  );
  cache = null;
  return retVal;
};
