const crypto = require('crypto')


/**
 * Decrypts cipherText from a decoded Zoom App Context object
 * @param {Buffer} cipherText - Data to decrypt
 * @param {Buffer} hash - sha256 hash of the Client Secret
 * @param {Buffer} iv - Initialization Vector for cipherText
 * @param {Buffer} aad - Additional Auth Data for cipher
 * @param {Buffer} tag - cipherText auth tag
 * @return {JSON|Error} Decrypted JSON obj from cipherText or Error
 */
function decrypt(cipherText, hash, iv, aad, tag) {
    // AES/GCM decryption
    const decipher = crypto
        .createDecipheriv('aes-256-gcm', hash, iv)
        .setAAD(aad)
        .setAuthTag(tag)
        .setAutoPadding(false);

    const update = decipher.update(cipherText, 'hex', 'utf-8');
    const final = decipher.final('utf-8');

    const decrypted = update + final;

    return JSON.parse(decrypted);
}



export const contextHeader = 'x-zoom-app-context';
