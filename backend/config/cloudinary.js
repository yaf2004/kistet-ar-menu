const cloudinary = require('cloudinary').v2;

function getCloudinary() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary storage is not configured');
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true
  });
  return cloudinary;
}

async function uploadToCloudinary(buffer, { folder, resourceType = 'image', publicId }) {
  const client = getCloudinary();
  return new Promise((resolve, reject) => {
    const options = {
      folder,
      resource_type: resourceType,
      overwrite: false,
      unique_filename: false,
      use_filename: false
    };
    if (publicId) options.public_id = resourceType === 'raw' ? `${publicId}.glb` : publicId;
    const stream = client.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      if (resourceType === 'raw') {
        result.secure_url = result.secure_url.replace('/upload/', '/upload/fl_attachment:false/');
      }
      resolve(result);
    });
    stream.end(buffer);
  });
}

module.exports = { uploadToCloudinary };
