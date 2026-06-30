const crypto = require('crypto');

/**
 * Generate RSA key pair for user
 * Returns { publicKey, privateKey } in PEM format
 */
const generateKeyPair = () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  return { publicKey, privateKey };
};

/**
 * Encrypt private key using user's password (AES-256-GCM)
 */
const encryptPrivateKey = (privateKey, password) => {
  const algorithm = 'aes-256-gcm';
  const key = crypto.scryptSync(password, 'salt', 32); // Derive key from password
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Return IV + AuthTag + Encrypted data (all hex encoded)
  return {
    encrypted: iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
};

/**
 * Decrypt private key using user's password
 */
const decryptPrivateKey = (encryptedData, password) => {
  try {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(password, 'salt', 32);
    
    const parts = encryptedData.encrypted.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error('Failed to decrypt private key: ' + error.message);
  }
};

/**
 * Encrypt email content using recipient's public key
 */
const encryptEmailContent = (content, recipientPublicKey) => {
  try {
    // For large content, use hybrid encryption:
    // 1. Generate a random AES key
    // 2. Encrypt content with AES
    // 3. Encrypt AES key with RSA (recipient's public key)
    
    const algorithm = 'aes-256-gcm';
    const aesKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    
    // Encrypt content with AES
    const cipher = crypto.createCipheriv(algorithm, aesKey, iv);
    let encrypted = cipher.update(content, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    
    // Encrypt AES key with RSA
    const encryptedKey = crypto.publicEncrypt(
      {
        key: recipientPublicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      aesKey
    );
    
    // Return: IV + AuthTag + EncryptedKey + EncryptedContent (all hex)
    return {
      encrypted: iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encryptedKey.toString('hex') + ':' + encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      encryptedKey: encryptedKey.toString('hex')
    };
  } catch (error) {
    throw new Error('Failed to encrypt email content: ' + error.message);
  }
};

/**
 * Decrypt email content using user's private key
 */
const decryptEmailContent = (encryptedData, privateKey) => {
  try {
    const algorithm = 'aes-256-gcm';
    
    const parts = encryptedData.encrypted.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedKey = Buffer.from(parts[2], 'hex');
    const encrypted = parts[3];
    
    // Decrypt AES key with RSA
    const aesKey = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      encryptedKey
    );
    
    // Decrypt content with AES
    const decipher = crypto.createDecipheriv(algorithm, aesKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error('Failed to decrypt email content: ' + error.message);
  }
};

/**
 * Encrypt attachment data
 */
const encryptAttachment = (attachmentBuffer, recipientPublicKey) => {
  const content = attachmentBuffer.toString('base64');
  return encryptEmailContent(content, recipientPublicKey);
};

/**
 * Decrypt attachment data
 */
const decryptAttachment = (encryptedData, privateKey) => {
  const decryptedBase64 = decryptEmailContent(encryptedData, privateKey);
  return Buffer.from(decryptedBase64, 'base64');
};

module.exports = {
  generateKeyPair,
  encryptPrivateKey,
  decryptPrivateKey,
  encryptEmailContent,
  decryptEmailContent,
  encryptAttachment,
  decryptAttachment
};

