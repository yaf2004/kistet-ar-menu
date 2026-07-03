const cloudinary = require('cloudinary').v2;

async function uploadToCloudinary(buffer, { folder, resourceType = 'image', publicId }) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  return new Promise((resolve, reject) => {
    const options = { folder, resource_type: resourceType };
    if (publicId) options.public_id = publicId;

    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    stream.end(buffer);
  });
}

module.exports = { uploadToCloudinary };