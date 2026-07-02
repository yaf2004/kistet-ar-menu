const cloudinary = require('cloudinary').v2;

// Configure once from environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload a file buffer directly to Cloudinary.
// resourceType: 'image' for photos, 'raw' for .glb files
// folder: 'ar-menu/dishes' or 'ar-menu/models'
function uploadToCloudinary(buffer, { folder, resourceType = 'image', publicId }) {
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
