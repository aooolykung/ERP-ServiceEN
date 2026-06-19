import * as Minio from 'minio';
import dotenv from 'dotenv';

dotenv.config();

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadminpassword',
});

const bucketName = process.env.MINIO_BUCKET_NAME || 'job-images';

// Ensure bucket exists and set public policy
export const initMinio = async () => {
  try {
    const exists = await minioClient.bucketExists(bucketName);
    if (!exists) {
      await minioClient.makeBucket(bucketName, 'us-east-1');
      console.log(`Bucket '${bucketName}' created successfully.`);
    } else {
      console.log(`Bucket '${bucketName}' already exists.`);
    }

    //  ย้ายออกนอก if-else เพื่อให้ตั้งค่า Public Policy ทุกครั้งที่เริ่ม Server
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'PublicRead',
          Effect: 'Allow',
          Principal: '*', //  ปรับเป็นแบบสากลที่ MinIO รองรับได้เสถียรที่สุด
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${bucketName}/*`],
        },
      ],
    };

    await minioClient.setBucketPolicy(bucketName, JSON.stringify(policy));
    console.log(` Public read policy applied to bucket '${bucketName}' successfully.`);

  } catch (err) {
    console.warn('Could not initialize MinIO bucket automatically. Please ensure MinIO is running and bucket is created.');
    console.error(err);
  }
};

/**
 * Upload a file buffer to MinIO and return its public URL
 */
export const uploadImage = async (file) => {
  const objectName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

  await minioClient.putObject(
    bucketName,
    objectName,
    file.buffer,
    file.size,
    { 'Content-Type': file.mimetype }
  );

  // --- แก้ไขตรงนี้ครับ ---
  // ถ้าใน .env ของคุณมี MINIO_PUBLIC_URL ให้ใช้ตัวนั้นเป็นหลัก
  // เพราะนี่คือสิ่งที่ Browser ต้องเข้าถึง
  if (process.env.MINIO_PUBLIC_URL) {
    return `${process.env.MINIO_PUBLIC_URL}/${bucketName}/${objectName}`;
  }

  // กรณีรันในเครื่องตัวเอง (Development)
  //const protocol = process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http';
  //const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
  //const port = process.env.MINIO_PORT || '9000';
  //return `${protocol}://${endpoint}:${port}/${bucketName}/${objectName}`;
};

export { minioClient, bucketName };