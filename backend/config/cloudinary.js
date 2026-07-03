const cloudinary = require('cloudinary').v2;

async function uploadToCloudinary(buffer, { folder, resourceType = 'image', publicId }) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  return new Promise((resolve, reject) => {
    const options = { folder, resource_type: resourceType };
    if (publicId) options.public_id = resourceType === 'raw' ? `${publicId}.glb` : publicId;

    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      // For raw files, add fl_attachment:false to allow browser to load directly
      if (resourceType === 'raw') {
        result.secure_url = result.secure_url.replace('/upload/', '/upload/fl_attachment:false/');
      }
      resolve(result);
    });
    stream.end(buffer);
  });
}

module.exports = { uploadToCloudinary };