const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

class S3Helper {
  constructor(config = {}) {
    this.bucketName = config.bucketName || process.env.AWS_S3_BUCKET || process.env.BUCKET_NAME;
    this.region = config.region || process.env.AWS_REGION;
    this.folderName = config.folderName || process.env.FOLDER_NAME;
    
    this.s3Client = new S3Client({
      region: this.region,
      ...config.s3Options
    });
  }

  async getCoverageJsonFile(fileName) {
    let coverageJson = {};
    try {
      const response = await this.fetch(fileName);
      coverageJson = JSON.parse(response);
    } catch (err) {
      console.log('Error fetching coverage JSON:', err);
    }
    return coverageJson;
  }

  async putCoverageJsonFile(fileName, coverageJson, coveragePercentage) {
    const data = {
      ...coverageJson,
      [process.env.GITHUB_CURR_BRANCH]: coveragePercentage,
    };

    try {
      await this.upload(fileName, JSON.stringify(data));
      console.log('Coverage JSON file uploaded to S3 successfully');
    } catch (err) {
      console.log('Error uploading coverage JSON:', err);
      throw err;
    }
  }

  async fetch(fileName) {
    // Avoid double .json extension
    const key = fileName.endsWith('.json') ? `${this.folderName}/${fileName}` : `${this.folderName}/${fileName}.json`;
    const params = {
      Bucket: this.bucketName,
      Key: key,
    };
    let response = await this.s3Client.send(new GetObjectCommand(params));
    response = await this.streamToPromise(response.Body);
    return response;
  }

  streamToPromise(stream) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      stream.on('error', reject);
    });
  }

  async upload(fileName, data) {
    // Avoid double .json extension
    const key = fileName.endsWith('.json') ? `${this.folderName}/${fileName}` : `${this.folderName}/${fileName}.json`;
    const params = {
      Bucket: this.bucketName,
      Key: key,
      Body: data,
    };
    return this.s3Client.send(new PutObjectCommand(params));
  }
}

module.exports = S3Helper;
