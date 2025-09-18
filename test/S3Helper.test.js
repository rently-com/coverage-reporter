const { GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const S3Helper = require('../src/S3Helper');

describe('S3Helper', function() {
  let s3Helper;
  let mockS3Client;

  beforeEach(function() {
    this.sandbox = sinon.createSandbox();
    
    // Clear environment variables
    delete process.env.AWS_S3_BUCKET;
    delete process.env.BUCKET_NAME;
    delete process.env.FOLDER_NAME;
    delete process.env.AWS_REGION;
    delete process.env.GITHUB_CURR_BRANCH;

    // Create S3Helper instance with test config
    s3Helper = new S3Helper({
      bucketName: 'test-bucket',
      folderName: 'test-folder',
      region: 'us-east-1'
    });

    // Mock S3 client
    mockS3Client = {
      send: this.sandbox.stub()
    };
    s3Helper.s3Client = mockS3Client;
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  describe('constructor', function() {
    it('should use provided config values', function() {
      const helper = new S3Helper({
        bucketName: 'custom-bucket',
        folderName: 'custom-folder',
        region: 'us-west-2'
      });

      expect(helper.bucketName).to.equal('custom-bucket');
      expect(helper.folderName).to.equal('custom-folder');
      expect(helper.region).to.equal('us-west-2');
    });

    it('should fallback to environment variables', function() {
      process.env.AWS_S3_BUCKET = 'env-bucket';
      process.env.FOLDER_NAME = 'env-folder';
      process.env.AWS_REGION = 'env-region';

      const helper = new S3Helper();

      expect(helper.bucketName).to.equal('env-bucket');
      expect(helper.folderName).to.equal('env-folder');
      expect(helper.region).to.equal('env-region');
    });

    it('should handle empty config object', function() {
      const helper = new S3Helper({});
      expect(helper.bucketName).to.be.undefined;
      expect(helper.folderName).to.be.undefined;
      expect(helper.region).to.be.undefined;
    });
  });

  describe('streamToPromise', function() {
    it('should convert stream to string', async function() {
      const mockStream = {
        on: this.sandbox.stub()
      };

      // Mock successful stream processing
      mockStream.on.withArgs('data').callsArgWith(1, Buffer.from('test'));
      mockStream.on.withArgs('end').callsArg(1);

      const result = await s3Helper.streamToPromise(mockStream);
      expect(result).to.equal('test');
    });

    it('should handle stream errors', async function() {
      const mockStream = {
        on: this.sandbox.stub()
      };
      const error = new Error('Stream error');

      // Mock stream error
      mockStream.on.withArgs('error').callsArgWith(1, error);

      try {
        await s3Helper.streamToPromise(mockStream);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).to.equal(error);
      }
    });
  });

  describe('fetch', function() {
    it('should fetch file from S3 successfully', async function() {
      const mockBody = {
        on: this.sandbox.stub()
      };
      mockBody.on.withArgs('data').callsArgWith(1, Buffer.from('{"test":"data"}'));
      mockBody.on.withArgs('end').callsArg(1);

      const mockResponse = { Body: mockBody };
      mockS3Client.send.resolves(mockResponse);

      const result = await s3Helper.fetch('test-file');

      expect(mockS3Client.send.calledOnce).to.be.true;
      const command = mockS3Client.send.firstCall.args[0];
      expect(command).to.be.instanceOf(GetObjectCommand);
      expect(command.input.Bucket).to.equal('test-bucket');
      expect(command.input.Key).to.equal('test-folder/test-file.json');
      expect(result).to.equal('{"test":"data"}');
    });
  });

  describe('upload', function() {
    it('should upload data to S3 successfully', async function() {
      const mockResponse = { ETag: '"mock-etag"' };
      mockS3Client.send.resolves(mockResponse);

      const result = await s3Helper.upload('test-file', '{"test":"data"}');

      expect(mockS3Client.send.calledOnce).to.be.true;
      const command = mockS3Client.send.firstCall.args[0];
      expect(command).to.be.instanceOf(PutObjectCommand);
      expect(command.input.Bucket).to.equal('test-bucket');
      expect(command.input.Key).to.equal('test-folder/test-file.json');
      expect(command.input.Body).to.equal('{"test":"data"}');
      expect(result).to.equal(mockResponse);
    });
  });

  describe('getCoverageJsonFile', function() {
    it('should get and parse coverage JSON file successfully', async function() {
      const mockBody = {
        on: this.sandbox.stub()
      };
      const testData = { backend: 85, frontend: 95 };
      mockBody.on.withArgs('data').callsArgWith(1, Buffer.from(JSON.stringify(testData)));
      mockBody.on.withArgs('end').callsArg(1);

      const mockResponse = { Body: mockBody };
      mockS3Client.send.resolves(mockResponse);

      const result = await s3Helper.getCoverageJsonFile('coverage');

      expect(result).to.deep.equal(testData);
    });

    it('should return empty object when file fetch fails', async function() {
      mockS3Client.send.rejects(new Error('File not found'));

      const result = await s3Helper.getCoverageJsonFile('coverage');

      expect(result).to.deep.equal({});
    });

    it('should return empty object when JSON parsing fails', async function() {
      const mockBody = {
        on: this.sandbox.stub()
      };
      mockBody.on.withArgs('data').callsArgWith(1, Buffer.from('invalid json'));
      mockBody.on.withArgs('end').callsArg(1);

      const mockResponse = { Body: mockBody };
      mockS3Client.send.resolves(mockResponse);

      const result = await s3Helper.getCoverageJsonFile('coverage');

      expect(result).to.deep.equal({});
    });
  });

  describe('putCoverageJsonFile', function() {
    beforeEach(function() {
      process.env.GITHUB_CURR_BRANCH = 'feature-branch';
    });

    it('should upload coverage data successfully', async function() {
      const existingData = { main: { backend: 80, frontend: 90 } };
      const newCoverage = { backend: 85, frontend: 95 };
      const mockResponse = { ETag: '"mock-etag"' };
      
      mockS3Client.send.resolves(mockResponse);

      await s3Helper.putCoverageJsonFile('coverage', existingData, newCoverage);

      expect(mockS3Client.send.calledOnce).to.be.true;
      const command = mockS3Client.send.firstCall.args[0];
      expect(command).to.be.instanceOf(PutObjectCommand);
      
      const uploadedData = JSON.parse(command.input.Body);
      expect(uploadedData).to.deep.equal({
        main: { backend: 80, frontend: 90 },
        'feature-branch': { backend: 85, frontend: 95 }
      });
    });

    it('should throw error when upload fails', async function() {
      const error = new Error('Upload failed');
      mockS3Client.send.rejects(error);

      try {
        await s3Helper.putCoverageJsonFile('coverage', {}, { backend: 85, frontend: 95 });
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).to.equal(error);
      }
    });

    it('should handle empty existing data', async function() {
      const newCoverage = { backend: 85, frontend: 95 };
      const mockResponse = { ETag: '"mock-etag"' };
      
      mockS3Client.send.resolves(mockResponse);

      await s3Helper.putCoverageJsonFile('coverage', {}, newCoverage);

      const command = mockS3Client.send.firstCall.args[0];
      const uploadedData = JSON.parse(command.input.Body);
      expect(uploadedData).to.deep.equal({
        'feature-branch': { backend: 85, frontend: 95 }
      });
    });
  });

  describe('fetch - file extension handling', function() {
    it('should handle files that already have .json extension', async function() {
      const fileName = 'coverage-history.json';
      const mockResponse = {
        Body: {
          on: sinon.stub()
        }
      };
      
      // Mock the stream behavior
      const mockChunks = [Buffer.from('{"test": "data"}')];
      mockResponse.Body.on.withArgs('data').callsArgWith(1, mockChunks[0]);
      mockResponse.Body.on.withArgs('end').callsArg(1);
      
      mockS3Client.send.resolves(mockResponse);

      const result = await s3Helper.fetch(fileName);

      expect(result).to.equal('{"test": "data"}');
      
      // Verify the key doesn't have double .json extension
      const command = mockS3Client.send.firstCall.args[0];
      expect(command.input.Key).to.equal('test-folder/coverage-history.json');
    });

    it('should add .json extension to files without it', async function() {
      const fileName = 'coverage-history';
      const mockResponse = {
        Body: {
          on: sinon.stub()
        }
      };
      
      // Mock the stream behavior
      const mockChunks = [Buffer.from('{"test": "data"}')];
      mockResponse.Body.on.withArgs('data').callsArgWith(1, mockChunks[0]);
      mockResponse.Body.on.withArgs('end').callsArg(1);
      
      mockS3Client.send.resolves(mockResponse);

      const result = await s3Helper.fetch(fileName);

      expect(result).to.equal('{"test": "data"}');
      
      // Verify the key has .json extension added
      const command = mockS3Client.send.firstCall.args[0];
      expect(command.input.Key).to.equal('test-folder/coverage-history.json');
    });
  });
});
